import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Image as ImageIcon, Plus, Sparkles, Trash2, Upload } from 'lucide-react';
import { ActionButtons } from '../../../components/ActionButtons';
import { CustomLoader } from '../../../components/CustomLoader';
import { AdminCard, AdminPanelHeader, ColorField, GradientEditor } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { sanitizeSvgMarkup } from '../../../lib/styleEngine';
import { uploadFileInChunks } from '../../../lib/uploadClient';
import type { AllSettings, AnimatedWordConfig, ButtonConfig, IconAssetConfig, LoadingStyleConfig } from '../../../types/platform';

const LOADING_CONTEXTS: Array<{ key: keyof AllSettings['loading']; label: string }> = [
  { key: 'pageNav', label: 'التنقل بين الصفحات' },
  { key: 'videoOpen', label: 'فتح صفحة الفيديو' },
  { key: 'videoBuffer', label: 'تخزين الفيديو مؤقتاً (Buffering)' },
  { key: 'upload', label: 'أثناء الرفع' },
  { key: 'processing', label: 'أثناء المعالجة' },
  { key: 'download', label: 'أثناء التنزيل' },
  { key: 'imageOpen', label: 'فتح معرض الصور' },
  { key: 'relatedLoad', label: 'تحميل المحتوى المشابه' },
];

const BUTTON_ICONS = [
  'ArrowLeft',
  'ExternalLink',
  'Download',
  'Share2',
  'Copy',
  'Play',
  'Eye',
  'FileText',
  'Film',
  'Image',
  'Globe',
  'Link2',
  'Bookmark',
  'Sparkles',
  'Check',
];

const LOADER_ICONS = [
  'Loader2',
  'Play',
  'Upload',
  'Cog',
  'Download',
  'Image',
  'Layers',
  'RefreshCw',
  'Compass',
  'Film',
];

function createEmptyButton(order: number): ButtonConfig {
  return {
    id: `btn-${Date.now()}`,
    label: 'زر جديد',
    icon: 'ArrowLeft',
    customIconUrl: '',
    iconSize: 16,
    iconColor: '#FFFFFF',
    textColor: '#FFFFFF',
    background: '#B08D45',
    gradient: {
      enabled: false,
      type: 'linear',
      angle: 135,
      direction: 'to left',
      position: 'center',
      stops: ['#B08D45', '#D4AF65', '#9c932b'],
      opacity: 1,
      intensity: 1,
      animated: false,
      animationSpeed: 6,
      animationDirection: 'normal',
      loop: true,
    },
    borderColor: '#B08D45',
    borderWidth: 0,
    borderRadius: 8,
    styleMode: 'icon-with-text',
    hoverEffect: 'lift',
    hoverBg: '#8C6A2F',
    hoverText: '#FFFFFF',
    shadow: '0 2px 8px rgba(0,0,0,0.12)',
    glow: 'none',
    paddingX: 18,
    paddingY: 10,
    width: 'auto',
    height: 'auto',
    action: 'url',
    destination: '/p/videos',
    openInNewTab: false,
    placement: 'hero',
    visible: true,
    disabled: false,
    order,
  };
}

