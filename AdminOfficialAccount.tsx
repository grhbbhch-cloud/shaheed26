import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  Award,
  BadgeCheck,
  CheckCircle2,
  Monitor,
  RotateCcw,
  ShieldCheck,
  Smartphone,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { OfficialAccountAttribution } from '../../../components/OfficialAccountAttribution';
import { AdminCard, AdminPanelHeader, ColorField } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { uploadFileInChunks } from '../../../lib/uploadClient';
import type { OfficialAccountConfig } from '../../../types/platform';

const FONT_OPTIONS = ['Cairo', 'IBM Plex Sans Arabic', 'Tajawal', 'Amiri', 'Noto Naskh Arabic'];
const GOLD_PRESETS = [
  { label: 'ذهبي ملكي', color: '#D4AF65' },
  { label: 'ذهبي المنصة', color: '#B08D45' },
  { label: 'ذهبي داكن', color: '#C9A227' },
  { label: 'زمردي موثق', color: '#10B981' },
  { label: 'أزرق رسمي', color: '#2563EB' },
];

export function AdminOfficialAccount() {
  const { settings, previousSettings, saveCategory, resetCategory, notify } = useAdmin();
  const [cfg, setCfg] = useState<OfficialAccountConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  useEffect(() => {
    if (settings?.officialAccount) {
      setCfg(structuredClone(settings.officialAccount));
    }
  }, [settings?.officialAccount]);

  if (!settings || !cfg) return null;

  const hasUnsavedChanges = JSON.stringify(cfg) !== JSON.stringify(settings.officialAccount);
  const hasPreviousSnapshot = Boolean(previousSettings.officialAccount);

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('officialAccount', cfg, 'تحديث إعدادات الحساب الرسمي الموثق');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setCfg(structuredClone(settings.officialAccount));
    notify('تم إلغاء التعديلات غير المحفوظة', 'info');
  };

  const handleRevertPrevious = () => {
    if (!previousSettings.officialAccount) return;
    setCfg(structuredClone(previousSettings.officialAccount));
    notify('تمت استعادة الإعدادات السابقة إلى المعاينة — اضغط حفظ وتطبيق للاعتماد', 'info');
  };

  const handleUploadAvatar = async (file: File) => {
    setUploadingAvatar(true);
    try {
      const res = await uploadFileInChunks(file);
      setCfg((prev) => (prev ? { ...prev, avatarUrl: res.media.public_url, showAvatar: true } : prev));
      notify('تم رفع صورة الحساب الرسمي — اضغط حفظ وتطبيق للاعتماد');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل رفع الصورة', 'error');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleConfirmDeleteAccount = async () => {
    const deletedState: OfficialAccountConfig = {
      ...cfg,
      enabled: false,
      deleted: true,
    };
    setCfg(deletedState);
    setConfirmDeleteOpen(false);
    setSaving(true);
    try {
      await saveCategory('officialAccount', deletedState, 'حذف وتعطيل الحساب الرسمي الموثق');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <AdminPanelHeader
        title="الحساب الرسمي الموثق"
        subtitle="إنشاء وتخصيص الحساب الرسمي الموثق للناشر مع التحكم الكامل بالاسم والصورة وشارة التوثيق والموضع، وتطبيقه اختيارياً على المواد المختارة."
        onSave={handleSave}
        onCancel={handleCancel}
        onRevertPrevious={handleRevertPrevious}
        onReset={() => resetCategory('officialAccount')}
        hasUnsavedChanges={hasUnsavedChanges}
        hasPreviousSnapshot={hasPreviousSnapshot}
        saving={saving}
      />

      {cfg.deleted ? (
        <AdminCard title="تم حذف الحساب الرسمي الموثق">
          <div className="py-10 text-center space-y-4">
            <p className="text-sm font-bold text-neutral-700">
              الحساب الرسمي الموثق محذوف ومُعطّل حالياً ولا يظهر على أي مادة في الموقع العام (مع بقاء جميع المحتويات والفيديوهات والصور محفوظة دون أي مساس).
            </p>
            <button
              type="button"
              onClick={() => setCfg({ ...cfg, deleted: false, enabled: true })}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
            >
              <RotateCcw size={14} />
              <span>إنشاء وتفعيل الحساب الرسمي من جديد</span>
            </button>
          </div>
        </AdminCard>
      ) : (
        <div className="space-y-5">
          {/* Live Interactive Preview */}
          <AdminCard title="معاينة حية لظهور الحساب الرسمي على المحتوى">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="text-xs text-neutral-600">
                تحديث الاسم أو الصورة أو الشارة هنا ينعكس تلقائياً على جميع المواد المُفعّل عليها خيار التوثيق دون تعديل كل مادة على حدة.
              </div>
              <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPreviewViewport('desktop')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                    previewViewport === 'desktop' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600'
                  }`}
                >
                  <Monitor size={13} /> سطح المكتب
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewViewport('mobile')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold cursor-pointer ${
                    previewViewport === 'mobile' ? 'bg-white text-neutral-900 shadow-xs' : 'text-neutral-600'
                  }`}
                >
                  <Smartphone size={13} /> الجوال
                </button>
              </div>
            </div>

            <div
              className={`mx-auto rounded-2xl border border-neutral-200 bg-neutral-50 p-4 sm:p-6 transition-all ${
                previewViewport === 'mobile' ? 'max-w-sm' : 'w-full'
              }`}
            >
              {!cfg.enabled && (
                <div className="mb-3 px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-bold text-amber-800">
                  تنبيه: الحساب الرسمي معطّل حالياً — لن يظهر للزوار حتى تفعّل خيار التفعيل وتحفظ التغييرات.
                </div>
              )}
              <div className="space-y-3 bg-white p-4 rounded-xl border border-neutral-200">
                <div className="h-32 rounded-lg bg-neutral-900 flex items-center justify-center text-xs text-neutral-400">
                  مساحة الفيديو / الصورة / المادة (مثال للعرض)
                </div>
                {cfg.defaultPlacement === 'below-media' && (
                  <OfficialAccountAttribution configOverride={cfg} previewMode />
                )}
                <h3 className="text-base font-extrabold text-neutral-900">
                  عنوان المادة المنشورة في الأرشيف
                </h3>
                {cfg.defaultPlacement === 'below-title' && (
                  <OfficialAccountAttribution configOverride={cfg} previewMode />
                )}
                <p className="text-xs text-neutral-600 leading-relaxed">
                  نص تعريفي مختصر يوضح كيفية اندماج توثيق الحساب الرسمي بانسيابية مع تفاصيل المحتوى.
                </p>
                {cfg.defaultPlacement === 'below-content' && (
                  <OfficialAccountAttribution configOverride={cfg} previewMode />
                )}
              </div>
            </div>
          </AdminCard>

          <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
            {/* Identity & Avatar */}
            <AdminCard title="هوية الحساب وصورة الملف الشخصي" className="xl:col-span-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-100">
                  <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={cfg.enabled}
                      onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
                      className="accent-[#B08D45]"
                    />
                    <span>تفعيل الحساب الرسمي الموثق في الموقع</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => setConfirmDeleteOpen(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 text-red-600 text-xs font-bold hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>حذف الحساب الرسمي</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      عبارة التقديم (قبل الاسم — قابلة للتحرير حرفياً)
                    </label>
                    <input
                      type="text"
                      value={cfg.wordingPrefix}
                      onChange={(e) => setCfg({ ...cfg, wordingPrefix: e.target.value })}
                      placeholder="منشور من حساب"
                      className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      اسم الحساب الرسمي
                    </label>
                    <input
                      type="text"
                      value={cfg.displayName}
                      onChange={(e) => setCfg({ ...cfg, displayName: e.target.value })}
                      placeholder="أرشيف الشهيد"
                      className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cfg.showDescription}
                        onChange={(e) => setCfg({ ...cfg, showDescription: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>إظهار وصف تعريفي مختصر للحساب</span>
                    </label>
                  </div>
                  {cfg.showDescription && (
                    <textarea
                      rows={2}
                      value={cfg.description}
                      onChange={(e) => setCfg({ ...cfg, description: e.target.value })}
                      placeholder="نبذة تعريفية عن الحساب الرسمي..."
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
                    />
                  )}
                </div>

                {/* Avatar Upload / Remove */}
                <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={cfg.showAvatar}
                        onChange={(e) => setCfg({ ...cfg, showAvatar: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>إظهار صورة الحساب الدائرية</span>
                    </label>
                    {cfg.avatarUrl && (
                      <button
                        type="button"
                        onClick={() => setCfg({ ...cfg, avatarUrl: '' })}
                        className="text-xs text-red-600 hover:underline font-semibold cursor-pointer"
                      >
                        إزالة الصورة
                      </button>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-14 h-14 rounded-full overflow-hidden border border-neutral-300 bg-white flex items-center justify-center shrink-0">
                      {cfg.avatarUrl ? (
                        <img src={cfg.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <ShieldCheck size={22} className="text-[#B08D45]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-[200px] space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer">
                          <Upload size={13} />
                          <span>{uploadingAvatar ? 'جاري الرفع...' : 'رفع / تغيير صورة الحساب'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) handleUploadAvatar(f);
                            }}
                          />
                        </label>
                      </div>
                      <input
                        type="text"
                        dir="ltr"
                        value={cfg.avatarUrl}
                        onChange={(e) => setCfg({ ...cfg, avatarUrl: e.target.value })}
                        placeholder="/uploads/... أو رابط صورة"
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-[11px] font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </AdminCard>

            {/* Verification Badge */}
            <AdminCard title="شارة التوثيق (الأيقونة واللون والحجم)" className="xl:col-span-6">
              <div className="space-y-4">
                <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={cfg.badgeEnabled}
                    onChange={(e) => setCfg({ ...cfg, badgeEnabled: e.target.checked })}
                    className="accent-[#B08D45]"
                  />
                  <span>إظهار شارة التوثيق بجانب اسم الحساب</span>
                </label>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-2">شكل أيقونة التوثيق</label>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {[
                      { id: 'BadgeCheck', label: 'نجمة موثقة', Icon: BadgeCheck },
                      { id: 'CheckCircle2', label: 'علامة صح', Icon: CheckCircle2 },
                      { id: 'ShieldCheck', label: 'درع التوثيق', Icon: ShieldCheck },
                      { id: 'Award', label: 'وسام', Icon: Award },
                      { id: 'Star', label: 'نجمة', Icon: Star },
                      { id: 'custom-svg', label: 'SVG مخصص', Icon: BadgeCheck },
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCfg({ ...cfg, badgeIcon: opt.id as any })}
                        className={`p-2 rounded-xl border text-[11px] font-bold flex flex-col items-center gap-1 cursor-pointer ${
                          cfg.badgeIcon === opt.id
                            ? 'border-[#B08D45] bg-[#F7F4EC] text-[#8C6A2F]'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        <opt.Icon size={18} style={{ color: cfg.badgeColor || '#D4AF65' }} />
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {cfg.badgeIcon === 'custom-svg' && (
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">كود SVG مخصص للشارة</label>
                    <textarea
                      rows={3}
                      dir="ltr"
                      value={cfg.badgeCustomSvg}
                      onChange={(e) => setCfg({ ...cfg, badgeCustomSvg: e.target.value })}
                      placeholder="<svg viewBox='0 0 24 24'>...</svg>"
                      className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs font-mono"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-neutral-700">ألوان سريعة مقترحة للشارة</div>
                  <div className="flex flex-wrap gap-2">
                    {GOLD_PRESETS.map((p) => (
                      <button
                        key={p.color}
                        type="button"
                        onClick={() => setCfg({ ...cfg, badgeColor: p.color })}
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold cursor-pointer ${
                          cfg.badgeColor.toLowerCase() === p.color.toLowerCase()
                            ? 'border-neutral-900 bg-neutral-100'
                            : 'border-neutral-200 bg-white'
                        }`}
                      >
                        <span className="w-3.5 h-3.5 rounded-full border border-neutral-300" style={{ backgroundColor: p.color }} />
                        <span>{p.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <ColorField
                    label="لون شارة التوثيق (مخصص)"
                    value={cfg.badgeColor}
                    onChange={(c) => setCfg({ ...cfg, badgeColor: c })}
                  />
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">حجم الشارة (px)</label>
                    <input
                      type="number"
                      min={12}
                      max={36}
                      value={cfg.badgeSize}
                      onChange={(e) => setCfg({ ...cfg, badgeSize: Number(e.target.value) })}
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                </div>
              </div>
            </AdminCard>
          </div>

          {/* Styling, Typography & Placement */}
          <AdminCard title="التصميم والخطوط والموضع الافتراضي">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-semibold mb-1">خط اسم الحساب</label>
                <select
                  value={cfg.nameFontFamily}
                  onChange={(e) => setCfg({ ...cfg, nameFontFamily: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">حجم اسم الحساب</label>
                <input
                  type="text"
                  dir="ltr"
                  value={cfg.nameFontSize}
                  onChange={(e) => setCfg({ ...cfg, nameFontSize: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">وزن الخط</label>
                <select
                  value={cfg.nameFontWeight}
                  onChange={(e) => setCfg({ ...cfg, nameFontWeight: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="500">متوسط (500)</option>
                  <option value="600">نصف عريض (600)</option>
                  <option value="700">عريض (700)</option>
                  <option value="800">عريض جداً (800)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">المحاذاة</label>
                <select
                  value={cfg.alignment}
                  onChange={(e) => setCfg({ ...cfg, alignment: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="right">يمين</option>
                  <option value="center">توسيط</option>
                  <option value="left">يسار</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-semibold mb-1">الموضع الافتراضي في صفحة المادة</label>
                <select
                  value={cfg.defaultPlacement}
                  onChange={(e) => setCfg({ ...cfg, defaultPlacement: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="below-media">أسفل المشغل / الصورة مباشرة</option>
                  <option value="below-title">أسفل عنوان المادة</option>
                  <option value="below-content">أسفل وصف ونص المادة</option>
                </select>
              </div>

              <ColorField label="لون اسم الحساب" value={cfg.nameColor} onChange={(c) => setCfg({ ...cfg, nameColor: c })} />
              <ColorField label="لون عبارة التقديم" value={cfg.prefixColor} onChange={(c) => setCfg({ ...cfg, prefixColor: c })} />
              <ColorField label="لون الوصف" value={cfg.descriptionColor} onChange={(c) => setCfg({ ...cfg, descriptionColor: c })} />
              <ColorField label="خلفية الصندوق" value={cfg.backgroundColor} onChange={(c) => setCfg({ ...cfg, backgroundColor: c })} />
              <ColorField label="لون الحدود" value={cfg.borderColor} onChange={(c) => setCfg({ ...cfg, borderColor: c })} />
              <div>
                <label className="block text-xs font-semibold mb-1">سماكة الحدود (px)</label>
                <input
                  type="number"
                  min={0}
                  max={6}
                  value={cfg.borderWidth}
                  onChange={(e) => setCfg({ ...cfg, borderWidth: Number(e.target.value) })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">استدارة الحواف (px)</label>
                <input
                  type="number"
                  min={0}
                  max={36}
                  value={cfg.borderRadius}
                  onChange={(e) => setCfg({ ...cfg, borderRadius: Number(e.target.value) })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">الحشوة الداخلية (px)</label>
                <input
                  type="number"
                  min={4}
                  max={40}
                  value={cfg.padding}
                  onChange={(e) => setCfg({ ...cfg, padding: Number(e.target.value) })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">التباعد الداخلي (px)</label>
                <input
                  type="number"
                  min={4}
                  max={32}
                  value={cfg.spacing}
                  onChange={(e) => setCfg({ ...cfg, spacing: Number(e.target.value) })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div className="col-span-2 sm:col-span-3">
                <label className="block text-xs font-semibold mb-1">الظل (CSS Shadow)</label>
                <input
                  type="text"
                  dir="ltr"
                  value={cfg.shadow}
                  onChange={(e) => setCfg({ ...cfg, shadow: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
            </div>
          </AdminCard>
        </div>
      )}

      {/* Safe Deletion Modal */}
      {confirmDeleteOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
          onClick={() => setConfirmDeleteOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-red-700">
                <AlertTriangle size={18} />
                <span>تأكيد حذف الحساب الرسمي الموثق</span>
              </div>
              <button type="button" onClick={() => setConfirmDeleteOpen(false)} className="cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-neutral-700 leading-relaxed">
              سيؤدي حذف الحساب الرسمي إلى إزالة إشارة التوثيق ونسبة النشر من جميع المواد في الموقع العام فوراً دون أي حذف أو تغيير على الفيديوهات أو الصور أو المنشورات نفسها. ويمكنك إعادة إنشائه لاحقاً في أي وقت.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteOpen(false)}
                className="px-4 py-2 rounded-lg border border-neutral-300 text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteAccount}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 cursor-pointer"
              >
                تأكيد الحذف الكامل للحساب
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
