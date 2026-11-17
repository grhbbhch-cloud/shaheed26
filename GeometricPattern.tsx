import React from 'react';
import type { DecorationRegionConfig } from '../types/platform';

interface GeometricPatternProps {
  config?: DecorationRegionConfig | null;
  className?: string;
  height?: number;
}

export function GeometricPattern({ config, className = '', height }: GeometricPatternProps) {
  if (!config || !config.enabled || config.pattern === 'none') {
    return null;
  }

  const size = Math.max(10, Number(config.size || 64));
  const spacing = Math.max(0, Number(config.spacing || 0));
  const tile = size + spacing;
  const strokeW = Math.max(0.5, Number(config.lineThickness || 1.2));
  const primary = config.primaryColor || '#B08D45';
  const secondary = config.secondaryColor || '#D4AF65';

  if (config.pattern === 'diamond-strip') {
    const stripH = height || Math.max(16, size + 8);
    const step = Math.max(14, size + spacing);
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${step}' height='${stripH}' viewBox='0 0 ${step} ${stripH}'><polygon points='${step / 2},${stripH / 2 - size * 0.36} ${step / 2 + size * 0.36},${stripH / 2} ${step / 2},${stripH / 2 + size * 0.36} ${step / 2 - size * 0.36},${stripH / 2}' fill='none' stroke='${primary}' stroke-width='${strokeW}'/><circle cx='${step / 2}' cy='${stripH / 2}' r='1.4' fill='${secondary}' opacity='0.6'/></svg>`;
    const bgUrl = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    return (
      <div
        aria-hidden="true"
        className={`w-full overflow-hidden ${className}`}
        style={{
          height: `${stripH}px`,
          backgroundColor: '#080808',
          backgroundImage: bgUrl,
          backgroundRepeat: 'repeat-x',
          backgroundPosition: 'center',
          opacity: config.opacity ?? 0.9,
          animation:
            config.animation === 'drift'
              ? `alharbiPatternDrift ${config.animationSpeed || 14}s linear infinite`
              : config.animation === 'pulse'
                ? `alharbiPatternPulse ${config.animationSpeed || 4}s ease-in-out infinite`
                : undefined,
        }}
      />
    );
  }

  if (config.pattern === 'custom-svg' && config.customSvgUrl) {
    return (
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute inset-0 ${className}`}
        style={{
          backgroundImage: `url("${config.customSvgUrl}")`,
          backgroundRepeat: config.position === 'repeat' ? 'repeat' : 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: `${tile}px ${tile}px`,
          opacity: config.opacity ?? 0.3,
          mixBlendMode: (config.blendMode as any) || 'normal',
          transform: config.rotation ? `rotate(${config.rotation}deg)` : undefined,
        }}
      />
    );
  }

  let patternInner = '';
  if (config.pattern === 'islamic-star') {
    const c = tile / 2;
    const rOuter = size * 0.44;
    const rInner = size * 0.17;
    const pts: string[] = [];
    for (let i = 0; i < 16; i++) {
      const ang = (Math.PI / 8) * i;
      const r = i % 2 === 0 ? rOuter : rInner;
      pts.push(`${(c + r * Math.cos(ang)).toFixed(1)},${(c + r * Math.sin(ang)).toFixed(1)}`);
    }
    patternInner = `<polygon points='${pts.join(' ')}' fill='none' stroke='${primary}' stroke-width='${strokeW}'/><circle cx='${c}' cy='${c}' r='${(size * 0.1).toFixed(1)}' fill='none' stroke='${secondary}' stroke-width='${strokeW * 0.8}' opacity='0.5'/>`;
  } else if (config.pattern === 'geometric-grid') {
    patternInner = `<path d='M ${tile} 0 L 0 0 0 ${tile}' fill='none' stroke='${primary}' stroke-width='${strokeW}'/><path d='M 0 0 L ${tile} ${tile} M ${tile} 0 L 0 ${tile}' fill='none' stroke='${secondary}' stroke-width='${strokeW * 0.6}' opacity='0.4'/>`;
  } else if (config.pattern === 'interlocking-octagons') {
    const s = tile;
    const d = s * 0.25;
    patternInner = `<polygon points='${d},2 ${s - d},2 ${s - 2},${d} ${s - 2},${s - d} ${s - d},${s - 2} ${d},${s - 2} 2,${s - d} 2,${d}' fill='none' stroke='${primary}' stroke-width='${strokeW}'/><rect x='${s * 0.35}' y='${s * 0.35}' width='${s * 0.3}' height='${s * 0.3}' transform='rotate(45 ${s / 2} ${s / 2})' fill='none' stroke='${secondary}' stroke-width='${strokeW * 0.85}' opacity='0.6'/>`;
  } else if (config.pattern === 'arabesque-mesh') {
    const c = tile / 2;
    patternInner = `<circle cx='${c}' cy='${c}' r='${size * 0.38}' fill='none' stroke='${primary}' stroke-width='${strokeW}'/><circle cx='0' cy='0' r='${size * 0.28}' fill='none' stroke='${secondary}' stroke-width='${strokeW * 0.8}'/><circle cx='${tile}' cy='0' r='${size * 0.28}' fill='none' stroke='${secondary}' stroke-width='${strokeW * 0.8}'/><circle cx='0' cy='${tile}' r='${size * 0.28}' fill='none' stroke='${secondary}' stroke-width='${strokeW * 0.8}'/><circle cx='${tile}' cy='${tile}' r='${size * 0.28}' fill='none' stroke='${secondary}' stroke-width='${strokeW * 0.8}'/>`;
  }

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${tile}' height='${tile}' viewBox='0 0 ${tile} ${tile}'>${patternInner}</svg>`;
  const bgUrl = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${className}`}
      style={{
        backgroundImage: bgUrl,
        backgroundRepeat: 'repeat',
        backgroundPosition: 'center',
        backgroundSize: `${tile / Math.max(1, config.density || 1)}px ${tile / Math.max(1, config.density || 1)}px`,
        opacity: config.opacity ?? 0.35,
        mixBlendMode: (config.blendMode as any) || 'normal',
        transform: config.rotation ? `rotate(${config.rotation}deg)` : undefined,
        animation:
          config.animation === 'drift'
            ? `alharbiPatternDrift ${config.animationSpeed || 20}s linear infinite`
            : config.animation === 'pulse'
              ? `alharbiPatternPulse ${config.animationSpeed || 5}s ease-in-out infinite`
              : undefined,
      }}
    />
  );
}
