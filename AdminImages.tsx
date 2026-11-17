import React, { useState } from 'react';
import { AlertTriangle, ExternalLink, Image as ImageIcon, Link2, Trash2, Unlink, Upload, X } from 'lucide-react';
import { AdminCard, AdminPanelHeader, ColorField } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { usePlatform } from '../../../context/PlatformContext';
import { formatBytes } from '../../../lib/styleEngine';
import { uploadFileInChunks } from '../../../lib/uploadClient';
import type { ContentRecord } from '../../../types/platform';

export function AdminImages() {
  const { mediaFiles, content, pages, refreshAll, notify } = useAdmin();
  const { refreshBootstrap } = usePlatform();
  const [selectedItem, setSelectedItem] = useState<ContentRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteConflict, setDeleteConflict] = useState<{
    id: number;
    name: string;
    message: string;
    references: Array<{ kind: string; id: number | string; title: string; location: string }>;
  } | null>(null);

  const imageContent = content.filter(
    (c) => c.content_type === 'image' || c.content_type === 'gallery'
  );
  const imageMedia = mediaFiles.filter((m) => m.media_kind === 'image');

  const [editState, setEditState] = useState({
    title: '',
    description: '',
    page_id: '',
    child_page_id: '',
    status: 'published',
    link_enabled: false,
    link_url: '',
    link_label: '',
    link_new_tab: true,
    altText: '',
    borderColor: '#B08D45',
    borderWidth: 0,
    borderRadius: 10,
    glowColor: '',
    imageFocalPoint: 'center' as 'center' | 'top' | 'bottom' | 'left' | 'right',
  });

  const selectImageItem = (c: ContentRecord) => {
    let sj: any = {};
    try {
      sj = JSON.parse(c.settings_json || '{}');
    } catch {
      sj = {};
    }
    setSelectedItem(c);
    setEditState({
      title: c.title,
      description: c.description || '',
      page_id: c.page_id ? String(c.page_id) : '',
      child_page_id: c.child_page_id ? String(c.child_page_id) : '',
      status: c.status,
      link_enabled: Boolean(c.link_enabled),
      link_url: c.link_url || '',
      link_label: c.link_label || sj.linkLabel || '',
      link_new_tab: Boolean(c.link_new_tab),
      altText: sj.altText || '',
      borderColor: sj.borderColor || '#B08D45',
      borderWidth: sj.borderWidth || 0,
      borderRadius: sj.borderRadius ?? 10,
      glowColor: sj.glowColor || '',
      imageFocalPoint: sj.imageFocalPoint || 'center',
    });
  };

  const handleUploadNewImage = async (file: File) => {
    try {
      const res = await uploadFileInChunks(file);
      const imagesPage = pages.find((p) => p.slug === 'images');
      const createRes = await fetch('/api/admin/content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: file.name.replace(/\.[^.]+$/, ''),
          content_type: 'image',
          status: 'published',
          page_id: imagesPage?.id || null,
          media_file_id: res.media.id,
          media_url: res.media.public_url,
          thumbnail_url: res.media.public_url,
        }),
      });
      const created = await createRes.json();
      await refreshAll();
      await refreshBootstrap();
      if (created.item) selectImageItem(created.item);
      notify('تم رفع الصورة وإنشاء سجلها بنجاح');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل رفع الصورة', 'error');
    }
  };

  const createItemFromMedia = async (m: typeof imageMedia[number]) => {
    const imagesPage = pages.find((p) => p.slug === 'images');
    const createRes = await fetch('/api/admin/content', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        title: m.original_name.replace(/\.[^.]+$/, ''),
        content_type: 'image',
        status: 'published',
        page_id: imagesPage?.id || null,
        media_file_id: m.id,
        media_url: m.public_url,
        thumbnail_url: m.public_url,
      }),
    });
    const created = await createRes.json();
    await refreshAll();
    await refreshBootstrap();
    if (created.item) selectImageItem(created.item);
    notify('تم تحويل الصورة لمنشور قابل للتخصيص والربط');
  };

  const saveImageItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;
    setSaving(true);
    try {
      let existingSj: any = {};
      try {
        existingSj = JSON.parse(selectedItem.settings_json || '{}');
      } catch {
        existingSj = {};
      }
      const res = await fetch(`/api/admin/content/${selectedItem.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: editState.title,
          description: editState.description,
          page_id: editState.page_id ? Number(editState.page_id) : null,
          child_page_id: editState.child_page_id ? Number(editState.child_page_id) : null,
          status: editState.status,
          link_enabled: editState.link_enabled,
          link_url: editState.link_url,
          link_label: editState.link_label,
          link_new_tab: editState.link_new_tab,
          settings: {
            ...existingSj,
            altText: editState.altText,
            linkLabel: editState.link_label,
            borderColor: editState.borderColor,
            borderWidth: editState.borderWidth,
            borderRadius: editState.borderRadius,
            glowColor: editState.glowColor,
            imageFocalPoint: editState.imageFocalPoint,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل الحفظ');
      await refreshAll();
      await refreshBootstrap();
      setSelectedItem(data.item);
      notify('تم حفظ خصائص الصورة ورابط الانتقال بنجاح');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'خطأ في الحفظ', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <AdminPanelHeader
        title="مكتبة الصور والوسائط والصور القابلة للنقر"
        subtitle="إدارة الصور والمعارض، ربط كل صورة برابط وجهة مخصص ونص للرابط عند النقر، وتخصيص الحدود والتأثيرات البصرية."
        actions={
          <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer">
            <Upload size={14} />
            <span>رفع ونشر صورة</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadNewImage(f);
              }}
            />
          </label>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-7 space-y-6">
          <AdminCard title={`منشورات الصور (${imageContent.length})`}>
            {imageContent.length === 0 ? (
              <p className="py-8 text-center text-xs text-neutral-500">
                لا توجد صور منشورة بعد. استخدم زر "رفع ونشر صورة" أعلاه.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {imageContent.map((img) => (
                  <div
                    key={img.id}
                    onClick={() => selectImageItem(img)}
                    className={`rounded-xl border overflow-hidden cursor-pointer transition-all ${
                      selectedItem?.id === img.id
                        ? 'border-[#B08D45] ring-2 ring-[#B08D45]/25'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="aspect-video bg-neutral-100 relative">
                      {(img.thumbnail_url || img.media_url) && (
                        <img
                          src={img.thumbnail_url || img.media_url}
                          alt={img.title}
                          className="w-full h-full object-cover"
                        />
                      )}
                      {img.link_enabled ? (
                        <span className="absolute top-2 left-2 bg-[#8C6A2F] text-white text-[10px] px-2 py-0.5 rounded inline-flex items-center gap-1">
                          <Link2 size={10} /> مرتبطة برابط
                        </span>
                      ) : null}
                    </div>
                    <div className="p-3 bg-white">
                      <div className="text-xs font-bold text-neutral-900 truncate">{img.title}</div>
                      <div className="text-[11px] text-neutral-500 mt-0.5 truncate">
                        {img.link_enabled && img.link_url ? img.link_url : 'بدون رابط خارجي'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>

          <AdminCard title={`ملفات الصور الخام في التخزين (${imageMedia.length})`}>
            {imageMedia.length === 0 ? (
              <p className="py-6 text-center text-xs text-neutral-500">لا توجد ملفات صور خام.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {imageMedia.map((m) => (
                  <div key={m.id} className="rounded-lg border border-neutral-200 overflow-hidden bg-white">
                    <img src={m.public_url} alt={m.original_name} className="aspect-square w-full object-cover" />
                    <div className="p-2 flex items-center justify-between gap-1 text-[11px]">
                      <button
                        type="button"
                        onClick={() => createItemFromMedia(m)}
                        className="text-[#8C6A2F] font-bold hover:underline cursor-pointer"
                      >
                        نشر كصورة
                      </button>
                      <span className="text-neutral-400">{formatBytes(m.file_size)}</span>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await fetch(`/api/admin/media/${m.id}`, {
                            method: 'DELETE',
                            credentials: 'include',
                          });
                          const data = await res.json().catch(() => ({}));
                          if (res.status === 409 && data.inUse) {
                            setDeleteConflict({
                              id: m.id,
                              name: m.original_name,
                              message: data.error || 'هذه الصورة مرتبطة بمواد منشورة حالياً.',
                              references: Array.isArray(data.references) ? data.references : [],
                            });
                            return;
                          }
                          if (!res.ok) {
                            notify(data.error || 'تعذر حذف الملف', 'error');
                            return;
                          }
                          await refreshAll();
                          notify('تم حذف الملف');
                        }}
                        className="text-red-600 hover:text-red-800 cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminCard>
        </div>

        <AdminCard
          title={selectedItem ? `تحرير الصورة: ${selectedItem.title}` : 'خصائص الصورة ورابط النقر'}
          className="xl:col-span-5"
        >
          {!selectedItem ? (
            <div className="py-16 text-center text-xs text-neutral-500 space-y-2">
              <ImageIcon size={28} className="mx-auto text-neutral-400" />
              <p>اختر صورة من القائمة لتعديل خصائصها ورابط الانتقال عند النقر.</p>
            </div>
          ) : (
            <form onSubmit={saveImageItem} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">العنوان</label>
                <input
                  type="text"
                  value={editState.title}
                  onChange={(e) => setEditState({ ...editState, title: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">الوصف</label>
                <textarea
                  rows={2}
                  value={editState.description}
                  onChange={(e) => setEditState({ ...editState, description: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">النص البديل لإتاحة الوصول (Alt Text)</label>
                <input
                  type="text"
                  value={editState.altText}
                  onChange={(e) => setEditState({ ...editState, altText: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                />
              </div>

              <div className="p-3.5 rounded-xl border border-[#E8E0D0] bg-[#F7F4EC]/60 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="inline-flex items-center gap-2 text-xs font-bold text-neutral-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editState.link_enabled}
                      onChange={(e) => setEditState({ ...editState, link_enabled: e.target.checked })}
                      className="accent-[#B08D45]"
                    />
                    <span>تفعيل النقر على الصورة لفتح رابط مخصص</span>
                  </label>
                  {editState.link_enabled && editState.link_url && (
                    <button
                      type="button"
                      onClick={() =>
                        setEditState({ ...editState, link_enabled: false, link_url: '', link_label: '' })
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 cursor-pointer"
                    >
                      <Unlink size={11} /> إزالة الرابط
                    </button>
                  )}
                </div>

                {editState.link_enabled && (
                  <>
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                        عنوان الوجهة (URL)
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={editState.link_url}
                        onChange={(e) => setEditState({ ...editState, link_url: e.target.value })}
                        placeholder="https://... أو /p/videos"
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-neutral-700 mb-1">
                        نص الرابط الظاهر للزوار (اختياري)
                      </label>
                      <input
                        type="text"
                        value={editState.link_label}
                        onChange={(e) => setEditState({ ...editState, link_label: e.target.value })}
                        placeholder="مثال: الانتقال إلى التقرير الكامل"
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editState.link_new_tab}
                          onChange={(e) =>
                            setEditState({ ...editState, link_new_tab: e.target.checked })
                          }
                          className="accent-[#B08D45]"
                        />
                        <span>فتح في تبويب جديد</span>
                      </label>
                      {editState.link_url && (
                        <a
                          href={editState.link_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-bold text-[#8C6A2F] hover:underline"
                        >
                          <span>معاينة واختبار الوجهة</span>
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <ColorField
                  label="لون الإطار"
                  value={editState.borderColor}
                  onChange={(v) => setEditState({ ...editState, borderColor: v })}
                />
                <ColorField
                  label="لون التوهج (Glow)"
                  value={editState.glowColor}
                  onChange={(v) => setEditState({ ...editState, glowColor: v })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">سماكة الإطار (px)</label>
                  <input
                    type="number"
                    min={0}
                    max={12}
                    value={editState.borderWidth}
                    onChange={(e) =>
                      setEditState({ ...editState, borderWidth: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">استدارة الحواف (px)</label>
                  <input
                    type="number"
                    min={0}
                    max={32}
                    value={editState.borderRadius}
                    onChange={(e) =>
                      setEditState({ ...editState, borderRadius: Number(e.target.value) })
                    }
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">نقطة التركيز (Focal Point)</label>
                <select
                  value={editState.imageFocalPoint}
                  onChange={(e) => setEditState({ ...editState, imageFocalPoint: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="center">المنتصف (Center)</option>
                  <option value="top">الأعلى (Top)</option>
                  <option value="bottom">الأسفل (Bottom)</option>
                  <option value="right">اليمين (Right)</option>
                  <option value="left">اليسار (Left)</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] cursor-pointer"
              >
                {saving ? 'جاري الحفظ...' : 'حفظ خصائص الصورة'}
              </button>
            </form>
          )}
        </AdminCard>
      </div>

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
                <span>تحذير: الصورة مرتبطة بمحتوى منشور</span>
              </div>
              <button type="button" onClick={() => setDeleteConflict(null)} className="cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="text-xs text-neutral-700 space-y-2">
              <p className="font-semibold">{deleteConflict.message}</p>
              <p className="text-neutral-500">الملف: {deleteConflict.name}</p>
              {deleteConflict.references.length > 0 && (
                <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-1.5 max-h-48 overflow-y-auto">
                  {deleteConflict.references.map((r, i) => (
                    <div key={i} className="text-[11px] flex items-center justify-between gap-2">
                      <span className="font-bold text-neutral-800">{r.title}</span>
                      <span className="text-neutral-500">{r.location}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConflict(null)}
                className="px-4 py-2 rounded-lg border border-neutral-300 text-xs font-semibold cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  const res = await fetch(`/api/admin/media/${deleteConflict.id}?force=1`, {
                    method: 'DELETE',
                    credentials: 'include',
                  });
                  setDeleteConflict(null);
                  if (res.ok) {
                    await refreshAll();
                    notify('تم حذف الصورة وفك ارتباطها');
                  } else {
                    notify('تعذر حذف الصورة', 'error');
                  }
                }}
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
