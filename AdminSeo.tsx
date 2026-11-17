import React, { useEffect, useState } from 'react';
import { ExternalLink, Eye, Globe } from 'lucide-react';
import { AdminCard, AdminPanelHeader } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import type { SeoSettingsConfig } from '../../../types/platform';

export function AdminSeo() {
  const { settings, saveCategory, resetCategory, notify } = useAdmin();
  const [seo, setSeo] = useState<SeoSettingsConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewTitle, setPreviewTitle] = useState('');
  const [previewText, setPreviewText] = useState('');

  useEffect(() => {
    if (settings?.seo) {
      setSeo(structuredClone(settings.seo));
    }
  }, [settings]);

  if (!seo) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('seo', seo, 'تحديث إعدادات محركات البحث والسيو');
    } finally {
      setSaving(false);
    }
  };

  const inspectEndpoint = async (url: string, label: string) => {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      const txt = await res.text();
      setPreviewTitle(label);
      setPreviewText(txt);
    } catch {
      notify('تعذر معاينة الملف.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <AdminPanelHeader
        title="تحسين محركات البحث (SEO)"
        subtitle="إدارة العناوين الافتراضية، صورة المشاركة (OpenGraph)، خريطة الموقع XML وملف robots.txt"
        onSave={handleSave}
        onReset={() => resetCategory('seo')}
        saving={saving}
      />

      <AdminCard title="إعدادات السيو والعناوين القياسية">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">رابط الموقع الأساسي (Site URL)</label>
            <input
              type="url"
              dir="ltr"
              value={seo.siteUrl}
              onChange={(e) => setSeo({ ...seo, siteUrl: e.target.value })}
              placeholder="https://example.com"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">العنوان الافتراضي للموقع</label>
            <input
              type="text"
              value={seo.defaultTitle}
              onChange={(e) => setSeo({ ...seo, defaultTitle: e.target.value })}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">قالب العناوين (Title Template)</label>
            <input
              type="text"
              value={seo.titleTemplate}
              onChange={(e) => setSeo({ ...seo, titleTemplate: e.target.value })}
              placeholder="%s | أرشيف الشهيد"
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">رابط صورة المشاركة الافتراضية (OG Image)</label>
            <input
              type="text"
              dir="ltr"
              value={seo.defaultOgImage}
              onChange={(e) => setSeo({ ...seo, defaultOgImage: e.target.value })}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-mono"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-neutral-700 mb-1">الوصف العام لمحركات البحث (Meta Description)</label>
            <textarea
              rows={2}
              value={seo.defaultDescription}
              onChange={(e) => setSeo({ ...seo, defaultDescription: e.target.value })}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-6 pt-3 border-t border-neutral-100">
          <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={seo.sitemapEnabled}
              onChange={(e) => setSeo({ ...seo, sitemapEnabled: e.target.checked })}
              className="accent-[#B08D45]"
            />
            <span>تفعيل خريطة الموقع الديناميكية (/sitemap.xml)</span>
          </label>
          <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              checked={seo.structuredDataEnabled}
              onChange={(e) => setSeo({ ...seo, structuredDataEnabled: e.target.checked })}
              className="accent-[#B08D45]"
            />
            <span>تفعيل البيانات المنظمة JSON-LD</span>
          </label>
        </div>
      </AdminCard>

      <AdminCard title="ملف robots.txt وخريطة الموقع (Sitemap)">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">محتوى robots.txt</label>
            <textarea
              dir="ltr"
              rows={5}
              value={seo.robotsTxt}
              onChange={(e) => setSeo({ ...seo, robotsTxt: e.target.value })}
              className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs font-mono bg-neutral-50"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => inspectEndpoint('/sitemap.xml', 'معاينة /sitemap.xml')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
            >
              <Eye size={14} />
              <span>معاينة sitemap.xml داخل اللوحة</span>
            </button>
            <button
              type="button"
              onClick={() => inspectEndpoint('/robots.txt', 'معاينة /robots.txt')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
            >
              <Globe size={14} />
              <span>معاينة robots.txt داخل اللوحة</span>
            </button>
            <a
              href="/sitemap.xml"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#F7F4EC] text-[#8C6A2F] border border-[#E8E0D0] text-xs font-bold"
            >
              <ExternalLink size={14} />
              <span>فتح /sitemap.xml</span>
            </a>
          </div>

          {previewText && (
            <div className="rounded-xl border border-neutral-200 bg-neutral-950 text-neutral-100 p-4 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-[#D4AF65]">
                <span>{previewTitle}</span>
                <button type="button" onClick={() => setPreviewText('')} className="text-neutral-400 hover:text-white cursor-pointer">
                  إغلاق
                </button>
              </div>
              <pre dir="ltr" className="text-[11px] font-mono overflow-x-auto max-h-64 whitespace-pre">
                {previewText}
              </pre>
            </div>
          )}
        </div>
      </AdminCard>
    </div>
  );
}
