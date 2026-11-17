import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Eraser,
  Eye,
  EyeOff,
  FileText,
  Plus,
  RotateCcw,
  Trash2,
  Type,
  Upload,
} from 'lucide-react';
import { AdminCard, AdminPanelHeader, ColorField, TextStyleEditor } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { DEFAULT_SETTINGS } from '../../../../server/defaults';
import { buildTextStyle } from '../../../lib/styleEngine';
import { uploadFileInChunks } from '../../../lib/uploadClient';
import type {
  AllSettings,
  CustomTextElementConfig,
  HomepageSectionConfig,
  NavItemConfig,
  TextStyleConfig,
} from '../../../types/platform';

const TYPO_TARGETS: Array<{ key: keyof AllSettings['typography']; label: string }> = [
  { key: 'siteTitle', label: 'عنوان الموقع الرئيسي' },
  { key: 'navigation', label: 'روابط شريط التنقل' },
  { key: 'homeHeadings', label: 'عناوين البطل والصفحة الرئيسية' },
  { key: 'sectionHeadings', label: 'عناوين الأقسام والمجموعات' },
  { key: 'postTitle', label: 'عناوين المنشورات والمقالات' },
  { key: 'videoTitle', label: 'عناوين الفيديوهات' },
  { key: 'imageTitle', label: 'عناوين الصور والمعارض' },
  { key: 'description', label: 'النصوص والوصف' },
  { key: 'metadata', label: 'البيانات الوصفية والتواريخ' },
  { key: 'related', label: 'عناوين المحتوى المشابه' },
  { key: 'buttons', label: 'نصوص الأزرار' },
  { key: 'footer', label: 'نصوص التذييل' },
  { key: 'adminSidebar', label: 'قائمة لوحة التحكم' },
  { key: 'adminHeadings', label: 'عناوين لوحة التحكم' },
  { key: 'adminInputs', label: 'حقول الإدخال الإدارية' },
];

const BUILTIN_FONTS = ['Cairo', 'Tajawal', 'IBM Plex Sans Arabic', 'Amiri', 'IBM Plex Mono'];

const UI_TEXT_GROUPS: Array<{
  group: string;
  fields: Array<{ key: Exclude<keyof AllSettings['uiTexts'], 'contentTypeLabels' | 'customTextBlocks'>; label: string }>;
}> = [
  {
    group: 'رسائل الفراغ والحالات العامة',
    fields: [
      { key: 'homeEmptySection', label: 'رسالة القسم الفارغ بالرئيسية' },
      { key: 'collectionEmptyMessage', label: 'رسالة الصفحة الفارغة (بدون مواد)' },
      { key: 'searchEmptyMessage', label: 'رسالة عدم وجود نتائج بحث' },
      { key: 'detailNotFound', label: 'رسالة المادة غير موجودة' },
      { key: 'loadingPlatform', label: 'عبارة تحميل المنصة' },
      { key: 'loadingContent', label: 'عبارة تحميل المادة' },
      { key: 'loadingSearch', label: 'عبارة جاري البحث' },
    ],
  },
  {
    group: 'عبارات الفلترة والترتيب والتنقل',
    fields: [
      { key: 'breadcrumbHome', label: 'كلمة الرئيسية في مسار التصفح' },
      { key: 'backToHomeLabel', label: 'زر العودة للرئيسية' },
      { key: 'viewAllDefaultLabel', label: 'نص رابط عرض الكل الافتراضي' },
      { key: 'allItemsFilter', label: 'خيار فلتر الكل (الصفحات)' },
      { key: 'allTypesFilter', label: 'خيار فلتر كافة الأنواع' },
      { key: 'searchHeading', label: 'عنوان صفحة البحث' },
      { key: 'searchAllTypes', label: 'خيار جميع الأنواع بالبحث' },
      { key: 'sortNewest', label: 'ترتيب: الأحدث أولاً' },
      { key: 'sortOldest', label: 'ترتيب: الأقدم أولاً' },
    ],
  },
  {
    group: 'أزرار التفاعل والتحميل والتذييل',
    fields: [
      { key: 'openExternalLinkLabel', label: 'نص زر فتح الرابط الخارجي' },
      { key: 'downloadVideoLabel', label: 'نص زر تحميل الفيديو' },
      { key: 'downloadImageLabel', label: 'نص زر تحميل الصورة' },
      { key: 'downloadAudioLabel', label: 'نص زر تحميل الصوت' },
      { key: 'downloadDocumentLabel', label: 'نص زر تحميل الوثيقة' },
      { key: 'documentAttachedLabel', label: 'عنوان بطاقة الوثيقة المرفقة' },
      { key: 'shareLabel', label: 'نص زر المشاركة' },
      { key: 'copyLinkLabel', label: 'نص زر نسخ الرابط' },
      { key: 'copiedLinkLabel', label: 'نص إشعار تم نسخ الرابط' },
      { key: 'footerLinksTitle', label: 'عنوان عمود روابط التذييل' },
      { key: 'footerEmailLabel', label: 'بادئة البريد الإلكتروني بالتذييل' },
      { key: 'jsonFeedLabel', label: 'نص رابط خلاصة JSON' },
      { key: 'fontScaleDecrease', label: 'زر تصغير الخط (أ-)' },
      { key: 'fontScaleNormal', label: 'زر الخط العادي (عادي)' },
      { key: 'fontScaleIncrease', label: 'زر تكبير الخط (أ+)' },
    ],
  },
];

const BLOCK_LOCATIONS: Array<{ value: CustomTextElementConfig['location']; label: string }> = [
  { value: 'hero-top', label: 'أعلى الصفحة الرئيسية (فوق البانر)' },
  { value: 'hero-bottom', label: 'أسفل البانر الرئيسي مباشرة' },
  { value: 'home-after-sections', label: 'نهاية الصفحة الرئيسية' },
  { value: 'footer-top', label: 'فوق التذييل في كل الصفحات' },
  { value: 'collection-top', label: 'أعلى صفحات الأقسام والمجموعات' },
  { value: 'detail-top', label: 'أعلى صفحة تفاصيل المادة' },
];

