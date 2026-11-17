import type { CSSProperties } from 'react';
import type {
  AllSettings,
  BackgroundRegionConfig,
  GradientConfig,
  TextStyleConfig,
  TitleGradientSystemConfig,
  TitleGradientTargetKey,
} from '../types/platform';

export function buildGradientCss(g?: GradientConfig | null): string {
  if (!g || !g.enabled || !g.stops || g.stops.length === 0) return '';
  const rawStops = g.stops.filter(Boolean);
  const stops = rawStops.length === 1 ? [rawStops[0], rawStops[0]] : rawStops;
  if (g.type === 'conic') {
    const cyclic = g.animated && stops.length >= 2 && stops[0] !== stops[stops.length - 1]
      ? [...stops, stops[0]]
      : stops;
    const baseAngle = g.angle !== undefined ? `${g.angle}deg` : '0deg';
    return `conic-gradient(from var(--alharbi-angle, ${baseAngle}) at ${g.position || 'center'}, ${cyclic.join(', ')})`;
  }
  if (g.type === 'radial') {
    return `radial-gradient(circle at ${g.position || 'center'}, ${stops.join(', ')})`;
  }
  const dir = g.angle !== undefined ? `${g.angle}deg` : g.direction || 'to left';
  return `linear-gradient(${dir}, ${stops.join(', ')})`;
}

function buildGradientAnimationCss(g: GradientConfig): {
  backgroundSize?: string;
  animation?: string;
  animationPlayState?: 'paused' | 'running';
  willChange?: string;
} {
  if (!g.animated) return {};
  const speed = Math.max(0.5, Number(g.animationSpeed || 5));
  const timing = g.timingFunction || 'ease-in-out';
  const dir = g.animationDirection || 'normal';
  const iter = g.loop === false ? '1' : 'infinite';
  const scale = Math.max(150, Math.min(500, Number(g.spreadPercent || 260)));
  const playState = g.animationPaused ? 'paused' : 'running';

  if (g.type === 'conic') {
    return {
      backgroundSize: '180% 180%',
      animation: `alharbiConicSpin ${speed}s ${timing} ${iter} ${dir}`,
      animationPlayState: playState,
      willChange: 'background-position',
    };
  }
  if (dir === 'alternate' || dir === 'alternate-reverse') {
    return {
      backgroundSize: `${scale}% ${scale}%`,
      animation: `alharbiGradientPingPong ${speed}s ${timing} ${iter} ${dir}`,
      animationPlayState: playState,
      willChange: 'background-position',
    };
  }
  return {
    backgroundSize: `${scale}% ${scale}%`,
    animation: `alharbiGradientShift ${speed}s ${timing} ${iter} ${dir}`,
    animationPlayState: playState,
    willChange: 'background-position',
  };
}

export function buildGradientBoxStyle(g?: GradientConfig | null): CSSProperties {
  if (!g || !g.enabled) return {};
  const bg = buildGradientCss(g);
  if (!bg) return {};
  const transMs = Math.max(0, Number(g.transitionSpeedMs ?? 450));
  const animProps = buildGradientAnimationCss(g);
  return {
    backgroundImage: bg,
    opacity: g.opacity ?? 1,
    transition: `background-position ${transMs}ms ${g.timingFunction || 'ease-in-out'}, opacity ${transMs}ms ease`,
    ...animProps,
  };
}

