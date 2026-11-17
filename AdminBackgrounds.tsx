import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Upload } from 'lucide-react';
import { AdminCard, AdminPanelHeader, ColorField, GradientEditor } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { buildBackgroundStyle } from '../../../lib/styleEngine';
import { uploadFileInChunks } from '../../../lib/uploadClient';
import type { AllSettings, BackgroundLayer } from '../../../types/platform';

const REGIONS: Array<{ key: keyof AllSettings['backgrounds']; label: string }> = [
  { key: 'global', label: 'الخلفية العامة للموقع' },
  { key: 'hero', label: 'خلفية قسم البطل (Hero)' },
  { key: 'homepage', label: 'خلفية الصفحة الرئيسية' },
  { key: 'pages', label: 'خلفية صفحات الأقسام' },
  { key: 'videoDetail', label: 'خلفية صفحة الفيديو' },
  { key: 'imageDetail', label: 'خلفية صفحة الصور' },
  { key: 'articleDetail', label: 'خلفية صفحة المقالات' },
  { key: 'footer', label: 'خلفية التذييل' },
];

export function AdminBackgrounds() {
  const { settings, previousSettings, saveCategory, resetCategory, notify } = useAdmin();
  const [bgs, setBgs] = useState<AllSettings['backgrounds'] | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<keyof AllSettings['backgrounds']>('hero');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) setBgs(structuredClone(settings.backgrounds));
  }, [settings]);

  if (!settings || !bgs) return null;

  const region = bgs[selectedRegion];

  const updateLayer = (idx: number, patch: Partial<BackgroundLayer>) => {
    const nextLayers = region.layers.map((l, i) => (i === idx ? { ...l, ...patch } : l));
    setBgs({ ...bgs, [selectedRegion]: { ...region, layers: nextLayers } });
  };

  const addLayer = () => {
    const newLayer: BackgroundLayer = {
      id: `bg-${Date.now()}`,
      type: 'solid',
      visible: true,
      color: '#080808',
      gradient: {
        enabled: true,
        type: 'linear',
        angle: 135,
        direction: 'to left',
        position: 'center',
        stops: ['#080808', '#8C6A2F', '#080808'],
        opacity: 1,
        intensity: 1,
        animated: false,
        animationSpeed: 8,
        animationDirection: 'normal',
        loop: true,
      },
      opacity: 1,
      blur: 0,
      position: 'center',
      size: 'cover',
      repeat: 'no-repeat',
      attachment: 'scroll',
      blendMode: 'normal',
    };
    setBgs({ ...bgs, [selectedRegion]: { ...region, layers: [...region.layers, newLayer] } });
  };

  const handleUploadMedia = async (idx: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadFileInChunks(file);
      updateLayer(idx, { mediaUrl: res.media.public_url });
      notify('تم رفع صورة/وسيط الخلفية');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل الرفع', 'error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('backgrounds', bgs, 'تحديث الخلفيات والطبقات');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setBgs(structuredClone(settings.backgrounds));
    notify('تم إلغاء التعديلات غير المحفوظة', 'info');
  };

  const handleRevertPrevious = () => {
    const prev = previousSettings.backgrounds as AllSettings['backgrounds'] | undefined;
    if (!prev) return;
    setBgs(structuredClone(prev));
    notify('تمت استعادة الخلفيات السابقة في المعاينة؛ اضغط «حفظ وتطبيق التغييرات» لتثبيتها', 'info');
  };

  const hasUnsavedChanges = JSON.stringify(bgs) !== JSON.stringify(settings.backgrounds);
  const hasPreviousSnapshot = Boolean(previousSettings.backgrounds);

  return (
    <div>
      <AdminPanelHeader
        title="إدارة الخلفيات والأنماط متعددة الطبقات"
        subtitle="إضافة طبقات ألوان صلبة، تدرجات متحركة، صور أو فيديو لكل منطقة في الموقع"
        onSave={handleSave}
        onCancel={handleCancel}
        onRevertPrevious={handleRevertPrevious}
        onReset={() => resetCategory('backgrounds')}
        saving={saving}
        hasUnsavedChanges={hasUnsavedChanges}
        hasPreviousSnapshot={hasPreviousSnapshot}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <AdminCard title="مناطق الخلفية">
          <div className="space-y-1.5">
            {REGIONS.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setSelectedRegion(r.key)}
                className={`w-full text-right px-3 py-2 rounded-lg text-xs font-semibold border flex items-center justify-between cursor-pointer ${
                  selectedRegion === r.key
                    ? 'bg-[#B08D45] text-white border-[#B08D45]'
                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                }`}
              >
                <span>{r.label}</span>
                <span className="text-[11px] opacity-80">{bgs[r.key].layers.length} طبقات</span>
              </button>
            ))}
          </div>
        </AdminCard>

        <div className="lg:col-span-2 space-y-4">
          <AdminCard title={`معاينة وطبقات: ${REGIONS.find((r) => r.key === selectedRegion)?.label}`}>
            <div
              className="h-32 rounded-xl border border-neutral-300 mb-4 flex items-center justify-center text-xs font-bold text-white shadow-inner"
              style={buildBackgroundStyle(region)}
            >
              <span className="px-3 py-1 rounded bg-black/50">معاينة الخلفية المباشرة</span>
            </div>

            <button
              type="button"
              onClick={addLayer}
              className="mb-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
            >
              <Plus size={14} />
              <span>إضافة طبقة خلفية جديدة</span>
            </button>

            <div className="space-y-4">
              {region.layers.map((layer, idx) => (
                <div key={layer.id} className="p-4 rounded-xl border border-neutral-200 bg-neutral-50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-800">طبقة #{idx + 1}</span>
                    <div className="flex items-center gap-3">
                      <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={layer.visible}
                          onChange={(e) => updateLayer(idx, { visible: e.target.checked })}
                          className="accent-[#B08D45]"
                        />
                        <span>مرئية</span>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setBgs({
                            ...bgs,
                            [selectedRegion]: {
                              ...region,
                              layers: region.layers.filter((_, i) => i !== idx),
                            },
                          })
                        }
                        className="text-red-600 hover:text-red-700 cursor-pointer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-600 mb-1">نوع الطبقة</label>
                      <select
                        value={layer.type}
                        onChange={(e) => updateLayer(idx, { type: e.target.value as any })}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                      >
                        <option value="solid">لون صلب</option>
                        <option value="gradient">تدرج لوني</option>
                        <option value="animated-gradient">تدرج متحرك</option>
                        <option value="image">صورة</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-600 mb-1">الشفافية</label>
                      <input
                        type="number"
                        min={0}
                        max={1}
                        step={0.05}
                        value={layer.opacity}
                        onChange={(e) => updateLayer(idx, { opacity: Number(e.target.value) })}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-600 mb-1">التموضع والحجم</label>
                      <select
                        value={layer.size}
                        onChange={(e) => updateLayer(idx, { size: e.target.value })}
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                      >
                        <option value="cover">تغطية كاملة (cover)</option>
                        <option value="contain">احتواء (contain)</option>
                        <option value="auto">تلقائي</option>
                      </select>
                    </div>
                  </div>

                  {layer.type === 'solid' && (
                    <ColorField
                      label="لون الخلفية"
                      value={layer.color || '#080808'}
                      onChange={(c) => updateLayer(idx, { color: c })}
                    />
                  )}

                  {(layer.type === 'gradient' || layer.type === 'animated-gradient') && layer.gradient && (
                    <GradientEditor
                      value={{
                        ...layer.gradient,
                        enabled: true,
                        animated: layer.type === 'animated-gradient' || layer.gradient.animated,
                      }}
                      onChange={(g) => updateLayer(idx, { gradient: g })}
                    />
                  )}

                  {layer.type === 'image' && (
                    <div className="flex flex-wrap items-end gap-3">
                      <div className="flex-1 min-w-[200px]">
                        <label className="block text-[11px] font-semibold text-neutral-600 mb-1">رابط الصورة</label>
                        <input
                          type="text"
                          dir="ltr"
                          value={layer.mediaUrl || ''}
                          onChange={(e) => updateLayer(idx, { mediaUrl: e.target.value })}
                          className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold cursor-pointer">
                        <Upload size={14} />
                        <span>رفع صورة</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleUploadMedia(idx, e)}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </AdminCard>
        </div>
      </div>
    </div>
  );
}
