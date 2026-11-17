import React from 'react';
import {
  Cog,
  Compass,
  Download,
  Film,
  Image as ImageIcon,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { sanitizeSvgMarkup } from '../lib/styleEngine';
import type { LoadingStyleConfig } from '../types/platform';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Loader2,
  Play,
  Upload,
  Cog,
  Download,
  Image: ImageIcon,
  Layers,
  RefreshCw,
  Compass,
  Film,
};

interface CustomLoaderProps {
  config?: LoadingStyleConfig | null;
  label?: string;
  className?: string;
}

export function CustomLoader({ config, label, className = '' }: CustomLoaderProps) {
  if (config && !config.enabled) return null;

  const size = config?.size || 32;
  const color = config?.color || '#B08D45';
  const secondary = config?.secondaryColor || '#D4AF65';
  const speed = Math.max(0.3, config?.speed || 1);
  const style = config?.style || 'spinner';
  const IconComp = ICON_MAP[config?.iconName || 'Loader2'] || Loader2;

  const containerStyle: React.CSSProperties = {
    opacity: config?.opacity ?? 1,
    background: config?.background && config.background !== 'transparent' ? config.background : undefined,
    boxShadow: config?.shadow && config.shadow !== 'none' ? config.shadow : undefined,
    filter: config?.glow && config.glow !== 'none' ? `drop-shadow(${config.glow})` : undefined,
  };

  const spinAnim =
    config?.direction === 'counterclockwise'
      ? `alharbiSpinReverse ${speed}s linear infinite`
      : `spin ${speed}s linear infinite`;

  const wordsList =
    config?.words && config.words.length > 0
      ? config.words
      : [
          { text: 'أرشيف', color: color, fontSize: Math.max(18, Math.round(size * 0.72)), fontWeight: '800' },
          { text: 'الشهيد', color: secondary, fontSize: Math.max(18, Math.round(size * 0.72)), fontWeight: '800' },
        ];

  return (
    <div
      className={`inline-flex flex-col items-center justify-center gap-2 rounded-lg p-2 ${className}`}
      style={containerStyle}
      role="status"
      aria-live="polite"
    >
      {style === 'animated-words' ? (
        <div
          dir="rtl"
          className="inline-flex flex-wrap items-center justify-center select-none"
          style={{ gap: `${config?.wordGap ?? 10}px` }}
        >
          {wordsList.map((w, idx) => (
            <span
              key={`${w.text}-${idx}`}
              style={{
                color: w.color || color,
                fontSize: `${w.fontSize || 24}px`,
                fontWeight: (w.fontWeight as any) || '800',
                fontFamily: "'Cairo', 'IBM Plex Sans Arabic', sans-serif",
                letterSpacing: 'normal',
                animation: `alharbiWordPulse ${speed * 1.4}s ease-in-out infinite`,
                animationDelay: `${idx * 0.28}s`,
              }}
            >
              {w.text}
            </span>
          ))}
        </div>
      ) : style === 'custom-svg' && config?.customSvg ? (
        <div
          style={{
            width: size,
            height: size,
            color,
            animation: config.rotation ? spinAnim : undefined,
          }}
          dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(config.customSvg) }}
        />
      ) : style === 'pulsing-circles' ? (
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
          <span
            className="absolute inset-0 rounded-full animate-ping opacity-45"
            style={{ backgroundColor: color, animationDuration: `${speed * 1.4}s` }}
          />
          <span
            className="rounded-full"
            style={{
              width: size * 0.52,
              height: size * 0.52,
              background: config?.useGradient
                ? `linear-gradient(135deg, ${color}, ${secondary})`
                : color,
            }}
          />
        </div>
      ) : style === 'animated-lines' ? (
        <div className="flex items-end gap-1" style={{ height: size }}>
          {[0, 1, 2, 3].map((idx) => (
            <span
              key={idx}
              className="w-1.5 rounded-full animate-pulse"
              style={{
                height: `${50 + ((idx % 2) * 35)}%`,
                backgroundColor: idx % 2 === 0 ? color : secondary,
                animationDuration: `${speed * 0.9}s`,
                animationDelay: `${idx * 0.15}s`,
              }}
            />
          ))}
        </div>
      ) : style === 'rotating-icon' || style === 'icon-loader' ? (
        <IconComp
          size={size}
          style={{
            color,
            animation: config?.rotation !== false ? spinAnim : undefined,
          }}
        />
      ) : (
        <div
          className="rounded-full border-solid"
          style={{
            width: size,
            height: size,
            borderWidth: Math.max(2, Math.round(size / 10)),
            borderColor: `${secondary}33`,
            borderTopColor: color,
            animation: spinAnim,
          }}
        />
      )}

      {label && <span className="text-xs font-medium text-neutral-600">{label}</span>}
    </div>
  );
}
