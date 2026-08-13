import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg'];
const FPS_MIN = 1;
const FPS_MAX = 30;
const DEFAULT_FPS = 12;
const FRAMES_PER_IMAGE_MIN = 1;
const FRAMES_PER_IMAGE_MAX = 999;

/** Durée réelle = (frames / fps) secondes. */
function durationMsFromFramesAndFps(frames, fps) {
  return (frames / fps) * 1000;
}

function formatSecondsPerImage(frames, fps) {
  return (frames / fps).toFixed(2);
}

function isImageFile(file) {
  if (!file) return false;
  if (ACCEPTED_TYPES.includes(file.type)) return true;
  return /\.(png|jpe?g)$/i.test(file.name);
}

function getFrameLabel(index, config, hasEmptyTail) {
  if (hasEmptyTail && index >= config.frames) return 'Image vide';
  return `Image ${index + 1}`;
}

function isExcludedIndex(excludedFrames, index) {
  return Boolean(excludedFrames?.[index]);
}

/** Prochaine image active en boucle (saute les indices retirés). */
function findNextActiveIndex(fromIndex, count, excludedFrames) {
  if (count <= 0) return 0;
  for (let step = 1; step <= count; step += 1) {
    const next = (fromIndex + step) % count;
    if (!isExcludedIndex(excludedFrames, next)) return next;
  }
  return fromIndex;
}

function findFirstActiveIndex(count, excludedFrames) {
  for (let i = 0; i < count; i += 1) {
    if (!isExcludedIndex(excludedFrames, i)) return i;
  }
  return 0;
}

function findLastActiveIndex(count, excludedFrames) {
  for (let i = count - 1; i >= 0; i -= 1) {
    if (!isExcludedIndex(excludedFrames, i)) return i;
  }
  return Math.max(0, count - 1);
}

/** Orientation alignée sur le côté le plus long de l'image. */
function detectOrientationFromSize(width, height) {
  if (width > height) return 'horizontal';
  return 'vertical';
}

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function IconEyedropper() {
  return (
    <svg
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="m17 3-1.5 1.5" />
      <path d="M5 19l2-7.5L17 1.5l4.5 4.5L9.5 21z" />
      <path d="M5 19 2 22" />
    </svg>
  );
}

function IconTransparent() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden>
      <rect x="3" y="3" width="8" height="8" fill="currentColor" opacity="0.35" />
      <rect x="13" y="3" width="8" height="8" fill="currentColor" opacity="0.55" />
      <rect x="3" y="13" width="8" height="8" fill="currentColor" opacity="0.55" />
      <rect x="13" y="13" width="8" height="8" fill="currentColor" opacity="0.35" />
      <path
        d="M4 4l16 16"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTransportStart() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
      <rect x="5" y="6" width="2" height="12" fill="currentColor" />
      <path d="M17 6L11 12l6 6V6z" fill="currentColor" />
      <path d="M13 6L7 12l6 6V6z" fill="currentColor" />
    </svg>
  );
}

function IconTransportPrev() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
      <rect x="5" y="6" width="2" height="12" fill="currentColor" />
      <path d="M17 6L11 12l6 6V6z" fill="currentColor" />
    </svg>
  );
}

function IconTransportPlay() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
      <path d="M8 6l10 6-10 6V6z" fill="currentColor" />
    </svg>
  );
}

function IconTransportPause() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
      <rect x="7" y="6" width="3.5" height="12" fill="currentColor" />
      <rect x="13.5" y="6" width="3.5" height="12" fill="currentColor" />
    </svg>
  );
}

function IconTransportNext() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
      <path d="M7 6l6 6-6 6V6z" fill="currentColor" />
      <rect x="17" y="6" width="2" height="12" fill="currentColor" />
    </svg>
  );
}

function IconTransportEnd() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
      <path d="M7 6l6 6-6 6V6z" fill="currentColor" />
      <path d="M11 6l6 6-6 6V6z" fill="currentColor" />
      <rect x="17" y="6" width="2" height="12" fill="currentColor" />
    </svg>
  );
}

function IconSpriteSheet() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="4" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="3" y="13" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
      <rect x="14" y="13" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function IconSpeed() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 20a8 8 0 1 0-8-8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M12 12l4.2-4.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </svg>
  );
}

