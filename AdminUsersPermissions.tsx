import React, { useEffect, useState } from 'react';
import { KeyRound, Plus, Save, Shield, Trash2 } from 'lucide-react';
import { AdminCard, AdminPanelHeader } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';

const PERMISSION_KEYS = [
  { key: 'view', label: 'عرض لوحة التحكم والإحصاءات والتشخيص' },
  { key: 'create', label: 'إنشاء مواد وصفحات ومسارات جديدة' },
  { key: 'edit', label: 'تعديل المحتوى والصفحات والترجمات' },
  { key: 'delete', label: 'حذف المواد والصفحات والملفات' },
  { key: 'publish', label: 'نشر المحتوى للعموم (publish)' },
  { key: 'unpublish', label: 'إلغاء النشر / إخفاء / أرشفة المحتوى' },
  { key: 'upload', label: 'رفع الملفات ومعالجة الوسائط' },
  { key: 'download', label: 'تنزيل النسخ الاحتياطية والإصدارات' },
  { key: 'manage_appearance', label: 'تعديل المظهر والألوان والخطوط والقوائم والمشغل' },
  { key: 'manage_code', label: 'إدارة وتنفيذ الأكواد والمكونات المخصصة' },
  { key: 'manage_backups', label: 'إنشاء واستعادة النسخ الاحتياطية والإصدارات' },
  { key: 'manage_security', label: 'إدارة الأمان وسجلات النشاط (حساس)' },
  { key: 'manage_users', label: 'إدارة المستخدمين والصلاحيات (حساس)' },
  { key: 'manage_settings', label: 'حفظ إعدادات المنصة العامة والبحث' },
];

const ROLE_PRESETS: Record<string, { label: string; perms: Record<string, boolean> }> = {
  editor: {
    label: 'محرر مسودات (بدون نشر)',
    perms: { view: true, create: true, edit: true, upload: true },
  },
  publisher: {
    label: 'ناشر ومراجع محتوى',
    perms: { view: true, create: true, edit: true, delete: true, publish: true, unpublish: true, upload: true },
  },
  designer: {
    label: 'مصمم الواجهة والمشغل',
    perms: { view: true, manage_appearance: true },
  },
  media_manager: {
    label: 'مسؤول الوسائط والتخزين',
    perms: { view: true, create: true, edit: true, upload: true, download: true, delete: true },
  },
  full_admin: {
    label: 'مدير كامل (ما عدا الأمان والمستخدمين)',
    perms: {
      view: true,
      create: true,
      edit: true,
      delete: true,
      publish: true,
      unpublish: true,
      upload: true,
      download: true,
      manage_appearance: true,
      manage_code: true,
      manage_backups: true,
      manage_settings: true,
    },
  },
};

interface RoleUser {
  id: number;
  username: string;
  display_name: string;
  role: string;
  permissions_json: string;
  has_passcode?: boolean;
  active: number;
  created_at: string;
}

