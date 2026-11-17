import React, { useEffect, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { AdminCard, AdminPanelHeader } from '../../../components/admin/AdminSharedUI';
import { formatArabicDate } from '../../../lib/styleEngine';

interface ActivityRow {
  id: number;
  action: string;
  category: string;
  details: string;
  actor: string;
  severity: string;
  created_at: string;
}

export function AdminActivity() {
  const [logs, setLogs] = useState<ActivityRow[]>([]);
  const [cat, setCat] = useState('');

  const loadLogs = async (category = cat) => {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    const res = await fetch(`/api/admin/activity${qs}`, { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setLogs(data.logs || []);
    }
  };

  useEffect(() => {
    loadLogs(cat);
  }, [cat]);

  return (
    <div>
      <AdminPanelHeader
        title="سجل النشاط والتغييرات"
        subtitle="تتبع دقيق لكل عملية إنشاء أو تعديل أو حذف أو استعادة في لوحة التحكم"
        actions={
          <div className="flex items-center gap-2">
            <select
              value={cat}
              onChange={(e) => setCat(e.target.value)}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs"
            >
              <option value="">جميع الفئات</option>
              <option value="settings">الإعدادات</option>
              <option value="pages">الصفحات</option>
              <option value="content">المحتوى</option>
              <option value="media">الوسائط</option>
              <option value="subtitles">الترجمات</option>
              <option value="backup">النسخ الاحتياطي</option>
              <option value="auth">الأمان والدخول</option>
            </select>
            <button
              type="button"
              onClick={() => loadLogs(cat)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#B08D45] hover:bg-[#8C6A2F] text-white text-xs font-bold cursor-pointer"
            >
              <RefreshCw size={14} />
              <span>تحديث</span>
            </button>
          </div>
        }
      />

      <AdminCard>
        {logs.length === 0 ? (
          <div className="py-10 text-center text-xs text-neutral-500">
            <Activity size={28} className="mx-auto mb-2 text-neutral-400" />
            <span>لا توجد أحداث مسجلة ضمن هذا الفلتر.</span>
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {logs.map((l) => (
              <div key={l.id} className="py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-bold text-neutral-900">
                    {l.action}
                    {l.details ? ` — ${l.details}` : ''}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    {l.category} · {l.actor}
                  </div>
                </div>
                <span className="text-[11px] text-neutral-400 tabular-nums">
                  {formatArabicDate(l.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </AdminCard>
    </div>
  );
}