function IconFlipX() {
  return (
    <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v18"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="2.5 2.5"
      />
      <path
        d="M8 8H5.5A1.5 1.5 0 0 0 4 9.5v5A1.5 1.5 0 0 0 5.5 16H8"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M16 8h2.5A1.5 1.5 0 0 1 20 9.5v5a1.5 1.5 0 0 1-1.5 1.5H16"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M8 12H3m5 0-2-2m2 2-2 2M16 12h5m-5 0 2-2m-2 2 2 2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SectionTitle({ icon, children }) {
  return (
    <div className="mb-4">
      <h2 className="m-0 flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.14em] text-primary">
        {icon}
        <span>{children}</span>
      </h2>
      <hr className="sp-section-hr" />
    </div>
  );
}

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-45';

const btnPrimary = cx(
  btnBase,
  'border-transparent bg-[linear-gradient(135deg,#fbbd2e_0%,#ffcb00_48%,#ea9f0e_100%)] text-primary-foreground shadow-[var(--shadow-glow)] hover:brightness-105'
);

const btnSecondary = cx(
  btnBase,
  'border-border bg-transparent text-foreground hover:border-primary/50 hover:bg-muted'
);

const btnIcon = 'min-w-9 px-0 py-2';

const inputBase =
  'w-full rounded-xl border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30';

/**
 * Lecteur de sprite sheet en boucle (style GIF), sans backend.
 */
export default function SpritePlayer() {
  const [imageSrc, setImageSrc] = useState(null);
  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [orientation, setOrientation] = useState('vertical');
  const [framesInput, setFramesInput] = useState('6');
  const [fps, setFps] = useState(DEFAULT_FPS);
  const [framesPerImage, setFramesPerImage] = useState(1);
  const [config, setConfig] = useState(null);
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [appendEmptyFrame, setAppendEmptyFrame] = useState(false);
  const [emptyFrameUseBgColor, setEmptyFrameUseBgColor] = useState(false);
  const [emptyFrameBgColor, setEmptyFrameBgColor] = useState('#000000');
  const [framesPerImageOverrides, setFramesPerImageOverrides] = useState({});
  /** Indices exclus de la boucle de lecture (soft-disable). */
  const [excludedFrames, setExcludedFrames] = useState({});
  const [flipX, setFlipX] = useState(false);
  const [error, setError] = useState('');
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef(null);
  const timelineActiveTickRef = useRef(null);

  const loadImageFile = useCallback((file) => {
    if (!isImageFile(file)) {
      setError('Format non pris en charge. Utilisez un PNG ou JPEG.');
      return;
    }
    setError('');
    setConfig(null);
    setFrameIndex(0);
    setIsPaused(false);
    setFramesPerImageOverrides({});
    setExcludedFrames({});
    setFlipX(false);
    setEmptyFrameUseBgColor(false);
    setEmptyFrameBgColor('#000000');
    setNaturalSize({ w: 0, h: 0 });

    const reader = new FileReader();
    reader.onload = () => {
      setImageSrc(reader.result);
    };
    reader.onerror = () => {
      setError('Lecture du fichier impossible.');
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileChange = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (file) loadImageFile(file);
      e.target.value = '';
    },
    [loadImageFile]
  );

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current += 1;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      dragCounterRef.current = 0;
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) loadImageFile(file);
    },
    [loadImageFile]
  );

  const handleImageLoad = useCallback((e) => {
    const { naturalWidth, naturalHeight } = e.currentTarget;
    setNaturalSize({ w: naturalWidth, h: naturalHeight });
    setOrientation(detectOrientationFromSize(naturalWidth, naturalHeight));
  }, []);

  const handleValidate = useCallback(() => {
    setError('');
    if (!imageSrc || naturalSize.w === 0) {
      setError('Chargez une image et attendez le chargement.');
      return;
    }
    const n = parseInt(String(framesInput).trim(), 10);
    if (!Number.isFinite(n) || n < 1) {
      setError('Indiquez un nombre de frames ≥ 1.');
      return;
    }

    let frameW;
    let frameH;
    if (orientation === 'horizontal') {
      frameW = naturalSize.w / n;
      frameH = naturalSize.h;
    } else {
      frameW = naturalSize.w;
      frameH = naturalSize.h / n;
    }

    if (!Number.isFinite(frameW) || !Number.isFinite(frameH) || frameW < 1 || frameH < 1) {
      setError('Dimensions de frame invalides.');
      return;
    }

    setConfig({
      frames: n,
      frameW,
      frameH,
      orientation,
      fullW: naturalSize.w,
      fullH: naturalSize.h,
    });
    setFrameIndex(0);
    setIsPaused(false);
    setFramesPerImageOverrides({});
    setExcludedFrames({});
  }, [imageSrc, naturalSize, framesInput, orientation]);

  const playbackFrameCount = config
    ? config.frames + (appendEmptyFrame ? 1 : 0)
    : 0;

  const isEmptyFrame =
    Boolean(config) && appendEmptyFrame && frameIndex >= config.frames;

  const isCurrentExcluded = isExcludedIndex(excludedFrames, frameIndex);

  const activeFrameIndices = useMemo(() => {
    if (playbackFrameCount === 0) return [];
    return Array.from({ length: playbackFrameCount }, (_, index) => index).filter(
      (index) => !isExcludedIndex(excludedFrames, index)
    );
  }, [playbackFrameCount, excludedFrames]);

  const activePlaybackCount = activeFrameIndices.length;
  const activePosition = activeFrameIndices.indexOf(frameIndex);

  const excludedEntries = useMemo(() => {
    if (!config || playbackFrameCount === 0) return [];
    return Object.keys(excludedFrames)
      .map((key) => Number(key))
      .filter(
        (index) =>
          Number.isFinite(index) &&
          index >= 0 &&
          index < playbackFrameCount &&
          isExcludedIndex(excludedFrames, index)
      )
      .sort((a, b) => a - b);
  }, [excludedFrames, config, playbackFrameCount]);

  const goPrevFrame = useCallback(() => {
    if (!config || playbackFrameCount === 0) return;
    setFrameIndex((i) => (i - 1 + playbackFrameCount) % playbackFrameCount);
  }, [config, playbackFrameCount]);

  const goNextFrame = useCallback(() => {
    if (!config || playbackFrameCount === 0) return;
    setFrameIndex((i) => (i + 1) % playbackFrameCount);
  }, [config, playbackFrameCount]);

  const handleAppendEmptyFrameChange = useCallback(
    (e) => {
      const checked = e.target.checked;
      setAppendEmptyFrame(checked);
      if (!checked && config) {
        if (frameIndex >= config.frames) {
          setFrameIndex(config.frames - 1);
        }
        setFramesPerImageOverrides((prev) => {
          const next = { ...prev };
          delete next[config.frames];
          return next;
        });
        setExcludedFrames((prev) => {
          if (!isExcludedIndex(prev, config.frames)) return prev;
          const next = { ...prev };
          delete next[config.frames];
          return next;
        });
      }
    },
    [config, frameIndex]
  );

  const goToStart = useCallback(() => {
    if (!config || playbackFrameCount === 0) return;
    setFrameIndex(findFirstActiveIndex(playbackFrameCount, excludedFrames));
  }, [config, playbackFrameCount, excludedFrames]);

  const goToEnd = useCallback(() => {
    if (!config || playbackFrameCount === 0) return;
    setFrameIndex(findLastActiveIndex(playbackFrameCount, excludedFrames));
  }, [config, playbackFrameCount, excludedFrames]);

  const togglePause = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  const getEffectiveFramesPerImage = useCallback(
    (index) => framesPerImageOverrides[index] ?? framesPerImage,
    [framesPerImageOverrides, framesPerImage]
  );

  const getEffectiveDurationMs = useCallback(
    (index) => durationMsFromFramesAndFps(getEffectiveFramesPerImage(index), fps),
    [getEffectiveFramesPerImage, fps]
  );

  const currentFramesPerImage = getEffectiveFramesPerImage(frameIndex);
  const currentDurationSec = formatSecondsPerImage(currentFramesPerImage, fps);

  const handleFpsChange = useCallback((e) => {
    setFps(Number(e.target.value));
  }, []);

  const parseFramesPerImage = useCallback((raw) => {
    const n = parseInt(String(raw).trim(), 10);
    if (!Number.isFinite(n) || n < FRAMES_PER_IMAGE_MIN) return null;
    return Math.min(n, FRAMES_PER_IMAGE_MAX);
  }, []);

  const handleFramesPerImageChange = useCallback(
    (e) => {
      const value = parseFramesPerImage(e.target.value);
      if (value !== null) setFramesPerImage(value);
    },
    [parseFramesPerImage]
  );

  const handleFrameFramesPerImageOverrideChange = useCallback(
    (e) => {
      const value = parseFramesPerImage(e.target.value);
      if (value === null) return;
      setFramesPerImageOverrides((prev) => {
        const next = { ...prev };
        if (value === framesPerImage) {
          delete next[frameIndex];
        } else {
          next[frameIndex] = value;
        }
        return next;
      });
    },
    [frameIndex, framesPerImage, parseFramesPerImage]
  );

  const resetAllFramesPerImageOverrides = useCallback(() => {
    setFramesPerImageOverrides({});
  }, []);

  const canExcludeCurrentFrame =
    Boolean(config) &&
    playbackFrameCount > 0 &&
    (isCurrentExcluded || activePlaybackCount > 1);

  const toggleCurrentFrameExcluded = useCallback(() => {
    if (!config || playbackFrameCount === 0) return;

    if (isExcludedIndex(excludedFrames, frameIndex)) {
      setExcludedFrames((prev) => {
        const next = { ...prev };
        delete next[frameIndex];
        return next;
      });
      return;
    }

    if (activePlaybackCount <= 1) return;

    const nextExcluded = { ...excludedFrames, [frameIndex]: true };
    setExcludedFrames(nextExcluded);
    setFrameIndex(findNextActiveIndex(frameIndex, playbackFrameCount, nextExcluded));
  }, [
    config,
    playbackFrameCount,
    excludedFrames,
    frameIndex,
    activePlaybackCount,
  ]);

  const restoreAllExcludedFrames = useCallback(() => {
    setExcludedFrames({});
  }, []);

  const goToFrameAndPause = useCallback((index) => {
    setFrameIndex(index);
    setIsPaused(true);
  }, []);

  const toggleFlipX = useCallback(() => {
    setFlipX((prev) => !prev);
  }, []);

  const overrideEntries = useMemo(() => {
    if (!config) return [];
    return Object.entries(framesPerImageOverrides)
      .map(([key, frameCount]) => ({
        index: Number(key),
        frameCount,
      }))
      .filter(
        (entry) =>
          Number.isFinite(entry.index) &&
          entry.index >= 0 &&
          entry.index < playbackFrameCount
      )
      .sort((a, b) => a.index - b.index);
  }, [framesPerImageOverrides, config, playbackFrameCount]);

  useEffect(() => {
    if (!config || isPaused || playbackFrameCount === 0) return;
    if (activePlaybackCount === 0) return;

    if (isExcludedIndex(excludedFrames, frameIndex)) {
      setFrameIndex(findNextActiveIndex(frameIndex, playbackFrameCount, excludedFrames));
      return;
    }

    const delayMs = getEffectiveDurationMs(frameIndex);
    const id = window.setTimeout(() => {
      setFrameIndex((i) => findNextActiveIndex(i, playbackFrameCount, excludedFrames));
    }, delayMs);

    return () => window.clearTimeout(id);
  }, [
    frameIndex,
    fps,
    framesPerImage,
    framesPerImageOverrides,
    excludedFrames,
    config,
    isPaused,
    playbackFrameCount,
    activePlaybackCount,
    getEffectiveDurationMs,
  ]);

  useEffect(() => {
    if (!config || !isPaused) return;

    const onKeyDown = (e) => {
      const tag = e.target?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        e.target?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrevFrame();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNextFrame();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [config, isPaused, goPrevFrame, goNextFrame]);

  useEffect(() => {
    if (!config) return;
    timelineActiveTickRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'nearest',
      block: 'nearest',
    });
  }, [config, frameIndex]);

  const backgroundPosition = useMemo(() => {
    if (!config || isEmptyFrame) return '0 0';
    if (config.orientation === 'horizontal') {
      return `${-(frameIndex * config.frameW)}px 0`;
    }
    return `0 ${-(frameIndex * config.frameH)}px`;
  }, [config, frameIndex, isEmptyFrame]);

  const frameBoxStyle = useMemo(() => {
    if (!config) return undefined;
    return {
      width: `${config.frameW}px`,
      height: `${config.frameH}px`,
    };
  }, [config]);

  const emptyFrameStyle = useMemo(() => {
    if (!frameBoxStyle) return undefined;
    if (!emptyFrameUseBgColor) return frameBoxStyle;
    return {
      ...frameBoxStyle,
      backgroundColor: emptyFrameBgColor,
    };
  }, [frameBoxStyle, emptyFrameUseBgColor, emptyFrameBgColor]);

  const handleEmptyFrameBgColorChange = useCallback((e) => {
    setEmptyFrameBgColor(e.target.value);
    setEmptyFrameUseBgColor(true);
  }, []);

  const handleEmptyFrameEyedropper = useCallback(async () => {
    if (!window.EyeDropper) {
      setError('La pipette n’est pas prise en charge par ce navigateur (Chrome ou Edge recommandé).');
      return;
    }
    try {
      const dropper = new window.EyeDropper();
      const { sRGBHex } = await dropper.open();
      setEmptyFrameBgColor(sRGBHex);
      setEmptyFrameUseBgColor(true);
      setError('');
    } catch {
      /* annulation par l’utilisateur */
    }
  }, []);

  const flipTransformStyle = useMemo(
    () => (flipX ? { transform: 'scaleX(-1)' } : undefined),
    [flipX]
  );

  const previewStyle = useMemo(() => {
    if (!imageSrc || !config || isEmptyFrame) return undefined;
    return {
      ...frameBoxStyle,
      backgroundImage: `url(${imageSrc})`,
      backgroundSize: `${config.fullW}px ${config.fullH}px`,
      backgroundPosition,
      backgroundRepeat: 'no-repeat',
      ...flipTransformStyle,
    };
  }, [imageSrc, config, isEmptyFrame, frameBoxStyle, backgroundPosition, flipTransformStyle]);

  const emptyFramePreviewStyle = useMemo(() => {
    if (!emptyFrameStyle) return undefined;
    return {
      ...emptyFrameStyle,
      ...flipTransformStyle,
    };
  }, [emptyFrameStyle, flipTransformStyle]);

  return (
    <div
      className="mx-auto box-border min-h-screen max-w-[960px] px-5 py-6 pb-8 text-foreground sm:px-6"
      role="region"
      aria-label="Lecteur de sprite sheet"
    >
      <header className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          SpritePlayer
        </h1>
        <p className="m-0 text-sm text-muted-foreground">
          Aperçu en boucle d&apos;une feuille de sprites (PNG / JPEG)
        </p>
      </header>

      {error && (
        <p
          className="mb-4 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-sm text-danger"
          role="alert"
        >
          {error}
        </p>
      )}

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <section className="sp-panel p-5 sm:p-6">
          <SectionTitle icon={<IconSpriteSheet />}>Feuille de sprites</SectionTitle>

          <div className="mb-4 grid gap-4 sm:grid-cols-[1.2fr_0.8fr]">
            <fieldset className="min-w-0 border-0 p-0">
              <legend className="mb-2 text-sm font-medium text-muted-foreground">Orientation</legend>
              <div className="flex flex-wrap gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    name="sprite-orientation"
                    value="horizontal"
                    checked={orientation === 'horizontal'}
                    onChange={() => setOrientation('horizontal')}
                    className="accent-primary"
                  />
                  <span>Horizontale ➡️</span>
                </label>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input
                    type="radio"
                    name="sprite-orientation"
                    value="vertical"
                    checked={orientation === 'vertical'}
                    onChange={() => setOrientation('vertical')}
                    className="accent-primary"
                  />
                  <span>Verticale ⬇️</span>
                </label>
              </div>
            </fieldset>

            <label className="flex min-w-0 flex-col gap-1.5">
              <span className="text-sm font-medium text-muted-foreground">Nombre d&apos;images</span>
              <input
                type="number"
                min={1}
                step={1}
                className={inputBase}
                value={framesInput}
                onChange={(e) => setFramesInput(e.target.value)}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={cx(btnPrimary, 'w-full sm:w-auto')} onClick={handleValidate}>
              Valider &amp; Lancer
            </button>
            <button
              type="button"
              className={cx(
                btnSecondary,
                flipX && 'border-primary bg-muted text-primary'
              )}
              onClick={toggleFlipX}
              disabled={!imageSrc}
              aria-pressed={flipX}
              title="Inverser horizontalement (scaleX -1)"
              aria-label="Inverser horizontalement"
            >
              <IconFlipX />
              Flip X
            </button>
          </div>
        </section>

        <section className="sp-panel p-5 sm:p-6">
          <SectionTitle icon={<IconSpeed />}>Vitesse</SectionTitle>
          <div className="mb-3 grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5">
            <span className="text-sm font-medium text-muted-foreground">
              FPS : <strong className="font-bold tabular-nums text-primary">{fps}</strong>
            </span>
            <span className="text-sm font-medium text-muted-foreground">Frame Time</span>
            <input
              type="range"
              min={FPS_MIN}
              max={FPS_MAX}
              step={1}
              value={fps}
              onChange={handleFpsChange}
              className="sp-range col-start-1"
              aria-label="Images par seconde"
            />
            <div className="col-start-2 row-start-2 flex items-center gap-2">
              <input
                type="number"
                min={FRAMES_PER_IMAGE_MIN}
                max={FRAMES_PER_IMAGE_MAX}
                step={1}
                className={cx(inputBase, 'w-20')}
                value={framesPerImage}
                onChange={handleFramesPerImageChange}
                aria-label="Temps par image en nombre de frames pour toutes les images"
              />
              <span className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
                ={formatSecondsPerImage(framesPerImage, fps)}s
              </span>
            </div>
            <div className="col-span-1 flex justify-between text-[0.7rem] text-muted-foreground" aria-hidden>
              <span>{FPS_MIN}</span>
              <span>{FPS_MAX}</span>
            </div>
          </div>
          <label
            className={cx(
              'mb-2 flex items-center gap-2 text-sm text-foreground',
              !config ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
            )}
          >
            <input
              type="checkbox"
              checked={appendEmptyFrame}
              onChange={handleAppendEmptyFrameChange}
              disabled={!config}
              className="accent-primary"
            />
            <span>Image vide en fin d&apos;animation</span>
          </label>
          {appendEmptyFrame && (
            <div className="ml-1 border-l border-border pl-3">
              <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={emptyFrameUseBgColor}
                  onChange={(e) => setEmptyFrameUseBgColor(e.target.checked)}
                  className="accent-primary"
                />
                <span>Couleur de fond personnalisée</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={emptyFrameBgColor}
                  onChange={handleEmptyFrameBgColorChange}
                  className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-input p-1 disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={!emptyFrameUseBgColor}
                  aria-label="Couleur de fond de l’image vide"
                />
                <button
                  type="button"
                  className={cx(btnSecondary, btnIcon)}
                  onClick={handleEmptyFrameEyedropper}
                  disabled={!emptyFrameUseBgColor}
                  title="Pipette : prélever une couleur à l’écran"
                  aria-label="Pipette : prélever une couleur à l’écran"
                >
                  <IconEyedropper />
                </button>
                <button
                  type="button"
                  className={cx(btnSecondary, btnIcon)}
                  onClick={() => setEmptyFrameUseBgColor(false)}
                  disabled={!emptyFrameUseBgColor}
                  title="Fond transparent"
                  aria-label="Fond transparent"
                >
                  <IconTransparent />
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <section
        className="sp-panel mb-4 overflow-hidden"
        aria-label="Aperçu animation"
      >
        <div
          className={cx(
            'relative flex min-h-[220px] cursor-pointer items-center justify-center p-5 transition-[background,box-shadow]',
            'bg-preview',
            !imageSrc && 'rounded-xl border-2 border-dashed border-border bg-background hover:border-primary/40 hover:bg-muted/40',
            isDragging && 'bg-primary/10 shadow-[inset_0_0_0_2px_var(--color-primary)]'
          )}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          aria-label="Zone d’aperçu : glissez une image PNG ou JPEG, ou appuyez pour parcourir"
        >
          {isDragging && (
            <div
              className="pointer-events-none absolute inset-0 z-2 flex items-center justify-center bg-primary/15 text-sm font-semibold text-foreground"
              aria-hidden
            >
              Relâchez pour importer
            </div>
          )}
          {config && (
            <p className="pointer-events-none absolute top-2 right-2.5 m-0 rounded bg-background/75 px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
              {Math.round(config.frameW)} × {Math.round(config.frameH)} px
            </p>
          )}
          {config && frameBoxStyle ? (
            isEmptyFrame ? (
              <div
                className="sp-pixel shrink-0"
                style={emptyFramePreviewStyle}
                aria-label="Image vide"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                className="sp-pixel shrink-0"
                style={previewStyle}
                onClick={(e) => e.stopPropagation()}
              />
            )
          ) : imageSrc ? (
            <>
              <img
                src={imageSrc}
                alt="Feuille de sprites importée"
                className="sp-pixel max-h-[min(360px,50vh)] max-w-full object-contain"
                style={flipTransformStyle}
                onClick={(e) => e.stopPropagation()}
              />
              <p className="absolute inset-x-4 bottom-10 m-0 rounded-lg px-3 py-2 text-center text-sm text-foreground/90 [background:#3d3d3d85]">
                Configurez les frames puis cliquez sur « Valider & Lancer ».
                <span className="mt-1 block text-xs text-muted-foreground">
                  Glissez une autre image pour remplacer
                </span>
              </p>
            </>
          ) : (
            <div className="text-center">
              <p className="m-0 text-base font-semibold text-foreground">
                {isDragging ? 'Relâchez pour importer' : 'Glissez une image ici'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">PNG ou JPEG</p>
              <button
                type="button"
                className={cx(btnPrimary, 'mt-4')}
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
              >
                Parcourir…
              </button>
            </div>
          )}
          {naturalSize.w > 0 && (
            <p className="pointer-events-none absolute right-2.5 bottom-2 m-0 rounded bg-background/75 px-1.5 py-0.5 text-xs tabular-nums text-muted-foreground">
              {naturalSize.w} × {naturalSize.h} px
            </p>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,.png,.jpg,.jpeg"
            className="sr-only"
            onChange={handleFileChange}
            tabIndex={-1}
            aria-hidden
          />
        </div>
        {config && (
          <nav
            className="border-t border-border bg-timeline px-3 py-2.5"
            aria-label="Timeline des images"
          >
            <div
              className="flex flex-nowrap justify-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:thin]"
              role="list"
            >
              {Array.from({ length: playbackFrameCount }, (_, index) => {
                const isActive = index === frameIndex;
                const isEmptyTick = appendEmptyFrame && index >= config.frames;
                const hasOverride = framesPerImageOverrides[index] != null;
                const isExcluded = isExcludedIndex(excludedFrames, index);
                const label = isEmptyTick ? 'V' : String(index + 1);
                const fullLabel = getFrameLabel(index, config, appendEmptyFrame);

                return (
                  <button
                    key={index}
                    type="button"
                    role="listitem"
                    ref={isActive ? timelineActiveTickRef : null}
                    className={cx(
                      'relative inline-flex size-8 shrink-0 items-center justify-center overflow-hidden rounded border text-xs font-semibold tabular-nums transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      isActive
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-muted text-muted-foreground hover:border-primary/40 hover:bg-muted/80 hover:text-foreground',
                      isEmptyTick && !isActive && 'border-dashed',
                      isExcluded && !isActive && 'opacity-45',
                      isExcluded && isActive && 'opacity-80',
                      !isPaused && 'cursor-not-allowed opacity-70',
                      !isPaused && isActive && 'opacity-100'
                    )}
                    disabled={!isPaused}
                    aria-current={isActive ? 'true' : undefined}
                    aria-label={
                      isPaused
                        ? `Aller à ${fullLabel}${isExcluded ? ' (retirée)' : ''}`
                        : `${fullLabel}${isActive ? ' (en lecture)' : ''}${isExcluded ? ' (retirée)' : ''}`
                    }
                    title={
                      isPaused
                        ? isExcluded
                          ? `${fullLabel} — retirée de l’animation`
                          : `Afficher ${fullLabel}`
                        : 'Mettez en pause pour sélectionner une image'
                    }
                    onClick={() => goToFrameAndPause(index)}
                  >
                    <span className="pointer-events-none">{label}</span>
                    {isExcluded && (
                      <span
                        className="pointer-events-none absolute inset-0"
                        aria-hidden
                      >
                        <svg
                          className="absolute inset-0 size-full"
                          viewBox="0 0 32 32"
                          preserveAspectRatio="none"
                        >
                          <line
                            x1="6"
                            y1="26"
                            x2="26"
                            y2="6"
                            stroke="currentColor"
                            strokeWidth="2.25"
                            strokeLinecap="round"
                            opacity="0.9"
                          />
                        </svg>
                      </span>
                    )}
                    {hasOverride && (
                      <span
                        className={cx(
                          'absolute top-[3px] right-[3px] size-[5px] rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.35)]',
                          isActive ? 'bg-primary-foreground' : 'bg-primary'
                        )}
                        aria-hidden
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        )}
        {config && (
          <div
            className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-transport px-4 py-2.5"
            role="toolbar"
            aria-label="Contrôles de lecture"
          >
            <div className="flex min-w-[min(100%,220px)] flex-1 flex-wrap items-end gap-x-5 gap-y-2.5">
              <span
                className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-xs font-medium tabular-nums text-muted-foreground"
                aria-live="polite"
              >
                {isCurrentExcluded
                  ? `${getFrameLabel(frameIndex, config, appendEmptyFrame)} · retirée`
                  : isEmptyFrame
                    ? `Vide · ${activePosition + 1} / ${activePlaybackCount}`
                    : `Image ${activePosition + 1} / ${activePlaybackCount}`}
                {isPaused ? ' · en pause' : ''}
              </span>
              {isPaused && (
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  <span>
                    Frame Time :{' '}
                    <strong className="font-bold tabular-nums text-primary">
                      {currentFramesPerImage} frame{currentFramesPerImage > 1 ? 's' : ''}
                    </strong>{' '}
                    <span className="text-muted-foreground">({currentDurationSec} s)</span>
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className={cx(
                        btnBase,
                        'min-w-[1.8rem] border-border bg-muted px-0 py-1 text-foreground hover:border-primary/50 hover:bg-muted/80'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        const value = Math.max(FRAMES_PER_IMAGE_MIN, currentFramesPerImage - 1);
                        handleFrameFramesPerImageOverrideChange({ target: { value } });
                      }}
                      aria-label="Diminuer Frame Time"
                    >
                      –
                    </button>
                    <input
                      type="number"
                      min={FRAMES_PER_IMAGE_MIN}
                      max={FRAMES_PER_IMAGE_MAX}
                      step={1}
                      value={currentFramesPerImage}
                      onChange={handleFrameFramesPerImageOverrideChange}
                      onClick={(e) => e.stopPropagation()}
                      className={cx(inputBase, 'w-[3.2rem] py-1 text-center')}
                      aria-label={`Temps par image en frames de ${getFrameLabel(frameIndex, config, appendEmptyFrame)}`}
                    />
                    <button
                      type="button"
                      className={cx(
                        btnBase,
                        'min-w-[1.8rem] border-border bg-muted px-0 py-1 text-foreground hover:border-primary/50 hover:bg-muted/80'
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        const value = Math.min(FRAMES_PER_IMAGE_MAX, currentFramesPerImage + 1);
                        handleFrameFramesPerImageOverrideChange({ target: { value } });
                      }}
                      aria-label="Augmenter Frame Time"
                    >
                      +
                    </button>
                  </div>
                </label>
              )}
              {isPaused && (
                <button
                  type="button"
                  className={cx(
                    btnSecondary,
                    'text-xs',
                    isCurrentExcluded && 'border-primary/50 text-primary'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCurrentFrameExcluded();
                  }}
                  disabled={!canExcludeCurrentFrame}
                  title={
                    isCurrentExcluded
                      ? 'Remettre cette image dans la boucle'
                      : canExcludeCurrentFrame
                        ? 'Retirer cette image de la boucle (sans modifier la feuille)'
                        : 'Impossible de retirer la dernière image active'
                  }
                  aria-pressed={isCurrentExcluded}
                  aria-label={
                    isCurrentExcluded
                      ? 'Remettre dans l’animation'
                      : 'Retirer de l’animation'
                  }
                >
                  {isCurrentExcluded ? 'Remettre dans l’animation' : 'Retirer de l’animation'}
                </button>
              )}
            </div>
            <div className="flex overflow-hidden rounded-full border border-border bg-muted">
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center text-foreground transition-colors hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={goToStart}
                title="Première image"
                aria-label="Première image"
              >
                <IconTransportStart />
              </button>
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center text-foreground transition-colors hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={goPrevFrame}
                title="Image précédente"
                aria-label="Image précédente"
              >
                <IconTransportPrev />
              </button>
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center bg-primary text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={togglePause}
                aria-pressed={!isPaused}
                title={isPaused ? 'Lecture' : 'Pause'}
                aria-label={isPaused ? 'Lecture' : 'Pause'}
              >
                {isPaused ? <IconTransportPlay /> : <IconTransportPause />}
              </button>
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center text-foreground transition-colors hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={goNextFrame}
                title="Image suivante"
                aria-label="Image suivante"
              >
                <IconTransportNext />
              </button>
              <button
                type="button"
                className="inline-flex size-10 items-center justify-center text-foreground transition-colors hover:bg-primary/15 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                onClick={goToEnd}
                title="Dernière image"
                aria-label="Dernière image"
              >
                <IconTransportEnd />
              </button>
            </div>
          </div>
        )}
      </section>

      {config && excludedEntries.length > 0 && (
        <section
          className="sp-panel mb-4 p-5 sm:p-6"
          aria-label="Images retirées de l’animation"
        >
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.14em] text-primary">
            Images retirées
          </h2>
          <ul className="m-0 mb-3 flex list-none flex-wrap gap-2 p-0">
            {excludedEntries.map((index) => (
              <li key={index}>
                <button
                  type="button"
                  className={cx(
                    'relative inline-flex items-center gap-2 overflow-hidden rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    frameIndex === index && isPaused
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-muted text-foreground hover:border-primary/40'
                  )}
                  onClick={() => goToFrameAndPause(index)}
                  title={`Afficher ${getFrameLabel(index, config, appendEmptyFrame)} et mettre en pause`}
                >
                  <span>{getFrameLabel(index, config, appendEmptyFrame)}</span>
                  <span
                    className="pointer-events-none absolute inset-0"
                    aria-hidden
                  >
                    <svg
                      className="absolute inset-0 size-full"
                      viewBox="0 0 96 28"
                      preserveAspectRatio="none"
                    >
                      <line
                        x1="8"
                        y1="22"
                        x2="88"
                        y2="6"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        opacity="0.55"
                      />
                    </svg>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={btnSecondary}
            onClick={restoreAllExcludedFrames}
          >
            Tout réintégrer
          </button>
        </section>
      )}

      {config && overrideEntries.length > 0 && (
        <section
          className="sp-panel p-5 sm:p-6"
          aria-label="Surcharges de Frame Time"
        >
          <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-[0.14em] text-primary">
            Surcharges de durée
          </h2>
          <ul className="m-0 mb-3 flex list-none flex-wrap gap-2 p-0">
            {overrideEntries.map(({ index, frameCount }) => (
              <li key={index}>
                <button
                  type="button"
                  className={cx(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    frameIndex === index && isPaused
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-muted text-foreground hover:border-primary/40'
                  )}
                  onClick={() => goToFrameAndPause(index)}
                  title={`Afficher ${getFrameLabel(index, config, appendEmptyFrame)} et mettre en pause`}
                >
                  <span>{getFrameLabel(index, config, appendEmptyFrame)}</span>
                  <span className="tabular-nums opacity-80">
                    {frameCount} frame{frameCount > 1 ? 's' : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className={btnSecondary}
            onClick={resetAllFramesPerImageOverrides}
          >
            Réinitialiser toutes les surcharges
          </button>
        </section>
      )}

      {/* Image cachée pour lire naturalWidth / naturalHeight */}
      {imageSrc && (
        <img
          src={imageSrc}
          alt=""
          className="pointer-events-none absolute -left-[9999px] h-px w-px opacity-0"
          onLoad={handleImageLoad}
        />
      )}
    </div>
  );
}
