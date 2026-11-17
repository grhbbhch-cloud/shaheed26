import React, { useCallback, useEffect, useState } from 'react';
import { Feather, FileText, FolderTree, Inbox, RotateCcw, Trash2 } from 'lucide-react';
import { AdminCard, AdminPanelHeader } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';

interface TrashRow {
  id: number;
  title: string;
  slug?: string;
  page_type?: string;
  content_type?: string;
  poet_name?: string;
  deleted_at: string | null;
  updated_at: string;
}

export function AdminRecycleBin() {
  const { notify, refreshAll } = useAdmin();
  const [pages, setPages] = useState<TrashRow[]>([]);
  const [content, setContent] = useState<TrashRow[]>([]);
  const [poems, setPoems] = useState<TrashRow[]>([]);
  const [submissions, setSubmissions] = useState<TrashRow[]>([]);
  const [tab, setTab] = useState<'all' | 'content' | 'page' | 'poem' | 'submission'>('all');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/trash', { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setPages(data.pages || []);
        setContent(data.content || []);
        setPoems(data.poems || []);
        setSubmissions(data.submissions || []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRestore = async (kind: 'page' | 'content' | 'poem' | 'submission', id: number) => {
    const res = await fetch(`/api/admin/trash/${kind}/${id}/restore`, {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      notify(
        kind === 'submission'
          ? 'تمت استعادة مشاركة القصيدة إلى قائمة المراجعة.'
          : 'تمت الاستعادة إلى المسودات بنجاح.',
        'success'
      );
      await load();
      await refreshAll();
    }
  };

  const handlePurge = async (kind: 'page' | 'content' | 'poem' | 'submission', id: number) => {
    const res = await fetch(`/api/admin/trash/${kind}/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) {
      notify('تم الحذف النهائي من قاعدة البيانات.', 'info');
      await load();
      await refreshAll();
    }
  };

  const handleEmptyTrash = async () => {
    const res = await fetch('/api/admin/trash/empty', {
      method: 'POST',
      credentials: 'include',
    });
    if (res.ok) {
      notify('تم إفراغ سلة المحذوفات بالكامل.', 'info');
      await load();
      await refreshAll();
    }
  };

  const total = pages.length + content.length + poems.length + submissions.length;

  return (
    <div className="space-y-6">
      <AdminPanelHeader
        title="سلة المحذوفات"
        subtitle="استعادة الصفحات أو المواد أو القصائد أو مشاركات الزوار المحذوفة مؤقتاً قبل حذفها نهائياً"
        actions={
          total > 0 ? (
            <button
              type="button"
              onClick={handleEmptyTrash}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-red-300 bg-red-50 text-red-700 text-xs font-bold hover:bg-red-100 cursor-pointer"
            >
              <Trash2 size={14} />
              <span>إفراغ السلة ({total})</span>
            </button>
          ) : undefined
        }
      />

      <AdminCard>
        <div className="flex flex-wrap gap-2 mb-5">
          {[
            { id: 'all', label: `الكل (${total})` },
            { id: 'content', label: `المواد (${content.length})` },
            { id: 'page', label: `الصفحات (${pages.length})` },
            { id: 'poem', label: `القصائد (${poems.length})` },
            { id: 'submission', label: `مشاركات القصائد (${submissions.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id as any)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                tab === t.id
                  ? 'bg-[#B08D45] text-white'
                  : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-10 text-center text-xs text-neutral-500">جاري تحميل المحذوفات...</p>
        ) : total === 0 ? (
          <p className="py-10 text-center text-xs text-neutral-500">سلة المحذوفات فارغة حالياً.</p>
        ) : (
          <div className="space-y-2.5">
            {(tab === 'all' || tab === 'content') &&
              content.map((c) => (
                <div
                  key={`c-${c.id}`}
                  className="rounded-xl border border-neutral-200 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FileText size={16} className="text-neutral-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-neutral-900 truncate">{c.title}</div>
                      <div className="text-[11px] text-neutral-500">مادة ({c.content_type})</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRestore('content', c.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold cursor-pointer"
                    >
                      <RotateCcw size={13} />
                      <span>استعادة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePurge('content', c.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>حذف نهائي</span>
                    </button>
                  </div>
                </div>
              ))}

            {(tab === 'all' || tab === 'page') &&
              pages.map((p) => (
                <div
                  key={`pg-${p.id}`}
                  className="rounded-xl border border-neutral-200 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FolderTree size={16} className="text-neutral-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-neutral-900 truncate">{p.title}</div>
                      <div className="text-[11px] text-neutral-500">صفحة (/p/{p.slug})</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRestore('page', p.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold cursor-pointer"
                    >
                      <RotateCcw size={13} />
                      <span>استعادة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePurge('page', p.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>حذف نهائي</span>
                    </button>
                  </div>
                </div>
              ))}

            {(tab === 'all' || tab === 'poem') &&
              poems.map((pm) => (
                <div
                  key={`pm-${pm.id}`}
                  className="rounded-xl border border-neutral-200 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Feather size={16} className="text-[#8C6A2F] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-neutral-900 truncate">{pm.title}</div>
                      <div className="text-[11px] text-neutral-500">
                        قصيدة {pm.poet_name ? `— ${pm.poet_name}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRestore('poem', pm.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold cursor-pointer"
                    >
                      <RotateCcw size={13} />
                      <span>استعادة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePurge('poem', pm.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>حذف نهائي</span>
                    </button>
                  </div>
                </div>
              ))}

            {(tab === 'all' || tab === 'submission') &&
              submissions.map((sb) => (
                <div
                  key={`sb-${sb.id}`}
                  className="rounded-xl border border-neutral-200 p-3.5 flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Inbox size={16} className="text-[#8C6A2F] shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-neutral-900 truncate">{sb.title}</div>
                      <div className="text-[11px] text-neutral-500">
                        مشاركة زائر {sb.poet_name ? `— ${sb.poet_name}` : ''}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRestore('submission', sb.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold cursor-pointer"
                    >
                      <RotateCcw size={13} />
                      <span>استعادة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePurge('submission', sb.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs font-bold cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>حذف نهائي</span>
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
