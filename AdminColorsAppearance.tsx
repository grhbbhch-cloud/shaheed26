import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, BookmarkPlus, Eye, EyeOff, Plus, RotateCcw, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { InfoCard } from '../../../components/InfoCard';
import { MediaCard } from '../../../components/MediaCard';
import { AdminCard, AdminPanelHeader, ColorField, GradientEditor } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { buildGradientBoxStyle, buildTextStyle, CONTENT_TYPE_LABELS } from '../../../lib/styleEngine';
import type {
  AllSettings,
  ContentRecord,
  InfoCardConfig,
  InfoCardFieldConfig,
  RelatedSettingsConfig,
  TitleGradientSystemConfig,
  TitleGradientTargetKey,
} from '../../../types/platform';

const TITLE_GRADIENT_TARGET_LABELS: Array<{ key: TitleGradientTargetKey; label: string }> = [
  { key: 'siteTitle', label: 'عنوان الموقع الرئيسي' },
  { key: 'heroTitle', label: 'عنوان القسم الترحيبي (Hero)' },
  { key: 'sectionHeadings', label: 'عناوين الأقسام' },
  { key: 'pageBannerTitle', label: 'عناوين ترويسات الصفحات' },
  { key: 'postTitle', label: 'عناوين المنشورات' },
  { key: 'videoTitle', label: 'عناوين الفيديوهات' },
  { key: 'imageTitle', label: 'عناوين الصور' },
  { key: 'poetryPageTitle', label: 'عنوان صفحة قصائد' },
  { key: 'poemCardTitle', label: 'عناوين بطاقات القصائد' },
  { key: 'buttons', label: 'الأزرار وعناصر التفاعل' },
  { key: 'navigation', label: 'روابط شريط التنقل' },
  { key: 'cards', label: 'حدود / خلفيات البطاقات' },
  { key: 'badges', label: 'الشارات والوسوم' },
  { key: 'icons', label: 'الأيقونات والرموز' },
  { key: 'playerControls', label: 'أزرار ومؤشر مشغل الفيديو' },
  { key: 'loaders', label: 'مؤشرات وشاشات التحميل' },
];

const TARGET_LABELS: Array<{ key: keyof AllSettings['colors']['targets']; label: string }> = [
  { key: 'siteTitle', label: 'عنوان الموقع' },
  { key: 'pageHeading', label: 'عناوين الصفحات' },
  { key: 'postTitle', label: 'عناوين المنشورات' },
  { key: 'videoTitle', label: 'عناوين الفيديوهات' },
  { key: 'imageTitle', label: 'عناوين الصور' },
  { key: 'buttons', label: 'الأزرار' },
  { key: 'navigation', label: 'شريط التنقل' },
  { key: 'badges', label: 'الشارات والوسوم' },
  { key: 'cards', label: 'البطاقات' },
  { key: 'borders', label: 'الحدود والفواصل' },
  { key: 'backgrounds', label: 'الخلفيات' },
  { key: 'icons', label: 'الأيقونات' },
  { key: 'separators', label: 'الأشرطة الفاصلة' },
  { key: 'playerControls', label: 'عناصر المشغل' },
  { key: 'loaders', label: 'مؤشرات التحميل' },
  { key: 'related', label: 'المحتوى المشابه' },
  { key: 'admin', label: 'واجهة الإدارة' },
];

const QUICK_RELATED_COUNTS = [1, 2, 3, 4, 5, 6, 8, 10];

const FIELD_ICON_OPTIONS = [
  { value: '', label: 'بدون أيقونة' },
  { value: 'Calendar', label: 'التقويم (Calendar)' },
  { value: 'Clock', label: 'الساعة (Clock)' },
  { value: 'Eye', label: 'العين (Eye)' },
  { value: 'FileText', label: 'مستند (FileText)' },
  { value: 'Film', label: 'فيلم (Film)' },
  { value: 'Folder', label: 'مجلد / قسم (Folder)' },
  { value: 'Globe', label: 'الويب / المصدر (Globe)' },
  { value: 'Info', label: 'معلومات (Info)' },
  { value: 'Shield', label: 'درع (Shield)' },
  { value: 'Sparkles', label: 'نجمة / مميز (Sparkles)' },
  { value: 'Tag', label: 'وسم / تصنيف (Tag)' },
  { value: 'User', label: 'محرر / مراسل (User)' },
];

const FIELD_FONT_OPTIONS = [
  'Cairo',
  'Tajawal',
  'Almarai',
  'IBM Plex Sans Arabic',
  'Readex Pro',
  'Amiri',
  'Noto Kufi Arabic',
];

