import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Edit3, EyeOff, Lock, RotateCcw, Save, Trash2 } from 'lucide-react';
import { AdminCard, AdminPanelHeader } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import type { PoemSubmissionRecord } from '../../../types/platform';

function parseCustomFields(raw?: string): Array<{ id: string; label: string; value: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function AdminPoemSubmissions() {
  const { notify, refreshAll } = useAdmin();
  const [submissions, setSubmissions] = useState<PoemSubmissionRecord[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [deletedCount, setDeletedCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    title: '',
    poet_name: '',
    verses_text: '',
    extra_info: '',
    admin_notes: '',
  });
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/poem-submissions?status=${statusFilter}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setSubmissions(data.submissions || []);
        setPendingCount(data.pendingCount || 0);
        setDeletedCount(data.deletedCount || 0);
      }
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const startEdit = (sub: PoemSubmissionRecord) => {
    setEditingId(sub.id);
    setEditForm({
      title: sub.title,
      poet_name: sub.poet_name,
      verses_text: sub.verses_text,
      extra_info: sub.extra_info,
      admin_notes: sub.admin_notes,
    });
  };

  const saveEdit = async (id: number) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/poem-submissions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        notify('تم تحديث بيانات المشاركة.', 'success');
        setEditingId(null);
        await load();
      } else {
        notify('تعذر حفظ التعديلات.', 'error');
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleApprove = async (sub: PoemSubmissionRecord, publishNow: boolean) => {
    setBusyId(sub.id);
    try {
      const res = await fetch(`/api/admin/poem-submissions/${sub.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ publishNow }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || 'تعذر اعتماد المشاركة.', 'error');
        return;
      }
      if (data.alreadyApproved) {
        notify('تم اعتماد هذه المشاركة مسبقاً (محمية من التكرار).', 'info');
      } else {
        notify(
          publishNow
            ? 'تم اعتماد القصيدة ونشرها في الديوان.'
            : 'تم تحويل المشاركة إلى مسودة في قسم القصائد.',
          'success'
        );
      }
      await load();
      await refreshAll();
    } finally {
      setBusyId(null);
    }
  };

  const handleStatus = async (sub: PoemSubmissionRecord, status: 'private' | 'rejected' | 'pending') => {
    setBusyId(sub.id);
    try {
      const res = await fetch(`/api/admin/poem-submissions/${sub.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        notify('تم تحديث حالة المشاركة.', 'info');
        await load();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number, permanent = false) => {
    setBusyId(id);
    try {
      const res = await fetch(
        `/api/admin/poem-submissions/${id}${permanent ? '?permanent=1' : ''}`,
        {
          method: 'DELETE',
          credentials: 'include',
        }
      );
      if (res.ok) {
        notify(
          permanent ? 'تم حذف المشاركة نهائياً.' : 'تم نقل المشاركة إلى المحذوفات (قابلة للاستعادة).',
          'info'
        );
        await load();
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleRestore = async (id: number) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/poem-submissions/${id}/restore`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        notify('تمت استعادة المشاركة إلى قائمة المراجعة بنجاح.', 'success');
        await load();
      }
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPanelHeader
        title="مشاركات القصائد الواردة (صندوق المالك الخاص)"
        subtitle="كل ما يرسله الزوار عبر نموذج صفحة قصائد يصل هنا فقط بسرية تامة ولا يظهر للعموم إلا بعد موافقتك"
      />

      <AdminCard>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'الكل' },
              { id: 'pending', label: `قيد المراجعة (${pendingCount})` },
              { id: 'approved', label: 'معتمدة ومنشورة' },
              { id: 'private', label: 'محتفظ بها خاصة' },
              { id: 'rejected', label: 'مرفوضة' },
              { id: 'deleted', label: `المحذوفات (${deletedCount})` },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setStatusFilter(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                  statusFilter === t.id
                    ? 'bg-[#B08D45] text-white'
                    : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <p className="py-10 text-center text-xs text-neutral-500">جاري تحميل المشاركات...</p>
        ) : submissions.length === 0 ? (
          <p className="py-10 text-center text-xs text-neutral-500">لا توجد مشاركات ضمن هذا التصنيف.</p>
        ) : (
          <div className="space-y-4">
            {submissions.map((sub) => {
              const extraCustom = parseCustomFields(sub.custom_fields_json);
              return (
                <div
                  key={sub.id}
                  className="rounded-xl border border-neutral-200 p-4 space-y-3 bg-neutral-50/40"
                >
                  {editingId === sub.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          value={editForm.title}
                          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                          className="rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white"
                          placeholder="عنوان القصيدة"
                        />
                        <input
                          type="text"
                          value={editForm.poet_name}
                          onChange={(e) => setEditForm({ ...editForm, poet_name: e.target.value })}
                          className="rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white"
                          placeholder="اسم الشاعر"
                        />
                      </div>
                      <textarea
                        rows={5}
                        value={editForm.verses_text}
                        onChange={(e) => setEditForm({ ...editForm, verses_text: e.target.value })}
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white leading-relaxed"
                      />
                      <input
                        type="text"
                        value={editForm.extra_info}
                        onChange={(e) => setEditForm({ ...editForm, extra_info: e.target.value })}
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white"
                        placeholder="معلومات أو ملاحظات إضافية من المرسل..."
                      />
                      <input
                        type="text"
                        value={editForm.admin_notes}
                        onChange={(e) => setEditForm({ ...editForm, admin_notes: e.target.value })}
                        className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-xs bg-white"
                        placeholder="ملاحظة إدارية داخلية..."
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={busyId === sub.id}
                          onClick={() => saveEdit(sub.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold cursor-pointer"
                        >
                          <Save size={13} />
                          <span>حفظ التعديل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 rounded-lg border border-neutral-300 text-xs cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-extrabold text-neutral-900">{sub.title}</h4>
                          <div className="text-xs text-neutral-500 mt-0.5">
                            الشاعر: {sub.poet_name || 'غير مذكور'}
                            {sub.extra_info && ` • ${sub.extra_info}`}
                          </div>
                        </div>
                        <span
                          className={`px-2.5 py-0.5 rounded text-[11px] font-bold ${
                            sub.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : sub.status === 'pending'
                                ? 'bg-amber-100 text-amber-800'
                                : sub.status === 'private'
                                  ? 'bg-blue-100 text-blue-800'
                                  : sub.status === 'deleted'
                                    ? 'bg-neutral-200 text-neutral-700'
                                    : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {sub.status === 'approved'
                            ? 'معتمدة'
                            : sub.status === 'pending'
                              ? 'قيد المراجعة'
                              : sub.status === 'private'
                                ? 'خاصة بالمالك'
                                : sub.status === 'deleted'
                                  ? 'في المحذوفات'
                                  : 'مرفوضة'}
                        </span>
                      </div>

                      <pre className="whitespace-pre-wrap font-sans text-xs text-neutral-800 leading-loose bg-white rounded-lg border border-neutral-200 p-3">
                        {sub.verses_text}
                      </pre>

                      {extraCustom.length > 0 && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-white rounded-lg border border-neutral-200 p-3 text-xs">
                          {extraCustom.map((cf) => (
                            <div key={cf.id}>
                              <span className="font-bold text-neutral-700">{cf.label}: </span>
                              <span className="text-neutral-600">{cf.value}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {sub.admin_notes && (
                        <div className="text-xs text-[#8C6A2F] bg-[#F7F4EC] rounded-lg px-3 py-2">
                          ملاحظة المالك: {sub.admin_notes}
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {sub.status === 'deleted' ? (
                          <>
                            <button
                              type="button"
                              disabled={busyId === sub.id}
                              onClick={() => handleRestore(sub.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
                            >
                              <RotateCcw size={13} />
                              <span>استعادة المشاركة</span>
                            </button>
                            <button
                              type="button"
                              disabled={busyId === sub.id}
                              onClick={() => handleDelete(sub.id, true)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-bold cursor-pointer mr-auto"
                            >
                              <Trash2 size={13} />
                              <span>حذف نهائي</span>
                            </button>
                          </>
                        ) : (
                          <>
                            {sub.status !== 'approved' && (
                              <>
                                <button
                                  type="button"
                                  disabled={busyId === sub.id}
                                  onClick={() => handleApprove(sub, true)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer"
                                >
                                  <CheckCircle2 size={13} />
                                  <span>اعتماد ونشر فوراً</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={busyId === sub.id}
                                  onClick={() => handleApprove(sub, false)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold cursor-pointer"
                                >
                                  <span>حفظ كمسودة قصيدة</span>
                                </button>
                              </>
                            )}
                            <button
                              type="button"
                              onClick={() => startEdit(sub)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs cursor-pointer"
                            >
                              <Edit3 size={13} />
                              <span>تحرير</span>
                            </button>
                            <button
                              type="button"
                              disabled={busyId === sub.id}
                              onClick={() => handleStatus(sub, 'private')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs cursor-pointer"
                            >
                              <Lock size={13} />
                              <span>إبقاء خاصاً</span>
                            </button>
                            <button
                              type="button"
                              disabled={busyId === sub.id}
                              onClick={() => handleStatus(sub, 'rejected')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-xs cursor-pointer"
                            >
                              <EyeOff size={13} />
                              <span>رفض</span>
                            </button>
                            <button
                              type="button"
                              disabled={busyId === sub.id}
                              onClick={() => handleDelete(sub.id, false)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs cursor-pointer mr-auto"
                            >
                              <Trash2 size={13} />
                              <span>نقل للمحذوفات</span>
                            </button>
                          </>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </AdminCard>
    </div>
  );
}