export function AdminTypography() {
  const { settings, previousSettings, saveCategory, resetCategory, notify } = useAdmin();

  const [activeTab, setActiveTab] = useState<'elements' | 'phrases'>('elements');
  const [typo, setTypo] = useState<AllSettings['typography'] | null>(null);
  const [identity, setIdentity] = useState<AllSettings['identity'] | null>(null);
  const [homepage, setHomepage] = useState<AllSettings['homepage'] | null>(null);
  const [navigation, setNavigation] = useState<AllSettings['navigation'] | null>(null);
  const [related, setRelated] = useState<AllSettings['related'] | null>(null);
  const [footer, setFooter] = useState<AllSettings['footer'] | null>(null);
  const [buttons, setButtons] = useState<AllSettings['buttons']>([]);
  const [infoCard, setInfoCard] = useState<AllSettings['infoCard'] | null>(null);
  const [searchCfg, setSearchCfg] = useState<AllSettings['search'] | null>(null);
  const [otherCfg, setOtherCfg] = useState<AllSettings['other'] | null>(null);
  const [adminTheme, setAdminTheme] = useState<AllSettings['adminTheme'] | null>(null);
  const [uiTexts, setUiTexts] = useState<AllSettings['uiTexts'] | null>(null);

  const [dirtyCats, setDirtyCats] = useState<Set<keyof AllSettings>>(new Set());
  const [selectedKey, setSelectedKey] = useState<keyof AllSettings['typography']>('homeHeadings');
  const [customPreviewText, setCustomPreviewText] = useState<string>('');
  const [fontName, setFontName] = useState('');
  const [uploadingFont, setUploadingFont] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setTypo(structuredClone(settings.typography));
    setIdentity(structuredClone(settings.identity));
    setHomepage(structuredClone(settings.homepage));
    setNavigation(structuredClone(settings.navigation));
    setRelated(structuredClone(settings.related));
    setFooter(structuredClone(settings.footer));
    setButtons(structuredClone(settings.buttons || []));
    setInfoCard(structuredClone(settings.infoCard));
    setSearchCfg(structuredClone(settings.search));
    setOtherCfg(structuredClone(settings.other));
    setAdminTheme(structuredClone(settings.adminTheme));
    setUiTexts(structuredClone(settings.uiTexts));
    setDirtyCats(new Set());
  }, [settings]);

  const markDirty = (cat: keyof AllSettings) => {
    setDirtyCats((prev) => {
      const next = new Set(prev);
      next.add(cat);
      return next;
    });
  };

  const livePreviewSample = useMemo(() => {
    if (customPreviewText.trim()) return customPreviewText;
    const siteLabel = identity?.siteName || 'المنصة';
    switch (selectedKey) {
      case 'siteTitle':
        return identity?.siteName || 'عنوان الموقع محذوف / فارغ';
      case 'navigation':
        return (navigation?.items || []).filter((i) => i.visible).map((i) => i.label).join('  ·  ') || 'لا توجد روابط ظاهرة';
      case 'homeHeadings':
        return (homepage?.hero.showTitle && !homepage?.hero.titleDeleted && homepage?.hero.title) || homepage?.hero.subtitle || siteLabel;
      case 'sectionHeadings':
        return homepage?.sections.find((s) => s.visible && !s.deleted)?.title || 'عنوان القسم الرئيسي';
      case 'postTitle':
        return `مثال عنوان مقال أو تقرير — ${siteLabel}`;
      case 'videoTitle':
        return `مثال عنوان مادة مرئية — ${siteLabel}`;
      case 'imageTitle':
        return `مثال عنوان صورة أرشيفية — ${siteLabel}`;
      case 'description':
        return homepage?.hero.subtitle || uiTexts?.homeEmptySection || `نص وصفي توضيحي ضمن ${siteLabel}`;
      case 'metadata':
        return '١٦ نوفمبر ٢٠٢٦ · فيديو وثائقي';
      case 'related':
        return related?.title || 'مواد ذات صلة';
      case 'buttons':
        return uiTexts?.viewAllDefaultLabel || buttons[0]?.label || 'عرض الكل';
      case 'footer':
        return footer?.text || footer?.copyright || siteLabel;
      case 'adminSidebar':
        return `${adminTheme?.sidebarTitle ?? siteLabel} — ${adminTheme?.sidebarSubtitle ?? 'لوحة التحكم'}`;
      case 'adminHeadings':
        return `لوحة إدارة ${siteLabel}`;
      case 'adminInputs':
        return searchCfg?.placeholder || 'ابحث في الأرشيف...';
      default:
        return `${siteLabel} — معاينة مباشرة لتنسيق الخط والنص العربي`;
    }
  }, [selectedKey, customPreviewText, identity, navigation, homepage, uiTexts, related, buttons, footer, adminTheme, searchCfg]);

  if (!settings || !typo || !identity || !homepage || !navigation || !related || !footer || !infoCard || !searchCfg || !otherCfg || !adminTheme || !uiTexts) {
    return null;
  }

  const availableFonts = [
    ...BUILTIN_FONTS,
    ...(identity.customFonts || []).map((f) => f.name).filter((n) => !BUILTIN_FONTS.includes(n)),
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      const catPayloads: Partial<Record<keyof AllSettings, any>> = {
        typography: typo,
        identity,
        homepage,
        navigation,
        related,
        footer,
        buttons,
        infoCard,
        search: searchCfg,
        other: otherCfg,
        adminTheme,
        uiTexts,
      };
      const toSave = dirtyCats.size > 0 ? Array.from(dirtyCats) : (['typography'] as Array<keyof AllSettings>);
      if (!toSave.includes('typography')) toSave.unshift('typography');

      for (const cat of toSave) {
        if (catPayloads[cat] !== undefined) {
          await saveCategory(cat, catPayloads[cat], `تحديث (${cat}) من محرر الخطوط والنصوص`);
        }
      }
      setDirtyCats(new Set());
      notify('تم حفظ وتطبيق كافة الخطوط والنصوص والتعديلات على الموقع مباشرة');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setTypo(structuredClone(settings.typography));
    setIdentity(structuredClone(settings.identity));
    setHomepage(structuredClone(settings.homepage));
    setNavigation(structuredClone(settings.navigation));
    setRelated(structuredClone(settings.related));
    setFooter(structuredClone(settings.footer));
    setButtons(structuredClone(settings.buttons || []));
    setInfoCard(structuredClone(settings.infoCard));
    setSearchCfg(structuredClone(settings.search));
    setOtherCfg(structuredClone(settings.other));
    setAdminTheme(structuredClone(settings.adminTheme));
    setUiTexts(structuredClone(settings.uiTexts));
    setDirtyCats(new Set());
    notify('تم إلغاء التعديلات غير المحفوظة', 'info');
  };

  const handleRevertPrevious = () => {
    const prevTypo = previousSettings.typography as AllSettings['typography'] | undefined;
    const prevUi = previousSettings.uiTexts as AllSettings['uiTexts'] | undefined;
    if (!prevTypo && !prevUi) return;
    const nextDirty = new Set(dirtyCats);
    if (prevTypo) {
      setTypo(structuredClone(prevTypo));
      nextDirty.add('typography');
    }
    if (prevUi) {
      setUiTexts(structuredClone(prevUi));
      nextDirty.add('uiTexts');
    }
    setDirtyCats(nextDirty);
    notify('تمت استعادة الإعدادات السابقة في المعاينة؛ اضغط «حفظ وتطبيق التغييرات» لتثبيتها', 'info');
  };

  const handleUploadFont = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFont(true);
    try {
      const res = await uploadFileInChunks(file);
      const ext = file.name.split('.').pop()?.toLowerCase() || 'woff2';
      const fmt = ext === 'ttf' ? 'truetype' : ext === 'otf' ? 'opentype' : ext;
      const cleanName = (fontName || file.name.replace(/\.[^.]+$/, '')).trim();
      const nextFonts = [
        ...(identity.customFonts || []),
        { id: `font-${Date.now()}`, name: cleanName, url: res.media.public_url, format: fmt },
      ];
      setIdentity({ ...identity, customFonts: nextFonts });
      await saveCategory(
        'identity',
        { ...identity, customFonts: nextFonts },
        `رفع خط مخصص: ${cleanName}`
      );
      setFontName('');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل رفع الخط', 'error');
    } finally {
      setUploadingFont(false);
    }
  };

  const handleRemoveFont = async (id: string) => {
    const nextFonts = (identity.customFonts || []).filter((f) => f.id !== id);
    setIdentity({ ...identity, customFonts: nextFonts });
    await saveCategory(
      'identity',
      { ...identity, customFonts: nextFonts },
      'حذف خط مخصص'
    );
  };

  const updateUiPhrase = (
    key: Exclude<keyof AllSettings['uiTexts'], 'contentTypeLabels' | 'customTextBlocks'>,
    val: string
  ) => {
    setUiTexts({ ...uiTexts, [key]: val });
    markDirty('uiTexts');
  };

  const addCustomTextBlock = () => {
    const newBlock: CustomTextElementConfig = {
      id: `txt-${Date.now()}`,
      location: 'hero-bottom',
      text: 'نص أو تنويه جديد قابل للتعديل والحذف',
      visible: true,
      deleted: false,
      order: (uiTexts.customTextBlocks || []).length + 1,
      showDesktop: true,
      showTablet: true,
      showMobile: true,
      style: structuredClone(typo.description),
      background: '#FFFFFF',
      borderColor: '#D8D8D8',
      borderWidth: 1,
      borderRadius: 10,
      shadow: 'none',
      padding: 14,
    };
    setUiTexts({
      ...uiTexts,
      customTextBlocks: [...(uiTexts.customTextBlocks || []), newBlock],
    });
    markDirty('uiTexts');
  };

  const updateBlock = (id: string, patch: Partial<CustomTextElementConfig>) => {
    setUiTexts({
      ...uiTexts,
      customTextBlocks: (uiTexts.customTextBlocks || []).map((b) =>
        b.id === id ? { ...b, ...patch } : b
      ),
    });
    markDirty('uiTexts');
  };

  const currentProfile: TextStyleConfig = typo[selectedKey];
  const previewStyle = buildTextStyle(
    {
      ...currentProfile,
      color:
        currentProfile.color === '#171717' || currentProfile.color === '#000000'
          ? '#FFFFFF'
          : currentProfile.color,
    },
    null,
    'desktop'
  );

  const renderPhraseRow = (
    label: string,
    value: string,
    onChange: (next: string) => void,
    defaultVal?: string
  ) => (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-2.5 rounded-lg border border-neutral-200 bg-neutral-50/70">
      <div className="sm:w-56 shrink-0">
        <div className="text-xs font-bold text-neutral-800">{label}</div>
        {!value && <span className="text-[10px] text-amber-700 font-semibold">محذوف / مخفي حالياً</span>}
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="فارغ (لن يظهر نص)..."
        className="flex-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
      />
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onChange('')}
          title="حذف / مسح هذا النص ليختفي من الموقع"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-red-600 text-[11px] font-bold hover:bg-red-50 cursor-pointer"
        >
          <Eraser size={12} /> حذف النص
        </button>
        {defaultVal !== undefined && value !== defaultVal && (
          <button
            type="button"
            onClick={() => onChange(defaultVal)}
            title="استعادة النص الافتراضي"
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-neutral-300 bg-white text-neutral-700 text-[11px] font-semibold hover:bg-neutral-100 cursor-pointer"
          >
            <RotateCcw size={12} /> استعادة
          </button>
        )}
      </div>
    </div>
  );

  const renderElementInlineContentEditor = () => {
    switch (selectedKey) {
      case 'siteTitle':
        return (
          <div className="space-y-2.5">
            {renderPhraseRow(
              'اسم الموقع الرئيسي (الهيدر والتذييل)',
              identity.siteName,
              (v) => {
                setIdentity({ ...identity, siteName: v });
                markDirty('identity');
              }
            )}
            {renderPhraseRow(
              'الوصف الفرعي للمنصة',
              identity.siteSubtitle,
              (v) => {
                setIdentity({ ...identity, siteSubtitle: v });
                markDirty('identity');
              }
            )}
            {renderPhraseRow(
              'عنوان تبويب المتصفح',
              identity.browserTitle,
              (v) => {
                setIdentity({ ...identity, browserTitle: v });
                markDirty('identity');
              }
            )}
          </div>
        );

      case 'navigation':
        return (
          <div className="space-y-2">
            {(navigation.items || []).map((navItem: NavItemConfig) => (
              <div
                key={navItem.id}
                className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg border border-neutral-200 bg-neutral-50/70"
              >
                <input
                  type="text"
                  value={navItem.label}
                  onChange={(e) => {
                    setNavigation({
                      ...navigation,
                      items: navigation.items.map((it) =>
                        it.id === navItem.id ? { ...it, label: e.target.value } : it
                      ),
                    });
                    markDirty('navigation');
                  }}
                  className="flex-1 min-w-[140px] rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                />
                <input
                  type="text"
                  dir="ltr"
                  value={navItem.url}
                  onChange={(e) => {
                    setNavigation({
                      ...navigation,
                      items: navigation.items.map((it) =>
                        it.id === navItem.id ? { ...it, url: e.target.value } : it
                      ),
                    });
                    markDirty('navigation');
                  }}
                  className="w-40 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={() => {
                    setNavigation({
                      ...navigation,
                      items: navigation.items.map((it) =>
                        it.id === navItem.id ? { ...it, visible: !it.visible } : it
                      ),
                    });
                    markDirty('navigation');
                  }}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold cursor-pointer ${
                    navItem.visible
                      ? 'border-[#B08D45]/40 bg-[#F7F4EC] text-[#8C6A2F]'
                      : 'border-amber-200 bg-amber-50 text-amber-700'
                  }`}
                >
                  {navItem.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                  <span>{navItem.visible ? 'ظاهر' : 'مخفي'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNavigation({
                      ...navigation,
                      items: navigation.items.filter((it) => it.id !== navItem.id),
                    });
                    markDirty('navigation');
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-white text-red-600 text-[11px] font-bold hover:bg-red-50 cursor-pointer"
                >
                  <Trash2 size={12} /> حذف
                </button>
              </div>
            ))}
          </div>
        );

      case 'homeHeadings':
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-neutral-200">
              <span className="text-xs font-bold text-neutral-700">حالة قسم البطل بالرئيسية:</span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setHomepage({
                      ...homepage,
                      hero: { ...homepage.hero, enabled: !homepage.hero.enabled },
                    });
                    markDirty('homepage');
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold cursor-pointer ${
                    homepage.hero.enabled ? 'bg-[#B08D45] text-white' : 'bg-neutral-200 text-neutral-700'
                  }`}
                >
                  {homepage.hero.enabled ? 'قسم البطل مفعّل (اضغط للإخفاء)' : 'قسم البطل مخفي (اضغط للتفعيل)'}
                </button>
              </div>
            </div>

            {[
              { field: 'title' as const, showKey: 'showTitle' as const, delKey: 'titleDeleted' as const, label: 'العنوان الرئيسي للبطل' },
              { field: 'subtitle' as const, showKey: 'showSubtitle' as const, delKey: 'subtitleDeleted' as const, label: 'الجملة الوصفية للبطل' },
              { field: 'introText' as const, showKey: 'showIntro' as const, delKey: 'introDeleted' as const, label: 'النص التمهيدي الإضافي' },
            ].map((row) => {
              const isDeleted = Boolean(homepage.hero[row.delKey]);
              const isShown = Boolean(homepage.hero[row.showKey]);
              return (
                <div key={row.field} className="p-2.5 rounded-lg border border-neutral-200 bg-neutral-50/70 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-neutral-800">{row.label}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setHomepage({
                            ...homepage,
                            hero: { ...homepage.hero, [row.showKey]: !isShown },
                          });
                          markDirty('homepage');
                        }}
                        className="px-2 py-1 rounded border border-neutral-300 bg-white text-[11px] font-semibold cursor-pointer"
                      >
                        {isShown ? 'إخفاء' : 'إظهار'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setHomepage({
                            ...homepage,
                            hero: {
                              ...homepage.hero,
                              [row.delKey]: !isDeleted,
                              ...(isDeleted ? {} : { [row.field]: '' }),
                            },
                          });
                          markDirty('homepage');
                        }}
                        className={`px-2 py-1 rounded border text-[11px] font-bold cursor-pointer ${
                          isDeleted
                            ? 'border-[#B08D45]/40 bg-[#F7F4EC] text-[#8C6A2F]'
                            : 'border-red-200 bg-white text-red-600'
                        }`}
                      >
                        {isDeleted ? 'استعادة العنصر' : 'حذف العنصر'}
                      </button>
                    </div>
                  </div>
                  <input
                    type="text"
                    value={homepage.hero[row.field] || ''}
                    onChange={(e) => {
                      setHomepage({
                        ...homepage,
                        hero: { ...homepage.hero, [row.field]: e.target.value, [row.delKey]: false },
                      });
                      markDirty('homepage');
                    }}
                    placeholder="اكتب النص أو اتركه فارغاً..."
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                </div>
              );
            })}
          </div>
        );

      case 'sectionHeadings':
        return (
          <div className="space-y-3">
            {(homepage.sections || []).map((sec: HomepageSectionConfig) => (
              <div key={sec.id} className="p-3 rounded-lg border border-neutral-200 bg-neutral-50/70 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold text-neutral-900">
                    قسم: {sec.title || 'بدون عنوان'} {sec.deleted ? '(محذوف)' : !sec.visible ? '(مخفي)' : ''}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setHomepage({
                          ...homepage,
                          sections: homepage.sections.map((s) =>
                            s.id === sec.id ? { ...s, visible: !s.visible } : s
                          ),
                        });
                        markDirty('homepage');
                      }}
                      className="px-2 py-1 rounded border border-neutral-300 bg-white text-[11px] font-semibold cursor-pointer"
                    >
                      {sec.visible ? 'إخفاء القسم' : 'إظهار القسم'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setHomepage({
                          ...homepage,
                          sections: homepage.sections.map((s) =>
                            s.id === sec.id ? { ...s, deleted: !s.deleted } : s
                          ),
                        });
                        markDirty('homepage');
                      }}
                      className={`px-2 py-1 rounded border text-[11px] font-bold cursor-pointer ${
                        sec.deleted
                          ? 'border-[#B08D45]/40 bg-[#F7F4EC] text-[#8C6A2F]'
                          : 'border-red-200 bg-white text-red-600'
                      }`}
                    >
                      {sec.deleted ? 'استعادة القسم' : 'حذف القسم'}
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={sec.title}
                    onChange={(e) => {
                      setHomepage({
                        ...homepage,
                        sections: homepage.sections.map((s) =>
                          s.id === sec.id ? { ...s, title: e.target.value } : s
                        ),
                      });
                      markDirty('homepage');
                    }}
                    placeholder="عنوان القسم (فارغ لحذفه)"
                    className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    value={sec.subtitle}
                    onChange={(e) => {
                      setHomepage({
                        ...homepage,
                        sections: homepage.sections.map((s) =>
                          s.id === sec.id ? { ...s, subtitle: e.target.value } : s
                        ),
                      });
                      markDirty('homepage');
                    }}
                    placeholder="الوصف الفرعي (فارغ لحذفه)"
                    className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    value={sec.viewAllLabel}
                    onChange={(e) => {
                      setHomepage({
                        ...homepage,
                        sections: homepage.sections.map((s) =>
                          s.id === sec.id ? { ...s, viewAllLabel: e.target.value } : s
                        ),
                      });
                      markDirty('homepage');
                    }}
                    placeholder="نص رابط عرض الكل"
                    className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                  <input
                    type="text"
                    value={sec.emptyMessage ?? ''}
                    onChange={(e) => {
                      setHomepage({
                        ...homepage,
                        sections: homepage.sections.map((s) =>
                          s.id === sec.id ? { ...s, emptyMessage: e.target.value } : s
                        ),
                      });
                      markDirty('homepage');
                    }}
                    placeholder="رسالة عند عدم وجود مواد (فارغ لإخفائها)"
                    className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                  />
                </div>
              </div>
            ))}
          </div>
        );

      case 'related':
        return (
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-neutral-200">
              <span className="text-xs font-bold text-neutral-700">
                حالة صندوق المحتوى المشابه: {related.deleted ? 'محذوف' : related.enabled ? 'مفعّل' : 'مخفي'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRelated({ ...related, enabled: !related.enabled });
                    markDirty('related');
                  }}
                  className="px-2.5 py-1 rounded border border-neutral-300 bg-white text-xs font-semibold cursor-pointer"
                >
                  {related.enabled ? 'إخفاء الصندوق' : 'إظهار الصندوق'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRelated({ ...related, deleted: !related.deleted });
                    markDirty('related');
                  }}
                  className={`px-2.5 py-1 rounded border text-xs font-bold cursor-pointer ${
                    related.deleted
                      ? 'border-[#B08D45]/40 bg-[#F7F4EC] text-[#8C6A2F]'
                      : 'border-red-200 bg-white text-red-600'
                  }`}
                >
                  {related.deleted ? 'استعادة الصندوق' : 'حذف الصندوق'}
                </button>
              </div>
            </div>
            {renderPhraseRow(
              'عنوان قسم المحتوى المشابه',
              related.title,
              (v) => {
                setRelated({ ...related, title: v });
                markDirty('related');
              },
              DEFAULT_SETTINGS.related.title
            )}
            {renderPhraseRow(
              'وصف قسم المحتوى المشابه',
              related.description,
              (v) => {
                setRelated({ ...related, description: v });
                markDirty('related');
              },
              DEFAULT_SETTINGS.related.description
            )}
          </div>
        );

      case 'footer':
        return (
          <div className="space-y-2.5">
            {renderPhraseRow(
              'النص التعريفي بالتذييل',
              footer.text,
              (v) => {
                setFooter({ ...footer, text: v });
                markDirty('footer');
              }
            )}
            {renderPhraseRow(
              'عبارة حقوق النشر',
              footer.copyright,
              (v) => {
                setFooter({ ...footer, copyright: v });
                markDirty('footer');
              }
            )}
            {renderPhraseRow(
              'عنوان عمود روابط المنصة',
              uiTexts.footerLinksTitle,
              (v) => updateUiPhrase('footerLinksTitle', v),
              DEFAULT_SETTINGS.uiTexts.footerLinksTitle
            )}
            {renderPhraseRow(
              'بادئة البريد الإلكتروني',
              uiTexts.footerEmailLabel,
              (v) => updateUiPhrase('footerEmailLabel', v),
              DEFAULT_SETTINGS.uiTexts.footerEmailLabel
            )}
            {renderPhraseRow(
              'رابط خلاصة JSON',
              uiTexts.jsonFeedLabel,
              (v) => updateUiPhrase('jsonFeedLabel', v),
              DEFAULT_SETTINGS.uiTexts.jsonFeedLabel
            )}
          </div>
        );

      case 'buttons':
        return (
          <div className="space-y-2.5">
            {renderPhraseRow(
              'نص زر البحث العلوي',
              searchCfg.buttonLabel,
              (v) => {
                setSearchCfg({ ...searchCfg, buttonLabel: v });
                markDirty('search');
              },
              DEFAULT_SETTINGS.search.buttonLabel
            )}
            {renderPhraseRow(
              'نص رابط عرض الكل الافتراضي',
              uiTexts.viewAllDefaultLabel,
              (v) => updateUiPhrase('viewAllDefaultLabel', v),
              DEFAULT_SETTINGS.uiTexts.viewAllDefaultLabel
            )}
            {renderPhraseRow(
              'نص زر العودة للرئيسية',
              uiTexts.backToHomeLabel,
              (v) => updateUiPhrase('backToHomeLabel', v),
              DEFAULT_SETTINGS.uiTexts.backToHomeLabel
            )}
            {renderPhraseRow(
              'نص زر المشاركة',
              uiTexts.shareLabel,
              (v) => updateUiPhrase('shareLabel', v),
              DEFAULT_SETTINGS.uiTexts.shareLabel
            )}
            {renderPhraseRow(
              'نص زر نسخ الرابط',
              uiTexts.copyLinkLabel,
              (v) => updateUiPhrase('copyLinkLabel', v),
              DEFAULT_SETTINGS.uiTexts.copyLinkLabel
            )}
            {renderPhraseRow(
              'نص زر فتح الرابط الخارجي',
              uiTexts.openExternalLinkLabel,
              (v) => updateUiPhrase('openExternalLinkLabel', v),
              DEFAULT_SETTINGS.uiTexts.openExternalLinkLabel
            )}
            {buttons.length > 0 && (
              <div className="pt-2 space-y-2">
                <div className="text-xs font-bold text-neutral-700">الأزرار المخصصة المنشأة:</div>
                {buttons.map((b) => (
                  <div key={b.id} className="flex flex-wrap items-center gap-2 p-2 rounded-lg border border-neutral-200 bg-neutral-50">
                    <input
                      type="text"
                      value={b.label}
                      onChange={(e) => {
                        setButtons(buttons.map((it) => (it.id === b.id ? { ...it, label: e.target.value } : it)));
                        markDirty('buttons');
                      }}
                      className="flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setButtons(buttons.map((it) => (it.id === b.id ? { ...it, visible: !it.visible } : it)));
                        markDirty('buttons');
                      }}
                      className="px-2 py-1 rounded border border-neutral-300 bg-white text-[11px] font-semibold cursor-pointer"
                    >
                      {b.visible ? 'إخفاء' : 'إظهار'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setButtons(buttons.filter((it) => it.id !== b.id));
                        markDirty('buttons');
                      }}
                      className="px-2 py-1 rounded border border-red-200 bg-white text-red-600 text-[11px] font-bold cursor-pointer"
                    >
                      حذف
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );

      case 'metadata':
        return (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
              {Object.entries(uiTexts.contentTypeLabels || {}).map(([typeKey, labelVal]) => (
                <div key={typeKey} className="flex items-center gap-1.5 p-2 rounded-lg border border-neutral-200 bg-neutral-50">
                  <span className="text-[11px] font-mono text-neutral-500 w-16 shrink-0">{typeKey}</span>
                  <input
                    type="text"
                    value={labelVal}
                    onChange={(e) => {
                      setUiTexts({
                        ...uiTexts,
                        contentTypeLabels: { ...uiTexts.contentTypeLabels, [typeKey]: e.target.value },
                      });
                      markDirty('uiTexts');
                    }}
                    className="flex-1 rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        );

      case 'adminSidebar':
        return (
          <div className="space-y-2.5">
            {renderPhraseRow(
              'العنوان الرئيسي للقائمة الجانبية بالإدارة',
              adminTheme.sidebarTitle,
              (v) => {
                setAdminTheme({ ...adminTheme, sidebarTitle: v });
                markDirty('adminTheme');
              }
            )}
            {renderPhraseRow(
              'العنوان الفرعي للقائمة الجانبية',
              adminTheme.sidebarSubtitle,
              (v) => {
                setAdminTheme({ ...adminTheme, sidebarSubtitle: v });
                markDirty('adminTheme');
              }
            )}
          </div>
        );

      case 'adminHeadings':
      case 'adminInputs':
        return (
          <div className="space-y-2.5">
            {renderPhraseRow(
              'عنوان صفحة البحث العام',
              uiTexts.searchHeading,
              (v) => updateUiPhrase('searchHeading', v),
              DEFAULT_SETTINGS.uiTexts.searchHeading
            )}
            {renderPhraseRow(
              'نص مربع البحث (Placeholder)',
              searchCfg.placeholder,
              (v) => {
                setSearchCfg({ ...searchCfg, placeholder: v });
                markDirty('search');
              },
              DEFAULT_SETTINGS.search.placeholder
            )}
            {renderPhraseRow(
              'نص شريط الإعلانات العلوي',
              otherCfg.announcementBarText,
              (v) => {
                setOtherCfg({ ...otherCfg, announcementBarText: v });
                markDirty('other');
              }
            )}
            {renderPhraseRow(
              'نص زر العودة للأعلى',
              otherCfg.backToTopLabel,
              (v) => {
                setOtherCfg({ ...otherCfg, backToTopLabel: v });
                markDirty('other');
              },
              DEFAULT_SETTINGS.other.backToTopLabel
            )}
          </div>
        );

      default:
        return (
          <div className="space-y-2.5">
            {renderPhraseRow(
              'رسالة القسم الفارغ بالصفحة الرئيسية',
              uiTexts.homeEmptySection,
              (v) => updateUiPhrase('homeEmptySection', v),
              DEFAULT_SETTINGS.uiTexts.homeEmptySection
            )}
            {renderPhraseRow(
              'رسالة الصفحة الفارغة (بدون محتوى)',
              uiTexts.collectionEmptyMessage,
              (v) => updateUiPhrase('collectionEmptyMessage', v),
              DEFAULT_SETTINGS.uiTexts.collectionEmptyMessage
            )}
            {renderPhraseRow(
              'رسالة عدم وجود نتائج بالبحث',
              uiTexts.searchEmptyMessage,
              (v) => updateUiPhrase('searchEmptyMessage', v),
              DEFAULT_SETTINGS.uiTexts.searchEmptyMessage
            )}
            {renderPhraseRow(
              'رسالة المادة غير موجودة',
              uiTexts.detailNotFound,
              (v) => updateUiPhrase('detailNotFound', v),
              DEFAULT_SETTINGS.uiTexts.detailNotFound
            )}
            {renderPhraseRow(
              'عبارة التحميل العامة للمنصة',
              uiTexts.loadingPlatform,
              (v) => updateUiPhrase('loadingPlatform', v),
              DEFAULT_SETTINGS.uiTexts.loadingPlatform
            )}
          </div>
        );
    }
  };

  return (
    <div>
      <AdminPanelHeader
        title="إدارة الخطوط والنصوص"
        subtitle="التحكم الكامل بـ 15 عنصراً نصياً وتعديل أو حذف أي جملة أو عبارة ظاهرة في المنصة وتطبيقها فوراً."
        onSave={handleSave}
        onCancel={handleCancel}
        onRevertPrevious={handleRevertPrevious}
        onReset={async () => {
          await resetCategory('typography');
          await resetCategory('uiTexts');
        }}
        saving={saving}
        hasUnsavedChanges={dirtyCats.size > 0}
        hasPreviousSnapshot={Boolean(previousSettings.typography || previousSettings.uiTexts)}
      />

      {/* Tabs + Save Indicator */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="inline-flex rounded-xl border border-neutral-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setActiveTab('elements')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
              activeTab === 'elements' ? 'bg-[#B08D45] text-white' : 'text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <Type size={14} />
            <span>العناصر النصية والخطوط (15 عنصر)</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('phrases')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold cursor-pointer ${
              activeTab === 'phrases' ? 'bg-[#B08D45] text-white' : 'text-neutral-700 hover:bg-neutral-50'
            }`}
          >
            <FileText size={14} />
            <span>تعديل وحذف كافة جمل الموقع والكتل المخصصة</span>
          </button>
        </div>

        {dirtyCats.size > 0 && (
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#8C6A2F] text-white text-xs font-bold shadow cursor-pointer"
          >
            <Check size={14} />
            <span>حفظ وتطبيق التعديلات ({dirtyCats.size})</span>
          </button>
        )}
      </div>

      {activeTab === 'elements' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="space-y-5">
            <AdminCard title="العناصر النصية">
              <div className="space-y-1.5 max-h-[420px] overflow-y-auto pl-1">
                {TYPO_TARGETS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setSelectedKey(t.key)}
                    className={`w-full text-right px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-between cursor-pointer ${
                      selectedKey === t.key
                        ? 'bg-[#B08D45] text-white border-[#B08D45]'
                        : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                    }`}
                  >
                    <span>{t.label}</span>
                    <span className="text-[11px] opacity-80">{typo[t.key].fontFamily}</span>
                  </button>
                ))}
              </div>
            </AdminCard>

            <AdminCard title="رفع خط مخصص" subtitle="يدعم woff2 و woff و ttf و otf">
              <div className="space-y-3">
                <input
                  type="text"
                  value={fontName}
                  onChange={(e) => setFontName(e.target.value)}
                  placeholder="اسم الخط (مثال: CustomArabicFont)"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
                />
                <label className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[#B08D45] text-[#8C6A2F] text-xs font-bold hover:bg-[#F7F4EC] cursor-pointer">
                  <Upload size={14} />
                  <span>{uploadingFont ? 'جاري الرفع...' : 'اختيار ملف خط ورفعه'}</span>
                  <input
                    type="file"
                    accept=".woff2,.woff,.ttf,.otf"
                    onChange={handleUploadFont}
                    className="hidden"
                  />
                </label>

                {(identity.customFonts || []).length > 0 && (
                  <div className="space-y-1.5 pt-2 border-t border-neutral-200">
                    {identity.customFonts.map((f) => (
                      <div
                        key={f.id}
                        className="flex items-center justify-between px-2.5 py-1.5 rounded bg-neutral-50 border border-neutral-200 text-xs"
                      >
                        <span className="font-semibold">{f.name}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveFont(f.id)}
                          className="text-red-600 hover:text-red-700 cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </AdminCard>
          </div>

          <div className="lg:col-span-2 space-y-5">
            <AdminCard
              title={`تخصيص: ${TYPO_TARGETS.find((t) => t.key === selectedKey)?.label}`}
              subtitle="معاينة حية للنص الفعلي، وتعديل أو حذف الجمل المرتبطة به مباشرة، وتخصيص الخط والتدرجات"
            >
              {/* Live Preview Box */}
              <div className="mb-4 space-y-2">
                <div className="p-4 rounded-xl border border-neutral-200 bg-neutral-900 text-white">
                  <div style={previewStyle}>{livePreviewSample}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customPreviewText}
                    onChange={(e) => setCustomPreviewText(e.target.value)}
                    placeholder="اكتب أي نص لاختبار المعاينة الحية أعلاه (أو اتركه لعرض النص الفعلي بالموقع)..."
                    className="flex-1 rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                  />
                  {customPreviewText && (
                    <button
                      type="button"
                      onClick={() => setCustomPreviewText('')}
                      className="px-2.5 py-1.5 rounded-lg border border-neutral-300 text-xs text-neutral-600 hover:bg-neutral-50 cursor-pointer"
                    >
                      عرض النص الفعلي
                    </button>
                  )}
                </div>
              </div>

              {/* Inline Text & Delete Editor for the Selected Element */}
              <div className="mb-5 p-4 rounded-xl border border-[#E8E0D0] bg-[#F7F4EC]/60">
                <div className="text-xs font-extrabold text-[#8C6A2F] mb-3">
                  النصوص والجمل الفعلية لهذا العنصر (عدّل المكتوب أو احذفه أو أخفه):
                </div>
                {renderElementInlineContentEditor()}
              </div>

              {/* Typography Styling */}
              <TextStyleEditor
                value={currentProfile}
                onChange={(next) => {
                  setTypo((prev) => (prev ? { ...prev, [selectedKey]: next } : prev));
                  markDirty('typography');
                }}
                availableFonts={availableFonts}
              />
            </AdminCard>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {UI_TEXT_GROUPS.map((grp) => (
            <AdminCard key={grp.group} title={grp.group}>
              <div className="space-y-2.5">
                {grp.fields.map((f) =>
                  renderPhraseRow(
                    f.label,
                    uiTexts[f.key],
                    (v) => updateUiPhrase(f.key, v),
                    DEFAULT_SETTINGS.uiTexts[f.key]
                  )
                )}
              </div>
            </AdminCard>
          ))}

          <AdminCard title="تسميات أنواع المحتوى بالمنصة">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Object.entries(uiTexts.contentTypeLabels || {}).map(([typeKey, val]) => (
                <div key={typeKey} className="flex items-center gap-2 p-2.5 rounded-lg border border-neutral-200 bg-neutral-50">
                  <span className="text-xs font-mono text-neutral-500 w-20 shrink-0">{typeKey}</span>
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => {
                      setUiTexts({
                        ...uiTexts,
                        contentTypeLabels: { ...uiTexts.contentTypeLabels, [typeKey]: e.target.value },
                      });
                      markDirty('uiTexts');
                    }}
                    className="flex-1 rounded border border-neutral-300 bg-white px-2.5 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setUiTexts({
                        ...uiTexts,
                        contentTypeLabels: { ...uiTexts.contentTypeLabels, [typeKey]: '' },
                      });
                      markDirty('uiTexts');
                    }}
                    title="مسح التسمية"
                    className="text-red-600 p-1 cursor-pointer"
                  >
                    <Eraser size={13} />
                  </button>
                </div>
              ))}
            </div>
          </AdminCard>

          <AdminCard title="الكتل النصية المخصصة عبر الصفحات (إضافة / تعديل / حذف)">
            <div className="flex justify-end mb-4">
              <button
                type="button"
                onClick={addCustomTextBlock}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold cursor-pointer"
              >
                <Plus size={14} /> إضافة كتلة نصية جديدة
              </button>
            </div>

            {(uiTexts.customTextBlocks || []).length === 0 ? (
              <p className="text-xs text-neutral-500 text-center py-6">
                لا توجد كتل نصية إضافية حالياً. اضغط «إضافة كتلة نصية جديدة» لإنشاء نص في أي موضع بالموقع.
              </p>
            ) : (
              <div className="space-y-4">
                {(uiTexts.customTextBlocks || []).map((blk) => (
                  <div
                    key={blk.id}
                    className={`p-4 rounded-xl border space-y-3 ${
                      blk.deleted ? 'border-red-200 bg-red-50/40' : 'border-neutral-200 bg-neutral-50/60'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <select
                        value={blk.location}
                        onChange={(e) =>
                          updateBlock(blk.id, { location: e.target.value as CustomTextElementConfig['location'] })
                        }
                        className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold"
                      >
                        {BLOCK_LOCATIONS.map((loc) => (
                          <option key={loc.value} value={loc.value}>
                            {loc.label}
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateBlock(blk.id, { visible: !blk.visible })}
                          className="px-2.5 py-1 rounded border border-neutral-300 bg-white text-xs font-semibold cursor-pointer"
                        >
                          {blk.visible ? 'إخفاء' : 'إظهار'}
                        </button>
                        <button
                          type="button"
                          onClick={() => updateBlock(blk.id, { deleted: !blk.deleted })}
                          className="px-2.5 py-1 rounded border border-red-200 bg-white text-red-600 text-xs font-bold cursor-pointer"
                        >
                          {blk.deleted ? 'استعادة' : 'حذف'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setUiTexts({
                              ...uiTexts,
                              customTextBlocks: (uiTexts.customTextBlocks || []).filter((x) => x.id !== blk.id),
                            });
                            markDirty('uiTexts');
                          }}
                          className="px-2.5 py-1 rounded bg-red-600 text-white text-xs font-bold cursor-pointer"
                        >
                          حذف نهائي
                        </button>
                      </div>
                    </div>

                    <textarea
                      rows={2}
                      value={blk.text}
                      onChange={(e) => updateBlock(blk.id, { text: e.target.value })}
                      className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <ColorField
                        label="لون النص"
                        value={blk.style.color}
                        onChange={(v) => updateBlock(blk.id, { style: { ...blk.style, color: v } })}
                      />
                      <ColorField
                        label="لون الخلفية"
                        value={blk.background}
                        onChange={(v) => updateBlock(blk.id, { background: v })}
                      />
                      <div>
                        <label className="block text-[11px] font-semibold mb-1">حجم الخط (Desktop)</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={blk.style.fontSizeDesktop}
                          onChange={(e) =>
                            updateBlock(blk.id, { style: { ...blk.style, fontSizeDesktop: e.target.value } })
                          }
                          className="w-full rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-mono"
                        />
                      </div>
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
