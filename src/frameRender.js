/** Taille de case entière pour éviter les fuites vers la frame voisine. */
export function roundFrameSize(rawW, rawH) {
  return {
    frameW: Math.max(1, Math.round(rawW)),
    frameH: Math.max(1, Math.round(rawH)),
  };
}

/**
 * @param {number} naturalW
 * @param {number} naturalH
 * @param {number} frameCount — utilisé pour horizontal / vertical
 * @param {'horizontal'|'vertical'|'grid'} orientation
 * @param {{ columns?: number, rows?: number }} [grid]
 */
export function computeFrameSize(naturalW, naturalH, frameCount, orientation, grid) {
  if (orientation === 'grid') {
    const columns = Math.max(1, grid?.columns ?? 1);
    const rows = Math.max(1, grid?.rows ?? 1);
    return roundFrameSize(naturalW / columns, naturalH / rows);
  }
  if (orientation === 'horizontal') {
    return roundFrameSize(naturalW / frameCount, naturalH);
  }
  return roundFrameSize(naturalW, naturalH / frameCount);
}

/** Lecture grille : gauche → droite, puis rangée suivante (row-major). */
export function getFrameSourceRect(config, index) {
  const { frameW, frameH, orientation, columns } = config;
  if (orientation === 'grid') {
    const cols = Math.max(1, columns ?? 1);
    const col = index % cols;
    const row = Math.floor(index / cols);
    return {
      sx: col * frameW,
      sy: row * frameH,
      sw: frameW,
      sh: frameH,
    };
  }
  return {
    sx: orientation === 'horizontal' ? index * frameW : 0,
    sy: orientation === 'vertical' ? index * frameH : 0,
    sw: frameW,
    sh: frameH,
  };
}

export function getStoredOffset(offsets, index) {
  const stored = offsets?.[index];
  if (!stored) return { x: 0, y: 0 };
  return {
    x: Number.isFinite(stored.x) ? stored.x : 0,
    y: Number.isFinite(stored.y) ? stored.y : 0,
  };
}

export function hasNonZeroOffset(offsets, index) {
  const { x, y } = getStoredOffset(offsets, index);
  return x !== 0 || y !== 0;
}

export function clampOffset(value, maxAbs) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  const limit = Math.max(0, maxAbs);
  return Math.min(limit, Math.max(-limit, n));
}

export function formatOffsetLabel({ x, y }) {
  const fmt = (n) => {
    if (n > 0) return `+${n}`;
    if (n < 0) return `−${Math.abs(n)}`;
    return `${n}`;
  };
  return `X${fmt(x)} Y${fmt(y)}`;
}

export function nudgeStep(shiftKey) {
  return shiftKey ? 10 : 1;
}

/**
 * Grille de la feuille exportée : une case par frame encore active, même orientation.
 * En grille, on conserve le nombre de colonnes d’origine (réduit s’il reste moins de frames).
 */
export function getExportSheetLayout(orientation, activeCount, columns) {
  const n = Math.max(0, Number(activeCount) || 0);
  if (n === 0) {
    return { columns: 0, rows: 0 };
  }
  if (orientation === 'horizontal') {
    return { columns: n, rows: 1 };
  }
  if (orientation === 'vertical') {
    return { columns: 1, rows: n };
  }
  const cols = Math.max(1, Math.min(Math.max(1, columns ?? 1), n));
  return { columns: cols, rows: Math.ceil(n / cols) };
}

export function toExportFileName(baseName) {
  const safe = String(baseName || 'spritesheet')
    .replace(/[/\\?%*:|"<>]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
  return `${safe || 'spritesheet'}-export.png`;
}

export function downloadCanvasPng(canvas, filename) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Export PNG impossible.'));
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.rel = 'noopener';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1500);
      resolve();
    }, 'image/png');
  });
}

/**
 * Dessine une frame isolée dans `canvas` (taille = case).
 * Ordre : fond → collage à (offsetX, offsetY) → Flip X.
 * Réutilisable pour l’aperçu et l’export PNG.
 */
export function drawIsolatedFrame(canvas, {
  image,
  config,
  frameIndex,
  offsetX = 0,
  offsetY = 0,
  fillColor = null,
  flipX = false,
  isEmpty = false,
}) {
  const w = config.frameW;
  const h = config.frameH;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;

  const paint = (ctx) => {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, w, h);
    if (fillColor) {
      ctx.fillStyle = fillColor;
      ctx.fillRect(0, 0, w, h);
    }
    if (isEmpty || !image) return;

    const { sx, sy, sw, sh } = getFrameSourceRect(config, frameIndex);
    const srcW = Math.min(sw, Math.max(0, image.naturalWidth - sx));
    const srcH = Math.min(sh, Math.max(0, image.naturalHeight - sy));
    if (srcW < 1 || srcH < 1) return;
    ctx.drawImage(image, sx, sy, srcW, srcH, offsetX, offsetY, srcW, srcH);
  };

  const dest = canvas.getContext('2d');
  if (!dest) return;

  if (!flipX) {
    paint(dest);
    return;
  }

  const buffer = document.createElement('canvas');
  buffer.width = w;
  buffer.height = h;
  const bufferCtx = buffer.getContext('2d');
  if (!bufferCtx) return;
  paint(bufferCtx);

  dest.imageSmoothingEnabled = false;
  dest.clearRect(0, 0, w, h);
  dest.save();
  dest.translate(w, 0);
  dest.scale(-1, 1);
  dest.drawImage(buffer, 0, 0);
  dest.restore();
}

/**
 * Assemble une sprite sheet à partir des frames actives.
 * Chaque frame est d’abord dessinée sur un canvas isolé (taille = case)
 * pour qu’un sprite décalé ne déborde pas sur la case voisine.
 * Le `config` d’origine sert à lire les rectangles source ; seuls `activeIndices` sont collés.
 */
export function composeExportedSheet(sheetCanvas, {
  image,
  config,
  activeIndices,
  offsets,
  fillColor = null,
  flipX = false,
  isEmptyIndex,
}) {
  const indices = Array.isArray(activeIndices) ? activeIndices : [];
  const layout = getExportSheetLayout(config.orientation, indices.length, config.columns);
  const { frameW, frameH } = config;
  const sheetW = Math.max(1, layout.columns * frameW);
  const sheetH = Math.max(1, layout.rows * frameH);

  if (sheetCanvas.width !== sheetW) sheetCanvas.width = sheetW;
  if (sheetCanvas.height !== sheetH) sheetCanvas.height = sheetH;

  const dest = sheetCanvas.getContext('2d');
  if (!dest) return layout;

  dest.imageSmoothingEnabled = false;
  dest.clearRect(0, 0, sheetW, sheetH);

  const cols = Math.max(1, layout.columns);
  for (let i = 0; i < indices.length; i += 1) {
    const frameIndex = indices[i];
    const { x, y } = getStoredOffset(offsets, frameIndex);
    const cell = document.createElement('canvas');
    drawIsolatedFrame(cell, {
      image,
      config,
      frameIndex,
      offsetX: x,
      offsetY: y,
      fillColor,
      flipX,
      isEmpty: Boolean(isEmptyIndex?.(frameIndex)),
    });
    const col = i % cols;
    const row = Math.floor(i / cols);
    dest.drawImage(cell, col * frameW, row * frameH);
  }

  const totalCells = layout.columns * layout.rows;
  if (fillColor && totalCells > indices.length) {
    dest.fillStyle = fillColor;
    for (let i = indices.length; i < totalCells; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      dest.fillRect(col * frameW, row * frameH, frameW, frameH);
    }
  }

  return layout;
}
