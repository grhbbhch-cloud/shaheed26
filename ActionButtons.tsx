import React from 'react';
import {
  ArrowLeft,
  Bookmark,
  Check,
  Copy,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Film,
  Globe,
  Image as ImageIcon,
  Link2,
  Play,
  Share2,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePlatform } from '../context/PlatformContext';
import { buildGradientBoxStyle, buildTextStyle, sanitizeSvgMarkup } from '../lib/styleEngine';
import type { ButtonConfig } from '../types/platform';

const BTN_ICONS: Record<string, React.ComponentType<any>> = {
  ArrowLeft,
  ExternalLink,
  Download,
  Share2,
  Copy,
  Play,
  Eye,
  FileText,
  Film,
  Image: ImageIcon,
  Globe,
  Link2,
  Bookmark,
  Sparkles,
  Check,
};

interface ActionButtonsProps {
  buttons: ButtonConfig[];
  placement?: ButtonConfig['placement'];
  contextUrl?: string;
  contextTitle?: string;
  downloadUrl?: string;
  className?: string;
}

export function ActionButtons({
  buttons,
  placement,
  contextUrl,
  contextTitle,
  downloadUrl,
  className = '',
}: ActionButtonsProps) {
  const navigate = useNavigate();
  const { settings, viewport } = usePlatform();
  const [copiedId, setCopiedId] = React.useState<string | null>(null);
  const baseButtonTypo = buildTextStyle(settings?.typography?.buttons, null, viewport);

  const visibleButtons = (buttons || [])
    .filter((b) => b.visible && (!placement || b.placement === placement || b.placement === 'global'))
    .sort((a, b) => a.order - b.order);

  if (visibleButtons.length === 0) return null;

  const handleClick = async (btn: ButtonConfig) => {
    if (btn.disabled) return;
    if (btn.action === 'copy') {
      const target = btn.destination || contextUrl || window.location.href;
      await navigator.clipboard?.writeText(target).catch(() => {});
      setCopiedId(btn.id);
      setTimeout(() => setCopiedId(null), 2000);
      return;
    }
    if (btn.action === 'share') {
      const url = btn.destination || contextUrl || window.location.href;
      if (navigator.share) {
        await navigator.share({ title: contextTitle || document.title, url }).catch(() => {});
      } else {
        await navigator.clipboard?.writeText(url).catch(() => {});
        setCopiedId(btn.id);
        setTimeout(() => setCopiedId(null), 2000);
      }
      return;
    }
    if (btn.action === 'download') {
      const target = btn.destination || downloadUrl;
      if (target) {
        const a = document.createElement('a');
        a.href = target;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      return;
    }
    if (btn.action === 'scroll' && btn.destination) {
      const el = document.querySelector(btn.destination);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    if (btn.destination) {
      if (btn.destination.startsWith('/') && !btn.openInNewTab) {
        navigate(btn.destination);
      } else if (btn.openInNewTab) {
        window.open(btn.destination, '_blank', 'noopener,noreferrer');
      } else {
        window.location.assign(btn.destination);
      }
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {visibleButtons.map((btn) => {
        const IconComp = BTN_ICONS[btn.icon] || ArrowLeft;
        const gradStyle =
          btn.styleMode === 'gradient' || btn.styleMode === 'animated-gradient'
            ? buildGradientBoxStyle({
                ...btn.gradient,
                enabled: true,
                animated: btn.styleMode === 'animated-gradient' || btn.gradient?.animated,
              })
            : {};

        const hoverClass =
          btn.hoverEffect === 'lift'
            ? 'hover:-translate-y-0.5'
            : btn.hoverEffect === 'scale'
              ? 'hover:scale-105'
              : btn.hoverEffect === 'shine'
                ? 'alharbi-btn-shine'
                : btn.hoverEffect === 'glow'
                  ? 'hover:brightness-110'
                  : '';

        const isOutline = btn.styleMode === 'outline';
        const isTransparent = btn.styleMode === 'transparent';

        return (
          <button
            key={btn.id}
            type="button"
            disabled={btn.disabled}
            onClick={() => handleClick(btn)}
            className={`inline-flex items-center justify-center gap-2 font-semibold transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0 ${hoverClass}`}
            style={{
              ...baseButtonTypo,
              backgroundColor:
                isOutline || isTransparent
                  ? 'transparent'
                  : btn.styleMode === 'gradient' || btn.styleMode === 'animated-gradient'
                    ? undefined
                    : btn.background || '#B08D45',
              color: btn.textColor || (isOutline ? btn.borderColor || '#B08D45' : '#FFFFFF'),
              border: `${btn.borderWidth ?? (isOutline ? 1.5 : 0)}px solid ${btn.borderColor || '#B08D45'}`,
              borderRadius: `${btn.borderRadius ?? 8}px`,
              padding: `${btn.paddingY ?? 9}px ${btn.paddingX ?? 18}px`,
              boxShadow:
                btn.glow && btn.glow !== 'none'
                  ? btn.glow
                  : btn.shadow && btn.shadow !== 'none'
                    ? btn.shadow
                    : undefined,
              width: btn.width && btn.width !== 'auto' ? btn.width : undefined,
              height: btn.height && btn.height !== 'auto' ? btn.height : undefined,
              ...gradStyle,
            }}
          >
            {btn.styleMode !== 'text-only' &&
              (btn.customIconUrl ? (
                btn.customIconUrl.trim().startsWith('<svg') ? (
                  <span
                    className="inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full shrink-0"
                    style={{
                      width: btn.iconSize || 16,
                      height: btn.iconSize || 16,
                      color: btn.iconColor || btn.textColor || '#FFFFFF',
                    }}
                    dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(btn.customIconUrl) }}
                  />
                ) : (
                  <img
                    src={btn.customIconUrl}
                    alt=""
                    className="object-contain shrink-0"
                    style={{ width: btn.iconSize || 16, height: btn.iconSize || 16 }}
                  />
                )
              ) : (
                <IconComp
                  size={btn.iconSize || 16}
                  style={{ color: btn.iconColor || btn.textColor || '#FFFFFF' }}
                />
              ))}
            {btn.styleMode !== 'icon-only' && (
              <span>{copiedId === btn.id ? 'تم النسخ' : btn.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
