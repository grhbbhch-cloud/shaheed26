import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Cloud, HardDrive, RefreshCw, ShieldCheck, Trash2, X } from 'lucide-react';
import { AdminCard, AdminPanelHeader } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { formatArabicDate, formatBytes } from '../../../lib/styleEngine';
import type { StorageConfig } from '../../../types/platform';

interface MediaReference {
  kind: string;
  id: number | string;
  title: string;
  location: string;
}

export function AdminStorageMedia() {
  const { mediaFiles, settings, saveCategory, resetCategory, refreshAll, notify } = useAdmin();
  const [diag, setDiag] = useState<any>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleaningOrphans, setCleaningOrphans] = useState(false);
  const [savingStorage, setSavingStorage] = useState(false);
  const [testingStorage, setTestingStorage] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    activeMode?: string;
    hasSecret?: boolean;
    needsExternalConfig?: boolean;
    message: string;
  } | null>(null);
  const [storageCfg, setStorageCfg] = useState<StorageConfig>({
    mode: 'local',
    bucket: '',
    endpoint: '',
    region: '',
    accessKeyId: '',
    publicBaseUrl: '',
    maxFileSizeMb: 2048,
    autoTranscodeOnUpload: false,
    autoExtractThumbnails: true,
  });
  const [deleteConflict, setDeleteConflict] = useState<{
    mediaId: number;
    fileName: string;
    references: MediaReference[];
    message: string;
  } | null>(null);

  useEffect(() => {
    if (settings?.storage) {
      setStorageCfg(structuredClone(settings.storage));
    }
  }, [settings?.storage]);

  const loadHealth = async () => {
    const res = await fetch('/api/admin/health', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setDiag(data.diagnostics);
    }
  };

  useEffect(() => {
    loadHealth();
  }, [mediaFiles.length]);

  const handleCleanupChunks = async () => {
    setCleaning(true);
    try {
      const res = await fetch('/api/admin/media/cleanup-chunks', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      notify(`تم تنظيف ${data.removed || 0} مجلدات مؤقتة`);
      await loadHealth();
    } finally {
      setCleaning(false);
    }
  };

  const handleCleanupOrphans = async () => {
    setCleaningOrphans(true);
    try {
      const res = await fetch('/api/admin/media/cleanup-orphans', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || 'تعذر تنظيف الملفات اليتيمة', 'error');
        return;
      }
      notify(`تم حذف ${data.removed || 0} ملف يتيم واسترداد ${formatBytes(data.freedBytes || 0)}`);
      await loadHealth();
      await refreshAll();
    } finally {
      setCleaningOrphans(false);
    }
  };

  const handleSaveStorage = async () => {
    setSavingStorage(true);
    try {
      await saveCategory('storage', storageCfg, 'تحديث إعدادات التخزين والمعالجة');
    } finally {
      setSavingStorage(false);
    }
  };

  const handleTestStorage = async () => {
    setTestingStorage(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/storage/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(storageCfg),
      });
      const data = await res.json().catch(() => ({}));
      setTestResult({
        ok: Boolean(data.ok),
        activeMode: data.activeMode,
        hasSecret: Boolean(data.hasSecret),
        needsExternalConfig: data.needsExternalConfig,
        message: data.message || (res.ok ? 'اكتمل الفحص بنجاح' : 'تعذر اختبار الاتصال'),
      });
    } finally {
      setTestingStorage(false);
    }
  };

  const handleDeleteFile = async (id: number, fileName: string, force = false) => {
    const res = await fetch(`/api/admin/media/${id}${force ? '?force=1' : ''}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 409 && data.inUse) {
      setDeleteConflict({
        mediaId: id,
        fileName,
        references: Array.isArray(data.references) ? data.references : [],
        message: data.error || 'هذا الملف مستخدم حالياً في الموقع.',
      });
      return;
    }
    if (!res.ok) {
      notify(data.error || 'تعذر حذف الملف', 'error');
      return;
    }
    setDeleteConflict(null);
    notify('تم حذف الملف من التخزين');
    await refreshAll();
    await loadHealth();
  };

  return (
    <div>
      <AdminPanelHeader
        title="التخزين ومعالجة الوسائط"
        subtitle="مراقبة المساحة التخزينية الفعلية على الخادم وحالة FFmpeg/FFprobe وإعدادات التخزين وإدارة الملفات المرفوعة"
        onSave={handleSaveStorage}
        onReset={() => resetCategory('storage')}
        saving={savingStorage}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleCleanupChunks}
              disabled={cleaning}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
            >
              <Trash2 size={14} />
              <span>{cleaning ? 'جاري التنظيف...' : 'تنظيف أجزاء الرفع المؤقتة'}</span>
            </button>
            <button
              type="button"
              onClick={handleCleanupOrphans}
              disabled={cleaningOrphans}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-800 hover:bg-amber-100 cursor-pointer"
            >
              <Trash2 size={14} />
              <span>
                {cleaningOrphans
                  ? 'جاري تنظيف اليتيمة...'
                  : `تنظيف الملفات اليتيمة (${diag?.orphanedFilesCount ?? 0})`}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                refreshAll();
                loadHealth();
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-800 text-xs font-bold cursor-pointer hover:bg-neutral-50"
            >
              <RefreshCw size={14} />
              <span>تحديث القياسات</span>
            </button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <AdminCard>
          <div className="text-xs text-neutral-500">إجمالي مساحة الوسائط</div>
          <div className="text-2xl font-extrabold text-neutral-900 mt-1 tabular-nums">
            {formatBytes(diag?.totalMediaBytes || 0)}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1 tabular-nums">
            عدد الملفات: {diag?.totalFiles ?? mediaFiles.length}
          </div>
        </AdminCard>
        <AdminCard>
          <div className="text-xs text-neutral-500">محرك الفيديو (FFmpeg)</div>
          <div className="text-lg font-extrabold mt-1">
            {diag?.ffmpegAvailable ? (
              <span className="text-[#8C6A2F]">متصل ويعمل</span>
            ) : (
              <span className="text-red-600">غير متوفر</span>
            )}
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">
            FFprobe: {diag?.ffprobeAvailable ? 'جاهز' : 'غير جاهز'}
          </div>
        </AdminCard>
        <AdminCard>
          <div className="text-xs text-neutral-500">توزيع الأنواع</div>
          <div className="text-xs font-semibold text-neutral-800 mt-2 space-y-1">
            <div>فيديو: {formatBytes(diag?.byKind?.video || 0)}</div>
            <div>صور: {formatBytes(diag?.byKind?.image || 0)}</div>
          </div>
        </AdminCard>
        <AdminCard>
          <div className="text-xs text-neutral-500">تطابق القرص والملفات اليتيمة</div>
          <div className="text-2xl font-extrabold text-neutral-900 mt-1 tabular-nums">
            {diag?.missingFiles?.length || 0} مفقود · {diag?.orphanedFilesCount || 0} يتيم
          </div>
          <div className="text-[11px] text-neutral-500 mt-1">فحص تطابق قاعدة البيانات بالقرص</div>
        </AdminCard>
      </div>

      {/* Storage Mode & Cloud Preparation Card */}
      <AdminCard
        title="إعدادات وضع التخزين والربط السحابي والمعالجة التلقائية"
        subtitle="التحكم بحد أقصى لحجم الملف ومعالجة الفيديو والتجهيز لمزود التخزين الخارجي."
        className="mb-6"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">مزود / نمط التخزين</label>
              <select
                value={storageCfg.mode}
                onChange={(e) => setStorageCfg({ ...storageCfg, mode: e.target.value as StorageConfig['mode'] })}
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-semibold"
              >
                <option value="local">التخزين المحلي على الخادم (/uploads)</option>
                <option value="s3">Amazon S3 (تهيئة خارجية)</option>
                <option value="r2">Cloudflare R2 (تهيئة خارجية)</option>
                <option value="gcs">Google Cloud Storage (تهيئة خارجية)</option>
                <option value="firebase">Firebase Storage (تهيئة خارجية)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                الحد الأقصى لحجم الرفع (م.ب)
              </label>
              <input
                type="number"
                min={10}
                max={20480}
                value={storageCfg.maxFileSizeMb}
                onChange={(e) =>
                  setStorageCfg({ ...storageCfg, maxFileSizeMb: Number(e.target.value) || 2048 })
                }
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs tabular-nums"
              />
            </div>
            <div className="flex flex-col justify-end gap-2 pb-1">
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={storageCfg.autoExtractThumbnails}
                  onChange={(e) =>
                    setStorageCfg({ ...storageCfg, autoExtractThumbnails: e.target.checked })
                  }
                  className="accent-[#B08D45]"
                />
                <span>استخراج 6 صور مصغرة تلقائياً عند رفع الفيديو</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={storageCfg.autoTranscodeOnUpload}
                  onChange={(e) =>
                    setStorageCfg({ ...storageCfg, autoTranscodeOnUpload: e.target.checked })
                  }
                  className="accent-[#B08D45]"
                />
                <span>توليد جودات التشغيل تلقائياً بالخلفية بعد الرفع</span>
              </label>
            </div>
          </div>

          {storageCfg.mode !== 'local' && (
            <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-neutral-800">
                <Cloud size={15} className="text-[#8C6A2F]" />
                <span>معاملات المزود السحابي ({storageCfg.mode.toUpperCase()}) — مع استمرار النسخ المحلي الاحتياطي</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">اسم الحزمة (Bucket)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={storageCfg.bucket}
                    onChange={(e) => setStorageCfg({ ...storageCfg, bucket: e.target.value })}
                    placeholder="archive-media-bucket"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">نقطة النهاية (Endpoint)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={storageCfg.endpoint}
                    onChange={(e) => setStorageCfg({ ...storageCfg, endpoint: e.target.value })}
                    placeholder="https://s3.eu-west-2.amazonaws.com"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">المنطقة (Region)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={storageCfg.region}
                    onChange={(e) => setStorageCfg({ ...storageCfg, region: e.target.value })}
                    placeholder="auto / eu-west-2"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">معرف المفتاح العام (Access Key ID)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={storageCfg.accessKeyId}
                    onChange={(e) => setStorageCfg({ ...storageCfg, accessKeyId: e.target.value })}
                    placeholder="AKIA..."
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">الرابط العام للملفات (Public Base URL)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={storageCfg.publicBaseUrl}
                    onChange={(e) => setStorageCfg({ ...storageCfg, publicBaseUrl: e.target.value })}
                    placeholder="https://cdn.example.com"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>
              <p className="text-[11px] text-neutral-500">
                تنبيه أمني: مفاتيح التوقيع السرية تُضبط عبر متغير البيئة <code dir="ltr" className="font-mono bg-neutral-200 px-1 rounded">STORAGE_SECRET_ACCESS_KEY</code> (أو <code dir="ltr" className="font-mono bg-neutral-200 px-1 rounded">S3_SECRET_ACCESS_KEY</code> / <code dir="ltr" className="font-mono bg-neutral-200 px-1 rounded">R2_SECRET_ACCESS_KEY</code>) على الخادم فقط ولا تُخزن في إعدادات المتصفح.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <button
              type="button"
              disabled={testingStorage}
              onClick={handleTestStorage}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-bold text-neutral-800 hover:bg-neutral-50 cursor-pointer"
            >
              <ShieldCheck size={14} className="text-[#8C6A2F]" />
              <span>{testingStorage ? 'جاري فحص التخزين...' : 'اختبار الاتصال والتخزين'}</span>
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                testResult.ok
                  ? testResult.needsExternalConfig
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : 'border-emerald-300 bg-emerald-50 text-emerald-900'
                  : 'border-red-300 bg-red-50 text-red-900'
              }`}
            >
              {testResult.ok ? (
                <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              )}
              <div>
                <div className="font-bold">
                  الوضع النشط حالياً: {testResult.activeMode === 'local' ? 'التخزين المحلي على الخادم' : testResult.activeMode}
                </div>
                <div className="mt-0.5">{testResult.message}</div>
              </div>
            </div>
          )}
        </div>
      </AdminCard>

      <AdminCard title="سجل الملفات الفعلية على التخزين المحلي">
        {mediaFiles.length === 0 ? (
          <div className="py-10 text-center text-xs text-neutral-500">
            <HardDrive size={28} className="mx-auto mb-2 text-neutral-400" />
            <span>لا توجد ملفات وسائط مخزنة حتى الآن.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-600">
                <tr>
                  <th className="py-2.5 px-3">اسم الملف</th>
                  <th className="py-2.5 px-3">النوع</th>
                  <th className="py-2.5 px-3">الحجم</th>
                  <th className="py-2.5 px-3">الأبعاد</th>
                  <th className="py-2.5 px-3">التاريخ</th>
                  <th className="py-2.5 px-3">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {mediaFiles.map((m) => (
                  <tr key={m.id}>
                    <td className="py-2.5 px-3 font-semibold text-neutral-900 max-w-xs truncate">
                      {m.original_name}
                    </td>
                    <td className="py-2.5 px-3">{m.media_kind}</td>
                    <td className="py-2.5 px-3 tabular-nums">{formatBytes(m.file_size)}</td>
                    <td className="py-2.5 px-3 tabular-nums">
                      {m.width && m.height ? `${m.width}×${m.height}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-neutral-500">{formatArabicDate(m.created_at)}</td>
                    <td className="py-2.5 px-3">
                      <button
                        type="button"
                        onClick={() => handleDeleteFile(m.id, m.original_name, false)}
                        className="text-red-600 hover:underline cursor-pointer"
                      >
                        حذف
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>

      {deleteConflict && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setDeleteConflict(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 pb-3">
              <div className="flex items-center gap-2 text-sm font-bold text-red-700">
                <AlertTriangle size={18} />
                <span>تحذير: الملف مستخدم في الموقع</span>
              </div>
              <button type="button" onClick={() => setDeleteConflict(null)} className="cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="text-xs text-neutral-700 space-y-2">
              <p className="font-semibold">{deleteConflict.message}</p>
              <p className="text-neutral-500">الملف: {deleteConflict.fileName}</p>
              {deleteConflict.references.length > 0 && (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-1.5 max-h-48 overflow-y-auto">
                  {deleteConflict.references.map((r, idx) => (
                    <div key={idx} className="text-[11px] flex items-center justify-between gap-2">
                      <span className="font-bold text-neutral-800">{r.title}</span>
                      <span className="text-neutral-500">{r.location}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConflict(null)}
                className="px-4 py-2 rounded-lg border border-neutral-300 text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleDeleteFile(deleteConflict.mediaId, deleteConflict.fileName, true)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 cursor-pointer"
              >
                تأكيد الحذف رغم الارتباط
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