export function buildTextStyle(
  ts?: Partial<TextStyleConfig> | null,
  targetGradient?: GradientConfig | null,
  viewport: 'desktop' | 'tablet' | 'mobile' = 'desktop'
): CSSProperties {
  if (!ts) return {};
  const grad = ts.disableTargetGradient
    ? null
    : ts.gradient?.enabled
      ? ts.gradient
      : targetGradient?.enabled
        ? targetGradient
        : null;
  const fontSize =
    viewport === 'mobile'
      ? ts.fontSizeMobile || ts.fontSizeDesktop
      : viewport === 'tablet'
        ? ts.fontSizeTablet || ts.fontSizeDesktop
        : ts.fontSizeDesktop;

  const transMs = Math.max(0, Number(grad?.transitionSpeedMs ?? 450));
  const style: CSSProperties = {
    fontFamily: ts.fontFamily ? `'${ts.fontFamily}', 'Cairo', sans-serif` : undefined,
    fontSize,
    fontWeight: ts.fontWeight as any,
    lineHeight: ts.lineHeight,
    letterSpacing: ts.letterSpacing,
    textAlign: ts.textAlign,
    textDecoration: ts.textDecoration,
    color: ts.color,
    opacity: ts.opacity,
    textShadow: ts.textShadow && ts.textShadow !== 'none' ? ts.textShadow : undefined,
    transition: `color ${transMs}ms ease, opacity ${transMs}ms ease, text-shadow ${transMs}ms ease, background-position ${transMs}ms ease`,
  };

  if (grad && grad.enabled) {
    const css = buildGradientCss(grad);
    if (css) {
      const animProps = buildGradientAnimationCss(grad);
      style.backgroundImage = css;
      style.WebkitBackgroundClip = 'text';
      style.backgroundClip = 'text';
      style.color = 'transparent';
      style.WebkitTextFillColor = 'transparent';
      if (grad.opacity !== undefined && grad.opacity < 1) {
        style.opacity = grad.opacity;
      }
      if (grad.intensity !== undefined && Number(grad.intensity) !== 1) {
        style.filter = `saturate(${Math.max(0.5, Math.min(2, Number(grad.intensity)))})`;
      }
      if (animProps.backgroundSize) style.backgroundSize = animProps.backgroundSize;
      if (animProps.animation) style.animation = animProps.animation;
      if (animProps.animationPlayState) style.animationPlayState = animProps.animationPlayState;
      if (animProps.willChange) style.willChange = animProps.willChange;
    }
  }

  return style;
}

export function buildRtlCyclicGradientCss(rawStops: string[], angle = 90): string {
  const clean = (rawStops || []).map((s) => String(s || '').trim()).filter(Boolean);
  const baseStops = clean.length >= 2 ? clean : clean.length === 1 ? [clean[0], '#D4AF65'] : ['#8C6A2F', '#D4AF65', '#F7E7B4', '#B08D45'];
  const n = baseStops.length;
  const parts: string[] = [];
  for (let i = 0; i <= n; i++) {
    const color = baseStops[i % n];
    const pct = ((i / n) * 50).toFixed(3);
    parts.push(`${color} ${pct}%`);
  }
  for (let i = 1; i <= n; i++) {
    const color = baseStops[i % n];
    const pct = (50 + (i / n) * 50).toFixed(3);
    parts.push(`${color} ${pct}%`);
  }
  const safeAngle = Number.isFinite(Number(angle)) ? Number(angle) : 90;
  return `linear-gradient(${safeAngle}deg, ${parts.join(', ')})`;
}

export function buildTitleGradientProps(
  settings: { titleGradient?: TitleGradientSystemConfig } | null | undefined,
  targetKey: TitleGradientTargetKey,
  baseStyle: CSSProperties = {},
  options?: { pageId?: number | null; disabled?: boolean }
): { style: CSSProperties; className: string } {
  const tg = settings?.titleGradient;
  if (!tg || !tg.enabled || options?.disabled || !tg.targets?.[targetKey]) {
    return { style: baseStyle, className: '' };
  }
  if (
    Array.isArray(tg.targetPageIds) &&
    tg.targetPageIds.length > 0 &&
    options?.pageId !== undefined &&
    options?.pageId !== null &&
    !tg.targetPageIds.includes(Number(options.pageId))
  ) {
    return { style: baseStyle, className: '' };
  }

  const speed = Math.max(0.8, Math.min(30, Number(tg.speed || 6)));
  const fastSpeed = Math.max(0.4, Number((speed * 0.4).toFixed(2)));
  const timing = tg.timingFunction || 'linear';
  const iter = tg.loop === false ? '1' : 'infinite';
  const opacity = tg.opacity !== undefined ? Math.max(0.1, Math.min(1, Number(tg.opacity))) : 1;
  const intensity = tg.intensity !== undefined ? Math.max(0.5, Math.min(2, Number(tg.intensity))) : 1;
  const gradientCss = buildRtlCyclicGradientCss(tg.stops, tg.angle ?? 90);
  const hoverBehavior = tg.hoverBehavior || 'continue';

  const style: CSSProperties = {
    ...baseStyle,
    backgroundImage: gradientCss,
    backgroundSize: '200% 100%',
    backgroundRepeat: 'repeat-x',
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
    animation: `alharbiTitleSweepRTL ${speed}s ${timing} ${iter} normal`,
    opacity: opacity < 1 ? opacity : baseStyle.opacity,
    filter: intensity !== 1 ? `saturate(${intensity})` : baseStyle.filter,
    willChange: 'background-position',
    ['--alharbi-title-fast-speed' as any]: `${fastSpeed}s`,
  };

  const hoverClass =
    hoverBehavior !== 'continue' ? `alharbi-title-rtl alharbi-title-rtl-${hoverBehavior}` : 'alharbi-title-rtl';

  return { style, className: hoverClass };
}

