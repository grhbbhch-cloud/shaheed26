import React from 'react';
import { Award, BadgeCheck, CheckCircle2, ShieldCheck, Star } from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import { sanitizeSvgMarkup } from '../lib/styleEngine';
import type { ContentRecord, OfficialAccountConfig } from '../types/platform';

interface OfficialAccountAttributionProps {
  item?: ContentRecord;
  configOverride?: OfficialAccountConfig;
  placement?: 'below-media' | 'below-title' | 'below-content';
  previewMode?: boolean;
  className?: string;
}

export function OfficialAccountAttribution({
  item,
  configOverride,
  placement = 'below-media',
  previewMode = false,
  className = '',
}: OfficialAccountAttributionProps) {
  const { settings } = usePlatform();
  const config = configOverride || settings?.officialAccount;

  if (!config || config.deleted) return null;
  if (!previewMode && !config.enabled) return null;

  if (!previewMode && item) {
    let itemSettings: any = {};
    try {
      itemSettings = JSON.parse(item.settings_json || '{}');
    } catch {
      itemSettings = {};
    }
    if (!itemSettings.showOfficialAccount) return null;
    const itemPlacement =
      itemSettings.officialAccountPlacement && itemSettings.officialAccountPlacement !== 'inherit'
        ? itemSettings.officialAccountPlacement
        : config.defaultPlacement || 'below-media';
    if (placement !== itemPlacement) return null;
  }

  const renderBadge = () => {
    if (!config.badgeEnabled) return null;
    const size = Math.max(12, Math.min(36, Number(config.badgeSize || 18)));
    const color = config.badgeColor || '#D4AF65';

    if (config.badgeIcon === 'custom-svg' && config.badgeCustomSvg?.trim()) {
      const clean = sanitizeSvgMarkup(config.badgeCustomSvg);
      return (
        <span
          aria-label="حساب موثق"
          title="حساب موثق"
          className="inline-flex items-center justify-center shrink-0"
          style={{ width: size, height: size, color }}
          dangerouslySetInnerHTML={{ __html: clean }}
        />
      );
    }

    const iconProps = { size, style: { color }, className: 'shrink-0', 'aria-label': 'حساب موثق' };
    switch (config.badgeIcon) {
      case 'CheckCircle2':
        return <CheckCircle2 {...iconProps} />;
      case 'ShieldCheck':
        return <ShieldCheck {...iconProps} />;
      case 'Award':
        return <Award {...iconProps} />;
      case 'Star':
        return <Star {...iconProps} fill={color} />;
      case 'BadgeCheck':
      default:
        return <BadgeCheck {...iconProps} />;
    }
  };

  const alignJustify =
    config.alignment === 'center'
      ? 'justify-center text-center'
      : config.alignment === 'left'
        ? 'justify-end text-left'
        : 'justify-start text-right';

  return (
    <div
      className={`flex items-center ${alignJustify} ${className}`}
      style={{
        backgroundColor: config.backgroundColor || '#F7F4EC',
        border: `${config.borderWidth ?? 1}px solid ${config.borderColor || '#E8E0D0'}`,
        borderRadius: `${config.borderRadius ?? 12}px`,
        boxShadow: config.shadow && config.shadow !== 'none' ? config.shadow : undefined,
        padding: `${config.padding ?? 14}px`,
        gap: `${config.spacing ?? 12}px`,
      }}
    >
      {config.showAvatar && (
        <div
          className="w-11 h-11 rounded-full overflow-hidden shrink-0 border flex items-center justify-center bg-white"
          style={{ borderColor: config.borderColor || '#E8E0D0' }}
        >
          {config.avatarUrl ? (
            <img
              src={config.avatarUrl}
              alt={config.displayName || 'الحساب الرسمي'}
              className="w-full h-full object-cover"
            />
          ) : (
            <ShieldCheck size={20} style={{ color: config.badgeColor || '#D4AF65' }} />
          )}
        </div>
      )}

      <div className="min-w-0 space-y-0.5">
        <div className={`flex flex-wrap items-center gap-1.5 ${config.alignment === 'center' ? 'justify-center' : ''}`}>
          {config.wordingPrefix?.trim() && (
            <span className="text-xs font-medium" style={{ color: config.prefixColor || '#737373' }}>
              {config.wordingPrefix}
            </span>
          )}
          <span
            className="inline-flex items-center gap-1.5"
            style={{
              color: config.nameColor || '#171717',
              fontFamily: config.nameFontFamily ? `'${config.nameFontFamily}', 'Cairo', sans-serif` : undefined,
              fontSize: config.nameFontSize || '15px',
              fontWeight: config.nameFontWeight || '700',
            }}
          >
            <span>{config.displayName || 'الحساب الرسمي'}</span>
            {renderBadge()}
          </span>
        </div>

        {config.showDescription && config.description?.trim() && (
          <p className="text-xs leading-relaxed" style={{ color: config.descriptionColor || '#525252' }}>
            {config.description}
          </p>
        )}
      </div>
    </div>
  );
}
