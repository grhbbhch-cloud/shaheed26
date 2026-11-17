import React, { useRef, useState } from 'react';
import {
  FileText,
  Film,
  Image as ImageIcon,
  Mic,
  Play,
  PlayCircle,
  Triangle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePlatform } from '../context/PlatformContext';
import {
  buildTextStyle,
  CONTENT_TYPE_LABELS,
  formatArabicDate,
  formatDuration,
} from '../lib/styleEngine';
import type { ContentRecord, RelatedSettingsConfig } from '../types/platform';

interface MediaCardProps {
  item: ContentRecord;
  variant?: 'editorial' | 'compact' | 'media-first';
  showThumbnail?: boolean;
  showTitle?: boolean;
  showDate?: boolean;
  showDescription?: boolean;
  showBadge?: boolean;
  showPlayButton?: boolean;
  cardDesignOverride?: Partial<RelatedSettingsConfig['cardDesign']>;
}

export function MediaCard({
  item,
  variant = 'editorial',
  showThumbnail = true,
  showTitle = true,
  showDate = true,
  showDescription = true,
  showBadge = true,
  showPlayButton = true,
  cardDesignOverride,
}: MediaCardProps) {
  const { settings, viewport } = usePlatform();
  const [hoverPreviewActive, setHoverPreviewActive] = useState(false);
  const previewTimerRef = useRef<number | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement | null>(null);

  const extBtn = settings?.player?.externalPlayButton;
  const uiTexts = settings?.uiTexts;
  const typeLabels = uiTexts?.contentTypeLabels || CONTENT_TYPE_LABELS;

  const isVideo = item.content_type === 'video';
  const isImage = item.content_type === 'image' || item.content_type === 'gallery';

  let itemSettings: any = {};
  try {
    itemSettings = JSON.parse(item.settings_json || '{}');
  } catch {
    itemSettings = {};
  }

  const titleStyleKey = isVideo ? 'videoTitle' : isImage ? 'imageTitle' : 'postTitle';
  const titleGradientMode: 'inherit' | 'custom' | 'disabled' =
    itemSettings.titleGradientMode === 'disabled' ||
    itemSettings.titleStyleOverride?.gradient?.enabled === false
      ? 'disabled'
      : itemSettings.titleGradientMode === 'custom' ||
          itemSettings.titleStyleOverride?.gradient?.enabled === true
        ? 'custom'
        : 'inherit';

  const titleTextStyle = itemSettings.titleStyleOverride
    ? {
        ...settings?.typography?.[titleStyleKey],
        ...itemSettings.titleStyleOverride,
        disableTargetGradient: titleGradientMode === 'disabled',
      }
    : {
        ...settings?.typography?.[titleStyleKey],
        disableTargetGradient: titleGradientMode === 'disabled',
      };
  const titleTargetGrad =
    titleGradientMode === 'disabled'
      ? null
      : titleGradientMode === 'custom'
        ? itemSettings.titleStyleOverride?.gradient
        : cardDesignOverride?.titleGradient?.enabled
          ? cardDesignOverride.titleGradient
          : settings?.colors?.targets?.[titleStyleKey]?.gradient;

  const computedTitleStyle = buildTextStyle(
    {
      ...titleTextStyle,
      ...(cardDesignOverride?.textColor && titleGradientMode === 'disabled'
        ? { color: cardDesignOverride.textColor }
        : cardDesignOverride?.textColor && !itemSettings.titleStyleOverride?.color
          ? { color: cardDesignOverride.textColor }
          : {}),
      ...(cardDesignOverride?.titleFontSize ? { fontSizeDesktop: cardDesignOverride.titleFontSize } : {}),
    },
    titleTargetGrad,
    viewport
  );
  const computedDescStyle = buildTextStyle(settings?.typography?.description, null, viewport);
  const computedMetaStyle = buildTextStyle(settings?.typography?.metadata, null, viewport);

  const effectiveExtBtn = itemSettings.externalPlayButtonOverride
    ? { ...extBtn, ...itemSettings.externalPlayButtonOverride }
    : extBtn;

  const isExtBtnVisible =
    showPlayButton &&
    effectiveExtBtn &&
    effectiveExtBtn.visible !== false &&
    !(viewport === 'mobile' && effectiveExtBtn.showOnMobile === false) &&
    !(viewport !== 'mobile' && effectiveExtBtn.showOnDesktop === false);

  const handleMouseEnter = () => {
    if (!isVideo || !item.media_url || effectiveExtBtn?.hoverPreviewMode !== 'muted') return;
    setHoverPreviewActive(true);
    const durSec = Number(effectiveExtBtn?.previewDuration || 5);
    if (previewTimerRef.current) window.clearTimeout(previewTimerRef.current);
    previewTimerRef.current = window.setTimeout(() => {
      setHoverPreviewActive(false);
    }, durSec * 1000);
  };

  const handleMouseLeave = () => {
    if (previewTimerRef.current) {
      window.clearTimeout(previewTimerRef.current);
      previewTimerRef.current = null;
    }
    if (effectiveExtBtn?.stopPreviewOnLeave !== false) {
      setHoverPreviewActive(false);
    }
  };

  const cardBg = cardDesignOverride?.cardBackground || settings?.colors?.targets?.cards?.background || '#FFFFFF';
  const cardBorder = cardDesignOverride?.borderColor || settings?.colors?.targets?.cards?.borderColor || '#D8D8D8';
  const cardBorderWidth = cardDesignOverride?.borderWidth ?? settings?.colors?.cardBorderWidth ?? 1;
  const cardBorderStyle = settings?.colors?.cardBorderStyle || 'solid';
  const cardRadius = cardDesignOverride?.borderRadius ?? settings?.colors?.cardBorderRadius ?? 12;
  const cardShadow =
    cardDesignOverride?.glow && cardDesignOverride.glow !== 'none'
      ? cardDesignOverride.glow
      : cardDesignOverride?.shadow || settings?.colors?.cardShadow || undefined;

  const imageCustomStyle: React.CSSProperties = {
    borderRadius: itemSettings.borderRadius ? `${itemSettings.borderRadius}px` : undefined,
    border:
      itemSettings.borderWidth > 0
        ? `${itemSettings.borderWidth}px solid ${itemSettings.borderColor || '#B08D45'}`
        : undefined,
    boxShadow: itemSettings.glowColor
      ? `0 0 18px ${itemSettings.glowColor}`
      : itemSettings.shadow || undefined,
    opacity: itemSettings.opacity ?? 1,
    aspectRatio:
      cardDesignOverride?.imageAspectRatio && cardDesignOverride.imageAspectRatio !== 'auto'
        ? cardDesignOverride.imageAspectRatio
        : undefined,
    height:
      cardDesignOverride?.imageHeight && cardDesignOverride.imageHeight !== 'auto'
        ? cardDesignOverride.imageHeight
        : undefined,
  };

  const renderExtIcon = () => {
    const iconSz = Math.max(16, Math.min(34, (effectiveExtBtn?.iconSize || 24) * 0.85));
    const iconClr = effectiveExtBtn?.iconColor || '#FFFFFF';
    if (effectiveExtBtn?.icon === 'film') return <Film size={iconSz} style={{ color: iconClr }} />;
    if (effectiveExtBtn?.icon === 'play-circle') return <PlayCircle size={iconSz} style={{ color: iconClr }} />;
    if (effectiveExtBtn?.icon === 'triangle') {
      return <Triangle size={iconSz} fill={iconClr} className="rotate-90" style={{ color: iconClr }} />;
    }
    return <Play size={iconSz} fill={iconClr} style={{ color: iconClr }} />;
  };

  const mediaVisual = showThumbnail ? (
    <div
      className={`relative ${!cardDesignOverride?.imageAspectRatio ? 'aspect-video' : ''} w-full overflow-hidden bg-neutral-900`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={imageCustomStyle}
    >
      {hoverPreviewActive && isVideo && item.media_url ? (
        <video
          ref={previewVideoRef}
          src={item.media_url}
          muted
          autoPlay
          playsInline
          loop
          className="w-full h-full object-cover"
        />
      ) : item.thumbnail_url || (isImage && item.media_url) ? (
        <img
          src={item.thumbnail_url || item.media_url}
          alt={itemSettings.altText || item.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-neutral-900 via-neutral-900 to-[#2B210E] text-neutral-400 gap-2 py-10">
          {isVideo ? (
            <Film size={28} />
          ) : isImage ? (
            <ImageIcon size={28} />
          ) : item.content_type === 'audio' ? (
            <Mic size={28} />
          ) : (
            <FileText size={28} />
          )}
          <span className="text-xs">{typeLabels[item.content_type] || item.content_type}</span>
        </div>
      )}

      {/* Bottom shadow/glow effect for video cards */}
      {isVideo && (effectiveExtBtn?.bottomShadow || effectiveExtBtn?.bottomGlow) && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-16"
          style={{
              background: effectiveExtBtn.bottomGlow
              ? `linear-gradient(to top, ${effectiveExtBtn.bottomGlowColor || '#B08D45'}, transparent)`
              : `linear-gradient(to top, ${effectiveExtBtn.bottomShadowColor || 'rgba(0,0,0,0.65)'}, transparent)`,
            opacity: effectiveExtBtn.bottomGlow ? effectiveExtBtn.bottomGlowIntensity ?? 0.5 : 0.85,
          }}
        />
      )}

      {/* External Video Play Button */}
      {isVideo && isExtBtnVisible && effectiveExtBtn && (
        <div
          className={`pointer-events-none absolute inset-0 flex p-4 ${
            effectiveExtBtn.position === 'bottom-right'
              ? 'items-end justify-start'
              : effectiveExtBtn.position === 'bottom-left'
                ? 'items-end justify-end'
                : 'items-center justify-center'
          }`}
        >
          <div
            className={`flex items-center justify-center ${
              effectiveExtBtn.hoverEffect === 'scale' ? 'group-hover:scale-110' : ''
            } ${effectiveExtBtn.activeEffect === 'press' ? 'group-active:scale-95' : ''}`}
            style={{
              width: `${Math.max(36, Math.min(84, effectiveExtBtn.circleSize || 56))}px`,
              height: `${Math.max(36, Math.min(84, effectiveExtBtn.circleSize || 56))}px`,
              backgroundColor: effectiveExtBtn.circleBackground || '#B08D45',
              opacity: effectiveExtBtn.circleOpacity ?? 0.92,
              transition: `all ${effectiveExtBtn.transitionSpeedMs ?? 200}ms ease`,
              borderRadius:
                effectiveExtBtn.shape === 'square'
                  ? '0px'
                  : effectiveExtBtn.shape === 'rounded'
                    ? '12px'
                    : '9999px',
              border: `${effectiveExtBtn.borderWidth ?? 2}px solid ${effectiveExtBtn.borderColor || '#FFFFFF'}`,
              boxShadow: effectiveExtBtn.glow
                ? `0 0 20px ${effectiveExtBtn.glowColor || 'rgba(176,141,69,0.55)'}`
                : effectiveExtBtn.shadow || undefined,
              animation:
                effectiveExtBtn.animation === 'float'
                  ? `alharbiFloat ${effectiveExtBtn.animationSpeed || 2.5}s ease-in-out infinite`
                  : undefined,
            }}
          >
            {renderExtIcon()}
          </div>
        </div>
      )}

      {/* Duration stamp for videos */}
      {isVideo && item.duration > 0 && (
        <span
          dir="ltr"
          className="absolute bottom-2 left-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-medium text-white tabular-nums"
        >
          {formatDuration(item.duration)}
        </span>
      )}
    </div>
  ) : null;

  // Clickable custom destination URL behavior
  const hasCustomLink = Boolean(item.link_enabled && item.link_url);
  const destinationPath = `/content/${encodeURIComponent(item.slug)}`;
  const customLinkLabel =
    item.link_label || itemSettings.linkLabel || uiTexts?.openExternalLinkLabel || 'فتح الرابط المرتبط';

  const displayedDate =
    itemSettings.dateIsManual && itemSettings.customPublishedAt
      ? itemSettings.customPublishedAt
      : formatArabicDate(item.published_at || item.created_at, settings?.other?.dateFormat || 'arabic');

  const renderLinkWrapper = (children: React.ReactNode) => {
    if (!children) return null;
    if (!hasCustomLink) {
      return (
        <Link to={destinationPath} className="block">
          {children}
        </Link>
      );
    }
    if (item.link_url.startsWith('/') && !item.link_new_tab) {
      return (
        <Link to={item.link_url} className="block">
          {children}
        </Link>
      );
    }
    return (
      <a
        href={item.link_url}
        target={item.link_new_tab ? '_blank' : undefined}
        rel={item.link_new_tab ? 'noopener noreferrer' : undefined}
        className="block"
      >
        {children}
      </a>
    );
  };

  const hoverClass =
    cardDesignOverride?.hoverEffect === 'none'
      ? ''
      : cardDesignOverride?.hoverEffect === 'zoom'
        ? 'hover:scale-[1.02]'
        : 'hover:-translate-y-0.5 hover:shadow-md';

  return (
    <article
      className={`group flex flex-col overflow-hidden transition-all duration-200 h-full ${hoverClass}`}
      style={{
        backgroundColor: cardBg,
        border: `${cardBorderWidth}px ${cardBorderStyle} ${cardBorder}`,
        borderRadius: `${cardRadius}px`,
        boxShadow: cardShadow,
      }}
    >
      {renderLinkWrapper(mediaVisual)}

      <div
        className="flex flex-1 flex-col justify-between"
        style={{
          padding:
            cardDesignOverride?.cardPadding !== undefined
              ? `${cardDesignOverride.cardPadding}px`
              : variant === 'compact'
                ? '14px'
                : '16px',
        }}
      >
        <div>
          {/* Clean unboxed zero-pill metadata */}
          {(showBadge || showDate) && (
            <div
              className="flex flex-wrap items-center gap-1.5 text-xs mb-1.5"
              style={{
                ...computedMetaStyle,
                color: cardDesignOverride?.metaColor || computedMetaStyle.color || '#737373',
              }}
            >
              {showBadge && (
                <span className="font-semibold text-[#8C6A2F]">
                  {typeLabels[item.content_type] || item.content_type}
                </span>
              )}
              {(item.child_page_title || item.page_title) && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{item.child_page_title || item.page_title}</span>
                </>
              )}
              {showDate && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{displayedDate}</span>
                </>
              )}
            </div>
          )}

          {showTitle && (
            <Link to={hasCustomLink && item.link_url.startsWith('/') && !item.link_new_tab ? item.link_url : destinationPath} className="block">
              <h3 className="line-clamp-2 transition-opacity group-hover:opacity-85" style={computedTitleStyle}>
                {item.title}
              </h3>
            </Link>
          )}

          {showDescription && item.description && variant !== 'compact' && (
            <p
              className="mt-2 line-clamp-2"
              style={{
                ...computedDescStyle,
                color: computedDescStyle.color || '#525252',
              }}
            >
              {item.description}
            </p>
          )}
        </div>

        {hasCustomLink && (
          <div
            className="mt-3 pt-2.5 border-t border-neutral-100 flex items-center justify-end text-xs tabular-nums"
            style={{
              ...computedMetaStyle,
              color: cardDesignOverride?.metaColor || computedMetaStyle.color || '#737373',
            }}
          >
            <a
              href={item.link_url}
              target={item.link_new_tab ? '_blank' : undefined}
              rel={item.link_new_tab ? 'noopener noreferrer' : undefined}
              className="text-[#8C6A2F] font-semibold hover:underline"
            >
              {customLinkLabel}
            </a>
          </div>
        )}
      </div>
    </article>
  );
}
