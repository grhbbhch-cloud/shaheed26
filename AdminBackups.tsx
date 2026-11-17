import React, { useEffect, useState } from 'react';
import { Clock, Database, Download, RotateCcw, Save, Trash2, Upload } from 'lucide-react';
import { AdminCard, AdminPanelHeader } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { formatArabicDate, formatBytes } from '../../../lib/styleEngine';
import type { BackupScheduleConfig } from '../../../types/platform';

interface BackupRecord {
  id: number;
  label: string;
  backup_type: string;
  file_size: number;
  checksum: string;
  verified: number;
  created_at: string;
}

export function AdminBackups() {
  const { settings, saveCategory, refreshAll, notify } = useAdmin();
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);
  const [schedule, setSchedule] = useState<BackupScheduleConfig>({
    frequency: 'daily',
    retentionCount: 14,
    lastRunAt: '',
  });
  const [savingSchedule, setSavingSchedule] = useState(false);

  useEffect(() => {
    if (settings?.backupSchedule) {
      setSchedule(structuredClone(settings.backupSchedule));
    }
  }, [settings?.backupSchedule]);

  const loadBackups = async () => {
    const res = await fetch('/api/admin/backups', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setBackups(data.backups || []);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  const handleSaveSchedule = async () => {
    setSavingSchedule(true);
    try {
      await saveCategory('backupSchedule', schedule, 'تحديث جدول النسخ الاحتياطي التلقائي');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/admin/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label: label.trim() || undefined }),
      });
      if (res.ok) {
        notify('تم إنشاء نسخة احتياطية كاملة بنجاح');
        setLabel('');
        await loadBackups();
        await refreshAll();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRestore = async (id: number) => {
    const res = await fetch(`/api/admin/backups/${id}/restore`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'فشل استعادة النسخة', 'error');
      return;
    }
    notify('تم إنشاء نسخة أمان قبل الاستعادة ثم استعادة النسخة بنجاح');
    await loadBackups();
    await refreshAll();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await fetch('/api/admin/backups/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || 'ملف النسخة الاحتياطية غير صالح', 'error');
        return;
      }
      notify('تم حفظ نسخة أمان تلقائية واستيراد النسخة بنجاح');
      await loadBackups();
      await refreshAll();
    } catch {
      notify('تعذر قراءة ملف JSON', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    await fetch(`/api/admin/backups/${id}`, { method: 'DELETE', credentials: 'include' });
    notify('تم حذف النسخة الاحتياطية');
    await loadBackups();
  };

  return (
    <div>
      <AdminPanelHeader
        title="النسخ الاحتياطي والاستعادة"
        subtitle="إنشاء نسخ احتياطية كاملة وجدولتها تلقائياً مع نسخة أمان فورية قبل كل استعادة"
        actions={
          <label className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer">
            <Upload size={14} />
            <span>استيراد واستعادة ملف JSON</span>
            <input type="file" accept=".json,application/json" onChange={handleImport} className="hidden" />
          </label>
        }
      />

      <AdminCard
        title="جدولة النسخ الاحتياطي التلقائي وسياسة الاحتفاظ"
        subtitle="يعمل الخادم تلقائياً في الخلفية لإنشاء نسخة دورية وتنظيف النسخ الأقدم حسب العدد المحدد"
        className="mb-5"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">التكرار التلقائي</label>
            <select
              value={schedule.frequency}
              onChange={(e) => setSchedule({ ...schedule, frequency: e.target.value as any })}
              className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs"
            >
              <option value="off">متوقف (يدوي فقط)</option>
              <option value="daily">يومي (كل 24 ساعة)</option>
              <option value="weekly">أسبوعي (كل 7 أيام)</option>
              <option value="monthly">شهري (كل 30 يوماً)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">الحد الأقصى للنسخ التلقائية المحفوظة</label>
            <input
              type="number"
              min={1}
              max={60}
              value={schedule.retentionCount}
              onChange={(e) => setSchedule({ ...schedule, retentionCount: Math.max(1, Number(e.target.value)) })}
              className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs tabular-nums"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="text-[11px] text-neutral-500 flex items-center gap-1">
              <Clock size={13} />
              <span>آخر تشغيل: {schedule.lastRunAt ? formatArabicDate(schedule.lastRunAt) : 'لم يُنفذ بعد'}</span>
            </div>
            <button
              type="button"
              disabled={savingSchedule}
              onClick={handleSaveSchedule}
              className="inline-flex items-center gap-1 px-3.5 py-2 rounded-lg bg-[#B08D45] hover:bg-[#8C6A2F] text-white text-xs font-bold cursor-pointer shrink-0"
            >
              <Save size={13} />
              <span>{savingSchedule ? 'جاري الحفظ...' : 'حفظ الجدول'}</span>
            </button>
          </div>
        </div>
      </AdminCard>

      <AdminCard title="إنشاء نسخة احتياطية جديدة" className="mb-5">
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="تسمية النسخة (اختياري)..."
            className="flex-1 min-w-[240px] rounded-lg border border-neutral-300 px-3 py-2 text-xs"
          />
          <button
            type="button"
            disabled={creating}
            onClick={handleCreate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B08D45] hover:bg-[#8C6A2F] text-white text-xs font-bold cursor-pointer"
          >
            <Database size={14} />
            <span>{creating ? 'جاري الإنشاء...' : 'إنشاء نسخة احتياطية الآن'}</span>
          </button>
        </div>
      </AdminCard>

      <AdminCard title={`النسخ المحفوظة (${backups.length})`}>
        {backups.length === 0 ? (
          <p className="text-xs text-neutral-500 text-center py-8">لم يتم إنشاء نسخ احتياطية بعد.</p>
        ) : (
          <div className="space-y-2.5">
            {backups.map((b) => (
              <div
                key={b.id}
                className="p-3.5 rounded-xl border border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-neutral-900">{b.label}</span>
                    {b.backup_type === 'pre-restore' && (
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                        نسخة أمان قبل الاستعادة
                      </span>
                    )}
                    {b.backup_type === 'scheduled' && (
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                        نسخة مجدولة
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5 tabular-nums">
                    {formatArabicDate(b.created_at)} · {formatBytes(b.file_size)} · SHA-256:{' '}
                    {b.checksum.slice(0, 12)}...
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/api/admin/backups/${b.id}/download`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50"
                  >
                    <Download size={13} />
                    <span>تنزيل</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRestore(b.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>استعادة</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(b.id)}
                    className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  );
}
