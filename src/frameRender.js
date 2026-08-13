/** Taille de case entière pour éviter les fuites vers la frame voisine. */
export function roundFrameSize(rawW, rawH) {
  return {
    frameW: Math.max(1, Math.round(rawW)),
    frameH: Math.max(1, Math.round(rawH)),
  };
}

export function computeFrameSize(naturalW, naturalH, frameCount, orientation) {
  if (orientation === 'horizontal') {
    return roundFrameSize(naturalW / frameCount, naturalH);
  }
  return roundFrameSize(naturalW, naturalH / frameCount);
}

export function getFrameSourceRect(config, index) {
  const { frameW, frameH, orientation } = config;
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
