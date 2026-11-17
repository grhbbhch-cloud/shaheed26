import React from 'react';
import {
  Calendar,
  Clock,
  FileText,
  Film,
  Folder,
  Globe,
  Info,
  Shield,
  Sparkles,
  Tag,
  User,
} from 'lucide-react';
import { usePlatform } from '../context/PlatformContext';
import {
  buildGradientBoxStyle,
  CONTENT_TYPE_LABELS,
  formatArabicDate,
  formatDuration,
} from '../lib/styleEngine';
import type { ContentRecord, InfoCardConfig } from '../types/platform';

const FIELD_ICON_MAP: Record<string, React.ComponentType<any>> = {
  Calendar,
  Clock,
  FileText,
  Film,
  Folder,
  Globe,
  Info,
  Shield,
  Sparkles,
  Tag,
  User,
};

interface InfoCardProps {
  item: ContentRecord;
  config: InfoCardConfig;
  dateFormat?: 'arabic' | 'iso' | 'relative';
}

export function InfoCard({ item, config, dateFormat = 'arabic' }: InfoCardProps) {
  const { settings } = usePlatform();
  let itemOverrides: Partial<InfoCardConfig> | null = null;
  let itemSettings: any = {};
  let customMeta: Record<string, string> = {};
  try {
    itemSettings = JSON.parse(item.settings_json || '{}');
    if (itemSettings.infoCardOverride) itemOverrides = itemSettings.infoCardOverride;
  } catch {
    itemSettings = {};
  }
  try {
    customMeta = JSON.parse(item.custom_metadata_json || '{}');
  } catch {
    customMeta = {};
  }

  const eff: InfoCardConfig = {
    ...config,
    ...(itemOverrides || {}),
    fields: itemOverrides?.fields || config.fields,
  };

  if (!eff.enabled || eff.deleted) return null;

  const uiTexts = settings?.uiTexts;
  const typeLabels = uiTexts?.contentTypeLabels || CONTENT_TYPE_LABELS;
  const gradStyle = eff.gradient?.enabled ? buildGradientBoxStyle(eff.gradient) : {};

  const resolveValue = (key: string, customVal?: string): string => {
    if (customVal) return customVal;
    switch (key) {
      case 'badge':
        return item.category || typeLabels[item.content_type] || item.content_type;
      case 'title':
        return item.title;
      case 'description':
        return item.description || '—';
      case 'category':
        return item.child_page_title || item.page_title || item.category || 'عام';
      case 'source':
        return item.source_label || settings?.identity?.siteName || '';
      case 'editor':
        return item.editor_label || 'فريق التحرير والتوثيق';
      case 'publishedAt':
        if (itemSettings.dateIsManual && itemSettings.customPublishedAt) {
          return String(itemSettings.customPublishedAt);
        }
        return formatArabicDate(item.published_at || item.created_at, dateFormat);
      case 'resolution':
        return item.resolution || (item.height ? `${item.height}p` : '—');
      case 'duration':
        return item.duration > 0 ? formatDuration(item.duration) : '—';
      default:
        return customMeta[key] || '—';
    }
  };

  const sortedFields = [...(eff.fields || [])]
    .filter((f) => f.visible && !f.deleted && f.key !== 'views')
    .sort((a, b) => a.order - b.order);
  const visibleFields =
    eff.maxFields && eff.maxFields > 0 ? sortedFields.slice(0, eff.maxFields) : sortedFields;

  const layoutClass =
    eff.layout === 'two-column'
      ? 'grid grid-cols-1 sm:grid-cols-2'
      : eff.layout === 'horizontal'
        ? 'flex flex-wrap items-start'
        : 'flex flex-col';

  return (
    <aside
      className={`transition-all duration-200 ${
        eff.hoverEffect === 'lift'
          ? 'hover:-translate-y-0.5'
          : eff.hoverEffect === 'glow'
            ? 'hover:shadow-lg'
            : ''
      }`}
      style={{
        backgroundColor: eff.background || '#FFFFFF',
        border: `${eff.borderWidth ?? 1}px solid ${eff.borderColor || '#D8D8D8'}`,
        borderRadius: `${eff.borderRadius ?? 12}px`,
        boxShadow: eff.glow && eff.glow !== 'none' ? eff.glow : eff.shadow || undefined,
        padding: `${eff.padding ?? 20}px`,
        width: eff.width || '100%',
        height: eff.height || 'auto',
        ...gradStyle,
      }}
    >
      {eff.showBoxTitle && eff.boxTitle && (
        <h3 className="text-sm font-extrabold text-neutral-900 pb-3 mb-3 border-b" style={{ borderColor: eff.separatorColor || '#E7E7E7' }}>
          {eff.boxTitle}
        </h3>
      )}

      <div className={layoutClass} style={{ gap: `${eff.spacing ?? 12}px` }}>
        {visibleFields.map((field, idx) => {
          const val = resolveValue(field.key, customMeta[`__field_${field.key}`] || field.customValue);
          const IconComp = field.icon ? FIELD_ICON_MAP[field.icon] : undefined;
          return (
            <div
              key={field.key}
              className={eff.layout === 'vertical' ? 'pb-2.5' : 'min-w-[140px] flex-1'}
              style={{
                borderBottom:
                  eff.layout === 'vertical' && idx < visibleFields.length - 1
                    ? `1px solid ${eff.separatorColor || '#E7E7E7'}`
                    : undefined,
                backgroundColor:
                  field.background && field.background !== 'transparent'
                    ? field.background
                    : undefined,
                borderRadius:
                  field.background && field.background !== 'transparent' ? '6px' : undefined,
                padding:
                  field.background && field.background !== 'transparent'
                    ? `${Math.max(4, Number(field.spacing || 6))}px 10px`
                    : eff.layout === 'vertical' && idx < visibleFields.length - 1
                      ? `0 0 ${Math.max(4, Number(field.spacing || 8))}px 0`
                      : undefined,
                textAlign: field.textAlign || eff.textAlign || 'right',
              }}
            >
              <div className="text-[11px] font-medium text-neutral-500 mb-0.5 inline-flex items-center gap-1">
                {IconComp && (
                  <IconComp size={12} style={{ color: field.iconColor || '#B08D45' }} />
                )}
                <span>{field.label}</span>
              </div>
              <div
                className="tabular-nums break-words"
                style={{
                  fontFamily: field.fontFamily ? `'${field.fontFamily}', 'Cairo', sans-serif` : undefined,
                  fontSize: field.fontSize || '14px',
                  color: field.color || '#171717',
                  fontWeight: field.fontWeight ? Number(field.fontWeight) || field.fontWeight : field.key === 'title' ? 700 : 500,
                }}
              >
                {val}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
