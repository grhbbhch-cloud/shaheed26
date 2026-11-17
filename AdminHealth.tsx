import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { AdminCard, AdminPanelHeader } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { formatArabicDate, formatBytes } from '../../../lib/styleEngine';

export function AdminHealth() {
  const { notify } = useAdmin();
  const [diag, setDiag] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);

  const loadHealth = async () => {
    const res = await fetch('/api/admin/health', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setDiag(data.diagnostics);
      setEvents(data.events || []);
    }
  };

  useEffect(() => {
    loadHealth();
  }, []);

  const resolveEvent = async (id: number) => {
    await fetch(`/api/admin/health/events/${id}/resolve`, {
      method: 'POST',
      credentials: 'include',
    });
    notify('تم تحديد التنبيه كمُعالج');
    await loadHealth();
  };

  const clearResolved = async () => {
    await fetch('/api/admin/health/events/resolved', {
      method: 'DELETE',
      credentials: 'include',
    });
    notify('تم مسح السجلات المعالجة');
    await loadHealth();
  };

  return (
    <div>
      <AdminPanelHeader
        title="صحة النظام والتشخيص"
        subtitle="فحص حي لقاعدة البيانات، التخزين، FFmpeg، عمليات الرفع المتعثرة، والروابط المكسورة"
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={clearResolved}
              className="px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 cursor-pointer"
            >
              مسح السجلات المُعالجة
            </button>
            <button
              type="button"
              onClick={loadHealth}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#B08D45] hover:bg-[#8C6A2F] text-white text-xs font-bold cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>إعادة الفحص</span>
            </button>
          </div>
        }
      />

      {diag && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <AdminCard>
            <div className="text-xs text-neutral-500">قاعدة البيانات SQLite</div>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-bold">
              {diag.dbConnected ? (
                <>
                  <CheckCircle2 size={16} className="text-[#B08D45]" />
                  <span className="text-[#8C6A2F]">سليمة ومتصلة (WAL)</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={16} className="text-red-600" />
                  <span className="text-red-700">تتطلب فحصاً</span>
                </>
              )}
            </div>
          </AdminCard>
          <AdminCard>
            <div className="text-xs text-neutral-500">معالجة الفيديو (FFmpeg)</div>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-bold">
              {diag.ffmpegAvailable && diag.ffprobeAvailable ? (
                <>
                  <CheckCircle2 size={16} className="text-[#B08D45]" />
                  <span className="text-[#8C6A2F]">FFmpeg + FFprobe جاهزان</span>
                </>
              ) : (
                <>
                  <AlertTriangle size={16} className="text-amber-600" />
                  <span className="text-amber-700">غير متاح بالكامل</span>
                </>
              )}
            </div>
          </AdminCard>
          <AdminCard>
            <div className="text-xs text-neutral-500">ملفات مفقودة / روابط معطلة</div>
            <div className="mt-1 text-lg font-extrabold tabular-nums">
              {diag.missingFiles?.length || 0} / {diag.brokenLinks?.length || 0}
            </div>
          </AdminCard>
          <AdminCard>
            <div className="text-xs text-neutral-500">الوسائط والنسخ</div>
            <div className="mt-1 text-sm font-bold tabular-nums">
              {formatBytes(diag.totalMediaBytes || 0)} · {diag.backupCount || 0} نسخة
            </div>
          </AdminCard>
        </div>
      )}

      <AdminCard title={`سجل أحداث النظام والتشخيص (${events.length})`}>
        {events.length === 0 ? (
          <div className="py-10 text-center text-xs text-neutral-500">
            لا توجد أعطال أو أحداث نظام مسجلة. المنصة تعمل بحالة سليمة.
          </div>
        ) : (
          <div className="space-y-2.5">
            {events.map((ev) => (
              <div
                key={ev.id}
                className={`p-3 rounded-lg border flex flex-wrap items-center justify-between gap-3 ${
                  ev.resolved ? 'border-neutral-200 bg-neutral-50 opacity-70' : 'border-amber-200 bg-amber-50/50'
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-neutral-900">{ev.message}</div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {ev.event_type} · {formatArabicDate(ev.created_at)}
                  </div>
                </div>
                {!ev.resolved ? (
                  <button
                    type="button"
                    onClick={() => resolveEvent(ev.id)}
                    className="px-3 py-1.5 rounded-lg bg-[#B08D45] hover:bg-[#8C6A2F] text-white text-xs font-bold cursor-pointer"
                  >
                    تحديد كمُعالج
                  </button>
                ) : (
                  <span className="text-xs font-semibold text-[#8C6A2F]">تمت المعالجة</span>
                )}
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  );
}
