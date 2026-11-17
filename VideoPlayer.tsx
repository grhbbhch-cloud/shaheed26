import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Clock,
  Download,
  Film,
  Gauge,
  Maximize2,
  Minimize2,
  Pause,
  PictureInPicture2,
  Play,
  PlayCircle,
  Settings,
  Share2,
  Sliders,
  Subtitles,
  Triangle,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { formatDuration, sanitizeSvgMarkup } from '../lib/styleEngine';
import type {
  LoadingStyleConfig,
  PlayerControlItemConfig,
  PlayerSettingsConfig,
  SubtitleCue,
  SubtitleStyleConfig,
  SubtitleTrackRecord,
} from '../types/platform';
import { CustomLoader } from './CustomLoader';
import { GeometricPattern } from './GeometricPattern';

export interface PlayerRendition {
  label: string;
  height: number;
  width?: number;
  bitrate?: number;
  url: string;
  fileSize?: number;
  isOriginal?: boolean;
  status?: 'waiting' | 'processing' | 'completed' | 'failed';
  enabled?: boolean;
}

interface VideoPlayerProps {
  src: string;
  poster?: string;
  title: string;
  renditions?: PlayerRendition[];
  subtitles?: SubtitleTrackRecord[];
  playerConfig: PlayerSettingsConfig;
  subtitleStyle: SubtitleStyleConfig;
  bufferLoader?: LoadingStyleConfig;
  allowDownload?: boolean;
  allowShare?: boolean;
  onShare?: () => void;
  viewportOverride?: 'desktop' | 'tablet' | 'mobile';
  previewStarted?: boolean;
}

function parseTimeToSeconds(ts: string): number {
  const clean = ts.trim().replace(',', '.');
  const parts = clean.split(':').map(Number);
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  return Number(clean) || 0;
}

function shapeToRadius(shape?: string): string {
  if (shape === 'circle') return '9999px';
  if (shape === 'square') return '0px';
  return '6px';
}