export function buildBoxGradientProps(
  settings: { titleGradient?: TitleGradientSystemConfig } | null | undefined,
  targetKey: TitleGradientTargetKey,
  baseStyle: CSSProperties = {}
): { style: CSSProperties; className: string } {
  const tg = settings?.titleGradient;
  if (!tg || !tg.enabled || !tg.targets?.[targetKey]) {
    return { style: baseStyle, className: '' };
  }
  const speed = Math.max(0.8, Math.min(30, Number(tg.speed || 6)));
  const timing = tg.timingFunction || 'linear';
  const iter = tg.loop === false ? '1' : 'infinite';
  const gradientCss = buildRtlCyclicGradientCss(tg.stops, tg.angle ?? 90);
  const style: CSSProperties = {
    ...baseStyle,
    backgroundImage: gradientCss,
    backgroundSize: '200% 100%',
    backgroundRepeat: 'repeat-x',
    animation: `alharbiTitleSweepRTL ${speed}s ${timing} ${iter} normal`,
    willChange: 'background-position',
  };
  return { style, className: 'alharbi-title-rtl' };
}

export function buildBackgroundStyle(region?: BackgroundRegionConfig | null): CSSProperties {
  if (!region || !region.layers || region.layers.length === 0) return {};
  const visibleLayers = region.layers.filter((l) => l.visible);
  if (visibleLayers.length === 0) return {};

  const solid = visibleLayers.find((l) => l.type === 'solid');
  const images: string[] = [];
  const positions: string[] = [];
  const sizes: string[] = [];
  const repeats: string[] = [];
  let animatedSpeed = 0;

  for (const layer of visibleLayers) {
    if (layer.type === 'image' && layer.mediaUrl) {
      images.push(`url("${layer.mediaUrl}")`);
      positions.push(layer.position || 'center');
      sizes.push(layer.size || 'cover');
      repeats.push(layer.repeat || 'no-repeat');
    } else if ((layer.type === 'gradient' || layer.type === 'animated-gradient') && layer.gradient) {
      const gradCss = buildGradientCss({ ...layer.gradient, enabled: true });
      if (gradCss) {
        images.push(gradCss);
        positions.push(layer.position || 'center');
        sizes.push(layer.type === 'animated-gradient' || layer.gradient.animated ? '240% 240%' : layer.size || 'cover');
        repeats.push('no-repeat');
        if (layer.type === 'animated-gradient' || layer.gradient.animated) {
          animatedSpeed = layer.animationSpeed || layer.gradient.animationSpeed || 8;
        }
      }
    }
  }

  const style: CSSProperties = {
    backgroundColor: solid?.color || undefined,
  };
  if (images.length > 0) {
    style.backgroundImage = images.join(', ');
    style.backgroundPosition = positions.join(', ');
    style.backgroundSize = sizes.join(', ');
    style.backgroundRepeat = repeats.join(', ');
  }
  if (animatedSpeed > 0) {
    style.animation = `alharbiGradientShift ${animatedSpeed}s ease infinite`;
  }
  return style;
}

export function sanitizeSvgMarkup(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')
    .trim();
}

