import React, { useEffect, useState } from 'react';
import { ArrowUp, Megaphone, Plus, Trash2, Wrench } from 'lucide-react';
import { AdminCard, AdminPanelHeader, ColorField } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import type { AllSettings } from '../../../types/platform';

export function AdminOther() {
  const { settings, previousSettings, saveCategory, resetCategory, notify } = useAdmin();
  const [other, setOther] = useState<AllSettings['other'] | null>(null);
  const [links, setLinks] = useState<AllSettings['links'] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setOther(structuredClone(settings.other));
      setLinks(structuredClone(settings.links));
    }
  }, [settings]);

  if (!settings || !other || !links) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('other', other, 'تحديث الإعدادات الإضافية (غير ذلك)');
      await saveCategory('links', links, 'تحديث روابط التنزيل والمشاركة');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setOther(structuredClone(settings.other));
    setLinks(structuredClone(settings.links));
    notify('تم إلغاء التعديلات غير المحفوظة', 'info');
  };

  const handleRevertPrevious = () => {
    const prevOther = previousSettings.other as AllSettings['other'] | undefined;
    const prevLinks = previousSettings.links as AllSettings['links'] | undefined;
    if (!prevOther && !prevLinks) return;
    if (prevOther) setOther(structuredClone(prevOther));
    if (prevLinks) setLinks(structuredClone(prevLinks));
    notify('تمت استعادة الإعدادات السابقة في المعاينة؛ اضغط «حفظ وتطبيق التغييرات» لتثبيتها', 'info');
  };

  const hasUnsavedChanges =
    JSON.stringify(other) !== JSON.stringify(settings.other) ||
    JSON.stringify(links) !== JSON.stringify(settings.links);
  const hasPreviousSnapshot = Boolean(previousSettings.other || previousSettings.links);

  const addCustomLink = () => {
    setLinks({
      ...links,
      customLinks: [
        ...links.customLinks,
        {
          id: `lnk-${Date.now()}`,
          label: 'رابط جديد',
          url: 'https://',
          icon: 'ExternalLink',
          openInNewTab: true,
          visible: true,
          position: 'footer',
          color: '#FFFFFF',
          background: '#B08D45',
          hoverColor: '#8C6A2F',
        },
      ],
    });
  };

  return (
    <div>
      <AdminPanelHeader
        title="غير ذلك — الميزات التكميلية والروابط"
        subtitle="إعدادات أداة تكبير الخط، شريط التقدم، العودة للأعلى، شريط الإعلانات، وضع الصيانة، والخلاصة والروابط الخارجية"
        onSave={handleSave}
        onCancel={handleCancel}
        onRevertPrevious={handleRevertPrevious}
        onReset={async () => {
          await resetCategory('other');
          await resetCategory('links');
        }}
        saving={saving}
        hasUnsavedChanges={hasUnsavedChanges}
        hasPreviousSnapshot={hasPreviousSnapshot}
      />

      <div className="space-y-5">
        <AdminCard title="معاينة فورية للأدوات وشريط الإعلانات">
          <div className="rounded-xl border border-neutral-200 bg-neutral-50 overflow-hidden space-y-3 pb-3">
            {other.readingProgressBarEnabled && (
              <div className="w-full h-1 bg-neutral-200">
                <div className="w-2/3 h-full bg-[#B08D45]" />
              </div>
            )}
            {other.announcementBarEnabled ? (
              <div
                className="px-4 py-2 text-xs font-bold flex items-center justify-center gap-2"
                style={{ backgroundColor: other.announcementBarBg, color: other.announcementBarColor }}
              >
                <Megaphone size={13} />
                <span>{other.announcementBarText || 'نص شريط الإعلانات العلوي'}</span>
              </div>
            ) : (
              <div className="px-4 pt-3 text-[11px] text-neutral-400 text-center">
                شريط الإعلانات غير مفعّل حالياً
              </div>
            )}

            {other.maintenanceMode && (
              <div className="mx-3 p-2.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs flex items-center gap-2">
                <Wrench size={14} className="shrink-0" />
                <span>وضع الصيانة مفعّل: {other.maintenanceMessage}</span>
              </div>
            )}

            <div className="px-4 flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                {other.accessibilityFontWidgetEnabled && (
                  <div className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-[11px] font-bold text-neutral-700 shadow-xs">
                    <span>أ-</span>
                    <span className="text-neutral-300">|</span>
                    <span>عادي</span>
                    <span className="text-neutral-300">|</span>
                    <span>أ+</span>
                  </div>
                )}
              </div>
              {other.backToTopEnabled && (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#8C6A2F] text-white text-[11px] font-bold"
                >
                  <ArrowUp size={12} />
                  <span>{other.backToTopLabel || 'العودة للأعلى'}</span>
                </button>
              )}
            </div>
          </div>
        </AdminCard>

        <AdminCard title="أدوات التجربة وإمكانية الوصول في الموقع العام">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={other.accessibilityFontWidgetEnabled}
                onChange={(e) =>
                  setOther({ ...other, accessibilityFontWidgetEnabled: e.target.checked })
                }
                className="accent-[#B08D45]"
              />
              <span>أداة حجم الخط العائمة (أ- | عادي | أ+)</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={other.readingProgressBarEnabled}
                onChange={(e) =>
                  setOther({ ...other, readingProgressBarEnabled: e.target.checked })
                }
                className="accent-[#B08D45]"
              />
              <span>شريط تقدم القراءة أعلى الصفحة</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={other.backToTopEnabled}
                onChange={(e) => setOther({ ...other, backToTopEnabled: e.target.checked })}
                className="accent-[#B08D45]"
              />
              <span>زر العودة إلى الأعلى</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={other.jsonFeedEnabled}
                onChange={(e) => setOther({ ...other, jsonFeedEnabled: e.target.checked })}
                className="accent-[#B08D45]"
              />
              <span>تفعيل خلاصة المنشورات (/api/public/feed.json)</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={other.autoBackupEnabled}
                onChange={(e) => setOther({ ...other, autoBackupEnabled: e.target.checked })}
                className="accent-[#B08D45]"
              />
              <span>النسخ الاحتياطي التلقائي</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">نص زر العودة للأعلى</label>
              <input
                type="text"
                value={other.backToTopLabel}
                onChange={(e) => setOther({ ...other, backToTopLabel: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">صيغة عرض التاريخ</label>
              <select
                value={other.dateFormat}
                onChange={(e) => setOther({ ...other, dateFormat: e.target.value as any })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
              >
                <option value="arabic">تاريخ عربي كامل (١٦ نوفمبر ٢٠٢٦)</option>
                <option value="iso">رقمي (YYYY-MM-DD)</option>
                <option value="relative">نسبي (منذ كذا)</option>
              </select>
            </div>
          </div>
        </AdminCard>

        <AdminCard title="شريط الإعلانات العلوي ووضع الصيانة">
          <div className="space-y-4">
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={other.announcementBarEnabled}
                onChange={(e) => setOther({ ...other, announcementBarEnabled: e.target.checked })}
                className="accent-[#B08D45]"
              />
              <span>تفعيل شريط الإعلانات/التنويهات أعلى الموقع</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-neutral-700 mb-1">نص الإعلان</label>
                <input
                  type="text"
                  value={other.announcementBarText}
                  onChange={(e) => setOther({ ...other, announcementBarText: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <ColorField
                label="خلفية الشريط"
                value={other.announcementBarBg}
                onChange={(c) => setOther({ ...other, announcementBarBg: c })}
              />
              <ColorField
                label="لون النص"
                value={other.announcementBarColor}
                onChange={(c) => setOther({ ...other, announcementBarColor: c })}
              />
            </div>

            <div className="pt-3 border-t border-neutral-200 space-y-3">
              <label className="inline-flex items-center gap-2 text-xs font-bold text-amber-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={other.maintenanceMode}
                  onChange={(e) => setOther({ ...other, maintenanceMode: e.target.checked })}
                  className="accent-amber-600"
                />
                <span>تفعيل وضع الصيانة للموقع العام (مع بقاء لوحة التحكم متاحة للمالك)</span>
              </label>
              <input
                type="text"
                value={other.maintenanceMessage}
                onChange={(e) => setOther({ ...other, maintenanceMessage: e.target.value })}
                placeholder="رسالة وضع الصيانة للزوار..."
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
              />
            </div>
          </div>
        </AdminCard>

        <AdminCard title="خيارات التنزيل والمشاركة والروابط المخصصة">
          <div className="flex flex-wrap gap-5 mb-4">
            {[
              { key: 'allowVideoDownload', label: 'السماح بتنزيل الفيديو' },
              { key: 'allowAudioDownload', label: 'السماح بتنزيل الصوت' },
              { key: 'allowImageDownload', label: 'السماح بتنزيل الصور' },
              { key: 'allowCopyLink', label: 'زر نسخ الرابط' },
              { key: 'allowNativeShare', label: 'زر المشاركة' },
            ].map((opt) => (
              <label key={opt.key} className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean((links as any)[opt.key])}
                  onChange={(e) => setLinks({ ...links, [opt.key]: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          <button
            type="button"
            onClick={addCustomLink}
            className="mb-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B08D45] hover:bg-[#8C6A2F] text-white text-xs font-bold cursor-pointer"
          >
            <Plus size={14} />
            <span>إضافة رابط خارجي/داخلي مخصص</span>
          </button>

          {links.customLinks.length > 0 && (
            <div className="space-y-2">
              {links.customLinks.map((lnk, idx) => (
                <div key={lnk.id} className="p-3 rounded-lg border border-neutral-200 bg-neutral-50 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    value={lnk.label}
                    onChange={(e) => {
                      const next = [...links.customLinks];
                      next[idx] = { ...lnk, label: e.target.value };
                      setLinks({ ...links, customLinks: next });
                    }}
                    placeholder="التسمية"
                    className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs w-40"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={lnk.url}
                    onChange={(e) => {
                      const next = [...links.customLinks];
                      next[idx] = { ...lnk, url: e.target.value };
                      setLinks({ ...links, customLinks: next });
                    }}
                    placeholder="https://..."
                    className="flex-1 min-w-[200px] rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-mono"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setLinks({
                        ...links,
                        customLinks: links.customLinks.filter((_, i) => i !== idx),
                      })
                    }
                    className="text-red-600 p-1 hover:bg-red-50 rounded cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