export function AdminUsersPermissions() {
  const { notify } = useAdmin();
  const [users, setUsers] = useState<RoleUser[]>([]);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [role, setRole] = useState('editor');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editPerms, setEditPerms] = useState<Record<string, boolean>>({});
  const [editActive, setEditActive] = useState(true);
  const [editPasscode, setEditPasscode] = useState('');

  const loadUsers = async () => {
    const res = await fetch('/api/admin/users', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users || []);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const selectUser = (u: RoleUser) => {
    setSelectedId(u.id);
    setEditActive(Boolean(u.active));
    setEditPasscode('');
    try {
      setEditPerms(JSON.parse(u.permissions_json || '{}'));
    } catch {
      setEditPerms({});
    }
  };

  const handleCreate = async () => {
    if (!username.trim() || !displayName.trim()) {
      notify('اسم المستخدم والاسم الظاهر مطلوبان', 'error');
      return;
    }
    const presetPerms = ROLE_PRESETS[role]?.perms || { view: true, create: true, edit: true };
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        username: username.trim(),
        display_name: displayName.trim(),
        role,
        permissions: presetPerms,
        ...(passcode.trim() ? { passcode: passcode.trim() } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر إضافة الحساب', 'error');
      return;
    }
    notify('تمت إضافة الحساب الفرعي بنجاح');
    setUsername('');
    setDisplayName('');
    setPasscode('');
    await loadUsers();
  };

  const handleSavePerms = async () => {
    if (!selectedId) return;
    const target = users.find((u) => u.id === selectedId);
    if (!target) return;
    const res = await fetch(`/api/admin/users/${selectedId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        display_name: target.display_name,
        role: target.role,
        active: editActive,
        permissions: editPerms,
        ...(editPasscode.trim() ? { passcode: editPasscode.trim() } : {}),
      }),
    });
    if (res.ok) {
      notify('تم تحديث الصلاحيات وبيانات الحساب بنجاح');
      setEditPasscode('');
      await loadUsers();
    } else {
      const data = await res.json().catch(() => ({}));
      notify(data.error || 'تعذر تحديث الصلاحيات', 'error');
    }
  };

  const handleDelete = async (id: number) => {
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'include' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      notify(data.error || 'تعذر الحذف', 'error');
      return;
    }
    notify('تم حذف الحساب الفرعي');
    if (selectedId === id) setSelectedId(null);
    await loadUsers();
  };

  const selectedUser = users.find((u) => u.id === selectedId) || null;

  return (
    <div>
      <AdminPanelHeader
        title="مشرفو الإدارة والصلاحيات"
        subtitle="إدارة مشرفي لوحة الإدارة الفرعيين ومصفوفة الصلاحيات الخاصة بكل حساب"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="space-y-5">
          <AdminCard title="إضافة حساب أو دور تحريري">
            <div className="space-y-3">
              <input
                type="text"
                dir="ltr"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username (e.g. editor1)"
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-mono"
              />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="الاسم الظاهر (مثال: محرر الأخبار)"
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
              />
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                placeholder="رمز الدخول للحساب (اختياري للدخول المباشر)"
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
              />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
              >
                {Object.entries(ROLE_PRESETS).map(([k, p]) => (
                  <option key={k} value={k}>
                    {p.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleCreate}
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold cursor-pointer"
              >
                <Plus size={14} />
                <span>إضافة حساب</span>
              </button>
            </div>
          </AdminCard>

          <AdminCard title={`الحسابات المسجلة (${users.length})`}>
            <div className="space-y-2">
              {users.map((u) => (
                <div
                  key={u.id}
                  onClick={() => selectUser(u)}
                  className={`p-3 rounded-lg border cursor-pointer flex items-center justify-between gap-2 ${
                    selectedId === u.id
                      ? 'border-[#B08D45] bg-[#F7F4EC]'
                      : 'border-neutral-200 bg-white hover:bg-neutral-50'
                  }`}
                >
                  <div>
                    <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      <Shield size={13} className="text-[#B08D45]" />
                      <span>{u.display_name}</span>
                    </div>
                    <div className="text-[11px] text-neutral-500 flex items-center gap-1.5 mt-0.5">
                      <span>@{u.username} · {u.role} · {u.active ? 'نشط' : 'موقوف'}</span>
                      {u.username !== 'owner' && (
                        <span className={u.has_passcode ? 'text-[#8C6A2F] font-semibold' : 'text-neutral-400'}>
                          · {u.has_passcode ? 'مفعّل بكلمة مرور' : 'بدون رمز دخول'}
                        </span>
                      )}
                    </div>
                  </div>
                  {u.username !== 'owner' && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(u.id);
                      }}
                      className="text-red-600 p-1 hover:bg-red-50 rounded cursor-pointer"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </AdminCard>
        </div>

        <div className="lg:col-span-2">
          {selectedUser ? (
            <AdminCard title={`مصفوفة الصلاحيات: ${selectedUser.display_name}`}>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={selectedUser.username === 'owner'}
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="accent-[#B08D45]"
                  />
                  <span>الحساب مفعّل ونشط</span>
                </label>
                {selectedUser.username === 'owner' ? (
                  <span className="text-xs font-semibold text-[#8C6A2F]">
                    المالك الرئيسي يمتلك كامل الصلاحيات بشكل دائم
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <KeyRound size={13} className="text-neutral-400" />
                    <input
                      type="password"
                      value={editPasscode}
                      onChange={(e) => setEditPasscode(e.target.value)}
                      placeholder={selectedUser.has_passcode ? 'تعيين رمز دخول جديد...' : 'إضافة رمز دخول للحساب...'}
                      className="rounded-lg border border-neutral-300 px-2.5 py-1 text-xs"
                    />
                  </div>
                )}
              </div>

              {selectedUser.username !== 'owner' && (
                <div className="mb-4 flex flex-wrap items-center gap-1.5 pb-3 border-b border-neutral-100">
                  <span className="text-[11px] font-bold text-neutral-600 ml-1">قوالب جاهزة:</span>
                  {Object.entries(ROLE_PRESETS).map(([k, preset]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setEditPerms({ ...preset.perms })}
                      className="px-2.5 py-1 rounded-lg border border-neutral-300 bg-white text-[11px] font-semibold hover:border-[#B08D45] hover:text-[#8C6A2F] cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-5">
                {PERMISSION_KEYS.map((perm) => (
                  <label
                    key={perm.key}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-neutral-200 bg-neutral-50 text-xs font-semibold cursor-pointer"
                  >
                    <span>{perm.label}</span>
                    <input
                      type="checkbox"
                      disabled={selectedUser.username === 'owner'}
                      checked={selectedUser.username === 'owner' ? true : Boolean(editPerms[perm.key])}
                      onChange={(e) =>
                        setEditPerms({ ...editPerms, [perm.key]: e.target.checked })
                      }
                      className="accent-[#B08D45]"
                    />
                  </label>
                ))}
              </div>

              {selectedUser.username !== 'owner' && (
                <button
                  type="button"
                  onClick={handleSavePerms}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B08D45] hover:bg-[#8C6A2F] text-white text-xs font-bold cursor-pointer"
                >
                  <Save size={14} />
                  <span>حفظ الصلاحيات والبيانات</span>
                </button>
              )}
            </AdminCard>
          ) : (
            <AdminCard>
              <p className="text-xs text-neutral-500 py-10 text-center">
                اختر حساباً من القائمة لعرض أو تعديل مصفوفة الصلاحيات.
              </p>
            </AdminCard>
          )}
        </div>
      </div>
    </div>
  );
}
