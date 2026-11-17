import React, { useEffect, useState } from 'react';
import { Cloud, KeyRound, RefreshCw, ShieldCheck, Unlink } from 'lucide-react';
import { AdminCard, AdminPanelHeader } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { formatArabicDate } from '../../../lib/styleEngine';
import type { AllSettings } from '../../../types/platform';

export function AdminSecurity() {
  const {
    settings,
    saveCategory,
    resetCategory,
    notify,
    firebaseUser,
    cloudStatus,
    syncingCloud,
    connectOwnerGoogle,
    disconnectOwnerGoogle,
    syncNowToFirestore,
  } = useAdmin();

  const [sec, setSec] = useState<AllSettings['security'] | null>(null);
  const [saving, setSaving] = useState(false);

  const [currentCode1, setCurrentCode1] = useState('');
  const [currentCode2, setCurrentCode2] = useState('');
  const [newCode1, setNewCode1] = useState('');
  const [newCode2, setNewCode2] = useState('');
  const [updatingCodes, setUpdatingCodes] = useState(false);

  useEffect(() => {
    if (settings) setSec(structuredClone(settings.security));
  }, [settings]);

  if (!settings || !sec) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('security', sec, 'تحديث إعدادات الأمان والحماية');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCode1 || !currentCode2 || !newCode1 || !newCode2) {
      notify('يرجى إدخال الرمزين الحاليين والرمزين الجديدين.', 'error');
      return;
    }
    if (newCode1.trim().length < 6 || newCode2.trim().length < 6) {
      notify('يجب أن لا يقل كل من الرمز الأول والثاني الجديد عن 6 أحرف.', 'error');
      return;
    }
    setUpdatingCodes(true);
    try {
      const res = await fetch('/api/admin/security/codes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          currentCode1,
          currentCode2,
          newCode1: newCode1.trim(),
          newCode2: newCode2.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || 'تعذر تحديث رموز الدخول.', 'error');
        return;
      }
      notify('تم تحديث رمزي الدخول المزدوج للمالك الرئيسي بنجاح.', 'success');
      setCurrentCode1('');
      setCurrentCode2('');
      setNewCode1('');
      setNewCode2('');
    } finally {
      setUpdatingCodes(false);
    }
  };

  return (
    <div>
      <AdminPanelHeader
        title="الأمان والمزامنة السحابية"
        subtitle="تغيير رموز المالك المزدوجة مباشرة، إدارة المزامنة مع Firestore، وسياسات الجلسات"
        onSave={handleSave}
        onReset={() => resetCategory('security')}
        saving={saving}
      />

      <div className="space-y-5">
        <AdminCard title="حالة حماية بوابة المالك">
          <div className="flex items-start gap-3 p-3.5 rounded-xl border border-[#E8E0D0] bg-[#F7F4EC] text-[#171717] text-xs">
            <ShieldCheck size={18} className="shrink-0 mt-0.5 text-[#8C6A2F]" />
            <div>
              <div className="font-bold">المصادقة الثنائية للمالك مفعّلة على الخادم</div>
              <p className="mt-1 text-neutral-700 leading-relaxed">
                يتم التحقق من رمزي الدخول عبر تجزئة scryptSycn المملّحة في قاعدة البيانات، مع جلسة موقعة بتوقيع HMAC داخل ملف تعريف HttpOnly لا يمكن قراءته من المتصفح.
              </p>
            </div>
          </div>
        </AdminCard>

        <AdminCard title="تغيير رمزي الدخول المزدوج للمالك (مباشر)">
          <form onSubmit={handleUpdateCodes} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  الرمز الأول الحالي
                </label>
                <input
                  type="password"
                  value={currentCode1}
                  onChange={(e) => setCurrentCode1(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  الرمز الثاني الحالي
                </label>
                <input
                  type="password"
                  value={currentCode2}
                  onChange={(e) => setCurrentCode2(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  الرمز الأول الجديد (6 أحرف فأكثر)
                </label>
                <input
                  type="password"
                  value={newCode1}
                  onChange={(e) => setNewCode1(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  الرمز الثاني الجديد (6 أحرف فأكثر)
                </label>
                <input
                  type="password"
                  value={newCode2}
                  onChange={(e) => setNewCode2(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={updatingCodes}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B08D45] hover:bg-[#8C6A2F] text-white text-xs font-bold cursor-pointer disabled:opacity-60"
            >
              <KeyRound size={14} />
              <span>{updatingCodes ? 'جاري التحديث...' : 'اعتماد رموز الدخول الجديدة'}</span>
            </button>
          </form>
        </AdminCard>

        <AdminCard title="ربط حساب المالك والمزامنة السحابية (Firebase Firestore)">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-neutral-500">حالة الاتصال السحابي</div>
                <div className={`font-bold mt-1 ${cloudStatus?.firestoreConnected ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {cloudStatus?.firestoreConnected ? 'متصل وجاهز للمزامنة' : 'بحاجة لربط حساب المالك عبر Google'}
                </div>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-neutral-500">معرف المشروع السحابي</div>
                <div className="font-mono font-bold mt-1 truncate" dir="ltr">
                  {cloudStatus?.projectId || '—'}
                </div>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-neutral-500">حساب Google المرتبط</div>
                <div className="font-mono font-bold mt-1 truncate" dir="ltr">
                  {firebaseUser?.email || cloudStatus?.ownerEmail || 'غير مربوط'}
                </div>
              </div>
              <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                <div className="text-neutral-500">آخر مزامنة مكتملة</div>
                <div className="font-bold mt-1">
                  {cloudStatus?.lastSyncAt ? formatArabicDate(cloudStatus.lastSyncAt) : 'لم تُجرَ بعد'}
                </div>
              </div>
            </div>

            {cloudStatus?.lastSyncCounts && (
              <div className="text-xs text-neutral-600 bg-[#F7F4EC] border border-[#E8E0D0] rounded-lg px-3 py-2">
                آخر مزامنة: الصفحات ({cloudStatus.lastSyncCounts.pages || 0}) · المواد ({cloudStatus.lastSyncCounts.content || 0}) · القصائد ({cloudStatus.lastSyncCounts.poems || 0}) · المشاركات ({cloudStatus.lastSyncCounts.poemSubmissions || 0})
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5">
              {firebaseUser ? (
                <>
                  <button
                    type="button"
                    disabled={syncingCloud}
                    onClick={() => syncNowToFirestore(false)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw size={14} className={syncingCloud ? 'animate-spin' : ''} />
                    <span>{syncingCloud ? 'جاري المزامنة...' : 'مزامنة كافة البيانات مع Firestore الآن'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={disconnectOwnerGoogle}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                  >
                    <Unlink size={14} />
                    <span>فصل ارتباط Google</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={connectOwnerGoogle}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B08D45] hover:bg-[#8C6A2F] text-white text-xs font-bold cursor-pointer"
                >
                  <Cloud size={14} />
                  <span>ربط حساب المالك عبر Google لتفعيل المزامنة السحابية</span>
                </button>
              )}
            </div>
          </div>
        </AdminCard>

        <AdminCard title="سياسات الجلسة ومنع التخمين">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                مدة الجلسة (بالدقائق)
              </label>
              <input
                type="number"
                min={15}
                max={43200}
                value={sec.sessionTimeoutMinutes}
                onChange={(e) => setSec({ ...sec, sessionTimeoutMinutes: Number(e.target.value) })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                الحد الأقصى لمحاولات الدخول الفاشلة
              </label>
              <input
                type="number"
                min={3}
                max={50}
                value={sec.maxLoginAttempts}
                onChange={(e) => setSec({ ...sec, maxLoginAttempts: Number(e.target.value) })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                مدة الحظر المؤقت (بالدقائق)
              </label>
              <input
                type="number"
                min={1}
                max={1440}
                value={sec.lockoutMinutes}
                onChange={(e) => setSec({ ...sec, lockoutMinutes: Number(e.target.value) })}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-6">
            <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
              <input
                type="checkbox"
                checked={sec.ipRateLimitEnabled}
                onChange={(e) => setSec({ ...sec, ipRateLimitEnabled: e.target.checked })}
                className="accent-[#B08D45]"
              />
              <span>تفعيل تحديد معدل المحاولات حسب عنوان الشبكة (Rate Limit)</span>
            </label>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