export function AdminButtonsLoaders() {
  const { settings, previousSettings, saveCategory, resetCategory, notify } = useAdmin();
  const [tab, setTab] = useState<'buttons' | 'loaders' | 'action-buttons' | 'icon-library'>('buttons');
  const [buttons, setButtons] = useState<ButtonConfig[]>([]);
  const [loadingMap, setLoadingMap] = useState<AllSettings['loading'] | null>(null);
  const [linksCfg, setLinksCfg] = useState<AllSettings['links'] | null>(null);
  const [iconLibrary, setIconLibrary] = useState<IconAssetConfig[]>([]);
  const [newIconForm, setNewIconForm] = useState<{ name: string; kind: 'svg' | 'image'; content: string }>({
    name: '',
    kind: 'svg',
    content: '',
  });
  const [selectedBtnIdx, setSelectedBtnIdx] = useState<number>(0);
  const [selectedLoaderKey, setSelectedLoaderKey] = useState<keyof AllSettings['loading']>('pageNav');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setButtons(structuredClone(settings.buttons || []));
      setLoadingMap(structuredClone(settings.loading));
      setLinksCfg(structuredClone(settings.links));
      setIconLibrary(structuredClone(settings.iconLibrary || []));
    }
  }, [settings]);

  if (!settings || !loadingMap || !linksCfg) return null;

  const defaultButtonStyles: NonNullable<AllSettings['links']['buttonStyles']> = {
    downloadBg: '#B08D45',
    downloadText: '#FFFFFF',
    downloadHoverBg: '#8C6A2F',
    shareBg: '#171717',
    shareText: '#FFFFFF',
    copyBg: '#F7F4EC',
    copyText: '#171717',
    borderRadius: 10,
    size: 'md',
    ...(linksCfg.buttonStyles || {}),
  };

  const updateLinkBtnStyles = (patch: Partial<NonNullable<AllSettings['links']['buttonStyles']>>) => {
    setLinksCfg((prev) =>
      prev
        ? {
            ...prev,
            buttonStyles: {
              ...defaultButtonStyles,
              ...patch,
            },
          }
        : prev
    );
  };

  const activeBtn = buttons[selectedBtnIdx] || null;
  const activeLoader: LoadingStyleConfig = loadingMap[selectedLoaderKey];

  const updateButton = (idx: number, patch: Partial<ButtonConfig>) => {
    setButtons((prev) => prev.map((b, i) => (i === idx ? { ...b, ...patch } : b)));
  };

  const updateLoader = (patch: Partial<LoadingStyleConfig>) => {
    setLoadingMap((prev) =>
      prev
        ? {
            ...prev,
            [selectedLoaderKey]: {
              ...prev[selectedLoaderKey],
              ...patch,
            },
          }
        : prev
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (tab === 'buttons') {
        await saveCategory('buttons', buttons, 'تحديث الأزرار والرموز');
      } else if (tab === 'loaders') {
        await saveCategory('loading', loadingMap, 'تحديث حركات وأنماط التحميل');
      } else if (tab === 'icon-library') {
        await saveCategory('iconLibrary', iconLibrary, 'تحديث مكتبة الأيقونات');
      } else {
        await saveCategory('links', linksCfg, 'تحديث أنماط أزرار التحميل والمشاركة');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleUploadBtnIcon = async (file: File) => {
    if (selectedBtnIdx < 0 || !activeBtn) return;
    try {
      const up = await uploadFileInChunks(file);
      updateButton(selectedBtnIdx, { customIconUrl: up.media.public_url });
      notify('تم رفع وتعيين أيقونة الزر');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل رفع الأيقونة', 'error');
    }
  };

  const handleUploadLibraryImage = async (file: File) => {
    try {
      const up = await uploadFileInChunks(file);
      setNewIconForm((prev) => ({ ...prev, kind: 'image', content: up.media.public_url, name: prev.name || file.name.replace(/\.[^.]+$/, '') }));
      notify('تم رفع صورة الأيقونة بنجاح');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل رفع الصورة', 'error');
    }
  };

  const handleAddIconToLibrary = () => {
    if (!newIconForm.name.trim() || !newIconForm.content.trim()) {
      notify('أدخل اسم الأيقونة ومحتواها (SVG أو رابط الصورة)', 'error');
      return;
    }
    const contentClean = newIconForm.kind === 'svg' ? sanitizeSvgMarkup(newIconForm.content) : newIconForm.content.trim();
    const item: IconAssetConfig = {
      id: `icon-${Date.now()}`,
      name: newIconForm.name.trim(),
      kind: newIconForm.kind,
      content: contentClean,
      createdAt: new Date().toISOString(),
    };
    setIconLibrary((prev) => [item, ...prev]);
    setNewIconForm({ name: '', kind: 'svg', content: '' });
    notify('تمت إضافة الأيقونة — اضغط حفظ التغييرات للاعتماد');
  };

  const activeCategory: keyof AllSettings =
    tab === 'buttons'
      ? 'buttons'
      : tab === 'loaders'
        ? 'loading'
        : tab === 'icon-library'
          ? 'iconLibrary'
          : 'links';

  const handleCancel = () => {
    if (tab === 'buttons') setButtons(structuredClone(settings.buttons || []));
    else if (tab === 'loaders') setLoadingMap(structuredClone(settings.loading));
    else if (tab === 'icon-library') setIconLibrary(structuredClone(settings.iconLibrary || []));
    else setLinksCfg(structuredClone(settings.links));
    notify('تم إلغاء التعديلات غير المحفوظة', 'info');
  };

  const handleRevertPrevious = () => {
    const prev = previousSettings[activeCategory];
    if (!prev) return;
    if (tab === 'buttons') setButtons(structuredClone(prev));
    else if (tab === 'loaders') setLoadingMap(structuredClone(prev));
    else if (tab === 'icon-library') setIconLibrary(structuredClone(prev));
    else setLinksCfg(structuredClone(prev));
    notify('تمت استعادة الإعدادات السابقة في المعاينة؛ اضغط «حفظ وتطبيق التغييرات» لتثبيتها', 'info');
  };

  const hasUnsavedChanges =
    tab === 'buttons'
      ? JSON.stringify(buttons) !== JSON.stringify(settings.buttons || [])
      : tab === 'loaders'
        ? JSON.stringify(loadingMap) !== JSON.stringify(settings.loading)
        : tab === 'icon-library'
          ? JSON.stringify(iconLibrary) !== JSON.stringify(settings.iconLibrary || [])
          : JSON.stringify(linksCfg) !== JSON.stringify(settings.links);

  const hasPreviousSnapshot = Boolean(previousSettings[activeCategory]);

  return (
    <div>
      <AdminPanelHeader
        title="إدارة الأزرار والرموز وحركات التحميل"
        subtitle="التحكم الكامل بأزرار الإجراءات التفاعلية ومكتبة الأيقونات ومؤشرات التحميل المخصصة في جميع المواضع"
        onSave={handleSave}
        onCancel={handleCancel}
        onRevertPrevious={handleRevertPrevious}
        onReset={() => resetCategory(activeCategory)}
        saving={saving}
        hasUnsavedChanges={hasUnsavedChanges}
        hasPreviousSnapshot={hasPreviousSnapshot}
      />

      <div className="flex flex-wrap gap-2 mb-5">
        <button
          type="button"
          onClick={() => setTab('buttons')}
          className={`px-4 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
            tab === 'buttons'
              ? 'bg-[#B08D45] text-white border-[#B08D45]'
              : 'bg-white text-neutral-700 border-neutral-300'
          }`}
        >
          الأزرار والرموز التفاعلية ({buttons.length})
        </button>
        <button
          type="button"
          onClick={() => setTab('loaders')}
          className={`px-4 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
            tab === 'loaders'
              ? 'bg-[#B08D45] text-white border-[#B08D45]'
              : 'bg-white text-neutral-700 border-neutral-300'
          }`}
        >
          مؤشرات وحركات التحميل (8 مواضع)
        </button>
        <button
          type="button"
          onClick={() => setTab('action-buttons')}
          className={`px-4 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
            tab === 'action-buttons'
              ? 'bg-[#B08D45] text-white border-[#B08D45]'
              : 'bg-white text-neutral-700 border-neutral-300'
          }`}
        >
          أزرار التحميل والمشاركة
        </button>
        <button
          type="button"
          onClick={() => setTab('icon-library')}
          className={`px-4 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
            tab === 'icon-library'
              ? 'bg-[#B08D45] text-white border-[#B08D45]'
              : 'bg-white text-neutral-700 border-neutral-300'
          }`}
        >
          مكتبة الأيقونات المخصصة ({iconLibrary.length})
        </button>
      </div>

      {tab === 'buttons' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <AdminCard
            title="قائمة الأزرار"
            subtitle="أنشئ أزراراً مخصصة أو عدّل الأزرار الحالية"
          >
            <button
              type="button"
              onClick={() => {
                const next = [...buttons, createEmptyButton(buttons.length + 1)];
                setButtons(next);
                setSelectedBtnIdx(next.length - 1);
              }}
              className="w-full mb-3 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
            >
              <Plus size={14} />
              <span>إضافة زر جديد</span>
            </button>

            {buttons.length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-6">لا توجد أزرار مضافة حالياً.</p>
            ) : (
              <div className="space-y-2">
                {buttons.map((b, idx) => (
                  <div
                    key={b.id}
                    onClick={() => setSelectedBtnIdx(idx)}
                    className={`flex items-center justify-between gap-2 p-2.5 rounded-lg border text-xs cursor-pointer ${
                      idx === selectedBtnIdx
                        ? 'border-[#B08D45] bg-[#F7F4EC]'
                        : 'border-neutral-200 bg-white hover:bg-neutral-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-neutral-900 truncate">{b.label}</div>
                      <div className="text-[11px] text-neutral-500">
                        الموضع: {b.placement} · الإجراء: {b.action}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          updateButton(idx, { visible: !b.visible });
                        }}
                        className="p-1.5 rounded hover:bg-neutral-200/70 text-neutral-600 cursor-pointer"
                        title={b.visible ? 'إخفاء' : 'إظهار'}
                      >
                        {b.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = buttons.filter((_, i) => i !== idx);
                          setButtons(next);
                          setSelectedBtnIdx(Math.max(0, Math.min(selectedBtnIdx, next.length - 1)));
                        }}
                        className="p-1.5 rounded hover:bg-red-50 text-red-600 cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>

          <div className="lg:col-span-2">
            {activeBtn ? (
              <AdminCard title={`تحرير الزر: ${activeBtn.label}`}>
                <div className="mb-4 p-4 rounded-xl border border-neutral-200 bg-neutral-900 flex items-center justify-center">
                  <ActionButtons buttons={[{ ...activeBtn, visible: true }]} />
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">نص الزر</label>
                      <input
                        type="text"
                        value={activeBtn.label}
                        onChange={(e) => updateButton(selectedBtnIdx, { label: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">موضع الظهور</label>
                      <select
                        value={activeBtn.placement}
                        onChange={(e) => updateButton(selectedBtnIdx, { placement: e.target.value as any })}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                      >
                        <option value="hero">القسم الرئيسي (Hero)</option>
                        <option value="global">جميع الصفحات</option>
                        <option value="video">صفحة الفيديو</option>
                        <option value="image">صفحة الصور</option>
                        <option value="article">صفحة المقالات</option>
                        <option value="header">الشريط العلوي</option>
                        <option value="footer">التذييل</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">الإجراء</label>
                      <select
                        value={activeBtn.action}
                        onChange={(e) => updateButton(selectedBtnIdx, { action: e.target.value as any })}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                      >
                        <option value="url">فتح رابط أو صفحة</option>
                        <option value="download">تنزيل الملف</option>
                        <option value="share">مشاركة</option>
                        <option value="copy">نسخ الرابط</option>
                        <option value="scroll">تمرير لقسم (Selector)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">الوجهة / الرابط</label>
                      <input
                        type="text"
                        dir="ltr"
                        value={activeBtn.destination}
                        onChange={(e) => updateButton(selectedBtnIdx, { destination: e.target.value })}
                        placeholder="/p/videos أو https://..."
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                    <div className="flex items-end gap-4 pb-1.5">
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activeBtn.openInNewTab}
                          onChange={(e) =>
                            updateButton(selectedBtnIdx, { openInNewTab: e.target.checked })
                          }
                          className="accent-[#B08D45]"
                        />
                        <span>تبويب جديد</span>
                      </label>
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={activeBtn.disabled}
                          onChange={(e) => updateButton(selectedBtnIdx, { disabled: e.target.checked })}
                          className="accent-[#B08D45]"
                        />
                        <span>معطّل</span>
                      </label>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">نمط العرض</label>
                      <select
                        value={activeBtn.styleMode}
                        onChange={(e) => updateButton(selectedBtnIdx, { styleMode: e.target.value as any })}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                      >
                        <option value="icon-with-text">أيقونة مع نص</option>
                        <option value="solid">لون صلب</option>
                        <option value="outline">إطار مفرغ</option>
                        <option value="transparent">شفاف</option>
                        <option value="gradient">متدرج</option>
                        <option value="animated-gradient">متدرج متحرك</option>
                        <option value="icon-only">أيقونة فقط</option>
                        <option value="text-only">نص فقط</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">تأثير التمرير</label>
                      <select
                        value={activeBtn.hoverEffect}
                        onChange={(e) => updateButton(selectedBtnIdx, { hoverEffect: e.target.value as any })}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                      >
                        <option value="lift">رفع خفيف</option>
                        <option value="shine">لمعان</option>
                        <option value="glow">توهج</option>
                        <option value="scale">تكبير</option>
                        <option value="shadow">ظل</option>
                        <option value="none">بدون</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">الأيقونة</label>
                      <select
                        value={activeBtn.icon}
                        onChange={(e) => updateButton(selectedBtnIdx, { icon: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                      >
                        {BUTTON_ICONS.map((ic) => (
                          <option key={ic} value={ic}>
                            {ic}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">حجم الأيقونة (px)</label>
                      <input
                        type="number"
                        min={10}
                        max={48}
                        value={activeBtn.iconSize}
                        onChange={(e) =>
                          updateButton(selectedBtnIdx, { iconSize: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                      />
                    </div>
                  </div>

                  {/* Custom SVG/Image Icon Override + Library Picker */}
                  <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-bold text-neutral-800">
                        أيقونة مخصصة للزر (رابط صورة أو كود SVG مباشر — يتجاوز الأيقونة الافتراضية)
                      </label>
                      <div className="flex items-center gap-2">
                        {iconLibrary.length > 0 && (
                          <select
                            value=""
                            onChange={(e) => {
                              const picked = iconLibrary.find((ic) => ic.id === e.target.value);
                              if (picked) updateButton(selectedBtnIdx, { customIconUrl: picked.content });
                            }}
                            className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[11px]"
                          >
                            <option value="">اختيار من مكتبة الأيقونات...</option>
                            {iconLibrary.map((ic) => (
                              <option key={ic.id} value={ic.id}>
                                {ic.name} ({ic.kind.toUpperCase()})
                              </option>
                            ))}
                          </select>
                        )}
                        <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-neutral-300 text-[11px] font-semibold cursor-pointer hover:bg-neutral-100">
                          <Upload size={11} /> رفع أيقونة
                          <input
                            type="file"
                            accept="image/*,.svg"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadBtnIcon(f);
                            }}
                          />
                        </label>
                        {activeBtn.customIconUrl && (
                          <button
                            type="button"
                            onClick={() => updateButton(selectedBtnIdx, { customIconUrl: '' })}
                            className="text-[11px] text-red-600 hover:underline cursor-pointer"
                          >
                            مسح
                          </button>
                        )}
                      </div>
                    </div>
                    <input
                      type="text"
                      dir="ltr"
                      value={activeBtn.customIconUrl || ''}
                      onChange={(e) => updateButton(selectedBtnIdx, { customIconUrl: e.target.value })}
                      placeholder="/uploads/... أو <svg viewBox='0 0 24 24'>...</svg>"
                      className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <ColorField
                      label="لون الخلفية"
                      value={activeBtn.background}
                      onChange={(c) => updateButton(selectedBtnIdx, { background: c })}
                    />
                    <ColorField
                      label="لون النص"
                      value={activeBtn.textColor}
                      onChange={(c) => updateButton(selectedBtnIdx, { textColor: c })}
                    />
                    <ColorField
                      label="لون الأيقونة"
                      value={activeBtn.iconColor}
                      onChange={(c) => updateButton(selectedBtnIdx, { iconColor: c })}
                    />
                    <ColorField
                      label="لون الحدود"
                      value={activeBtn.borderColor}
                      onChange={(c) => updateButton(selectedBtnIdx, { borderColor: c })}
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">استدارة الزوايا</label>
                      <input
                        type="number"
                        min={0}
                        max={40}
                        value={activeBtn.borderRadius}
                        onChange={(e) =>
                          updateButton(selectedBtnIdx, { borderRadius: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">سماكة الحدود</label>
                      <input
                        type="number"
                        min={0}
                        max={6}
                        value={activeBtn.borderWidth}
                        onChange={(e) =>
                          updateButton(selectedBtnIdx, { borderWidth: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">حشوة أفقية</label>
                      <input
                        type="number"
                        min={4}
                        max={60}
                        value={activeBtn.paddingX}
                        onChange={(e) =>
                          updateButton(selectedBtnIdx, { paddingX: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-neutral-700 mb-1">حشوة عمودية</label>
                      <input
                        type="number"
                        min={4}
                        max={40}
                        value={activeBtn.paddingY}
                        onChange={(e) =>
                          updateButton(selectedBtnIdx, { paddingY: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                      />
                    </div>
                  </div>

                  <GradientEditor
                    value={activeBtn.gradient}
                    onChange={(g) => updateButton(selectedBtnIdx, { gradient: g })}
                    title="التدرج اللوني للزر"
                  />
                </div>
              </AdminCard>
            ) : (
              <AdminCard>
                <p className="text-xs text-neutral-500 text-center py-8">اختر زراً أو أضف زراً جديداً للتعديل.</p>
              </AdminCard>
            )}
          </div>
        </div>
      ) : tab === 'loaders' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <AdminCard title="مواضع حركات التحميل">
            <div className="space-y-1.5">
              {LOADING_CONTEXTS.map((ctx) => (
                <button
                  key={ctx.key}
                  type="button"
                  onClick={() => setSelectedLoaderKey(ctx.key)}
                  className={`w-full text-right px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-between cursor-pointer ${
                    selectedLoaderKey === ctx.key
                      ? 'bg-[#B08D45] text-white border-[#B08D45]'
                      : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <span>{ctx.label}</span>
                  <span className="text-[11px] opacity-80">
                    {loadingMap[ctx.key].enabled ? 'مفعّل' : 'معطّل'}
                  </span>
                </button>
              ))}
            </div>
          </AdminCard>

          <div className="lg:col-span-2">
            <AdminCard title={`تخصيص التحميل: ${LOADING_CONTEXTS.find((c) => c.key === selectedLoaderKey)?.label}`}>
              <div className="mb-4 p-6 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-center min-h-[110px]">
                <CustomLoader config={{ ...activeLoader, enabled: true }} label="معاينة مؤشر التحميل المباشرة" />
              </div>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-6">
                  <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeLoader.enabled}
                      onChange={(e) => updateLoader({ enabled: e.target.checked })}
                      className="accent-[#B08D45]"
                    />
                    <span>تفعيل مؤشر التحميل في هذا الموضع</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeLoader.rotation}
                      onChange={(e) => updateLoader({ rotation: e.target.checked })}
                      className="accent-[#B08D45]"
                    />
                    <span>تفعيل الدوران</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={activeLoader.useGradient}
                      onChange={(e) => updateLoader({ useGradient: e.target.checked })}
                      className="accent-[#B08D45]"
                    />
                    <span>تفعيل التدرج اللوني</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">نمط المؤشر</label>
                    <select
                      value={activeLoader.style}
                      onChange={(e) => updateLoader({ style: e.target.value as any })}
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                    >
                      <option value="spinner">دائرة دوارة (Spinner)</option>
                      <option value="rotating-icon">أيقونة دوارة</option>
                      <option value="animated-lines">خطوط متحركة</option>
                      <option value="pulsing-circles">دوائر نابضة</option>
                      <option value="animated-words">كلمات عربية متحركة (متسلسلة)</option>
                      <option value="icon-loader">أيقونة ثابتة/متحركة</option>
                      <option value="custom-svg">SVG مخصص</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">الأيقونة</label>
                    <select
                      value={activeLoader.iconName}
                      onChange={(e) => updateLoader({ iconName: e.target.value })}
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                    >
                      {LOADER_ICONS.map((ic) => (
                        <option key={ic} value={ic}>
                          {ic}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">اتجاه الدوران</label>
                    <select
                      value={activeLoader.direction}
                      onChange={(e) => updateLoader({ direction: e.target.value as any })}
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                    >
                      <option value="clockwise">مع عقارب الساعة</option>
                      <option value="counterclockwise">عكس عقارب الساعة</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <ColorField
                    label="اللون الرئيسي"
                    value={activeLoader.color}
                    onChange={(c) => updateLoader({ color: c })}
                  />
                  <ColorField
                    label="اللون الثانوي"
                    value={activeLoader.secondaryColor}
                    onChange={(c) => updateLoader({ secondaryColor: c })}
                  />
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">الحجم (px)</label>
                    <input
                      type="number"
                      min={16}
                      max={96}
                      value={activeLoader.size}
                      onChange={(e) => updateLoader({ size: Number(e.target.value) })}
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">السرعة (ثانية)</label>
                    <input
                      type="number"
                      min={0.3}
                      max={10}
                      step={0.1}
                      value={activeLoader.speed}
                      onChange={(e) => updateLoader({ speed: Number(e.target.value) })}
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                </div>

                {activeLoader.style === 'custom-svg' && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">كود SVG مخصص</label>
                    <textarea
                      dir="ltr"
                      rows={4}
                      value={activeLoader.customSvg}
                      onChange={(e) => updateLoader({ customSvg: e.target.value })}
                      placeholder="<svg viewBox='0 0 24 24'>...</svg>"
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-mono"
                    />
                  </div>
                )}

                {activeLoader.style === 'animated-words' && (
                  <div className="p-4 rounded-xl border border-[#E8E0D0] bg-[#F7F4EC]/50 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs font-extrabold text-neutral-900">
                        <Sparkles size={14} className="text-[#8C6A2F]" />
                        <span>سلسلة الكلمات العربية المتحركة (Animated Words)</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 text-xs">
                          <span className="font-semibold text-neutral-700">المسافة (px):</span>
                          <input
                            type="number"
                            min={2}
                            max={40}
                            value={activeLoader.wordGap ?? 10}
                            onChange={(e) => updateLoader({ wordGap: Number(e.target.value) })}
                            className="w-16 rounded border border-neutral-300 bg-white px-2 py-1 text-xs tabular-nums"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const current: AnimatedWordConfig[] = activeLoader.words?.length
                              ? activeLoader.words
                              : [
                                  { text: 'أرشيف', color: activeLoader.color, fontSize: 22, fontWeight: '800' },
                                  { text: 'الشهيد', color: activeLoader.secondaryColor, fontSize: 22, fontWeight: '800' },
                                ];
                            updateLoader({
                              words: [...current, { text: 'كلمة', color: activeLoader.color, fontSize: 22, fontWeight: '700' }],
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#B08D45] text-white text-xs font-bold cursor-pointer"
                        >
                          <Plus size={12} /> إضافة كلمة
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {(activeLoader.words && activeLoader.words.length > 0
                        ? activeLoader.words
                        : [
                            { text: 'أرشيف', color: activeLoader.color, fontSize: 22, fontWeight: '800' },
                            { text: 'الشهيد', color: activeLoader.secondaryColor, fontSize: 22, fontWeight: '800' },
                          ]
                      ).map((w, idx, arr) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-center bg-white p-2 rounded-lg border border-neutral-200">
                          <input
                            type="text"
                            value={w.text}
                            onChange={(e) => {
                              const next = arr.map((item, i) => (i === idx ? { ...item, text: e.target.value } : item));
                              updateLoader({ words: next });
                            }}
                            placeholder="الكلمة..."
                            className="col-span-4 rounded border border-neutral-300 px-2 py-1 text-xs font-bold"
                          />
                          <div className="col-span-3 flex items-center gap-1.5">
                            <input
                              type="color"
                              value={w.color || '#B08D45'}
                              onChange={(e) => {
                                const next = arr.map((item, i) => (i === idx ? { ...item, color: e.target.value } : item));
                                updateLoader({ words: next });
                              }}
                              className="w-7 h-7 rounded border border-neutral-300 cursor-pointer"
                            />
                            <input
                              type="text"
                              dir="ltr"
                              value={w.color || '#B08D45'}
                              onChange={(e) => {
                                const next = arr.map((item, i) => (i === idx ? { ...item, color: e.target.value } : item));
                                updateLoader({ words: next });
                              }}
                              className="w-full rounded border border-neutral-300 px-1.5 py-1 text-[11px] font-mono"
                            />
                          </div>
                          <input
                            type="number"
                            min={12}
                            max={64}
                            value={w.fontSize || 22}
                            onChange={(e) => {
                              const next = arr.map((item, i) =>
                                i === idx ? { ...item, fontSize: Number(e.target.value) } : item
                              );
                              updateLoader({ words: next });
                            }}
                            title="حجم الخط (px)"
                            className="col-span-2 rounded border border-neutral-300 px-2 py-1 text-xs tabular-nums"
                          />
                          <select
                            value={w.fontWeight || '800'}
                            onChange={(e) => {
                              const next = arr.map((item, i) =>
                                i === idx ? { ...item, fontWeight: e.target.value } : item
                              );
                              updateLoader({ words: next });
                            }}
                            className="col-span-2 rounded border border-neutral-300 px-1.5 py-1 text-xs"
                          >
                            <option value="500">500</option>
                            <option value="700">700</option>
                            <option value="800">800</option>
                            <option value="900">900</option>
                          </select>
                          <button
                            type="button"
                            disabled={arr.length <= 1}
                            onClick={() => updateLoader({ words: arr.filter((_, i) => i !== idx) })}
                            className="col-span-1 text-red-600 p-1 hover:bg-red-50 rounded disabled:opacity-30 cursor-pointer"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </AdminCard>
          </div>
        </div>
      ) : tab === 'action-buttons' ? (
        <AdminCard
          title="تخصيص أزرار التحميل والمشاركة ونسخ الرابط"
          subtitle="تنطبق هذه الأنماط والأحجام مباشرة على أزرار صفحة عرض الفيديو والمقالات والصور"
        >
          <div className="space-y-5">
            <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                style={{
                  backgroundColor: defaultButtonStyles.downloadBg,
                  color: defaultButtonStyles.downloadText,
                  borderRadius: `${defaultButtonStyles.borderRadius}px`,
                }}
                className={`font-bold ${
                  defaultButtonStyles.size === 'sm'
                    ? 'px-3 py-1.5 text-xs'
                    : defaultButtonStyles.size === 'lg'
                      ? 'px-6 py-3 text-sm'
                      : 'px-4 py-2 text-xs'
                }`}
              >
                معاينة زر التحميل
              </button>
              <button
                type="button"
                style={{
                  backgroundColor: defaultButtonStyles.shareBg,
                  color: defaultButtonStyles.shareText,
                  borderRadius: `${defaultButtonStyles.borderRadius}px`,
                }}
                className={`font-bold ${
                  defaultButtonStyles.size === 'sm'
                    ? 'px-3 py-1.5 text-xs'
                    : defaultButtonStyles.size === 'lg'
                      ? 'px-6 py-3 text-sm'
                      : 'px-4 py-2 text-xs'
                }`}
              >
                معاينة زر المشاركة
              </button>
              <button
                type="button"
                style={{
                  backgroundColor: defaultButtonStyles.copyBg,
                  color: defaultButtonStyles.copyText,
                  borderRadius: `${defaultButtonStyles.borderRadius}px`,
                }}
                className={`font-bold border border-neutral-300 ${
                  defaultButtonStyles.size === 'sm'
                    ? 'px-3 py-1.5 text-xs'
                    : defaultButtonStyles.size === 'lg'
                      ? 'px-6 py-3 text-sm'
                      : 'px-4 py-2 text-xs'
                }`}
              >
                معاينة زر نسخ الرابط
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              <ColorField
                label="خلفية زر التحميل"
                value={defaultButtonStyles.downloadBg}
                onChange={(c) => updateLinkBtnStyles({ downloadBg: c })}
              />
              <ColorField
                label="لون نص التحميل"
                value={defaultButtonStyles.downloadText}
                onChange={(c) => updateLinkBtnStyles({ downloadText: c })}
              />
              <ColorField
                label="خلفية التحميل عند التمرير"
                value={defaultButtonStyles.downloadHoverBg}
                onChange={(c) => updateLinkBtnStyles({ downloadHoverBg: c })}
              />
              <ColorField
                label="خلفية زر المشاركة"
                value={defaultButtonStyles.shareBg}
                onChange={(c) => updateLinkBtnStyles({ shareBg: c })}
              />
              <ColorField
                label="لون نص المشاركة"
                value={defaultButtonStyles.shareText}
                onChange={(c) => updateLinkBtnStyles({ shareText: c })}
              />
              <ColorField
                label="خلفية زر نسخ الرابط"
                value={defaultButtonStyles.copyBg}
                onChange={(c) => updateLinkBtnStyles({ copyBg: c })}
              />
              <ColorField
                label="لون نص نسخ الرابط"
                value={defaultButtonStyles.copyText}
                onChange={(c) => updateLinkBtnStyles({ copyText: c })}
              />
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">استدارة الزوايا (px)</label>
                <input
                  type="number"
                  min={0}
                  max={36}
                  value={defaultButtonStyles.borderRadius}
                  onChange={(e) => updateLinkBtnStyles({ borderRadius: Number(e.target.value) })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">حجم الأزرار</label>
                <select
                  value={defaultButtonStyles.size}
                  onChange={(e) => updateLinkBtnStyles({ size: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="sm">صغير (Small)</option>
                  <option value="md">متوسط (Medium)</option>
                  <option value="lg">كبير (Large)</option>
                </select>
              </div>
            </div>
          </div>
        </AdminCard>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <AdminCard title="إضافة أيقونة إلى المكتبة" className="lg:col-span-5">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">اسم الأيقونة</label>
                <input
                  type="text"
                  value={newIconForm.name}
                  onChange={(e) => setNewIconForm({ ...newIconForm, name: e.target.value })}
                  placeholder="مثال: شعار خاص أو أيقونة عرض"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">النوع</label>
                <select
                  value={newIconForm.kind}
                  onChange={(e) => setNewIconForm({ ...newIconForm, kind: e.target.value as 'svg' | 'image' })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs"
                >
                  <option value="svg">كود SVG مباشر</option>
                  <option value="image">ملف صورة / رابط مباشر</option>
                </select>
              </div>
              {newIconForm.kind === 'svg' ? (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">كود SVG</label>
                  <textarea
                    dir="ltr"
                    rows={5}
                    value={newIconForm.content}
                    onChange={(e) => setNewIconForm({ ...newIconForm, content: e.target.value })}
                    placeholder="<svg viewBox='0 0 24 24' fill='none' stroke='currentColor'>...</svg>"
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-mono"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-neutral-700">رابط الصورة أو رفع ملف</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      dir="ltr"
                      value={newIconForm.content}
                      onChange={(e) => setNewIconForm({ ...newIconForm, content: e.target.value })}
                      placeholder="/uploads/..."
                      className="flex-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                    />
                    <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold cursor-pointer hover:bg-neutral-50">
                      <Upload size={13} /> رفع
                      <input
                        type="file"
                        accept="image/*,.svg"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadLibraryImage(f);
                        }}
                      />
                    </label>
                  </div>
                </div>
              )}

              {newIconForm.content.trim() && (
                <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-900 text-white flex items-center justify-center min-h-[64px]">
                  {newIconForm.kind === 'svg' ? (
                    <span
                      className="w-8 h-8 inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                      dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(newIconForm.content) }}
                    />
                  ) : (
                    <img src={newIconForm.content} alt="" className="w-8 h-8 object-contain" />
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={handleAddIconToLibrary}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
              >
                <Plus size={14} /> إضافة لمكتبة الأيقونات
              </button>
            </div>
          </AdminCard>

          <AdminCard title={`الأيقونات المحفوظة (${iconLibrary.length})`} className="lg:col-span-7">
            {iconLibrary.length === 0 ? (
              <div className="py-12 text-center text-xs text-neutral-500 space-y-2">
                <ImageIcon size={28} className="mx-auto text-neutral-400" />
                <p>لم تُضف أي أيقونات مخصصة بعد. استخدم النموذج لإضافة SVG أو صورة ثم احفظ.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {iconLibrary.map((ic) => (
                  <div key={ic.id} className="rounded-xl border border-neutral-200 bg-white p-3 space-y-2">
                    <div className="h-14 rounded-lg bg-neutral-900 text-[#D4AF65] flex items-center justify-center">
                      {ic.kind === 'svg' ? (
                        <span
                          className="w-7 h-7 inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
                          dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(ic.content) }}
                        />
                      ) : (
                        <img src={ic.content} alt={ic.name} className="w-7 h-7 object-contain" />
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-bold text-neutral-900 truncate">{ic.name}</div>
                        <div className="text-[10px] text-neutral-500">{ic.kind.toUpperCase()}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIconLibrary((prev) => prev.filter((x) => x.id !== ic.id))}
                        className="text-red-600 p-1 hover:bg-red-50 rounded cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>
        </div>
      )}
    </div>
  );
}
