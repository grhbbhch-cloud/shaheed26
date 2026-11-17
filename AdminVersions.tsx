import React, { useEffect, useMemo, useState } from 'react';
import { GitCompare, History, RotateCcw, X } from 'lucide-react';
import { AdminCard, AdminPanelHeader } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { formatArabicDate } from '../../../lib/styleEngine';

interface VersionRow {
  id: number;
  category: string;
  entity_type?: string;
  entity_id?: number | null;
  label: string;
  snapshot_json?: string;
  created_by: string;
  created_at: string;
}

export function AdminVersions() {
  const { settings, refreshAll, notify } = useAdmin();
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [compareVersion, setCompareVersion] = useState<VersionRow | null>(null);
  const [entityFilter, setEntityFilter] = useState<'all' | 'settings' | 'page' | 'content' | 'poem'>('all');

  const loadVersions = async () => {
    const res = await fetch('/api/admin/versions', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setVersions(data.versions || []);
    }
  };

  useEffect(() => {
    loadVersions();
  }, []);

  const handleRollback = async (id: number) => {
    const res = await fetch(`/api/admin/versions/${id}/rollback`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      notify('تم التراجع إلى النسخة المحددة وتطبيقها بنجاح');
      setCompareVersion(null);
      await refreshAll();
      await loadVersions();
    } else {
      notify('تعذر تنفيذ التراجع', 'error');
    }
  };

  const diffRows = useMemo(() => {
    if (!compareVersion || !compareVersion.snapshot_json) return [];
    let oldVal: any = {};
    try {
      oldVal = JSON.parse(compareVersion.snapshot_json);
    } catch {
      return [];
    }
    const currentVal: any = (settings as any)?.[compareVersion.category] || {};
    if (typeof oldVal !== 'object' || oldVal === null || Array.isArray(oldVal)) {
      const oldStr = JSON.stringify(oldVal, null, 2);
      const curStr = JSON.stringify(currentVal, null, 2);
      return [{ key: compareVersion.category, oldStr, curStr, changed: oldStr !== curStr }];
    }
    const allKeys = Array.from(new Set([...Object.keys(oldVal), ...Object.keys(currentVal || {})]));
    return allKeys.map((k) => {
      const oldStr = JSON.stringify(oldVal[k]);
      const curStr = JSON.stringify(currentVal?.[k]);
      return {
        key: k,
        oldStr: oldStr === undefined ? '—' : oldStr.slice(0, 180),
        curStr: curStr === undefined ? '—' : curStr.slice(0, 180),
        changed: oldStr !== curStr,
      };
    });
  }, [compareVersion, settings]);

  const filteredVersions = useMemo(() => {
    if (entityFilter === 'all') return versions;
    return versions.filter((v) => {
      const et = v.entity_type || 'settings';
      return et === entityFilter;
    });
  }, [versions, entityFilter]);

  return (
    <div>
      <AdminPanelHeader
        title="سجل الإصدارات والتراجع"
        subtitle="كل حفظ للإعدادات أو الصفحة أو المحتوى أو القصيدة يُسجل هنا تلقائياً مع إمكانية التراجع الفوري"
      />

      <AdminCard title={`الإصدارات المسجلة (${filteredVersions.length})`}>
        <div className="flex flex-wrap gap-2 mb-4">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'settings', label: 'الإعدادات والتصميم' },
            { id: 'content', label: 'المواد' },
            { id: 'page', label: 'الصفحات' },
            { id: 'poem', label: 'القصائد' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setEntityFilter(t.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                entityFilter === t.id
                  ? 'bg-[#B08D45] text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {filteredVersions.length === 0 ? (
          <div className="py-10 text-center text-xs text-neutral-500">
            <History size={28} className="mx-auto mb-2 text-neutral-400" />
            <span>لا توجد تعديلات سابقة مسجلة ضمن هذا التصنيف.</span>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredVersions.map((v) => (
              <div
                key={v.id}
                className="p-3 rounded-lg border border-neutral-200 bg-neutral-50 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-neutral-900">
                    <span>#{v.id} — {v.label}</span>
                    {v.entity_type && v.entity_type !== 'settings' && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px]">
                        {v.entity_type === 'page' ? 'صفحة' : v.entity_type === 'content' ? 'مادة' : 'قصيدة'}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-neutral-500 mt-0.5">
                    الفئة: {v.category} · بواسطة: {v.created_by} · {formatArabicDate(v.created_at)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {v.snapshot_json && (!v.entity_type || v.entity_type === 'settings') && (
                    <button
                      type="button"
                      onClick={() => setCompareVersion(v)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-neutral-300 text-neutral-800 bg-white text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
                    >
                      <GitCompare size={13} />
                      <span>مقارنة قبل التراجع</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRollback(v.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#B08D45] text-[#8C6A2F] bg-white text-xs font-bold hover:bg-[#F7F4EC] cursor-pointer"
                  >
                    <RotateCcw size={13} />
                    <span>التراجع لهذا الإصدار</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </AdminCard>

      {compareVersion && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setCompareVersion(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-neutral-200 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-neutral-900">
                  مقارنة الإصدار #{compareVersion.id} مع الوضع الحالي ({compareVersion.category})
                </h3>
                <p className="text-[11px] text-neutral-500">{compareVersion.label}</p>
              </div>
              <button type="button" onClick={() => setCompareVersion(null)} className="cursor-pointer">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-2">
                {diffRows.map((row) => (
                  <div
                    key={row.key}
                    className={`rounded-lg border p-3 text-xs ${
                      row.changed ? 'border-amber-300 bg-amber-50/40' : 'border-neutral-200 bg-neutral-50'
                    }`}
                  >
                    <div className="font-mono font-bold text-neutral-900 mb-1.5 flex items-center justify-between">
                      <span>{row.key}</span>
                      {row.changed && (
                        <span className="text-[10px] font-sans font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded">
                          مختلف
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono" dir="ltr">
                      <div className="rounded border border-neutral-200 bg-white p-2 break-all">
                        <div className="text-[10px] font-sans font-bold text-neutral-500 mb-1">في الإصدار #{compareVersion.id}:</div>
                        {row.oldStr}
                      </div>
                      <div className="rounded border border-neutral-200 bg-white p-2 break-all">
                        <div className="text-[10px] font-sans font-bold text-neutral-500 mb-1">القيمة الحالية:</div>
                        {row.curStr}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-neutral-200 flex items-center justify-end gap-2 bg-neutral-50">
              <button
                type="button"
                onClick={() => setCompareVersion(null)}
                className="px-4 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => handleRollback(compareVersion.id)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>تأكيد التراجع لهذا الإصدار</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
