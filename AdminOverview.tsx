import React, { useEffect, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Database,
  Eye,
  EyeOff,
  FileText,
  Film,
  FolderTree,
  HardDrive,
  Image as ImageIcon,
  Plus,
  Save,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import { useAdmin, type AdminSectionId } from '../../../context/AdminContext';
import { formatArabicDate, formatBytes, STATUS_LABELS } from '../../../lib/styleEngine';
import type { OverviewCardConfig, OverviewConfig } from '../../../types/platform';

const DEFAULT_CARDS: OverviewCardConfig[] = [
  { id: 'ov-pages', label: 'إجمالي الصفحات', metricKey: 'totalPages', icon: 'FolderTree', color: '#8C6A2F', bgColor: '#F7F4EC', visible: true, order: 1, linkSection: 'pages' },
  { id: 'ov-content', label: 'إجمالي المواد', metricKey: 'totalContent', icon: 'FileText', color: '#171717', bgColor: '#F5F5F5', visible: true, order: 2, linkSection: 'content' },
  { id: 'ov-videos', label: 'الفيديوهات', metricKey: 'videoCount', icon: 'Film', color: '#B08D45', bgColor: '#F7F4EC', visible: true, order: 3, linkSection: 'videos' },
  { id: 'ov-images', label: 'الصور والمعارض', metricKey: 'imageCount', icon: 'Image', color: '#2563EB', bgColor: '#EFF6FF', visible: true, order: 4, linkSection: 'images' },
  { id: 'ov-articles', label: 'المقالات والتقارير', metricKey: 'articleCount', icon: 'BookOpen', color: '#0F766E', bgColor: '#F0FDFA', visible: true, order: 5, linkSection: 'content' },
  { id: 'ov-storage', label: 'المساحة المستخدمة', metricKey: 'storageUsedBytes', icon: 'HardDrive', color: '#4B5563', bgColor: '#F3F4F6', visible: true, order: 6, linkSection: 'storage' },
  { id: 'ov-errors', label: 'أخطاء غير محلولة', metricKey: 'recentErrors', icon: 'AlertTriangle', color: '#DC2626', bgColor: '#FEF2F2', visible: true, order: 7, linkSection: 'health' },
  { id: 'ov-backups', label: 'النسخ الاحتياطية', metricKey: 'backupCount', icon: 'Database', color: '#7C3AED', bgColor: '#F5F3FF', visible: true, order: 8, linkSection: 'backups' },
];

function renderCardIcon(name: string, color: string) {
  const style = { color: color || '#8C6A2F' };
  switch (name) {
    case 'FolderTree':
      return <FolderTree size={20} style={style} />;
    case 'FileText':
      return <FileText size={20} style={style} />;
    case 'Film':
      return <Film size={20} style={style} />;
    case 'Image':
      return <ImageIcon size={20} style={style} />;
    case 'HardDrive':
      return <HardDrive size={20} style={style} />;
    case 'AlertTriangle':
      return <AlertTriangle size={20} style={style} />;
    case 'Database':
      return <Database size={20} style={style} />;
    default:
      return <Sparkles size={20} style={style} />;
  }
}

export function AdminOverview() {
  const { overview, setActiveSection, settings, saveCategory } = useAdmin();
  const [liveOverview, setLiveOverview] = useState<any>(overview);
  const [customizing, setCustomizing] = useState(false);
  const [draft, setDraft] = useState<OverviewConfig>({
    cards: DEFAULT_CARDS,
    recentActivityLimit: 10,
    showQuickActions: true,
    showRecentPanel: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLiveOverview(overview);
  }, [overview]);

  useEffect(() => {
    if (settings?.overview) {
      setDraft({
        cards: settings.overview.cards?.length ? structuredClone(settings.overview.cards) : DEFAULT_CARDS,
        recentActivityLimit: settings.overview.recentActivityLimit ?? 10,
        showQuickActions: settings.overview.showQuickActions !== false,
        showRecentPanel: settings.overview.showRecentPanel !== false,
      });
    }
  }, [settings?.overview]);

  const limit = draft.recentActivityLimit || 10;
  useEffect(() => {
    fetch(`/api/admin/overview?limit=${limit}`, { credentials: 'include', cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) setLiveOverview(d);
      })
      .catch(() => {});
  }, [limit]);

  const stats = liveOverview?.stats;
  const recentActivity = liveOverview?.recentActivity || [];
  const recentContent = liveOverview?.recentContent || [];
  const recentMedia = liveOverview?.recentMedia || [];

  const cardStyle: React.CSSProperties = {
    backgroundColor: settings?.adminTheme?.cardBg || '#FFFFFF',
    borderColor: settings?.adminTheme?.cardBorder || '#D8D8D8',
    boxShadow: settings?.adminTheme?.cardShadow || undefined,
  };

  const activeCards = [...(draft.cards || DEFAULT_CARDS)]
    .filter((c) => c.visible)
    .sort((a, b) => a.order - b.order);

  const primaryKpis = activeCards.filter((c) =>
    ['totalPages', 'totalContent', 'publishedContent', 'draftContent', 'videoCount', 'imageCount'].includes(c.metricKey)
  );
  const secondaryCards = activeCards.filter(
    (c) =>
      !['totalPages', 'totalContent', 'publishedContent', 'draftContent', 'videoCount', 'imageCount'].includes(
        c.metricKey
      )
  );

  const renderMetricBody = (card: OverviewCardConfig) => {
    switch (card.metricKey) {
      case 'totalPages':
        return {
          value: stats ? String(stats.totalPages) : '—',
          sub: `منها ${stats ? stats.childPages : 0} صفحة فرعية`,
        };
      case 'totalContent':
      case 'publishedContent':
        return {
          value: stats
            ? String(card.metricKey === 'publishedContent' ? stats.publishedContent : stats.totalContent)
            : '—',
          sub: `المنشور: ${stats?.publishedContent ?? 0} · مسودات: ${stats?.draftContent ?? 0}`,
        };
      case 'draftContent':
        return {
          value: stats ? String(stats.draftContent) : '—',
          sub: `من أصل ${stats?.totalContent ?? 0} مادة`,
        };
      case 'videoCount':
        return {
          value: stats ? String(stats.videoCount) : '—',
          sub: `قيد المعالجة: ${stats?.processingItems ?? 0} · صوتيات: ${stats?.audioCount ?? 0}`,
        };
      case 'imageCount':
        return {
          value: stats ? String(stats.imageCount) : '—',
          sub: `المقالات والتقارير: ${stats?.articleCount ?? 0} · وثائق: ${stats?.documentCount ?? 0}`,
        };
      case 'articleCount':
        return {
          value: stats ? String(stats.articleCount) : '—',
          sub: `وثائق: ${stats?.documentCount ?? 0}`,
        };
      case 'storageUsedBytes':
        return {
          value: stats ? formatBytes(stats.storageUsedBytes) : '—',
          sub: `الملفات: ${stats?.fileCount ?? 0} · مفقود: ${stats?.missingFilesCount ?? 0}`,
        };
      case 'recentErrors':
        return {
          value: stats ? String(stats.recentErrors) : '—',
          sub:
            stats?.recentErrors > 0
              ? 'سجلات تتطلب المراجعة في صحة النظام'
              : 'جميع الأنظمة تعمل بصورة طبيعية',
        };
      case 'backupCount':
        return {
          value: stats?.backupCount > 0 ? 'محفوظ ونشط' : 'جاهز للنسخ الاحتياطي',
          sub: `SQLite WAL نشط · ${stats?.backupCount ?? 0} نسخة محفوظة`,
        };
      case 'uploadsInProgress':
        return {
          value: stats ? String(stats.uploadsInProgress ?? 0) : '—',
          sub: 'جلسات الرفع الجارية',
        };
      case 'processingItems':
        return {
          value: stats ? String(stats.processingItems ?? 0) : '—',
          sub: 'مهام معالجة الفيديو والوسائط',
        };
      default:
        return {
          value: card.customValue || 'فتح القسم',
          sub: card.linkSection ? `انتقال سريع إلى ${card.linkSection}` : 'بطاقة مخصصة',
        };
    }
  };

  const moveCard = (idx: number, delta: number) => {
    const sorted = [...draft.cards].sort((a, b) => a.order - b.order);
    const target = idx + delta;
    if (target < 0 || target >= sorted.length) return;
    [sorted[idx], sorted[target]] = [sorted[target], sorted[idx]];
    setDraft({
      ...draft,
      cards: sorted.map((c, i) => ({ ...c, order: i + 1 })),
    });
  };

  const handleSaveCustomOverview = async () => {
    setSaving(true);
    await saveCategory('overview', draft, 'تحديث تخصيص بطاقات نظرة عامة');
    setSaving(false);
    setCustomizing(false);
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions & Overview Customizer Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {draft.showQuickActions ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveSection('content')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
            >
              <Plus size={15} />
              <span>نشر مادة جديدة</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('uploads')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-800 text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
            >
              <Upload size={15} />
              <span>رفع ملفات وسائط</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('pages')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-800 text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
            >
              <FolderTree size={15} />
              <span>إدارة الصفحات</span>
            </button>
          </div>
        ) : (
          <div />
        )}

        <button
          type="button"
          onClick={() => setCustomizing((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-bold text-neutral-800 hover:bg-neutral-50 cursor-pointer"
        >
          <SlidersHorizontal size={14} className="text-[#8C6A2F]" />
          <span>{customizing ? 'إغلاق تخصيص البطاقات' : 'تخصيص البطاقات ولوحة البداية'}</span>
        </button>
      </div>

      {/* Interactive Overview Customizer */}
      {customizing && (
        <div className="rounded-xl border border-[#B08D45]/50 bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-100">
            <div>
              <h3 className="text-sm font-extrabold text-neutral-900">تخصيص بطاقات وإحصاءات لوحة البداية</h3>
              <p className="text-xs text-neutral-500">تحكم بظهور البطاقات، مسمياتها، ألوانها، ترتيبها، وإضافة بطاقات اختصار مخصصة.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    cards: [
                      ...prev.cards,
                      {
                        id: `custom-${Date.now()}`,
                        label: 'اختصار مخصص',
                        metricKey: 'custom',
                        customValue: 'إدارة',
                        visible: true,
                        color: '#8C6A2F',
                        bgColor: '#F7F4EC',
                        icon: 'Sparkles',
                        linkSection: 'uploads',
                        order: prev.cards.length + 1,
                      },
                    ],
                  }))
                }
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-300 text-xs font-bold text-neutral-800 cursor-pointer"
              >
                <Plus size={13} /> بطاقة مخصصة
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={handleSaveCustomOverview}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
              >
                <Save size={13} />
                <span>{saving ? 'جاري الحفظ...' : 'حفظ التخصيص'}</span>
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs font-semibold">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.showQuickActions}
                onChange={(e) => setDraft({ ...draft, showQuickActions: e.target.checked })}
                className="accent-[#B08D45]"
              />
              <span>إظهار أزرار الإجراءات السريعة</span>
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={draft.showRecentPanel}
                onChange={(e) => setDraft({ ...draft, showRecentPanel: e.target.checked })}
                className="accent-[#B08D45]"
              />
              <span>إظهار لوحات النشاط وأحدث المحتوى</span>
            </label>
            <div className="inline-flex items-center gap-2">
              <span>عدد عناصر السجل:</span>
              <input
                type="number"
                min={3}
                max={50}
                value={draft.recentActivityLimit}
                onChange={(e) => setDraft({ ...draft, recentActivityLimit: Number(e.target.value) || 10 })}
                className="w-16 rounded border border-neutral-300 px-2 py-1 text-xs tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-2">
            {[...draft.cards]
              .sort((a, b) => a.order - b.order)
              .map((c, idx) => (
                <div
                  key={c.id}
                  className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2.5 rounded-lg border border-neutral-200 bg-neutral-50 text-xs"
                >
                  <input
                    type="text"
                    value={c.label}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        cards: draft.cards.map((x) => (x.id === c.id ? { ...x, label: e.target.value } : x)),
                      })
                    }
                    className="sm:col-span-4 rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-bold"
                  />
                  {c.metricKey === 'custom' ? (
                    <input
                      type="text"
                      value={c.customValue || ''}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          cards: draft.cards.map((x) =>
                            x.id === c.id ? { ...x, customValue: e.target.value } : x
                          ),
                        })
                      }
                      placeholder="قيمة مختصرة..."
                      className="sm:col-span-2 rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                    />
                  ) : (
                    <span className="sm:col-span-2 text-[11px] text-neutral-500 font-mono">{c.metricKey}</span>
                  )}
                  <input
                    type="color"
                    value={c.color || '#8C6A2F'}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        cards: draft.cards.map((x) => (x.id === c.id ? { ...x, color: e.target.value } : x)),
                      })
                    }
                    className="sm:col-span-1 h-7 w-10 rounded border border-neutral-300 cursor-pointer"
                  />
                  <select
                    value={c.linkSection || 'overview'}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        cards: draft.cards.map((x) =>
                          x.id === c.id ? { ...x, linkSection: e.target.value as AdminSectionId } : x
                        ),
                      })
                    }
                    className="sm:col-span-3 rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                  >
                    <option value="pages">إدارة الصفحات</option>
                    <option value="content">إدارة المحتوى</option>
                    <option value="videos">مكتبة الفيديو</option>
                    <option value="images">مكتبة الصور</option>
                    <option value="uploads">مركز الرفع</option>
                    <option value="storage">التخزين والوسائط</option>
                    <option value="health">صحة النظام</option>
                    <option value="backups">النسخ الاحتياطي</option>
                  </select>
                  <div className="sm:col-span-2 flex items-center justify-end gap-1">
                    <button type="button" onClick={() => moveCard(idx, -1)} className="p-1 cursor-pointer">
                      <ArrowUp size={13} />
                    </button>
                    <button type="button" onClick={() => moveCard(idx, 1)} className="p-1 cursor-pointer">
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          cards: draft.cards.map((x) => (x.id === c.id ? { ...x, visible: !x.visible } : x)),
                        })
                      }
                      className="p-1 cursor-pointer"
                    >
                      {c.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    {c.metricKey === 'custom' && (
                      <button
                        type="button"
                        onClick={() =>
                          setDraft({
                            ...draft,
                            cards: draft.cards.filter((x) => x.id !== c.id),
                          })
                        }
                        className="p-1 text-red-600 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Primary KPI Cards */}
      {primaryKpis.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {primaryKpis.map((card) => {
            const m = renderMetricBody(card);
            return (
              <div
                key={card.id}
                onClick={() => card.linkSection && setActiveSection(card.linkSection as AdminSectionId)}
                className="rounded-xl border p-5 flex items-start justify-between cursor-pointer hover:border-[#B08D45] transition-colors"
                style={cardStyle}
              >
                <div>
                  <div className="text-xs font-medium text-neutral-500">{card.label}</div>
                  <div className="text-3xl font-extrabold text-neutral-900 mt-2 tabular-nums">{m.value}</div>
                  <div className="text-xs text-neutral-500 mt-1 tabular-nums">{m.sub}</div>
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: card.bgColor || '#F7F4EC' }}>
                  {renderCardIcon(card.icon, card.color)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Secondary / Status / Custom Cards */}
      {secondaryCards.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {secondaryCards.map((card) => {
            const m = renderMetricBody(card);
            return (
              <div
                key={card.id}
                onClick={() => card.linkSection && setActiveSection(card.linkSection as AdminSectionId)}
                className="rounded-xl border p-5 flex items-start justify-between cursor-pointer hover:border-[#B08D45] transition-colors"
                style={cardStyle}
              >
                <div>
                  <div className="text-xs font-medium text-neutral-500">{card.label}</div>
                  <div className="text-2xl font-extrabold text-neutral-900 mt-2 tabular-nums">{m.value}</div>
                  <div className="text-xs text-neutral-500 mt-1 tabular-nums">{m.sub}</div>
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: card.bgColor || '#F7F4EC' }}>
                  {renderCardIcon(card.icon, card.color)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom 2 Panels: Recent Activity + Recent Files & Content */}
      {draft.showRecentPanel && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="rounded-xl border p-5" style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity size={17} className="text-[#B08D45]" />
                <h3 className="text-sm font-extrabold text-neutral-900">سجل التغييرات الأخيرة</h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('activity')}
                className="text-xs font-bold text-[#8C6A2F] hover:underline cursor-pointer"
              >
                عرض السجل الكامل
              </button>
            </div>

            {recentActivity.length === 0 ? (
              <p className="py-10 text-center text-xs text-neutral-500">لا توجد سجلات نشاط بعد.</p>
            ) : (
              <div className="divide-y divide-neutral-100 max-h-72 overflow-y-auto">
                {recentActivity.map((log: any) => (
                  <div key={log.id} className="py-2.5 flex items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-neutral-800">{log.details}</div>
                      <div className="text-[11px] text-neutral-500 mt-0.5">
                        {log.category} · {log.actor}
                      </div>
                    </div>
                    <span className="text-[11px] text-neutral-400 whitespace-nowrap tabular-nums">
                      {formatArabicDate(log.created_at, 'arabic')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border p-5" style={cardStyle}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-neutral-900">أحدث الملفات والمحتوى</h3>
              <button
                type="button"
                onClick={() => setActiveSection('uploads')}
                className="text-xs font-bold text-[#8C6A2F] hover:underline cursor-pointer"
              >
                مركز الرفع
              </button>
            </div>

            {recentContent.length === 0 && recentMedia.length === 0 ? (
              <p className="py-10 text-center text-xs text-neutral-500">لا توجد مواد مضافة بعد.</p>
            ) : (
              <div className="space-y-2.5 max-h-72 overflow-y-auto">
                {recentContent.map((c: any) => (
                  <div
                    key={`c-${c.id}`}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-neutral-100 bg-neutral-50"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-neutral-900 truncate">{c.title}</div>
                      <div className="text-[11px] text-neutral-500">
                        {c.content_type} · {STATUS_LABELS[c.status] || c.status}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveSection('content')}
                      className="text-xs font-semibold text-[#8C6A2F] hover:underline shrink-0 cursor-pointer"
                    >
                      إدارة
                    </button>
                  </div>
                ))}
                {recentMedia.map((m: any) => (
                  <div
                    key={`m-${m.id}`}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-neutral-100"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-neutral-800 truncate">
                        {m.original_name}
                      </div>
                      <div className="text-[11px] text-neutral-500 tabular-nums">
                        {m.media_kind} · {formatBytes(m.file_size)}
                      </div>
                    </div>
                    <span className="text-[11px] text-[#8C6A2F] font-semibold">{m.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