export function syncPageSeo(opts: {
  title?: string;
  description?: string;
  ogImage?: string;
  canonical?: string;
  noIndex?: boolean;
}): void {
  if (typeof document === 'undefined') return;
  if (opts.title) {
    document.title = opts.title;
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', opts.title);
  }
  if (opts.description !== undefined) {
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute('content', opts.description);
    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute('content', opts.description);
  }
  if (opts.ogImage) {
    let ogImg = document.querySelector('meta[property="og:image"]');
    if (!ogImg) {
      ogImg = document.createElement('meta');
      ogImg.setAttribute('property', 'og:image');
      document.head.appendChild(ogImg);
    }
    ogImg.setAttribute('content', opts.ogImage);
  }
  let robots = document.querySelector('meta[name="robots"]');
  if (opts.noIndex) {
    if (!robots) {
      robots = document.createElement('meta');
      robots.setAttribute('name', 'robots');
      document.head.appendChild(robots);
    }
    robots.setAttribute('content', 'noindex, nofollow');
  } else if (robots) {
    robots.remove();
  }
  let canonicalEl = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (opts.canonical) {
    if (!canonicalEl) {
      canonicalEl = document.createElement('link');
      canonicalEl.rel = 'canonical';
      document.head.appendChild(canonicalEl);
    }
    canonicalEl.href = opts.canonical;
  } else if (canonicalEl) {
    canonicalEl.remove();
  }
}

export function syncBrowserIdentity(identity: AllSettings['identity']): void {
  if (typeof document === 'undefined') return;
  const title = identity.browserTitle || identity.siteName || 'أرشيف الشهيد';
  if (document.title !== title) {
    document.title = title;
  }

  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc && identity.metaDescription) {
    metaDesc.setAttribute('content', identity.metaDescription);
  }

  // Update favicon dynamically so changes appear immediately in browser tab
  const favUrl = identity.faviconUrl
    ? `${identity.faviconUrl}${identity.faviconUrl.includes('?') ? '&' : '?'}v=${identity.faviconVersion || 1}`
    : `/favicon.ico?v=${identity.faviconVersion || 1}`;
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    document.head.appendChild(link);
  }
  if (link.getAttribute('href') !== favUrl) {
    link.setAttribute('href', favUrl);
  }

  // Inject custom uploaded fonts
  const existingStyle = document.getElementById('alharbi-custom-fonts');
  const cssRules = (identity.customFonts || [])
    .map(
      (f) =>
        `@font-face { font-family: '${f.name.replace(/'/g, '')}'; src: url('${f.url}'); font-display: swap; }`
    )
    .join('\n');
  if (cssRules) {
    if (existingStyle) {
      existingStyle.textContent = cssRules;
    } else {
      const styleEl = document.createElement('style');
      styleEl.id = 'alharbi-custom-fonts';
      styleEl.textContent = cssRules;
      document.head.appendChild(styleEl);
    }
  } else if (existingStyle) {
    existingStyle.remove();
  }
}

export function formatArabicDate(
  iso: string | null | undefined,
  mode: 'arabic' | 'iso' | 'relative' = 'arabic'
): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  if (mode === 'iso') {
    return d.toISOString().slice(0, 10);
  }
  if (mode === 'relative') {
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'الآن';
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `منذ ${hrs} ساعة`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `منذ ${days} يوم`;
  }
  return d.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatDuration(seconds: number | null | undefined): string {
  const s = Math.max(0, Math.floor(Number(seconds || 0)));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  if (hrs > 0) return `${hrs}:${pad(mins)}:${pad(secs)}`;
  return `${pad(mins)}:${pad(secs)}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 ب';
  if (bytes < 1024) return `${bytes} ب`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} ك.ب`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ج.ب`;
}

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  video: 'فيديو',
  image: 'صورة',
  gallery: 'معرض صور',
  post: 'منشور',
  article: 'مقال',
  news: 'خبر',
  report: 'تقرير',
  poetry: 'قصيدة',
  audio: 'مادة صوتية',
  document: 'وثيقة',
  custom: 'محتوى مخصص',
};

export const STATUS_LABELS: Record<string, string> = {
  published: 'منشور',
  unpublished: 'غير منشور',
  draft: 'مسودة',
  scheduled: 'مجدول',
  hidden: 'مخفي',
  archived: 'مؤرشف',
  processing: 'قيد المعالجة',
  failed: 'فشل',
};