export function VideoPlayer({
  src,
  poster,
  title,
  renditions = [],
  subtitles = [],
  playerConfig,
  subtitleStyle,
  bufferLoader,
  allowDownload = true,
  allowShare = true,
  onShare,
  viewportOverride,
  previewStarted,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const rawRenditions = useMemo(() => {
    const valid = renditions.filter(
      (r) => Boolean(r?.url) && (!r.status || r.status === 'completed') && r.enabled !== false
    );
    if (valid.length > 0) return valid;
    return src ? [{ label: 'الأصلية', height: 720, url: src, isOriginal: true, status: 'completed' as const, enabled: true }] : [];
  }, [renditions, src]);

  const availableRenditions = useMemo(() => {
    const disabled = playerConfig.disabledQualities || [];
    const seenUrls = new Set<string>();
    const filtered = rawRenditions.filter((r) => {
      if (disabled.includes(r.label)) return false;
      if (seenUrls.has(r.url)) return false;
      seenUrls.add(r.url);
      return true;
    });
    const list = filtered.length > 0 ? filtered : rawRenditions;
    return [...list].sort((a, b) => (b.height || 0) - (a.height || 0));
  }, [rawRenditions, playerConfig.disabledQualities]);

  const downloadRenditions = useMemo(() => {
    const allowed = playerConfig.downloadableQualities || [];
    if (allowed.length === 0) return availableRenditions;
    const filtered = availableRenditions.filter((r) => allowed.includes(r.label));
    return filtered.length > 0 ? filtered : availableRenditions;
  }, [availableRenditions, playerConfig.downloadableQualities]);

  const pickAutoRendition = (list: PlayerRendition[]): PlayerRendition | undefined => {
    if (list.length === 0) return undefined;
    const maxCap = viewportOverride === 'mobile' || (typeof window !== 'undefined' && window.innerWidth < 640) ? 480 : 1080;
    const underCap = list.filter((r) => (r.height || 0) <= maxCap);
    return underCap[0] || list[0];
  };

  const allowManualSwitch = playerConfig.allowManualQualitySwitch !== false;

  const [qualityMode, setQualityMode] = useState<'auto' | 'manual'>(() => {
    if (!allowManualSwitch) return 'auto';
    try {
      const saved = window.localStorage.getItem('alharbi_video_quality');
      if (saved && saved !== 'auto') return 'manual';
      if (saved === 'auto') return 'auto';
    } catch {
      // ignore storage errors
    }
    return playerConfig.autoQuality !== false ? 'auto' : 'manual';
  });

  const preferredInitialRendition = useMemo(() => {
    if (!allowManualSwitch || qualityMode === 'auto') {
      return pickAutoRendition(availableRenditions);
    }
    let stored = '';
    try {
      stored = window.localStorage.getItem('alharbi_video_quality') || '';
    } catch {
      stored = '';
    }
    if (stored && stored !== 'auto') {
      const hitStored = availableRenditions.find(
        (r) => r.label === stored || r.label.startsWith(`${stored} `)
      );
      if (hitStored) return hitStored;
    }
    if (playerConfig.defaultQuality && playerConfig.defaultQuality !== 'auto') {
      const hit = availableRenditions.find((r) => r.label === playerConfig.defaultQuality);
      if (hit) return hit;
    }
    return availableRenditions[0];
  }, [availableRenditions, playerConfig.defaultQuality, allowManualSwitch, qualityMode]);

  const [currentUrl, setCurrentUrl] = useState<string>(preferredInitialRendition?.url || src);
  const [currentQualityLabel, setCurrentQualityLabel] = useState<string>(
    preferredInitialRendition?.label || 'الأصلية'
  );
  const [hasStarted, setHasStarted] = useState(Boolean(previewStarted));
  const [isPlaying, setIsPlaying] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(playerConfig.defaultSpeed || 1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [theaterFallback, setTheaterFallback] = useState(false);
  const [activeMenu, setActiveMenu] = useState<'none' | 'speed' | 'quality' | 'subtitles' | 'download'>('none');
  const [activeSubtitleId, setActiveSubtitleId] = useState<number | null>(() => {
    if (subtitleStyle.autoShowDefault === false || subtitles.length === 0) return null;
    return subtitles.find((s) => s.is_default === 1)?.id ?? subtitles[0].id;
  });
  const [copiedNotice, setCopiedNotice] = useState(false);
  const [hoverSeekRatio, setHoverSeekRatio] = useState<number | null>(null);
  const [detectedMobile, setDetectedMobile] = useState(false);
  const [hoveredCtrl, setHoveredCtrl] = useState<string | null>(null);
  const [touchSeekFeedback, setTouchSeekFeedback] = useState<string | null>(null);
  const lastTapRef = useRef<{ time: number; side: 'left' | 'right' } | null>(null);
  const pendingRestoreRef = useRef<{
    time: number;
    wasPlaying: boolean;
    rate: number;
    volume: number;
    muted: boolean;
  } | null>(null);

  useEffect(() => {
    const check = () => setDetectedMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const isMobileView = viewportOverride ? viewportOverride === 'mobile' : detectedMobile;

  useEffect(() => {
    if (previewStarted !== undefined) setHasStarted(previewStarted);
  }, [previewStarted]);

  useEffect(() => {
    if (subtitleStyle.autoShowDefault === false) {
      setActiveSubtitleId(null);
    } else if (subtitles.length > 0) {
      setActiveSubtitleId((prev) => {
        if (prev && subtitles.some((s) => s.id === prev)) return prev;
        return subtitles.find((s) => s.is_default === 1)?.id ?? subtitles[0].id;
      });
    } else {
      setActiveSubtitleId(null);
    }
  }, [subtitles, subtitleStyle.autoShowDefault]);

  useEffect(() => {
    if (availableRenditions.length > 0 && !availableRenditions.some((r) => r.url === currentUrl)) {
      const target = preferredInitialRendition || availableRenditions[0];
      setCurrentUrl(target.url);
      setCurrentQualityLabel(target.label);
    }
  }, [availableRenditions, preferredInitialRendition, currentUrl]);

  // Reset source cleanly if parent src prop changes to another video
  useEffect(() => {
    if (!src) return;
    if (!availableRenditions.some((r) => r.url === currentUrl)) {
      const target = preferredInitialRendition || availableRenditions[0];
      if (target) {
        setCurrentUrl(target.url);
        setCurrentQualityLabel(target.label);
      }
    }
  }, [src]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const activeTrack = useMemo(
    () => subtitles.find((t) => t.id === activeSubtitleId) || null,
    [subtitles, activeSubtitleId]
  );

  const effectiveSubStyle = useMemo<SubtitleStyleConfig>(() => {
    if (!activeTrack?.style_json) return subtitleStyle;
    try {
      const parsed = JSON.parse(activeTrack.style_json);
      return { ...subtitleStyle, ...parsed };
    } catch {
      return subtitleStyle;
    }
  }, [activeTrack, subtitleStyle]);

  const activeCueText = useMemo(() => {
    if (!activeTrack) return '';
    try {
      const cues: SubtitleCue[] = JSON.parse(activeTrack.cues_json || '[]');
      const hit = cues.find((c) => {
        const st = parseTimeToSeconds(c.start);
        const en = parseTimeToSeconds(c.end);
        return currentTime >= st && currentTime <= en;
      });
      return hit?.text || '';
    } catch {
      return '';
    }
  }, [activeTrack, currentTime]);

  const togglePlay = async () => {
    const v = videoRef.current;
    setHasStarted(true);
    if (!v || !currentUrl) {
      setIsPlaying((p) => !p);
      return;
    }
    if (v.paused) {
      try {
        await v.play();
      } catch {
        // ignore autoplay interruption
      }
    } else {
      v.pause();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    const t = Number(e.target.value);
    if (v) v.currentTime = t;
    setCurrentTime(t);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    const next = Number(e.target.value);
    setVolume(next);
    if (v) {
      v.volume = next;
      v.muted = next === 0;
    }
    setIsMuted(next === 0);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (v) {
      v.muted = !v.muted;
      setIsMuted(v.muted);
    } else {
      setIsMuted((m) => !m);
    }
  };

  const applyQualityTarget = (r: PlayerRendition, mode: 'auto' | 'manual', persistKey: string) => {
    const v = videoRef.current;
    const savedTime = v ? v.currentTime : currentTime;
    const wasPlaying = v ? !v.paused : isPlaying;
    setQualityMode(mode);
    try {
      window.localStorage.setItem('alharbi_video_quality', persistKey);
    } catch {
      // ignore storage errors
    }
    if (r.url !== currentUrl) {
      pendingRestoreRef.current = {
        time: savedTime,
        wasPlaying,
        rate: playbackRate,
        volume,
        muted: isMuted,
      };
      setIsBuffering(true);
      setCurrentUrl(r.url);
    }
    setCurrentQualityLabel(r.label);
    setActiveMenu('none');
  };

  const handleQualitySwitch = (r: PlayerRendition) => {
    applyQualityTarget(r, 'manual', r.label);
  };

  const handleAutoQualitySelect = () => {
    const target = pickAutoRendition(availableRenditions);
    if (!target) return;
    applyQualityTarget(target, 'auto', 'auto');
  };

  const toggleFullscreen = async () => {
    if (playerConfig.fullscreenStyle === 'theater-fallback') {
      setTheaterFallback((t) => !t);
      return;
    }
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      await el.requestFullscreen?.().catch(() => setTheaterFallback(true));
    } else {
      await document.exitFullscreen?.().catch(() => setTheaterFallback(false));
    }
  };

  const togglePiP = async () => {
    const v = videoRef.current as any;
    if (!v) return;
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture?.().catch(() => {});
    } else if (v.requestPictureInPicture) {
      await v.requestPictureInPicture().catch(() => {});
    }
  };

  const seekBy = (deltaSeconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    const next = Math.max(0, Math.min(v.duration || duration || 0, v.currentTime + deltaSeconds));
    v.currentTime = next;
    setCurrentTime(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (playerConfig.keyboardControls === false) return;
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const key = e.key.toLowerCase();
    if (e.key === ' ' || key === 'k') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      seekBy(5);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      seekBy(-5);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(1, Number((volume + 0.1).toFixed(2)));
      setVolume(next);
      if (videoRef.current) {
        videoRef.current.volume = next;
        videoRef.current.muted = false;
      }
      setIsMuted(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.max(0, Number((volume - 0.1).toFixed(2)));
      setVolume(next);
      if (videoRef.current) {
        videoRef.current.volume = next;
        videoRef.current.muted = next === 0;
      }
      setIsMuted(next === 0);
    } else if (key === 'm') {
      e.preventDefault();
      toggleMute();
    } else if (key === 'f') {
      e.preventDefault();
      toggleFullscreen();
    }
  };

  const handleVideoTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (playerConfig.touchControls === false || !hasStarted) return;
    const touch = e.changedTouches?.[0];
    if (!touch) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isRight = touch.clientX - rect.left > rect.width / 2;
    const side: 'left' | 'right' = isRight ? 'right' : 'left';
    const now = Date.now();
    if (lastTapRef.current && lastTapRef.current.side === side && now - lastTapRef.current.time < 320) {
      const delta = side === 'right' ? 10 : -10;
      seekBy(delta);
      setTouchSeekFeedback(delta > 0 ? '+10 ث' : '-10 ث');
      window.setTimeout(() => setTouchSeekFeedback(null), 700);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now, side };
    }
  };

  const handleShareClick = async () => {
    if (onShare) {
      onShare();
      return;
    }
    if (navigator.share) {
      await navigator.share({ title, url: window.location.href }).catch(() => {});
    } else {
      await navigator.clipboard?.writeText(window.location.href).catch(() => {});
      setCopiedNotice(true);
      setTimeout(() => setCopiedNotice(false), 1800);
    }
  };

  const menuBg = playerConfig.menuBg || '#171717';
  const menuText = playerConfig.menuText || '#FFFFFF';
  const menuIconColor = playerConfig.menuIconColor || '#D4AF65';
  const safeDownloadTitle = (title || 'video').replace(/[\\/:*?"<>|]/g, '-');

  const extBtn = playerConfig.externalPlayButton;
  const vis = playerConfig.buttonVisibility || {};
  const ctrlMap = playerConfig.controlsConfig || {};
  const speeds = playerConfig.enabledSpeeds?.length ? playerConfig.enabledSpeeds : [0.5, 1, 1.25, 1.5, 2];

  const playedPct = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const bufferedPct = duration > 0 ? Math.min(100, (bufferedEnd / duration) * 100) : 0;

  const getCtrl = (key: string): Partial<PlayerControlItemConfig> => ctrlMap[key] || {};

  const isCtrlVisible = (key: string): boolean => {
    const c = getCtrl(key);
    if (c.enabled === false) return false;
    if (vis[key] === false) return false;
    if (isMobileView && c.showOnMobile === false) return false;
    if (!isMobileView && c.showOnDesktop === false) return false;
    return true;
  };

  const ctrlStyle = (key: string, active = false): React.CSSProperties => {
    const c = getCtrl(key);
    const isHov = hoveredCtrl === key;
    const baseColor = c.color || playerConfig.iconColor || '#FFFFFF';
    const baseBg = c.background && c.background !== 'transparent' ? c.background : undefined;
    return {
      color: isHov
        ? c.hoverColor || playerConfig.hoverColor || '#D4AF65'
        : active
          ? c.activeColor || playerConfig.activeColor || '#9c932b'
          : baseColor,
      backgroundColor: isHov ? c.hoverBg || 'rgba(255,255,255,0.1)' : baseBg,
      borderRadius: shapeToRadius(c.shape),
      border: c.borderWidth && c.borderWidth > 0 ? `${c.borderWidth}px solid ${c.borderColor || 'rgba(255,255,255,0.3)'}` : undefined,
      boxShadow: c.shadow && c.shadow !== 'none' ? c.shadow : undefined,
      marginInline: c.spacing ? `${c.spacing / 2}px` : undefined,
    };
  };

  const orderedControls = useMemo(() => {
    const base = playerConfig.buttonOrder || [
      'play',
      'volume',
      'mute',
      'time',
      'duration',
      'subtitles',
      'speed',
      'quality',
      'pip',
      'download',
      'share',
      'fullscreen',
    ];
    return [...base].sort((a, b) => {
      const oa = ctrlMap[a]?.order ?? base.indexOf(a);
      const ob = ctrlMap[b]?.order ?? base.indexOf(b);
      return oa - ob;
    });
  }, [playerConfig.buttonOrder, ctrlMap]);

  const renderCustomOrIcon = (customUrl: string | undefined, size: number, fallbackNode: React.ReactNode) => {
    if (!customUrl) return fallbackNode;
    if (customUrl.trim().startsWith('<svg')) {
      return (
        <span
          className="inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
          style={{ width: size, height: size }}
          dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(customUrl) }}
        />
      );
    }
    return <img src={customUrl} alt="" style={{ width: size, height: size, objectFit: 'contain' }} />;
  };

  const renderControlButton = (key: string) => {
    if (!isCtrlVisible(key)) return null;
    const c = getCtrl(key);
    const iconSize = c.size || playerConfig.buttonSize || 18;
    const strokeWidth =
      playerConfig.iconDesign === 'bold' ? 2.5 : playerConfig.iconDesign === 'minimal' ? 1.4 : 2;

    switch (key) {
      case 'play':
        return (
          <button
            key={key}
            type="button"
            onClick={togglePlay}
            onMouseEnter={() => setHoveredCtrl(key)}
            onMouseLeave={() => setHoveredCtrl(null)}
            aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
            className="p-1.5 transition-all cursor-pointer"
            style={ctrlStyle(key, isPlaying)}
          >
            {isPlaying ? (
              <Pause size={iconSize} strokeWidth={strokeWidth} />
            ) : (
              renderCustomOrIcon(
                c.customIconUrl,
                iconSize,
                c.icon === 'PlayCircle' ? (
                  <PlayCircle size={iconSize} strokeWidth={strokeWidth} />
                ) : (
                  <Play size={iconSize} strokeWidth={strokeWidth} />
                )
              )
            )}
          </button>
        );

      case 'mute':
        return (
          <button
            key={key}
            type="button"
            onClick={toggleMute}
            onMouseEnter={() => setHoveredCtrl(key)}
            onMouseLeave={() => setHoveredCtrl(null)}
            aria-label={isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
            className="p-1.5 transition-all cursor-pointer"
            style={ctrlStyle(key, isMuted)}
          >
            {isMuted || volume === 0 ? (
              <VolumeX size={iconSize} strokeWidth={strokeWidth} />
            ) : (
              renderCustomOrIcon(c.customIconUrl, iconSize, <Volume2 size={iconSize} strokeWidth={strokeWidth} />)
            )}
          </button>
        );

      case 'volume':
        return (
          <div key={key} className="flex items-center gap-1.5" style={ctrlStyle(key)}>
            {!isCtrlVisible('mute') && (
              <button
                type="button"
                onClick={toggleMute}
                onMouseEnter={() => setHoveredCtrl(key)}
                onMouseLeave={() => setHoveredCtrl(null)}
                aria-label={isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
                className="p-1.5 cursor-pointer"
              >
                {isMuted || volume === 0 ? <VolumeX size={iconSize} /> : <Volume2 size={iconSize} />}
              </button>
            )}
            {playerConfig.showVolumeSlider && (
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="مستوى الصوت"
                className="w-16 h-1 cursor-pointer"
                style={{ accentColor: playerConfig.playedColor || '#B08D45' }}
              />
            )}
          </div>
        );

      case 'time':
        return (
          <span
            key={key}
            dir="ltr"
            className="text-xs tabular-nums whitespace-nowrap px-1.5 py-0.5 inline-flex items-center gap-1"
            style={{
              ...ctrlStyle(key),
              color: c.color || playerConfig.timeTextColor || '#FFFFFF',
              fontFamily: playerConfig.timeTextFont || 'IBM Plex Mono',
              fontSize: c.size ? `${Math.max(10, Math.min(18, c.size))}px` : undefined,
            }}
          >
            {c.icon === 'Clock' && <Clock size={12} className="opacity-70" />}
            {formatDuration(currentTime)}
            {!isCtrlVisible('duration') && duration > 0 ? ` / ${formatDuration(duration)}` : ''}
          </span>
        );

      case 'duration':
        return (
          <span
            key={key}
            dir="ltr"
            className="text-xs tabular-nums whitespace-nowrap px-1 py-0.5 opacity-85"
            style={{
              ...ctrlStyle(key),
              color: c.color || playerConfig.timeTextColor || '#D4D4D4',
              fontFamily: playerConfig.timeTextFont || 'IBM Plex Mono',
              fontSize: c.size ? `${Math.max(10, Math.min(18, c.size))}px` : undefined,
            }}
          >
            / {formatDuration(duration)}
          </span>
        );

      case 'subtitles':
        if (subtitles.length === 0) return null;
        return (
          <div key={key} className="relative">
            <button
              type="button"
              onClick={() => setActiveMenu(activeMenu === 'subtitles' ? 'none' : 'subtitles')}
              onMouseEnter={() => setHoveredCtrl(key)}
              onMouseLeave={() => setHoveredCtrl(null)}
              aria-label="الترجمات"
              className="flex items-center gap-1 px-2 py-1 text-xs transition-colors cursor-pointer"
              style={ctrlStyle(key, Boolean(activeSubtitleId))}
            >
              {renderCustomOrIcon(c.customIconUrl, iconSize, <Subtitles size={iconSize} strokeWidth={strokeWidth} />)}
              <span className="hidden md:inline">{activeTrack ? activeTrack.language_label : 'إيقاف'}</span>
            </button>
            {activeMenu === 'subtitles' && (
              <div
                className="absolute bottom-full mb-2 left-0 z-30 min-w-[140px] rounded-lg border border-white/15 py-1 shadow-xl text-xs"
                style={{ backgroundColor: menuBg, color: menuText }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveSubtitleId(null);
                    setActiveMenu('none');
                  }}
                  className="w-full px-3 py-1.5 text-right hover:bg-white/10 flex items-center justify-between cursor-pointer"
                >
                  <span>إيقاف الترجمة</span>
                  {activeSubtitleId === null && <Check size={13} style={{ color: menuIconColor }} />}
                </button>
                {subtitles.map((tr) => (
                  <button
                    key={tr.id}
                    type="button"
                    onClick={() => {
                      setActiveSubtitleId(tr.id);
                      setActiveMenu('none');
                    }}
                    className="w-full px-3 py-1.5 text-right hover:bg-white/10 flex items-center justify-between cursor-pointer"
                  >
                    <span>{tr.language_label}</span>
                    {activeSubtitleId === tr.id && <Check size={13} style={{ color: menuIconColor }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 'speed':
        return (
          <div key={key} className="relative">
            <button
              type="button"
              onClick={() => setActiveMenu(activeMenu === 'speed' ? 'none' : 'speed')}
              onMouseEnter={() => setHoveredCtrl(key)}
              onMouseLeave={() => setHoveredCtrl(null)}
              className="flex items-center gap-1 px-2 py-1 text-xs tabular-nums transition-colors cursor-pointer"
              style={ctrlStyle(key, playbackRate !== 1)}
            >
              {renderCustomOrIcon(c.customIconUrl, Math.max(12, iconSize - 3), <Gauge size={Math.max(12, iconSize - 3)} strokeWidth={strokeWidth} />)}
              <span>{playbackRate}x</span>
            </button>
            {activeMenu === 'speed' && (
              <div
                className="absolute bottom-full mb-2 left-0 z-30 min-w-[96px] rounded-lg border border-white/15 py-1 shadow-xl text-xs"
                style={{ backgroundColor: menuBg, color: menuText }}
              >
                {speeds.map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => {
                      setPlaybackRate(sp);
                      setActiveMenu('none');
                    }}
                    className="w-full px-3 py-1.5 text-right hover:bg-white/10 flex items-center justify-between tabular-nums cursor-pointer"
                  >
                    <span>{sp}x</span>
                    {playbackRate === sp && <Check size={13} style={{ color: menuIconColor }} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case 'quality':
        if (availableRenditions.length === 0) return null;
        return (
          <div key={key} className="relative">
            <button
              type="button"
              onClick={() => {
                if (!allowManualSwitch) return;
                setActiveMenu(activeMenu === 'quality' ? 'none' : 'quality');
              }}
              onMouseEnter={() => setHoveredCtrl(key)}
              onMouseLeave={() => setHoveredCtrl(null)}
              title={!allowManualSwitch ? 'التبديل التلقائي مفعل' : 'تغيير الجودة'}
              className={`flex items-center gap-1 px-2 py-1 text-xs transition-colors ${
                allowManualSwitch ? 'cursor-pointer' : 'cursor-default opacity-85'
              }`}
              style={ctrlStyle(key)}
            >
              {renderCustomOrIcon(
                c.customIconUrl,
                Math.max(13, iconSize - 2),
                c.icon === 'Sliders' ? (
                  <Sliders size={Math.max(13, iconSize - 2)} strokeWidth={strokeWidth} />
                ) : (
                  <Settings size={Math.max(13, iconSize - 2)} strokeWidth={strokeWidth} />
                )
              )}
              <span>
                {qualityMode === 'auto'
                  ? `تلقائي (${currentQualityLabel.replace(' (الأصلية)', '')})`
                  : currentQualityLabel}
              </span>
            </button>
            {activeMenu === 'quality' && allowManualSwitch && (
              <div
                className="absolute bottom-full mb-2 left-0 z-30 min-w-[195px] rounded-lg border border-white/15 py-1 shadow-xl text-xs"
                style={{ backgroundColor: menuBg, color: menuText }}
              >
                {playerConfig.autoQuality !== false && (
                  <button
                    type="button"
                    onClick={handleAutoQualitySelect}
                    className="w-full px-3 py-1.5 text-right hover:bg-white/10 flex items-center justify-between cursor-pointer border-b border-white/10"
                  >
                    <span>تلقائي (Auto)</span>
                    {qualityMode === 'auto' && <Check size={13} style={{ color: menuIconColor }} />}
                  </button>
                )}
                {availableRenditions.map((r) => (
                  <button
                    key={`${r.label}-${r.url}`}
                    type="button"
                    onClick={() => handleQualitySwitch(r)}
                    className="w-full px-3 py-1.5 text-right hover:bg-white/10 flex items-center justify-between cursor-pointer"
                  >
                    <span>{r.label}</span>
                    {qualityMode === 'manual' && currentQualityLabel === r.label && (
                      <Check size={13} style={{ color: menuIconColor }} />
                    )}
                  </button>
                ))}
                {availableRenditions.length <= 1 && (
                  <p className="px-3 py-1.5 text-[10px] opacity-75 border-t border-white/10 mt-1">
                    تتوفر حالياً النسخة الأصلية فقط؛ يمكن للمالك توليد جودات إضافية من لوحة التحكم.
                  </p>
                )}
              </div>
            )}
          </div>
        );

      case 'pip':
        if (!playerConfig.pipEnabled) return null;
        return (
          <button
            key={key}
            type="button"
            onClick={togglePiP}
            onMouseEnter={() => setHoveredCtrl(key)}
            onMouseLeave={() => setHoveredCtrl(null)}
            aria-label="صورة داخل صورة"
            className="inline-flex p-1.5 transition-colors cursor-pointer"
            style={ctrlStyle(key)}
          >
            {renderCustomOrIcon(c.customIconUrl, iconSize, <PictureInPicture2 size={iconSize} strokeWidth={strokeWidth} />)}
          </button>
        );

      case 'download':
        if (!allowDownload || !playerConfig.downloadEnabled || downloadRenditions.length === 0) {
          return null;
        }
        return (
          <div key={key} className="relative">
            <button
              type="button"
              onClick={() => setActiveMenu(activeMenu === 'download' ? 'none' : 'download')}
              onMouseEnter={() => setHoveredCtrl(key)}
              onMouseLeave={() => setHoveredCtrl(null)}
              aria-label="تحميل الفيديو"
              className="p-1.5 transition-colors cursor-pointer"
              style={ctrlStyle(key)}
            >
              {renderCustomOrIcon(c.customIconUrl, iconSize, <Download size={iconSize} strokeWidth={strokeWidth} />)}
            </button>
            {activeMenu === 'download' && (
              <div
                className="absolute bottom-full mb-2 left-0 z-30 min-w-[160px] rounded-lg border border-white/15 py-1 shadow-xl text-xs"
                style={{ backgroundColor: menuBg, color: menuText }}
              >
                {downloadRenditions.map((r) => (
                  <a
                    key={r.label}
                    href={r.url}
                    download={`${safeDownloadTitle}-${r.label}`}
                    onClick={() => setActiveMenu('none')}
                    className="block px-3 py-1.5 text-right hover:bg-white/10"
                  >
                    تحميل ({r.label})
                  </a>
                ))}
              </div>
            )}
          </div>
        );

      case 'share':
        if (!allowShare || !playerConfig.shareEnabled) return null;
        return (
          <button
            key={key}
            type="button"
            onClick={handleShareClick}
            onMouseEnter={() => setHoveredCtrl(key)}
            onMouseLeave={() => setHoveredCtrl(null)}
            aria-label="مشاركة"
            className="p-1.5 transition-colors cursor-pointer"
            style={ctrlStyle(key, copiedNotice)}
          >
            {copiedNotice ? (
              <Check size={iconSize} strokeWidth={strokeWidth} />
            ) : (
              renderCustomOrIcon(c.customIconUrl, iconSize, <Share2 size={iconSize} strokeWidth={strokeWidth} />)
            )}
          </button>
        );

      case 'fullscreen':
        return (
          <button
            key={key}
            type="button"
            onClick={toggleFullscreen}
            onMouseEnter={() => setHoveredCtrl(key)}
            onMouseLeave={() => setHoveredCtrl(null)}
            aria-label="ملء الشاشة"
            className="p-1.5 transition-colors cursor-pointer"
            style={ctrlStyle(key, isFullscreen || theaterFallback)}
          >
            {isFullscreen || theaterFallback ? (
              <Minimize2 size={iconSize} strokeWidth={strokeWidth} />
            ) : (
              renderCustomOrIcon(c.customIconUrl, iconSize, <Maximize2 size={iconSize} strokeWidth={strokeWidth} />)
            )}
          </button>
        );

      default:
        return null;
    }
  };

  const seekRadius = playerConfig.seekBarRadius !== undefined ? `${playerConfig.seekBarRadius}px` : '999px';
  const seekTransition = `${playerConfig.transitionSpeedMs ?? 180}ms`;

  const showSeek = vis.progress !== false && getCtrl('progress').enabled !== false;
  const showBuffered = vis.buffered !== false && getCtrl('buffered').enabled !== false;

  const controlBar = (
    <div
      className={`z-20 w-full flex flex-col justify-center gap-1.5 transition-all ${
        playerConfig.controlBarAnimation === 'slide' ? 'duration-300' : 'duration-150'
      }`}
      style={{
        backgroundColor: playerConfig.controlBarBackground || '#080808',
        opacity: playerConfig.controlBarOpacity ?? 0.9,
        minHeight: `${playerConfig.controlBarHeight || 52}px`,
        paddingLeft: `${playerConfig.controlBarPaddingX ?? 12}px`,
        paddingRight: `${playerConfig.controlBarPaddingX ?? 12}px`,
        paddingTop: `${playerConfig.controlBarPaddingY ?? 6}px`,
        paddingBottom: `${playerConfig.controlBarPaddingY ?? 6}px`,
        borderTop:
          playerConfig.controlBarPosition !== 'top' && (playerConfig.controlBarBorderWidth || 0) > 0
            ? `${playerConfig.controlBarBorderWidth}px solid ${playerConfig.controlBarBorderColor || 'rgba(255,255,255,0.15)'}`
            : undefined,
        borderBottom:
          playerConfig.controlBarPosition === 'top' && (playerConfig.controlBarBorderWidth || 0) > 0
            ? `${playerConfig.controlBarBorderWidth}px solid ${playerConfig.controlBarBorderColor || 'rgba(255,255,255,0.15)'}`
            : undefined,
        boxShadow:
          playerConfig.controlBarShadow && playerConfig.controlBarShadow !== 'none'
            ? playerConfig.controlBarShadow
            : undefined,
      }}
    >
      {/* Seek / Progress Bar */}
      {showSeek && (
        <div
          className="relative w-full flex items-center group cursor-pointer py-1"
          dir="ltr"
          onMouseMove={(e) => {
            if (playerConfig.hoverPreviewEnabled === false) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
            setHoverSeekRatio(ratio);
          }}
          onMouseLeave={() => setHoverSeekRatio(null)}
        >
          <div
            className="w-full overflow-hidden relative"
            style={{
              height: `${playerConfig.seekBarThickness || 5}px`,
              borderRadius: seekRadius,
              backgroundColor: playerConfig.seekBarColor || 'rgba(255,255,255,0.25)',
            }}
          >
            {showBuffered && (
              <div
                className="absolute inset-y-0 left-0"
                style={{
                  width: `${bufferedPct}%`,
                  backgroundColor: playerConfig.bufferedColor || 'rgba(255,255,255,0.45)',
                  transition: `width ${seekTransition} ease`,
                }}
              />
            )}
            {hoverSeekRatio !== null && (
              <div
                className="absolute inset-y-0 left-0 opacity-45"
                style={{
                  width: `${hoverSeekRatio * 100}%`,
                  backgroundColor: playerConfig.seekBarHoverColor || playerConfig.playedColor || '#D4AF65',
                }}
              />
            )}
            <div
              className="absolute inset-y-0 left-0"
              style={{
                width: `${playedPct}%`,
                backgroundColor: playerConfig.playedColor || '#B08D45',
                transition: `width ${seekTransition} linear`,
              }}
            />
          </div>

          {playerConfig.showSeekThumb !== false && (
            <div
              className="pointer-events-none absolute top-1/2 -translate-y-1/2 -translate-x-1/2 rounded-full shadow"
              style={{
                left: `${playedPct}%`,
                width: `${Math.max(10, (playerConfig.seekBarThickness || 5) + 6)}px`,
                height: `${Math.max(10, (playerConfig.seekBarThickness || 5) + 6)}px`,
                backgroundColor: playerConfig.playedColor || '#B08D45',
                border: '2px solid #FFFFFF',
              }}
            />
          )}

          {hoverSeekRatio !== null && duration > 0 && playerConfig.hoverPreviewEnabled !== false && (
            <div
              className="pointer-events-none absolute -top-6 -translate-x-1/2 rounded bg-black/90 text-white px-1.5 py-0.5 text-[10px] tabular-nums"
              style={{ left: `${hoverSeekRatio * 100}%` }}
            >
              {formatDuration(duration * hoverSeekRatio)}
            </div>
          )}

          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            aria-label="شريط التقدم"
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        </div>
      )}

      {/* Controls row */}
      <div className="flex items-center justify-between gap-2 pb-0.5">
        <div
          className={`flex items-center flex-wrap ${
            isMobileView && playerConfig.mobileCompactControls ? 'gap-0.5' : 'gap-1.5'
          }`}
        >
          {orderedControls.map((k) => renderControlButton(k))}
        </div>
      </div>
    </div>
  );

  const showExtButton =
    extBtn &&
    extBtn.visible !== false &&
    !(isMobileView && extBtn.showOnMobile === false) &&
    !(!isMobileView && extBtn.showOnDesktop === false);

  const renderExtPlayIcon = () => {
    const size = extBtn.iconSize || 28;
    const color = extBtn.iconColor || '#FFFFFF';
    if (extBtn.customIconUrl) {
      return renderCustomOrIcon(extBtn.customIconUrl, size, <Play size={size} fill={color} style={{ color }} />);
    }
    if (extBtn.icon === 'film') return <Film size={size} style={{ color }} />;
    if (extBtn.icon === 'play-circle') return <PlayCircle size={size} style={{ color }} />;
    if (extBtn.icon === 'triangle') return <Triangle size={size} fill={color} className="rotate-90" style={{ color }} />;
    return <Play size={size} fill={color} style={{ color }} />;
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`relative w-full overflow-hidden flex flex-col focus:outline-none ${
        theaterFallback ? 'fixed inset-4 z-50 m-auto max-w-6xl shadow-2xl' : ''
      }`}
      style={{
        width: playerConfig.width || '100%',
        height: playerConfig.height && playerConfig.height !== 'auto' ? playerConfig.height : undefined,
        backgroundColor: playerConfig.background || '#080808',
        backgroundImage: playerConfig.backgroundImage ? `url("${playerConfig.backgroundImage}")` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        border: `${playerConfig.borderWidth ?? 1}px solid ${playerConfig.borderColor || '#262626'}`,
        borderRadius: `${playerConfig.borderRadius ?? 12}px`,
        padding: playerConfig.padding ? `${playerConfig.padding}px` : undefined,
        marginTop: playerConfig.marginY ? `${playerConfig.marginY}px` : undefined,
        marginBottom: playerConfig.marginY ? `${playerConfig.marginY}px` : undefined,
        boxShadow:
          playerConfig.glow && playerConfig.glow !== 'none'
            ? playerConfig.glow
            : playerConfig.shadow || undefined,
      }}
    >
      {playerConfig.backgroundPattern && playerConfig.backgroundPattern !== 'none' && (
        <GeometricPattern
          config={{
            enabled: true,
            pattern: playerConfig.backgroundPattern,
            primaryColor: playerConfig.playedColor || '#B08D45',
            secondaryColor: '#D4AF65',
            opacity: 0.12,
            size: 64,
            rotation: 0,
            spacing: 10,
            density: 1,
            position: 'repeat',
            blendMode: 'normal',
            animation: 'none',
            animationSpeed: 20,
            lineThickness: 1,
            borderStyle: 'solid',
          }}
        />
      )}

      {playerConfig.controlBarPosition === 'top' && (hasStarted || previewStarted) && controlBar}

      <div
        className="relative w-full bg-black/90 flex items-center justify-center overflow-hidden"
        onTouchEnd={handleVideoTouchEnd}
        style={{
          aspectRatio: playerConfig.aspectRatio === 'auto' ? undefined : playerConfig.aspectRatio || '16/9',
        }}
      >
        {touchSeekFeedback && (
          <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2 z-30 rounded-full bg-black/80 text-white px-3 py-1 text-xs font-bold tabular-nums">
            {touchSeekFeedback}
          </div>
        )}
        {currentUrl ? (
          <video
            ref={videoRef}
            src={currentUrl}
            poster={poster || undefined}
            playsInline
            preload="metadata"
            onClick={togglePlay}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onWaiting={() => setIsBuffering(true)}
            onCanPlay={() => {
              setIsBuffering(false);
              const v = videoRef.current;
              const restore = pendingRestoreRef.current;
              if (v && restore) {
                pendingRestoreRef.current = null;
                if (restore.time > 0 && Math.abs(v.currentTime - restore.time) > 0.35) {
                  v.currentTime = restore.time;
                }
                v.playbackRate = restore.rate;
                v.volume = restore.volume;
                v.muted = restore.muted;
                if (restore.wasPlaying) {
                  v.play().catch(() => {});
                }
              }
            }}
            onPlaying={() => setIsBuffering(false)}
            onTimeUpdate={() => {
              const v = videoRef.current;
              if (!v) return;
              setCurrentTime(v.currentTime);
              if (v.buffered.length > 0) {
                setBufferedEnd(v.buffered.end(v.buffered.length - 1));
              }
            }}
            onLoadedMetadata={() => {
              const v = videoRef.current;
              if (!v) return;
              setDuration(v.duration || 0);
              const restore = pendingRestoreRef.current;
              if (restore) {
                if (restore.time > 0 && restore.time < (v.duration || Infinity)) {
                  v.currentTime = restore.time;
                }
                v.playbackRate = restore.rate;
                v.volume = restore.volume;
                v.muted = restore.muted;
              }
            }}
            className="w-full h-full object-contain cursor-pointer"
          />
        ) : poster ? (
          <img src={poster} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 gap-2 py-16">
            <Film size={36} />
            <span className="text-xs">{title || 'معاينة مشغل الفيديو'}</span>
          </div>
        )}

        {/* Subtitle Overlay */}
        {activeCueText && (
          <div
            className="pointer-events-none absolute inset-x-0 flex justify-center px-4 z-20"
            style={{
              bottom: effectiveSubStyle.position === 'bottom' ? `${effectiveSubStyle.bottomMargin || 56}px` : undefined,
              top: effectiveSubStyle.position === 'top' ? '24px' : undefined,
            }}
          >
            <div
              style={{
                maxWidth: `${effectiveSubStyle.maxWidthPercent || 84}%`,
                fontFamily: `'${effectiveSubStyle.fontFamily || 'Cairo'}', sans-serif`,
                fontSize: `${isMobileView ? effectiveSubStyle.fontSizeMobile || 15 : effectiveSubStyle.fontSizeDesktop || 20}px`,
                fontWeight: effectiveSubStyle.fontWeight || '600',
                color: effectiveSubStyle.textColor || '#FFFFFF',
                backgroundColor: effectiveSubStyle.backgroundColor
                  ? `rgba(${hexToRgb(effectiveSubStyle.backgroundColor)}, ${effectiveSubStyle.backgroundOpacity ?? 0.72})`
                  : 'rgba(0,0,0,0.72)',
                textAlign: effectiveSubStyle.textAlign || 'center',
                lineHeight: effectiveSubStyle.lineSpacing || 1.5,
                textShadow: effectiveSubStyle.textShadow || '0 2px 4px rgba(0,0,0,0.85)',
                WebkitTextStroke:
                  effectiveSubStyle.outlineWidth > 0
                    ? `${effectiveSubStyle.outlineWidth}px ${effectiveSubStyle.outlineColor || '#000'}`
                    : undefined,
                padding: '6px 14px',
                borderRadius: '6px',
              }}
            >
              {activeCueText}
            </div>
          </div>
        )}

        {/* Buffering Loader */}
        {isBuffering && hasStarted && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center z-20">
            <CustomLoader config={bufferLoader} />
          </div>
        )}

        {/* External Play Button Overlay before play starts */}
        {!hasStarted && showExtButton && (
          <button
            type="button"
            onClick={togglePlay}
            aria-label="تشغيل الفيديو"
            className={`absolute inset-0 flex p-5 bg-black/25 group cursor-pointer z-10 ${
              extBtn.position === 'bottom-right'
                ? 'items-end justify-start'
                : extBtn.position === 'bottom-left'
                  ? 'items-end justify-end'
                  : 'items-center justify-center'
            }`}
          >
            <div
              className={`flex items-center justify-center ${
                extBtn.hoverEffect === 'scale' ? 'group-hover:scale-110' : ''
              } ${extBtn.activeEffect === 'press' ? 'active:scale-95' : ''}`}
              style={{
                width: `${extBtn.circleSize || 64}px`,
                height: `${extBtn.circleSize || 64}px`,
                backgroundColor: extBtn.circleBackground || '#B08D45',
                opacity: extBtn.circleOpacity ?? 0.92,
                transition: `all ${extBtn.transitionSpeedMs ?? 200}ms ease`,
                borderRadius:
                  extBtn.shape === 'square' ? '0px' : extBtn.shape === 'rounded' ? '14px' : '9999px',
                border: `${extBtn.borderWidth ?? 2}px solid ${extBtn.borderColor || '#FFFFFF'}`,
                boxShadow: extBtn.glow
                  ? `0 0 24px ${extBtn.glowColor || 'rgba(176,141,69,0.6)'}`
                  : extBtn.shadow || undefined,
                animation:
                  extBtn.animation === 'float'
                    ? `alharbiFloat ${extBtn.animationSpeed || 2.5}s ease-in-out infinite`
                    : extBtn.animation === 'pulse'
                      ? `pulse ${extBtn.animationSpeed || 2.5}s ease-in-out infinite`
                      : undefined,
              }}
            >
              {renderExtPlayIcon()}
            </div>
          </button>
        )}
      </div>

      {playerConfig.controlBarPosition !== 'top' && controlBar}
    </div>
  );
}

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return `${r}, ${g}, ${b}`;
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `${r}, ${g}, ${b}`;
  }
  return '0, 0, 0';
}
