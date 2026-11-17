import React, { useEffect, useState } from 'react';
import { Upload } from 'lucide-react';
import { GeometricPattern } from '../../../components/GeometricPattern';
import { AdminCard, AdminPanelHeader, ColorField } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { uploadFileInChunks } from '../../../lib/uploadClient';
import type { AllSettings, DecorationRegionConfig } from '../../../types/platform';

const DECORATION_REGIONS: Array<{ key: keyof AllSettings['decorations']; label: string }> = [
  { key: 'navSeparator', label: 'الشريط الهندسي تحت القائمة' },
  { key: 'hero', label: 'خلفية قسم البطل (Hero)' },
  { key: 'header', label: 'الشريط العلوي (Header)' },
  { key: 'homepage', label: 'الصفحة الرئيسية' },
  { key: 'pages', label: 'صفحات الأقسام والمجموعات' },
  { key: 'videoPages', label: 'صفحات الفيديو' },
  { key: 'imagePages', label: 'صفحات الصور' },
  { key: 'postCards', label: 'بطاقات المحتوى' },
  { key: 'footer', label: 'التذييل' },
  { key: 'adminDashboard', label: 'لوحة التحكم الإدارية' },
];

export function AdminDecorations() {
  const { settings, previousSettings, saveCategory, resetCategory, notify } = useAdmin();
  const [decs, setDecs] = useState<AllSettings['decorations'] | null>(null);
  const [selectedKey, setSelectedKey] = useState<keyof AllSettings['decorations']>('hero');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setDecs(structuredClone(settings.decorations));
  }, [settings]);

  if (!settings || !decs) return null;

  const current: DecorationRegionConfig = decs[selectedKey];
  const updateCurrent = (patch: Partial<DecorationRegionConfig>) => {
    setDecs({ ...decs, [selectedKey]: { ...current, ...patch } });
  };

  const handleUploadSvg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadFileInChunks(file);
      updateCurrent({ pattern: 'custom-svg', customSvgUrl: res.media.public_url });
      notify('تم رفع ملف الزخرفة المخصص');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل الرفع', 'error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('decorations', decs, 'تحديث الزخارف الهندسية والإسلامية');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDecs(structuredClone(settings.decorations));
    notify('تم إلغاء التعديلات غير المحفوظة', 'info');
  };

  const handleRevertPrevious = () => {
    const prev = previousSettings.decorations as AllSettings['decorations'] | undefined;
    if (!prev) return;
    setDecs(structuredClone(prev));
    notify('تمت استعادة الزخارف السابقة في المعاينة؛ اضغط «حفظ وتطبيق التغييرات» لتثبيتها', 'info');
  };

  const hasUnsavedChanges = JSON.stringify(decs) !== JSON.stringify(settings.decorations);
  const hasPreviousSnapshot = Boolean(previousSettings.decorations);

  return (
    <div>
      <AdminPanelHeader
        title="الزخارف الهندسية والإسلامية"
        subtitle="إدارة النقوش الهندسية المتكررة في 10 مناطق مختلفة مع دعم رفع ملفات SVG مخصصة"
        onSave={handleSave}
        onCancel={handleCancel}
        onRevertPrevious={handleRevertPrevious}
        onReset={() => resetCategory('decorations')}
        saving={saving}
        hasUnsavedChanges={hasUnsavedChanges}
        hasPreviousSnapshot={hasPreviousSnapshot}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <AdminCard title="مناطق الزخرفة">
          <div className="space-y-1.5">
            {DECORATION_REGIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setSelectedKey(r.key)}
                className={`w-full text-right px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-between cursor-pointer ${
                  selectedKey === r.key
                    ? 'bg-[#B08D45] text-white border-[#B08D45]'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <span>{r.label}</span>
                <span className="text-[11px] opacity-80">
                  {decs[r.key].enabled ? decs[r.key].pattern : 'معطّل'}
                </span>
              </button>
            ))}
          </div>
        </AdminCard>

        <div className="lg:col-span-2">
          <AdminCard title={`تخصيص: ${DECORATION_REGIONS.find((r) => r.key === selectedKey)?.label}`}>
            <div className="relative h-36 rounded-xl border border-neutral-800 bg-[#080808] overflow-hidden mb-5 flex items-center justify-center">
              <GeometricPattern config={current} height={selectedKey === 'navSeparator' ? 36 : undefined} />
              <span className="relative z-10 px-3 py-1 rounded bg-black/60 text-white text-xs font-semibold">
                معاينة الزخرفة الهندسية
              </span>
            </div>

            <div className="space-y-4">
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={current.enabled}
                  onChange={(e) => updateCurrent({ enabled: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>تفعيل الزخرفة في هذه المنطقة</span>
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">نمط الزخرفة</label>
                  <select
                    value={current.pattern}
                    onChange={(e) => updateCurrent({ pattern: e.target.value as any })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                  >
                    <option value="islamic-star">نجمة إسلامية ثمانية</option>
                    <option value="diamond-strip">شريط معيّنات متصل</option>
                    <option value="geometric-grid">شبكة هندسية</option>
                    <option value="interlocking-octagons">مثمنات متداخلة</option>
                    <option value="arabesque-mesh">زخرفة أرابيسك</option>
                    <option value="custom-svg">ملف SVG مخصص</option>
                    <option value="none">بدون</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">الحركة</label>
                  <select
                    value={current.animation}
                    onChange={(e) => updateCurrent({ animation: e.target.value as any })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                  >
                    <option value="none">ثابت</option>
                    <option value="drift">انسياب بطيء</option>
                    <option value="pulse">نبض هادئ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">الشفافية</label>
                  <input
                    type="number"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={current.opacity}
                    onChange={(e) => updateCurrent({ opacity: Number(e.target.value) })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <ColorField
                  label="اللون الرئيسي للنَقش"
                  value={current.primaryColor}
                  onChange={(c) => updateCurrent({ primaryColor: c })}
                />
                <ColorField
                  label="اللون الثانوي للنَقش"
                  value={current.secondaryColor}
                  onChange={(c) => updateCurrent({ secondaryColor: c })}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">الحجم (px)</label>
                  <input
                    type="number"
                    min={10}
                    max={200}
                    value={current.size}
                    onChange={(e) => updateCurrent({ size: Number(e.target.value) })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">التباعد (px)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={current.spacing}
                    onChange={(e) => updateCurrent({ spacing: Number(e.target.value) })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">سماكة الخط</label>
                  <input
                    type="number"
                    min={0.5}
                    max={6}
                    step={0.1}
                    value={current.lineThickness}
                    onChange={(e) => updateCurrent({ lineThickness: Number(e.target.value) })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">الدوران (درجة)</label>
                  <input
                    type="number"
                    min={0}
                    max={360}
                    value={current.rotation}
                    onChange={(e) => updateCurrent({ rotation: Number(e.target.value) })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-neutral-200 flex flex-wrap items-center gap-3">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#B08D45] text-[#8C6A2F] text-xs font-bold cursor-pointer">
                  <Upload size={14} />
                  <span>رفع ملف SVG مخصص</span>
                  <input type="file" accept=".svg,image/svg+xml" onChange={handleUploadSvg} className="hidden" />
                </label>
                {current.customSvgUrl && (
                  <span className="text-[11px] font-mono text-neutral-500">{current.customSvgUrl}</span>
                )}
              </div>
            </div>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