export function AdminColorsAppearance() {
  const { settings, previousSettings, pages, content, saveCategory, resetCategory, notify } = useAdmin();
  const [subTab, setSubTab] = useState<'palette' | 'targets' | 'animated-gradient' | 'infocard' | 'related'>('palette');
  const [colors, setColors] = useState<AllSettings['colors'] | null>(null);
  const [titleGrad, setTitleGrad] = useState<TitleGradientSystemConfig | null>(null);
  const [infoCard, setInfoCard] = useState<InfoCardConfig | null>(null);
  const [related, setRelated] = useState<RelatedSettingsConfig | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<keyof AllSettings['colors']['targets']>('videoTitle');
  const [expandedFieldKey, setExpandedFieldKey] = useState<string | null>(null);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [presetName, setPresetName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setColors(structuredClone(settings.colors));
      if (settings.titleGradient) {
        setTitleGrad(structuredClone(settings.titleGradient));
      }
      const clonedInfoCard = structuredClone(settings.infoCard);
      clonedInfoCard.fields = (clonedInfoCard.fields || []).filter((f) => f.key !== 'views');
      setInfoCard(clonedInfoCard);
      setRelated(structuredClone(settings.related));
    }
  }, [settings]);

  if (!settings || !colors || !infoCard || !related) return null;

  const sampleItem: ContentRecord = content[0] || {
    id: 1,
    title: 'وثائقي ميداني — لقطات حصرية من التغطية الإعلامية',
    slug: 'sample-item',
    content_type: 'video',
    description: 'وصف موجز للمادة يظهر في المعاينة الحية لإعدادات الظهور.',
    body: '',
    status: 'published',
    featured: 1,
    page_id: 2,
    child_page_id: null,
    extra_page_ids_json: '[]',
    category: 'تغطية ميدانية',
    tags_json: '[]',
    thumbnail_url: '',
    media_url: '',
    media_file_id: null,
    gallery_urls_json: '[]',
    link_url: '',
    link_enabled: 0,
    link_new_tab: 0,
    duration: 185,
    resolution: '1080p',
    width: 1920,
    height: 1080,
    views: 0,
    source_label: settings?.identity?.siteName || '',
    editor_label: 'وحدة التوثيق',
    custom_metadata_json: '{}',
    settings_json: '{}',
    published_at: new Date().toISOString(),
    scheduled_at: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const activeCategory: 'colors' | 'titleGradient' | 'infoCard' | 'related' =
    subTab === 'animated-gradient'
      ? 'titleGradient'
      : subTab === 'infocard'
        ? 'infoCard'
        : subTab === 'related'
          ? 'related'
          : 'colors';

  const activeDraft =
    activeCategory === 'titleGradient'
      ? titleGrad
      : activeCategory === 'infoCard'
        ? infoCard
        : activeCategory === 'related'
          ? related
          : colors;
  const savedComparable =
    activeCategory === 'infoCard'
      ? { ...settings.infoCard, fields: (settings.infoCard.fields || []).filter((f) => f.key !== 'views') }
      : settings[activeCategory];

  const hasUnsavedChanges = JSON.stringify(activeDraft) !== JSON.stringify(savedComparable);
  const hasPreviousSnapshot = Boolean(previousSettings?.[activeCategory]);

  const handleSave = async () => {
    setSaving(true);
    try {
      if (subTab === 'palette' || subTab === 'targets') {
        await saveCategory('colors', colors, 'تحديث الألوان والتدرجات');
      } else if (subTab === 'animated-gradient' && titleGrad) {
        await saveCategory('titleGradient', titleGrad, 'تحديث نظام التدرج اللوني المتحرك العام');
      } else if (subTab === 'infocard') {
        await saveCategory('infoCard', infoCard, 'تحديث بطاقة معلومات الفيديو');
      } else {
        await saveCategory('related', related, 'تحديث إعدادات المحتوى المشابه');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (activeCategory === 'colors') {
      setColors(structuredClone(settings.colors));
    } else if (activeCategory === 'titleGradient' && settings.titleGradient) {
      setTitleGrad(structuredClone(settings.titleGradient));
    } else if (activeCategory === 'infoCard') {
      const cloned = structuredClone(settings.infoCard);
      cloned.fields = (cloned.fields || []).filter((f) => f.key !== 'views');
      setInfoCard(cloned);
    } else {
      setRelated(structuredClone(settings.related));
    }
    notify('تم إلغاء التعديلات غير المحفوظة والعودة للحالة المنشورة', 'info');
  };

  const handleRevertPrevious = () => {
    const prevSnap = previousSettings?.[activeCategory];
    if (!prevSnap) return;
    if (activeCategory === 'colors') {
      setColors(structuredClone(prevSnap as AllSettings['colors']));
    } else if (activeCategory === 'titleGradient') {
      setTitleGrad(structuredClone(prevSnap as TitleGradientSystemConfig));
    } else if (activeCategory === 'infoCard') {
      const cloned = structuredClone(prevSnap as InfoCardConfig);
      cloned.fields = (cloned.fields || []).filter((f) => f.key !== 'views');
      setInfoCard(cloned);
    } else {
      setRelated(structuredClone(prevSnap as RelatedSettingsConfig));
    }
    notify('تمت استعادة القيمة السابقة في المسودة — اضغط "حفظ وتطبيق التغييرات" لتفعيلها', 'info');
  };

  const handleReset = () => {
    if (subTab === 'animated-gradient') return resetCategory('titleGradient');
    if (subTab === 'infocard') return resetCategory('infoCard');
    if (subTab === 'related') return resetCategory('related');
    return resetCategory('colors');
  };

  const updateInfoFieldByKey = (key: string, patch: Partial<InfoCardFieldConfig>) => {
    setInfoCard((prev) =>
      prev
        ? {
            ...prev,
            fields: prev.fields.map((f) => (f.key === key ? { ...f, ...patch } : f)),
          }
        : prev
    );
  };

  const moveInfoField = (key: string, dir: -1 | 1) => {
    setInfoCard((prev) => {
      if (!prev) return prev;
      const sorted = [...prev.fields].sort((a, b) => a.order - b.order);
      const idx = sorted.findIndex((f) => f.key === key);
      const target = idx + dir;
      if (idx === -1 || target < 0 || target >= sorted.length) return prev;
      [sorted[idx], sorted[target]] = [sorted[target], sorted[idx]];
      return {
        ...prev,
        fields: sorted.map((f, i) => ({ ...f, order: i + 1 })),
      };
    });
  };

  const saveCurrentAsPreset = () => {
    if (!presetName.trim()) {
      notify('أدخل اسماً لقالب الألوان أولاً', 'error');
      return;
    }
    const paletteSnapshot: Record<string, string> = {
      primary: colors.primary,
      deepPrimary: colors.deepPrimary,
      secondary: colors.secondary,
      accent: colors.accent,
      goldAccent: colors.goldAccent,
      black: colors.black,
      darkBg: colors.darkBg,
      white: colors.white,
      lightBg: colors.lightBg,
      lightGray: colors.lightGray,
      mainText: colors.mainText,
      secondaryText: colors.secondaryText,
      border: colors.border,
      icon: colors.icon,
      buttonBg: colors.buttonBg,
      buttonText: colors.buttonText,
      hover: colors.hover,
      active: colors.active,
      disabled: colors.disabled,
      focus: colors.focus,
      shadowColor: colors.shadowColor,
      glowColor: colors.glowColor,
      loadingColor: colors.loadingColor,
      overlayColor: colors.overlayColor,
    };
    const nextPresets = [
      ...(colors.customPresets || []),
      { id: `preset-${Date.now()}`, name: presetName.trim(), colors: paletteSnapshot },
    ];
    setColors({ ...colors, customPresets: nextPresets });
    setPresetName('');
    notify('تمت إضافة قالب الألوان — اضغط حفظ التعديلات للاعتماد');
  };

  const previewRelatedCount = related.enabled && !related.deleted ? Math.max(0, Number(related.maxItems || 0)) : 0;

  return (
    <div>
      <AdminPanelHeader
        title="إدارة الألوان والمظهر وبطاقة المعلومات والمحتوى المشابه"
        subtitle="التحكم الشامل بألوان المنصة، التدرجات المستقلة، تخطيط وحقول بطاقة الفيديو، والعدد والتصميم الدقيق للمحتوى المشابه"
        onSave={handleSave}
        onCancel={handleCancel}
        onRevertPrevious={handleRevertPrevious}
        onReset={handleReset}
        hasUnsavedChanges={hasUnsavedChanges}
        hasPreviousSnapshot={hasPreviousSnapshot}
        saving={saving}
      />

      <div className="flex flex-wrap gap-2 mb-5">
        {[
          { id: 'palette', label: 'لوحة الألوان العامة' },
          { id: 'targets', label: 'ألوان وتدرجات العناصر' },
          { id: 'animated-gradient', label: 'التدرج المتحرك العام' },
          { id: 'infocard', label: 'بطاقة معلومات الفيديو' },
          { id: 'related', label: 'إعدادات المحتوى المشابه' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSubTab(t.id as any)}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
              subTab === t.id
                ? 'bg-[#B08D45] text-white border-[#B08D45]'
                : 'bg-white text-neutral-700 border-neutral-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === 'palette' && (
        <div className="space-y-5">
          <AdminCard title="لوحة الألوان الأساسية للمنصة">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ColorField label="اللون الرئيسي (Primary)" value={colors.primary} onChange={(c) => setColors({ ...colors, primary: c })} />
              <ColorField label="اللون العميق (Deep Primary)" value={colors.deepPrimary} onChange={(c) => setColors({ ...colors, deepPrimary: c })} />
              <ColorField label="اللون الثانوي (Secondary)" value={colors.secondary} onChange={(c) => setColors({ ...colors, secondary: c })} />
              <ColorField label="لون التمييز (Accent)" value={colors.accent} onChange={(c) => setColors({ ...colors, accent: c })} />
              <ColorField label="الذهبي المؤسسي" value={colors.goldAccent} onChange={(c) => setColors({ ...colors, goldAccent: c })} />
              <ColorField label="لون الأسود / البطل" value={colors.black} onChange={(c) => setColors({ ...colors, black: c })} />
              <ColorField label="الخلفية الفاتحة" value={colors.lightBg} onChange={(c) => setColors({ ...colors, lightBg: c })} />
              <ColorField label="لون النص الرئيسي" value={colors.mainText} onChange={(c) => setColors({ ...colors, mainText: c })} />
              <ColorField label="لون النص الثانوي" value={colors.secondaryText} onChange={(c) => setColors({ ...colors, secondaryText: c })} />
              <ColorField label="لون الحدود" value={colors.border} onChange={(c) => setColors({ ...colors, border: c })} />
              <ColorField label="لون الأيقونات" value={colors.icon} onChange={(c) => setColors({ ...colors, icon: c })} />
              <ColorField label="خلفية الأزرار الافتراضية" value={colors.buttonBg} onChange={(c) => setColors({ ...colors, buttonBg: c })} />
              <ColorField label="نص الأزرار" value={colors.buttonText} onChange={(c) => setColors({ ...colors, buttonText: c })} />
              <ColorField label="لون التمرير (Hover)" value={colors.hover} onChange={(c) => setColors({ ...colors, hover: c })} />
              <ColorField label="لون الحالة النشطة" value={colors.active} onChange={(c) => setColors({ ...colors, active: c })} />
              <ColorField label="لون التوهج (Glow)" value={colors.glowColor} onChange={(c) => setColors({ ...colors, glowColor: c })} />
            </div>
          </AdminCard>

          <AdminCard title="حدود وظلال البطاقات العامة">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">سمك حدود البطاقات (px)</label>
                <input
                  type="number"
                  min={0}
                  max={8}
                  value={colors.cardBorderWidth ?? 1}
                  onChange={(e) => setColors({ ...colors, cardBorderWidth: Number(e.target.value) })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">استدارة حواف البطاقات (px)</label>
                <input
                  type="number"
                  min={0}
                  max={36}
                  value={colors.cardBorderRadius ?? 12}
                  onChange={(e) => setColors({ ...colors, cardBorderRadius: Number(e.target.value) })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">نمط الحدود</label>
                <select
                  value={colors.cardBorderStyle || 'solid'}
                  onChange={(e) => setColors({ ...colors, cardBorderStyle: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="solid">متصل (solid)</option>
                  <option value="dashed">متقطع (dashed)</option>
                  <option value="dotted">منقط (dotted)</option>
                  <option value="double">مزدوج (double)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">ظل البطاقات (CSS Box Shadow)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={colors.cardShadow || ''}
                  onChange={(e) => setColors({ ...colors, cardShadow: e.target.value })}
                  placeholder="0 4px 18px rgba(0,0,0,0.06)"
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
            </div>
          </AdminCard>

          <AdminCard title="قوالب الألوان المحفوظة (Presets)">
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="اسم القالب الجديد (مثال: الذهبي الداكن)..."
                  className="flex-1 min-w-[220px] rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                />
                <button
                  type="button"
                  onClick={saveCurrentAsPreset}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
                >
                  <BookmarkPlus size={14} />
                  <span>حفظ الألوان الحالية كقالب</span>
                </button>
              </div>

              {(!colors.customPresets || colors.customPresets.length === 0) ? (
                <p className="text-xs text-neutral-500">لا توجد قوالب ألوان محفوظة بعد.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {colors.customPresets.map((preset) => (
                    <div
                      key={preset.id}
                      className="p-3 rounded-xl border border-neutral-200 bg-neutral-50 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-neutral-900 truncate">{preset.name}</div>
                        <div className="flex items-center gap-1 mt-1.5">
                          {[preset.colors.primary, preset.colors.deepPrimary, preset.colors.goldAccent, preset.colors.black]
                            .filter(Boolean)
                            .map((sw, i) => (
                              <span
                                key={i}
                                className="w-4 h-4 rounded-full border border-neutral-300"
                                style={{ backgroundColor: sw }}
                              />
                            ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setColors({ ...colors, ...preset.colors });
                            notify(`تم تطبيق قالب "${preset.name}" — اضغط حفظ التعديلات للاعتماد`);
                          }}
                          className="px-2.5 py-1 rounded bg-[#B08D45] text-white text-[11px] font-bold hover:bg-[#8C6A2F] cursor-pointer"
                        >
                          تطبيق
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setColors({
                              ...colors,
                              customPresets: (colors.customPresets || []).filter((p) => p.id !== preset.id),
                            })
                          }
                          className="p-1 text-red-600 hover:bg-red-50 rounded cursor-pointer"
                          title="حذف القالب"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </AdminCard>
        </div>
      )}

      {subTab === 'targets' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <AdminCard title="اختيار العنصر">
            <div className="space-y-1.5 max-h-[420px] overflow-y-auto pl-1">
              {TARGET_LABELS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSelectedTarget(t.key)}
                  className={`w-full text-right px-3 py-2 rounded-lg text-xs font-semibold border cursor-pointer ${
                    selectedTarget === t.key
                      ? 'bg-[#B08D45] text-white border-[#B08D45]'
                      : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </AdminCard>

          <div className="lg:col-span-2">
            <AdminCard title={`تخصيص العنصر: ${TARGET_LABELS.find((t) => t.key === selectedTarget)?.label}`}>
              <div className="space-y-4">
                {/* Live Animated Target Preview */}
                <div className="rounded-xl border border-neutral-200 bg-neutral-900 p-4 text-center">
                  <div className="text-[11px] text-neutral-400 mb-1">معاينة حية للعنصر المختار</div>
                  {['siteTitle', 'pageHeading', 'postTitle', 'videoTitle', 'imageTitle', 'navigation', 'related'].includes(
                    selectedTarget
                  ) ? (
                    <div
                      className="text-xl font-extrabold"
                      style={buildTextStyle(
                        {
                          fontFamily: 'Cairo',
                          fontSizeDesktop: '22px',
                          fontWeight: '800',
                          color: colors.targets[selectedTarget].color || '#FFFFFF',
                        },
                        colors.targets[selectedTarget].gradient,
                        'desktop'
                      )}
                    >
                      {TARGET_LABELS.find((t) => t.key === selectedTarget)?.label} — {settings?.identity?.siteName || 'أرشيف الشهيد'}
                    </div>
                  ) : (
                    <div
                      className="inline-block px-5 py-2 rounded-lg text-sm font-bold border"
                      style={{
                        color: colors.targets[selectedTarget].color || '#FFFFFF',
                        backgroundColor: colors.targets[selectedTarget].background || '#B08D45',
                        borderColor: colors.targets[selectedTarget].borderColor || 'transparent',
                        ...buildGradientBoxStyle(colors.targets[selectedTarget].gradient),
                      }}
                    >
                      {TARGET_LABELS.find((t) => t.key === selectedTarget)?.label}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <ColorField
                    label="لون النص / المقدمة"
                    value={colors.targets[selectedTarget].color}
                    onChange={(c) =>
                      setColors({
                        ...colors,
                        targets: {
                          ...colors.targets,
                          [selectedTarget]: { ...colors.targets[selectedTarget], color: c },
                        },
                      })
                    }
                  />
                  <ColorField
                    label="لون الخلفية"
                    value={colors.targets[selectedTarget].background}
                    onChange={(c) =>
                      setColors({
                        ...colors,
                        targets: {
                          ...colors.targets,
                          [selectedTarget]: { ...colors.targets[selectedTarget], background: c },
                        },
                      })
                    }
                  />
                  <ColorField
                    label="لون الحدود"
                    value={colors.targets[selectedTarget].borderColor}
                    onChange={(c) =>
                      setColors({
                        ...colors,
                        targets: {
                          ...colors.targets,
                          [selectedTarget]: { ...colors.targets[selectedTarget], borderColor: c },
                        },
                      })
                    }
                  />
                </div>
                <GradientEditor
                  value={colors.targets[selectedTarget].gradient}
                  onChange={(g) =>
                    setColors({
                      ...colors,
                      targets: {
                        ...colors.targets,
                        [selectedTarget]: { ...colors.targets[selectedTarget], gradient: g },
                      },
                    })
                  }
                />
              </div>
            </AdminCard>
          </div>
        </div>
      )}

      {subTab === 'animated-gradient' && titleGrad && (
        <div className="space-y-5">
          <AdminCard title="نظام التدرج اللوني المتحرك العام (RTL Sweep)">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={titleGrad.enabled}
                    onChange={(e) => setTitleGrad({ ...titleGrad, enabled: e.target.checked })}
                    className="accent-[#B08D45]"
                  />
                  <span>تفعيل التدرج المتحرك العام على العناصر المحددة</span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={titleGrad.mode || 'sweep'}
                    onChange={(e) => setTitleGrad({ ...titleGrad, mode: e.target.value as any })}
                    className="rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs font-semibold"
                  >
                    <option value="sweep">انسياب مستمر للنص بالكامل (Sweep متصل آمن للعربية)</option>
                    <option value="per-word">تموّج متدرج لكل كلمة (Per-Word)</option>
                    <option value="per-letter">تموّج مكثف آمن للتشكيل المتصل (Per-Letter Safe)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">النموذج الجاهز</label>
                  <select
                    value={titleGrad.preset}
                    onChange={(e) => {
                      const preset = e.target.value as TitleGradientSystemConfig['preset'];
                      const presets: Record<string, string[]> = {
                        'gold-metallic': ['#8C6A2F', '#D4AF65', '#F7E7B4', '#B08D45', '#8C6A2F'],
                        'green-gold': ['#1B4332', '#2D6A4F', '#D4AF65', '#9c932b', '#1B4332'],
                        'white-gold': ['#FFFFFF', '#F7E7B4', '#D4AF65', '#FFFFFF'],
                        'black-gold-white': ['#171717', '#B08D45', '#FFFFFF', '#D4AF65', '#171717'],
                        'multi-gold': ['#8C6A2F', '#B08D45', '#D4AF65', '#9c932b', '#F5E6C4', '#8C6A2F'],
                      };
                      setTitleGrad({
                        ...titleGrad,
                        preset,
                        stops: presets[preset] || titleGrad.stops,
                      });
                    }}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs"
                  >
                    <option value="gold-metallic">ذهبي معدني فاخر</option>
                    <option value="green-gold">أخضر وذهبي تراثي</option>
                    <option value="white-gold">أبيض مضيء وذهبي</option>
                    <option value="black-gold-white">أسود وذهبي وأبيض</option>
                    <option value="multi-gold">تدرج ذهبي متعدد</option>
                    <option value="custom">تدرج مخصص</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    السرعة ({titleGrad.speed} ثانية)
                  </label>
                  <input
                    type="range"
                    min={2}
                    max={20}
                    step={0.5}
                    value={titleGrad.speed}
                    onChange={(e) => setTitleGrad({ ...titleGrad, speed: Number(e.target.value) })}
                    className="w-full accent-[#B08D45]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    زاوية التدرج ({titleGrad.angle}°)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={360}
                    step={5}
                    value={titleGrad.angle}
                    onChange={(e) => setTitleGrad({ ...titleGrad, angle: Number(e.target.value) })}
                    className="w-full accent-[#B08D45]"
                  />
                </div>
              </div>
            </div>
          </AdminCard>

          <AdminCard title="الأهداف والمناطق المشمولة بالتدرج المتحرك">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {TITLE_GRADIENT_TARGET_LABELS.map((item) => (
                <label
                  key={item.key}
                  className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 bg-neutral-50 text-xs font-semibold cursor-pointer"
                >
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    checked={Boolean(titleGrad.targets?.[item.key])}
                    onChange={(e) =>
                      setTitleGrad({
                        ...titleGrad,
                        targets: {
                          ...titleGrad.targets,
                          [item.key]: e.target.checked,
                        },
                      })
                    }
                    className="accent-[#B08D45]"
                  />
                </label>
              ))}
            </div>
          </AdminCard>
        </div>
      )}

      {subTab === 'infocard' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            <AdminCard title="تصميم وموضع وتخطيط بطاقة معلومات الفيديو" className="xl:col-span-8">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-5">
                    <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={infoCard.enabled}
                        onChange={(e) => setInfoCard({ ...infoCard, enabled: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>تفعيل بطاقة المعلومات</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(infoCard.showBoxTitle)}
                        onChange={(e) => setInfoCard({ ...infoCard, showBoxTitle: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>إظهار عنوان البطاقة</span>
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInfoCard({ ...infoCard, deleted: !infoCard.deleted })}
                    className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                      infoCard.deleted
                        ? 'bg-[#B08D45] text-white border-[#B08D45]'
                        : 'border-red-200 text-red-600 hover:bg-red-50'
                    }`}
                  >
                    {infoCard.deleted ? <RotateCcw size={13} /> : <Trash2 size={13} />}
                    <span>{infoCard.deleted ? 'استعادة البطاقة بالكامل' : 'حذف وإخفاء البطاقة بالكامل'}</span>
                  </button>
                </div>

                {infoCard.showBoxTitle && (
                  <div>
                    <label className="block text-xs font-semibold mb-1">عنوان صندوق المعلومات</label>
                    <input
                      type="text"
                      value={infoCard.boxTitle || ''}
                      onChange={(e) => setInfoCard({ ...infoCard, boxTitle: e.target.value })}
                      className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <ColorField label="لون الخلفية" value={infoCard.background} onChange={(c) => setInfoCard({ ...infoCard, background: c })} />
                  <ColorField label="لون الحدود" value={infoCard.borderColor} onChange={(c) => setInfoCard({ ...infoCard, borderColor: c })} />
                  <ColorField label="لون الفاصل" value={infoCard.separatorColor} onChange={(c) => setInfoCard({ ...infoCard, separatorColor: c })} />
                  <div>
                    <label className="block text-xs font-semibold mb-1">الموضع بالصفحة</label>
                    <select
                      value={infoCard.position}
                      onChange={(e) => setInfoCard({ ...infoCard, position: e.target.value as any })}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="left">بجانب المشغل (يسار)</option>
                      <option value="right">بجانب المشغل (يمين)</option>
                      <option value="below">أسفل المشغل</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">تخطيط الحقول</label>
                    <select
                      value={infoCard.layout || 'vertical'}
                      onChange={(e) => setInfoCard({ ...infoCard, layout: e.target.value as any })}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="vertical">عمودي (أسطر)</option>
                      <option value="two-column">عمودان</option>
                      <option value="horizontal">صف أفقي</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">الحشوة الداخلية (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={48}
                      value={infoCard.padding}
                      onChange={(e) => setInfoCard({ ...infoCard, padding: Number(e.target.value) })}
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">التباعد (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={32}
                      value={infoCard.spacing}
                      onChange={(e) => setInfoCard({ ...infoCard, spacing: Number(e.target.value) })}
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">استدارة الحواف (px)</label>
                    <input
                      type="number"
                      min={0}
                      max={32}
                      value={infoCard.borderRadius}
                      onChange={(e) => setInfoCard({ ...infoCard, borderRadius: Number(e.target.value) })}
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">أقصى عدد للحقول (0 = الكل)</label>
                    <input
                      type="number"
                      min={0}
                      max={30}
                      value={infoCard.maxFields ?? 0}
                      onChange={(e) => setInfoCard({ ...infoCard, maxFields: Math.max(0, Number(e.target.value)) })}
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">موضع البطاقة على الجوال</label>
                    <select
                      value={infoCard.mobilePosition || 'below'}
                      onChange={(e) => setInfoCard({ ...infoCard, mobilePosition: e.target.value as any })}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="below">أسفل المشغل</option>
                      <option value="above">أعلى المشغل</option>
                      <option value="hidden">مخفية على الجوال</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">محاذاة النص العامة</label>
                    <select
                      value={infoCard.textAlign || 'right'}
                      onChange={(e) => setInfoCard({ ...infoCard, textAlign: e.target.value as any })}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="right">يمين</option>
                      <option value="center">توسيط</option>
                      <option value="left">يسار</option>
                    </select>
                  </div>
                </div>
                <GradientEditor
                  value={infoCard.gradient}
                  onChange={(g) => setInfoCard({ ...infoCard, gradient: g })}
                  title="تدرج خلفية بطاقة المعلومات"
                />
              </div>
            </AdminCard>

            <AdminCard title="معاينة حية لبطاقة المعلومات" className="xl:col-span-4">
              {infoCard.deleted ? (
                <p className="py-10 text-center text-xs text-red-600 font-bold">
                  البطاقة محذوفة حالياً — اضغط "استعادة البطاقة" لإرجاعها.
                </p>
              ) : (
                <InfoCard item={sampleItem} config={infoCard} dateFormat={settings.other.dateFormat} />
              )}
            </AdminCard>
          </div>

          <AdminCard
            title="حقول وعناصر المعلومات (تعديل كامل للنصوص، الأيقونات، الخطوط، الألوان، الترتيب، الحذف والإضافة)"
            subtitle="أي تعديل أو إضافة أو إخفاء أو حذف هنا ينعكس مباشرة على صفحة عرض المادة والموقع العام بعد الحفظ."
          >
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={newFieldLabel}
                onChange={(e) => setNewFieldLabel(e.target.value)}
                placeholder="إضافة عنصر معلومات جديد (مثال: اسم المراسل، المكان، الملاحظة)..."
                className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (!newFieldLabel.trim()) return;
                  const newKey = `custom_${Date.now()}`;
                  const newField: InfoCardFieldConfig = {
                    key: newKey,
                    label: newFieldLabel.trim(),
                    visible: true,
                    deleted: false,
                    order: infoCard.fields.length + 1,
                    customValue: '',
                    fontFamily: 'Cairo',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#171717',
                    iconColor: '#B08D45',
                    background: 'transparent',
                    textAlign: 'right',
                    spacing: 8,
                  };
                  setInfoCard({ ...infoCard, fields: [...infoCard.fields, newField] });
                  setExpandedFieldKey(newKey);
                  setNewFieldLabel('');
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold cursor-pointer"
              >
                <Plus size={14} />
                <span>إضافة عنصر</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {[...infoCard.fields]
                .filter((f) => f.key !== 'views')
                .sort((a, b) => a.order - b.order)
                .map((field, idx, arr) => {
                  const isStyleOpen = expandedFieldKey === field.key;
                  return (
                    <div
                      key={field.key}
                      className={`p-3 rounded-lg border space-y-2.5 ${
                        field.deleted
                          ? 'border-red-200 bg-red-50/40 opacity-60'
                          : field.visible
                            ? 'border-neutral-200 bg-white'
                            : 'border-neutral-200 bg-neutral-50 opacity-75'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveInfoField(field.key, -1)}
                              title="تحريك للأعلى"
                              className="p-1 rounded border border-neutral-200 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowUp size={12} />
                            </button>
                            <button
                              type="button"
                              disabled={idx === arr.length - 1}
                              onClick={() => moveInfoField(field.key, 1)}
                              title="تحريك للأسفل"
                              className="p-1 rounded border border-neutral-200 text-neutral-600 hover:bg-neutral-100 disabled:opacity-30 cursor-pointer"
                            >
                              <ArrowDown size={12} />
                            </button>
                          </div>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateInfoFieldByKey(field.key, { label: e.target.value })}
                            placeholder="اسم العنصر"
                            className="rounded border border-neutral-300 px-2 py-1 text-xs font-bold w-36"
                          />
                          <input
                            type="text"
                            value={field.customValue || ''}
                            onChange={(e) => updateInfoFieldByKey(field.key, { customValue: e.target.value })}
                            placeholder="نص مخصص ثابت (اختياري)"
                            className="rounded border border-neutral-300 px-2 py-1 text-xs w-40"
                          />
                          <select
                            value={field.icon || ''}
                            onChange={(e) => updateInfoFieldByKey(field.key, { icon: e.target.value })}
                            className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                          >
                            {FIELD_ICON_OPTIONS.map((ic) => (
                              <option key={ic.value || 'none'} value={ic.value}>
                                {ic.label}
                              </option>
                            ))}
                          </select>
                          <span className="text-[11px] font-mono text-neutral-400">{field.key}</span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <ColorField
                            label="لون النص"
                            value={field.color}
                            onChange={(c) => updateInfoFieldByKey(field.key, { color: c })}
                          />
                          <ColorField
                            label="لون الأيقونة"
                            value={field.iconColor || '#B08D45'}
                            onChange={(c) => updateInfoFieldByKey(field.key, { iconColor: c })}
                          />
                          <button
                            type="button"
                            onClick={() => setExpandedFieldKey(isStyleOpen ? null : field.key)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border cursor-pointer ${
                              isStyleOpen
                                ? 'bg-[#B08D45] text-white border-[#B08D45]'
                                : 'bg-white text-neutral-700 border-neutral-300 hover:bg-neutral-50'
                            }`}
                          >
                            <SlidersHorizontal size={12} />
                            <span>الخط والمظهر</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateInfoFieldByKey(field.key, { visible: !field.visible })}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border cursor-pointer ${
                              field.visible
                                ? 'bg-[#F7F4EC] text-[#8C6A2F] border-[#B08D45]/40'
                                : 'bg-neutral-100 text-neutral-600 border-neutral-300'
                            }`}
                          >
                            {field.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                            <span>{field.visible ? 'ظاهر' : 'مخفي'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => updateInfoFieldByKey(field.key, { deleted: !field.deleted })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border border-amber-200 text-amber-700 hover:bg-amber-50 cursor-pointer"
                          >
                            {field.deleted ? <RotateCcw size={13} /> : <Trash2 size={13} />}
                            <span>{field.deleted ? 'استرجاع' : 'إزالة'}</span>
                          </button>
                          <button
                            type="button"
                            title="حذف نهائي من القائمة"
                            onClick={() =>
                              setInfoCard({
                                ...infoCard,
                                fields: infoCard.fields
                                  .filter((f) => f.key !== field.key)
                                  .map((f, i) => ({ ...f, order: i + 1 })),
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                          >
                            <X size={13} />
                            <span>حذف نهائي</span>
                          </button>
                        </div>
                      </div>

                      {isStyleOpen && (
                        <div className="pt-2.5 border-t border-neutral-100 grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-end bg-neutral-50/70 p-2.5 rounded-lg">
                          <div>
                            <label className="block text-[11px] font-semibold text-neutral-600 mb-1">الخط</label>
                            <select
                              value={field.fontFamily || 'Cairo'}
                              onChange={(e) => updateInfoFieldByKey(field.key, { fontFamily: e.target.value })}
                              className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                            >
                              {FIELD_FONT_OPTIONS.map((f) => (
                                <option key={f} value={f}>
                                  {f}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-neutral-600 mb-1">حجم الخط</label>
                            <input
                              type="text"
                              dir="ltr"
                              value={field.fontSize || '13px'}
                              onChange={(e) => updateInfoFieldByKey(field.key, { fontSize: e.target.value })}
                              placeholder="13px"
                              className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-neutral-600 mb-1">سماكة الخط</label>
                            <select
                              value={field.fontWeight || '600'}
                              onChange={(e) => updateInfoFieldByKey(field.key, { fontWeight: e.target.value })}
                              className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                            >
                              <option value="400">عادي (400)</option>
                              <option value="500">متوسط (500)</option>
                              <option value="600">شبه عريض (600)</option>
                              <option value="700">عريض (700)</option>
                              <option value="800">ثقيل (800)</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-neutral-600 mb-1">المحاذاة</label>
                            <select
                              value={field.textAlign || 'right'}
                              onChange={(e) => updateInfoFieldByKey(field.key, { textAlign: e.target.value as any })}
                              className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                            >
                              <option value="right">يمين</option>
                              <option value="center">توسيط</option>
                              <option value="left">يسار</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-semibold text-neutral-600 mb-1">التباعد (px)</label>
                            <input
                              type="number"
                              min={0}
                              max={32}
                              value={field.spacing ?? 8}
                              onChange={(e) => updateInfoFieldByKey(field.key, { spacing: Number(e.target.value) })}
                              className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs tabular-nums"
                            />
                          </div>
                          <ColorField
                            label="خلفية العنصر"
                            value={field.background === 'transparent' ? '#FFFFFF' : field.background}
                            onChange={(c) => updateInfoFieldByKey(field.key, { background: c })}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </AdminCard>
        </div>
      )}

      {subTab === 'related' && (
        <div className="space-y-5">
          <AdminCard title="ضبط العدد الدقيق والمصدر لقسم (محتوى ذو صلة / مقترح)">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-5">
                  <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={related.enabled}
                      onChange={(e) => setRelated({ ...related, enabled: e.target.checked })}
                      className="accent-[#B08D45]"
                    />
                    <span>تفعيل قسم المحتوى المشابه</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={related.excludeCurrent}
                      onChange={(e) => setRelated({ ...related, excludeCurrent: e.target.checked })}
                      className="accent-[#B08D45]"
                    />
                    <span>استثناء العنصر المعروض حالياً</span>
                  </label>
                </div>

                <button
                  type="button"
                  onClick={() => setRelated({ ...related, deleted: !related.deleted })}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                    related.deleted
                      ? 'bg-[#B08D45] text-white border-[#B08D45]'
                      : 'border-red-200 text-red-600 hover:bg-red-50'
                  }`}
                >
                  {related.deleted ? <RotateCcw size={13} /> : <Trash2 size={13} />}
                  <span>{related.deleted ? 'استعادة قسم المحتوى المشابه' : 'حذف القسم بالكامل'}</span>
                </button>
              </div>

              {/* Quick Count Selector Pills + Custom Exact Count */}
              <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 space-y-2">
                <div className="text-xs font-bold text-neutral-800">
                  العدد الدقيق للعناصر المعروضة (Exact Count): {related.maxItems}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {QUICK_RELATED_COUNTS.map((cnt) => (
                    <button
                      key={cnt}
                      type="button"
                      onClick={() => setRelated({ ...related, maxItems: cnt })}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold tabular-nums cursor-pointer ${
                        related.maxItems === cnt
                          ? 'bg-[#B08D45] text-white border-[#B08D45]'
                          : 'bg-white text-neutral-700 border-neutral-300'
                      }`}
                    >
                      {cnt}
                    </button>
                  ))}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-neutral-600">مخصص:</span>
                    <input
                      type="number"
                      min={0}
                      max={24}
                      value={related.maxItems}
                      onChange={(e) => setRelated({ ...related, maxItems: Math.max(0, Number(e.target.value)) })}
                      className="w-20 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">عنوان القسم</label>
                  <input
                    type="text"
                    value={related.title}
                    onChange={(e) => setRelated({ ...related, title: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">طريقة الاختيار</label>
                  <select
                    value={related.selectionMode}
                    onChange={(e) => setRelated({ ...related, selectionMode: e.target.value as any })}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="newest">الأحدث نشراً</option>
                    <option value="oldest">الأقدم نشراً</option>
                    <option value="category">نفس التصنيف</option>
                    <option value="tags">تطابق الوسوم</option>
                    <option value="manual">اختيار يدوي</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">موضع القسم</label>
                  <select
                    value={related.position}
                    onChange={(e) => setRelated({ ...related, position: e.target.value as any })}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="below">أسفل المحتوى</option>
                    <option value="sidebar">شريط جانبي</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">تخطيط العرض</label>
                  <select
                    value={related.cardDesign.layout}
                    onChange={(e) =>
                      setRelated({
                        ...related,
                        cardDesign: { ...related.cardDesign, layout: e.target.value as any },
                      })
                    }
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                  >
                    <option value="grid">شبكة (Grid)</option>
                    <option value="list">قائمة (List)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  أنواع المحتوى المسموح بعرضها (اتركه فارغاً لعرض الكل)
                </label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(CONTENT_TYPE_LABELS).map(([k, lbl]) => {
                    const active = related.contentTypes.includes(k);
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() =>
                          setRelated({
                            ...related,
                            contentTypes: active
                              ? related.contentTypes.filter((t) => t !== k)
                              : [...related.contentTypes, k],
                          })
                        }
                        className={`px-2.5 py-1 rounded text-xs font-semibold border cursor-pointer ${
                          active
                            ? 'bg-[#B08D45] text-white border-[#B08D45]'
                            : 'bg-white text-neutral-600 border-neutral-300'
                        }`}
                      >
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              </div>

              {related.selectionMode === 'manual' && (
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                    اختر المواد يدوياً
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-neutral-200 rounded-lg">
                    {content
                      .filter((c) => c.status === 'published')
                      .map((c) => {
                        const checked = related.manualIds.includes(c.id);
                        return (
                          <label key={c.id} className="inline-flex items-center gap-2 text-xs cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setRelated({
                                  ...related,
                                  manualIds: e.target.checked
                                    ? [...related.manualIds, c.id]
                                    : related.manualIds.filter((id) => id !== c.id),
                                })
                              }
                              className="accent-[#B08D45]"
                            />
                            <span className="truncate">{c.title}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  تصفية حسب الصفحة المصدر (اتركه فارغاً للكل)
                </label>
                <div className="flex flex-wrap gap-2">
                  {pages
                    .filter((p) => p.status !== 'deleted')
                    .map((p) => {
                      const checked = related.sourcePageIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setRelated({
                              ...related,
                              sourcePageIds: checked
                                ? related.sourcePageIds.filter((id) => id !== p.id)
                                : [...related.sourcePageIds, p.id],
                            })
                          }
                          className={`px-2.5 py-1 rounded text-xs border cursor-pointer ${
                            checked
                              ? 'bg-[#B08D45] text-white border-[#B08D45]'
                              : 'bg-white text-neutral-700 border-neutral-300'
                          }`}
                        >
                          {p.title}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>
          </AdminCard>

          <AdminCard title="تصميم بطاقات المحتوى المشابه">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { key: 'showThumbnail', label: 'الصورة المصغرة' },
                { key: 'showTitle', label: 'العنوان' },
                { key: 'showDescription', label: 'الوصف' },
                { key: 'showDate', label: 'التاريخ' },
                { key: 'showBadge', label: 'الشارة' },
                { key: 'showPlayButton', label: 'زر التشغيل' },
                { key: 'showIcon', label: 'الأيقونة' },
              ].map((opt) => (
                <label key={opt.key} className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean((related.cardDesign as any)[opt.key])}
                    onChange={(e) =>
                      setRelated({
                        ...related,
                        cardDesign: { ...related.cardDesign, [opt.key]: e.target.checked },
                      })
                    }
                    className="accent-[#B08D45]"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <div>
                <label className="block text-xs font-semibold mb-1">الأعمدة (سطح المكتب)</label>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={related.cardDesign.columns}
                  onChange={(e) =>
                    setRelated({
                      ...related,
                      cardDesign: { ...related.cardDesign, columns: Number(e.target.value) },
                    })
                  }
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">الأعمدة (الجوال)</label>
                <select
                  value={related.cardDesign.columnsMobile || 1}
                  onChange={(e) =>
                    setRelated({
                      ...related,
                      cardDesign: { ...related.cardDesign, columnsMobile: Number(e.target.value) },
                    })
                  }
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value={1}>عمود واحد</option>
                  <option value={2}>عمودان</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">نسبة صورة البطاقة</label>
                <select
                  value={related.cardDesign.imageAspectRatio || '16/9'}
                  onChange={(e) =>
                    setRelated({
                      ...related,
                      cardDesign: { ...related.cardDesign, imageAspectRatio: e.target.value as any },
                    })
                  }
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="16/9">16:9</option>
                  <option value="4/3">4:3</option>
                  <option value="1/1">1:1 مربع</option>
                  <option value="auto">تلقائي</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">الحشوة الداخلية (px)</label>
                <input
                  type="number"
                  min={4}
                  max={36}
                  value={related.cardDesign.cardPadding ?? 16}
                  onChange={(e) =>
                    setRelated({
                      ...related,
                      cardDesign: { ...related.cardDesign, cardPadding: Number(e.target.value) },
                    })
                  }
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <ColorField
                label="خلفية البطاقة"
                value={related.cardDesign.cardBackground}
                onChange={(c) =>
                  setRelated({ ...related, cardDesign: { ...related.cardDesign, cardBackground: c } })
                }
              />
              <ColorField
                label="لون عنوان البطاقة"
                value={related.cardDesign.textColor}
                onChange={(c) =>
                  setRelated({ ...related, cardDesign: { ...related.cardDesign, textColor: c } })
                }
              />
              <ColorField
                label="لون البيانات الوصفية"
                value={related.cardDesign.metaColor || '#737373'}
                onChange={(c) =>
                  setRelated({ ...related, cardDesign: { ...related.cardDesign, metaColor: c } })
                }
              />
              <ColorField
                label="لون الحدود"
                value={related.cardDesign.borderColor}
                onChange={(c) =>
                  setRelated({ ...related, cardDesign: { ...related.cardDesign, borderColor: c } })
                }
              />
            </div>

            <GradientEditor
              value={related.cardDesign.titleGradient}
              onChange={(g) =>
                setRelated({ ...related, cardDesign: { ...related.cardDesign, titleGradient: g } })
              }
              title="تدرج عنوان بطاقات المحتوى المشابه"
            />
          </AdminCard>

          <AdminCard title={`معاينة حية للمحتوى المشابه (${previewRelatedCount} بطاقات)`}>
            {previewRelatedCount === 0 ? (
              <p className="py-6 text-center text-xs text-neutral-500">
                قسم المحتوى المشابه معطّل أو محذوف أو العدد مضبوط على 0.
              </p>
            ) : (
              <div
                className={`grid gap-4 ${
                  related.cardDesign.layout === 'list'
                    ? 'grid-cols-1'
                    : related.cardDesign.columns === 2
                      ? 'grid-cols-1 sm:grid-cols-2'
                      : related.cardDesign.columns === 4
                        ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                }`}
              >
                {Array.from({ length: Math.min(previewRelatedCount, 6) }).map((_, i) => {
                  const itm = content[i] || { ...sampleItem, id: i + 1, title: `${sampleItem.title} #${i + 1}` };
                  return (
                    <MediaCard
                      key={i}
                      item={itm}
                      variant={related.cardDesign.layout === 'list' ? 'compact' : 'editorial'}
                      showThumbnail={related.cardDesign.showThumbnail}
                      showTitle={related.cardDesign.showTitle}
                      showDate={related.cardDesign.showDate}
                      showDescription={related.cardDesign.showDescription}
                      showBadge={related.cardDesign.showBadge}
                      showPlayButton={related.cardDesign.showPlayButton}
                      cardDesignOverride={related.cardDesign}
                    />
                  );
                })}
              </div>
            )}
          </AdminCard>
        </div>
      )}
    </div>
  );
}
