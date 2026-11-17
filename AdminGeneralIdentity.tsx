import React, { useEffect, useState } from 'react';
import { Globe, Monitor, Smartphone, Trash2, Upload } from 'lucide-react';
import { AdminCard, AdminPanelHeader } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { uploadFileInChunks } from '../../../lib/uploadClient';
import type { AllSettings } from '../../../types/platform';

const DEFAULT_SITE_IMAGE: NonNullable<AllSettings['identity']['siteImage']> = {
  enabled: false,
  desktopUrl: '',
  mobileUrl: '',
  position: 'below-title',
  fit: 'cover',
  objectPosition: 'center',
  width: '100%',
  height: '280px',
  opacity: 1,
  borderRadius: 12,
  linkEnabled: false,
  linkUrl: '',
  openInNewTab: false,
  alt: '',
};

export function AdminGeneralIdentity() {
  const { settings, previousSettings, saveCategory, resetCategory, notify } = useAdmin();
  const [identity, setIdentity] = useState<AllSettings['identity'] | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setIdentity(structuredClone(settings.identity));
  }, [settings]);

  if (!settings || !identity) return null;

  const siteImg = { ...DEFAULT_SITE_IMAGE, ...(identity.siteImage || {}) };

  const uploadIdentityAsset = async (
    field: 'faviconUrl' | 'headerLogoUrl' | 'footerLogoUrl' | 'adminLogoUrl' | 'loginLogoUrl' | 'mobileLogoUrl' | 'defaultShareImage',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadFileInChunks(file);
      const next = {
        ...identity,
        [field]: res.media.public_url,
        ...(field === 'faviconUrl' ? { faviconVersion: (identity.faviconVersion || 1) + 1 } : {}),
      };
      setIdentity(next);
      notify('تم رفع الملف وتحديث الحقل؛ اضغط حفظ لتطبيق التغييرات فوراً');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل رفع الملف', 'error');
    }
  };

  const uploadSiteImageFile = async (
    which: 'desktopUrl' | 'mobileUrl',
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadFileInChunks(file);
      setIdentity({
        ...identity,
        siteImage: { ...siteImg, enabled: true, [which]: res.media.public_url },
      });
      notify('تم رفع صورة الموقع بنجاح');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل رفع صورة الموقع', 'error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('identity', identity, 'تحديث الهوية والإعدادات العامة');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setIdentity(structuredClone(settings.identity));
    notify('تم إلغاء التعديلات غير المحفوظة', 'info');
  };

  const handleRestorePrevious = () => {
    const prev = previousSettings.identity as AllSettings['identity'] | undefined;
    if (!prev) return;
    setIdentity(structuredClone(prev));
    notify('تمت استعادة النسخة السابقة في المعاينة؛ اضغط «حفظ وتطبيق التغييرات» لتثبيتها', 'info');
  };

  const hasUnsavedChanges = JSON.stringify(identity) !== JSON.stringify(settings.identity);
  const hasPreviousSnapshot = Boolean(previousSettings.identity);
  const previewBannerSrc =
    previewDevice === 'mobile' && siteImg.mobileUrl ? siteImg.mobileUrl : siteImg.desktopUrl;

  const assetFields: Array<{
    field: 'faviconUrl' | 'headerLogoUrl' | 'footerLogoUrl' | 'adminLogoUrl' | 'loginLogoUrl' | 'mobileLogoUrl' | 'defaultShareImage';
    label: string;
    accept: string;
  }> = [
    { field: 'faviconUrl', label: 'أيقونة تبويب المتصفح (Favicon)', accept: 'image/*,.ico,.svg' },
    { field: 'headerLogoUrl', label: 'شعار الشريط العلوي (Header Logo)', accept: 'image/*' },
    { field: 'footerLogoUrl', label: 'شعار التذييل (Footer Logo)', accept: 'image/*' },
    { field: 'adminLogoUrl', label: 'شعار لوحة التحكم', accept: 'image/*' },
    { field: 'loginLogoUrl', label: 'شعار شاشة دخول المالك', accept: 'image/*' },
    { field: 'mobileLogoUrl', label: 'شعار الجوال', accept: 'image/*' },
    { field: 'defaultShareImage', label: 'صورة المشاركة الافتراضية (OG Share)', accept: 'image/*' },
  ];

  return (
    <div>
      <AdminPanelHeader
        title="الإعدادات العامة وهوية الموقع"
        subtitle="تعديل اسم المنصة، عنوان تبويب المتصفح، الوصف، الفافيكون، الشعارات وصورة الموقع وبيانات التواصل"
        onSave={handleSave}
        onCancel={handleCancel}
        onRevertPrevious={handleRestorePrevious}
        onReset={() => resetCategory('identity')}
        saving={saving}
        hasUnsavedChanges={hasUnsavedChanges}
        hasPreviousSnapshot={hasPreviousSnapshot}
      />

      <div className="space-y-5">
        <AdminCard
          title="معاينة فورية للهوية وتبويب المتصفح"
          subtitle="تعكس المعاينة جميع التعديلات قبل الضغط على حفظ وتطبيق"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-t-xl border border-b-0 border-neutral-300 bg-white shadow-xs max-w-xs">
                {identity.faviconUrl ? (
                  <img src={identity.faviconUrl} alt="" className="w-4 h-4 object-contain shrink-0" />
                ) : (
                  <Globe size={14} className="text-[#8C6A2F] shrink-0" />
                )}
                <span className="text-xs font-semibold text-neutral-800 truncate">
                  {identity.browserTitle || identity.siteName || 'أرشيف الشهيد'}
                </span>
              </div>
              <div className="inline-flex rounded-lg border border-neutral-300 bg-neutral-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                    previewDevice === 'desktop' ? 'bg-[#B08D45] text-white' : 'text-neutral-600'
                  }`}
                >
                  <Monitor size={12} />
                  <span>سطح المكتب</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                    previewDevice === 'mobile' ? 'bg-[#B08D45] text-white' : 'text-neutral-600'
                  }`}
                >
                  <Smartphone size={12} />
                  <span>الجوال</span>
                </button>
              </div>
            </div>

            <div
              className={`rounded-xl border border-neutral-200 bg-neutral-50 p-4 mx-auto transition-all ${
                previewDevice === 'mobile' ? 'max-w-[360px]' : 'w-full'
              }`}
            >
              <div className="flex items-center justify-between gap-3 pb-3 border-b border-neutral-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  {!identity.logoHidden && identity.showLogoInHeader && (previewDevice === 'mobile' ? identity.mobileLogoUrl || identity.headerLogoUrl : identity.headerLogoUrl) && (
                    <img
                      src={(previewDevice === 'mobile' ? identity.mobileLogoUrl || identity.headerLogoUrl : identity.headerLogoUrl) as string}
                      alt={identity.siteName}
                      style={{
                        width: Math.min(identity.logoWidth || 44, 140),
                        height: Math.min(identity.logoHeight || 44, 56),
                        objectFit: (identity.logoFit as any) || 'contain',
                      }}
                    />
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-extrabold text-neutral-900 truncate">{identity.siteName}</div>
                    {identity.siteSubtitle && (
                      <div className="text-[11px] text-neutral-500 truncate">{identity.siteSubtitle}</div>
                    )}
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-neutral-200/70 text-neutral-600 font-semibold">
                  معاينة الترويسة
                </span>
              </div>

              {siteImg.enabled && previewBannerSrc && (
                <div className="mt-3">
                  <img
                    src={previewBannerSrc}
                    alt={siteImg.alt || identity.siteName}
                    className="w-full object-cover border border-neutral-200"
                    style={{
                      maxHeight: 160,
                      objectFit: siteImg.fit as any,
                      objectPosition: siteImg.objectPosition || 'center',
                      opacity: siteImg.opacity ?? 1,
                      borderRadius: siteImg.borderRadius ?? 12,
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </AdminCard>

        <AdminCard title="النصوص التعريفية ومحركات البحث">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">اسم المنصة الظاهر</label>
              <input
                type="text"
                value={identity.siteName}
                onChange={(e) => setIdentity({ ...identity, siteName: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">الوصف المختصر</label>
              <input
                type="text"
                value={identity.siteSubtitle}
                onChange={(e) => setIdentity({ ...identity, siteSubtitle: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                عنوان تبويب المتصفح (Browser Title)
              </label>
              <input
                type="text"
                value={identity.browserTitle}
                onChange={(e) => setIdentity({ ...identity, browserTitle: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">وصف الميتا (Meta Description)</label>
              <input
                type="text"
                value={identity.metaDescription}
                onChange={(e) => setIdentity({ ...identity, metaDescription: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
              />
            </div>
          </div>
        </AdminCard>

        <AdminCard title="الشعارات وأيقونة المتصفح (Favicon)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {assetFields.map((item) => (
              <div key={item.field} className="p-3 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-800">{item.label}</span>
                  {(identity[item.field] as string) && (
                    <img
                      src={identity[item.field] as string}
                      alt=""
                      className="h-8 w-8 object-contain rounded border border-neutral-300 bg-white"
                    />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={(identity[item.field] as string) || ''}
                    onChange={(e) => setIdentity({ ...identity, [item.field]: e.target.value })}
                    placeholder="/uploads/..."
                    className="flex-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                  {(identity[item.field] as string) && (
                    <button
                      type="button"
                      title="إزالة الشعار"
                      onClick={() => setIdentity({ ...identity, [item.field]: '' })}
                      className="p-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                  <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#B08D45] hover:bg-[#8C6A2F] text-white text-xs font-bold cursor-pointer shrink-0">
                    <Upload size={13} />
                    <span>رفع</span>
                    <input
                      type="file"
                      accept={item.accept}
                      onChange={(e) => uploadIdentityAsset(item.field, e)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-3 border-t border-neutral-200">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">عرض الشعار (px)</label>
              <input
                type="number"
                value={identity.logoWidth}
                onChange={(e) => setIdentity({ ...identity, logoWidth: Number(e.target.value) })}
                className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">ارتفاع الشعار (px)</label>
              <input
                type="number"
                value={identity.logoHeight}
                onChange={(e) => setIdentity({ ...identity, logoHeight: Number(e.target.value) })}
                className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">احتواء الشعار (Fit)</label>
              <select
                value={identity.logoFit || 'contain'}
                onChange={(e) => setIdentity({ ...identity, logoFit: e.target.value as any })}
                className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
              >
                <option value="contain">احتواء كامل (Contain)</option>
                <option value="cover">تغطية الإطار (Cover)</option>
                <option value="fill">ملء (Fill)</option>
                <option value="scale-down">تصغير تلقائي</option>
              </select>
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold pt-5 cursor-pointer">
              <input
                type="checkbox"
                checked={identity.showLogoInHeader}
                onChange={(e) => setIdentity({ ...identity, showLogoInHeader: e.target.checked })}
                className="accent-[#B08D45]"
              />
              <span>إظهار في الترويسة</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-semibold pt-5 cursor-pointer">
              <input
                type="checkbox"
                checked={identity.showLogoInFooter}
                onChange={(e) => setIdentity({ ...identity, showLogoInFooter: e.target.checked })}
                className="accent-[#B08D45]"
              />
              <span>إظهار في التذييل</span>
            </label>
          </div>
          <div className="pt-3 mt-3 border-t border-neutral-100">
            <label className="inline-flex items-center gap-2 text-xs font-bold text-red-700 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(identity.logoHidden)}
                onChange={(e) => setIdentity({ ...identity, logoHidden: e.target.checked })}
                className="accent-red-600"
              />
              <span>إخفاء الشعار تماماً في الترويسة والتذييل مع الإبقاء على الرابط محفوظاً</span>
            </label>
          </div>
        </AdminCard>

        <AdminCard
          title="صورة الموقع (Site Image / Banner)"
          subtitle="صورة مستقلة لسطح المكتب والجوال مع التحكم بالتموضع والمقاس والشفافية وإمكانية ربطها برابط تفاعلي"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(siteImg.enabled)}
                  onChange={(e) =>
                    setIdentity({ ...identity, siteImage: { ...siteImg, enabled: e.target.checked } })
                  }
                  className="accent-[#B08D45]"
                />
                <span>تفعيل وإظهار صورة الموقع في الصفحة الرئيسية</span>
              </label>
              {(siteImg.desktopUrl || siteImg.mobileUrl) && (
                <button
                  type="button"
                  onClick={() =>
                    setIdentity({
                      ...identity,
                      siteImage: { ...siteImg, enabled: false, desktopUrl: '', mobileUrl: '' },
                    })
                  }
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-red-200 bg-red-50 text-red-700 text-xs font-semibold cursor-pointer"
                >
                  <Trash2 size={12} />
                  <span>إزالة صورة الموقع</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50 space-y-2">
                <span className="block text-xs font-bold text-neutral-800">صورة سطح المكتب</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={siteImg.desktopUrl}
                    onChange={(e) =>
                      setIdentity({ ...identity, siteImage: { ...siteImg, desktopUrl: e.target.value } })
                    }
                    placeholder="/uploads/..."
                    className="flex-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                  <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold cursor-pointer">
                    <Upload size={13} />
                    <span>رفع</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => uploadSiteImageFile('desktopUrl', e)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
              <div className="p-3 rounded-lg border border-neutral-200 bg-neutral-50 space-y-2">
                <span className="block text-xs font-bold text-neutral-800">صورة الجوال (اختياري)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    dir="ltr"
                    value={siteImg.mobileUrl}
                    onChange={(e) =>
                      setIdentity({ ...identity, siteImage: { ...siteImg, mobileUrl: e.target.value } })
                    }
                    placeholder="/uploads/..."
                    className="flex-1 rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                  <label className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold cursor-pointer">
                    <Upload size={13} />
                    <span>رفع</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => uploadSiteImageFile('mobileUrl', e)}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">موضع الظهور</label>
                <select
                  value={siteImg.position}
                  onChange={(e) =>
                    setIdentity({ ...identity, siteImage: { ...siteImg, position: e.target.value as any } })
                  }
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="background">خلفية البانر الرئيسي</option>
                  <option value="above-title">فوق العنوان الرئيسي</option>
                  <option value="below-title">أسفل البانر الرئيسي</option>
                  <option value="right">بجانب العنوان (يمين)</option>
                  <option value="left">بجانب العنوان (يسار)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">الاحتواء (Fit)</label>
                <select
                  value={siteImg.fit}
                  onChange={(e) =>
                    setIdentity({ ...identity, siteImage: { ...siteImg, fit: e.target.value as any } })
                  }
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="cover">Cover (تغطية)</option>
                  <option value="contain">Contain (احتواء)</option>
                  <option value="fill">Fill (ملء)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">نقطة التركيز (Position)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={siteImg.objectPosition}
                  onChange={(e) =>
                    setIdentity({ ...identity, siteImage: { ...siteImg, objectPosition: e.target.value } })
                  }
                  placeholder="center"
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">العرض (Width)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={siteImg.width}
                  onChange={(e) =>
                    setIdentity({ ...identity, siteImage: { ...siteImg, width: e.target.value } })
                  }
                  placeholder="100%"
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">الارتفاع (Height)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={siteImg.height}
                  onChange={(e) =>
                    setIdentity({ ...identity, siteImage: { ...siteImg, height: e.target.value } })
                  }
                  placeholder="280px"
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">الشفافية (0 - 1)</label>
                <input
                  type="number"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={siteImg.opacity}
                  onChange={(e) =>
                    setIdentity({ ...identity, siteImage: { ...siteImg, opacity: Number(e.target.value) } })
                  }
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">استدارة الحواف (px)</label>
                <input
                  type="number"
                  min={0}
                  max={64}
                  value={siteImg.borderRadius}
                  onChange={(e) =>
                    setIdentity({ ...identity, siteImage: { ...siteImg, borderRadius: Number(e.target.value) } })
                  }
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">النص البديل (Alt)</label>
                <input
                  type="text"
                  value={siteImg.alt}
                  onChange={(e) =>
                    setIdentity({ ...identity, siteImage: { ...siteImg, alt: e.target.value } })
                  }
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-neutral-200 grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(siteImg.linkEnabled)}
                  onChange={(e) =>
                    setIdentity({ ...identity, siteImage: { ...siteImg, linkEnabled: e.target.checked } })
                  }
                  className="accent-[#B08D45]"
                />
                <span>تحويل الصورة إلى رابط تفاعلي</span>
              </label>
              <input
                type="text"
                dir="ltr"
                value={siteImg.linkUrl}
                onChange={(e) =>
                  setIdentity({ ...identity, siteImage: { ...siteImg, linkUrl: e.target.value } })
                }
                placeholder="https://... أو /page/videos"
                className="rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
              />
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(siteImg.openInNewTab)}
                  onChange={(e) =>
                    setIdentity({ ...identity, siteImage: { ...siteImg, openInNewTab: e.target.checked } })
                  }
                  className="accent-[#B08D45]"
                />
                <span>فتح في تبويب جديد</span>
              </label>
            </div>
          </div>
        </AdminCard>

        <AdminCard title="معلومات التواصل">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                dir="ltr"
                value={identity.contactEmail}
                onChange={(e) => setIdentity({ ...identity, contactEmail: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">رقم الهاتف</label>
              <input
                type="text"
                dir="ltr"
                value={identity.contactPhone}
                onChange={(e) => setIdentity({ ...identity, contactPhone: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">العنوان / المقر</label>
              <input
                type="text"
                value={identity.contactAddress}
                onChange={(e) => setIdentity({ ...identity, contactAddress: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
              />
            </div>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
