import React, { useEffect, useState } from 'react';
import { KeyRound, LayoutDashboard, Upload } from 'lucide-react';
import { AdminCard, AdminPanelHeader, ColorField, GradientEditor } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { uploadFileInChunks } from '../../../lib/uploadClient';
import { buildGradientCss } from '../../../lib/styleEngine';
import type { AllSettings } from '../../../types/platform';

export function AdminPortalCustomizer() {
  const { settings, previousSettings, saveCategory, resetCategory, notify } = useAdmin();
  const [subTab, setSubTab] = useState<'admin' | 'login'>('admin');
  const [adminTheme, setAdminTheme] = useState<AllSettings['adminTheme'] | null>(null);
  const [loginTheme, setLoginTheme] = useState<AllSettings['loginTheme'] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setAdminTheme(structuredClone(settings.adminTheme));
      setLoginTheme(structuredClone(settings.loginTheme));
    }
  }, [settings]);

  if (!settings || !adminTheme || !loginTheme) return null;

  const applyPreset = (mode: 'default' | 'light' | 'dark') => {
    if (mode === 'light') {
      setAdminTheme({
        ...adminTheme,
        mode: 'light',
        sidebarBg: '#FFFFFF',
        sidebarText: '#171717',
        sidebarIconColor: '#B08D45',
        activeMenuBg: '#B08D45',
        activeMenuText: '#FFFFFF',
        hoverBg: '#F7F4EC',
        sidebarHeaderBg: '#8C6A2F',
        mainBg: '#F7F4EC',
        cardBg: '#FFFFFF',
        cardBorder: '#E8E0D0',
      });
    } else if (mode === 'dark') {
      setAdminTheme({
        ...adminTheme,
        mode: 'dark',
        sidebarBg: '#080808',
        sidebarText: '#E5E7EB',
        sidebarIconColor: '#D4AF65',
        activeMenuBg: '#B08D45',
        activeMenuText: '#FFFFFF',
        hoverBg: '#1F1F1F',
        sidebarHeaderBg: '#8C6A2F',
        mainBg: '#111111',
        cardBg: '#FFFFFF',
        cardBorder: '#E8E0D0',
      });
    } else {
      setAdminTheme({
        ...adminTheme,
        mode: 'default',
        sidebarBg: '#151515',
        sidebarText: '#E5E7EB',
        sidebarIconColor: '#D4AF65',
        activeMenuBg: '#B08D45',
        activeMenuText: '#FFFFFF',
        hoverBg: '#222222',
        sidebarHeaderBg: '#8C6A2F',
        mainBg: '#F7F4EC',
        cardBg: '#FFFFFF',
        cardBorder: '#E8E0D0',
      });
    }
  };

  const handleUploadLoginBg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await uploadFileInChunks(file);
      setLoginTheme({ ...loginTheme, bgImageUrl: res.media.public_url });
      notify('تم رفع صورة خلفية شاشة الدخول');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'فشل الرفع', 'error');
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (subTab === 'admin') {
        await saveCategory('adminTheme', adminTheme, 'تخصيص مظهر لوحة التحكم');
      } else {
        await saveCategory('loginTheme', loginTheme, 'تخصيص شاشة تسجيل الدخول');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (subTab === 'admin') {
      setAdminTheme(structuredClone(settings.adminTheme));
    } else {
      setLoginTheme(structuredClone(settings.loginTheme));
    }
    notify('تم إلغاء التعديلات غير المحفوظة', 'info');
  };

  const handleRevertPrevious = () => {
    if (subTab === 'admin') {
      const prev = previousSettings.adminTheme as AllSettings['adminTheme'] | undefined;
      if (!prev) return;
      setAdminTheme(structuredClone(prev));
    } else {
      const prev = previousSettings.loginTheme as AllSettings['loginTheme'] | undefined;
      if (!prev) return;
      setLoginTheme(structuredClone(prev));
    }
    notify('تمت استعادة المظهر السابق في المعاينة؛ اضغط «حفظ وتطبيق التغييرات» لتثبيته', 'info');
  };

  const hasUnsavedChanges =
    subTab === 'admin'
      ? JSON.stringify(adminTheme) !== JSON.stringify(settings.adminTheme)
      : JSON.stringify(loginTheme) !== JSON.stringify(settings.loginTheme);
  const hasPreviousSnapshot = Boolean(
    subTab === 'admin' ? previousSettings.adminTheme : previousSettings.loginTheme
  );

  return (
    <div>
      <AdminPanelHeader
        title="تخصيص بوابة الإدارة وشاشة الدخول"
        subtitle="التحكم الكامل في القائمة الجانبية ومساحة العمل الإدارية، وكذلك خلفية وبطاقة وحقول شاشة دخول المالك"
        onSave={handleSave}
        onCancel={handleCancel}
        onRevertPrevious={handleRevertPrevious}
        onReset={() => resetCategory(subTab === 'admin' ? 'adminTheme' : 'loginTheme')}
        saving={saving}
        hasUnsavedChanges={hasUnsavedChanges}
        hasPreviousSnapshot={hasPreviousSnapshot}
      />

      <div className="flex gap-2 mb-5">
        <button
          type="button"
          onClick={() => setSubTab('admin')}
          className={`px-4 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
            subTab === 'admin'
              ? 'bg-[#B08D45] text-white border-[#B08D45]'
              : 'bg-white text-neutral-700 border-neutral-300'
          }`}
        >
          تخصيص لوحة التحكم والسايدبار
        </button>
        <button
          type="button"
          onClick={() => setSubTab('login')}
          className={`px-4 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
            subTab === 'login'
              ? 'bg-[#B08D45] text-white border-[#B08D45]'
              : 'bg-white text-neutral-700 border-neutral-300'
          }`}
        >
          تخصيص شاشة دخول المالك
        </button>
      </div>

      {subTab === 'admin' ? (
        <div className="space-y-5">
          <AdminCard title="معاينة فورية لمساحة عمل لوحة التحكم">
            <div
              className="rounded-xl border border-neutral-200 overflow-hidden grid grid-cols-12 min-h-[190px]"
              style={{ backgroundColor: adminTheme.mainBg }}
            >
              <div
                className="col-span-4 sm:col-span-3 flex flex-col border-l border-black/10"
                style={{ backgroundColor: adminTheme.sidebarBg, color: adminTheme.sidebarText }}
              >
                <div className="p-2.5" style={{ backgroundColor: adminTheme.sidebarHeaderBg }}>
                  <div className="text-xs font-extrabold text-white truncate">{adminTheme.sidebarTitle || 'لوحة الإدارة'}</div>
                  <div className="text-[10px] text-white/80 truncate">{adminTheme.sidebarSubtitle || 'نظام إدارة المحتوى'}</div>
                </div>
                <div className="p-2 space-y-1">
                  <div
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded font-bold"
                    style={{
                      backgroundColor: adminTheme.activeMenuBg,
                      color: adminTheme.activeMenuText,
                      fontSize: Math.min(adminTheme.menuFontSize || 13, 14),
                    }}
                  >
                    <LayoutDashboard size={12} />
                    <span>العنصر النشط</span>
                  </div>
                  <div
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded"
                    style={{ fontSize: Math.min(adminTheme.menuFontSize || 13, 14) }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: adminTheme.sidebarIconColor }} />
                    <span>إدارة المحتوى</span>
                  </div>
                  <div
                    className="flex items-center gap-1.5 px-2 py-1.5 rounded"
                    style={{
                      backgroundColor: adminTheme.hoverBg,
                      fontSize: Math.min(adminTheme.menuFontSize || 13, 14),
                    }}
                  >
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: adminTheme.sidebarIconColor }} />
                    <span>حالة التمرير</span>
                  </div>
                </div>
              </div>
              <div className="col-span-8 sm:col-span-9 p-4">
                <div
                  className="rounded-xl p-3 border"
                  style={{ backgroundColor: adminTheme.cardBg, borderColor: adminTheme.cardBorder }}
                >
                  <div className="text-xs font-bold text-neutral-800 mb-1">بطاقة عمل نموذجية</div>
                  <div className="text-[11px] text-neutral-500">
                    عرض القائمة: {adminTheme.sidebarWidth}px • حجم خط القائمة: {adminTheme.menuFontSize}px
                  </div>
                </div>
              </div>
            </div>
          </AdminCard>

          <AdminCard title="قوالب سريعة للوحة التحكم">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => applyPreset('default')}
                className="px-3 py-1.5 rounded-lg border border-neutral-300 text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
              >
                القالب المؤسسي الافتراضي (داكن جانبي + خلفية فاتحة)
              </button>
              <button
                type="button"
                onClick={() => applyPreset('light')}
                className="px-3 py-1.5 rounded-lg border border-neutral-300 text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
              >
                النمط الفاتح الكامل
              </button>
              <button
                type="button"
                onClick={() => applyPreset('dark')}
                className="px-3 py-1.5 rounded-lg border border-neutral-300 text-xs font-semibold hover:bg-neutral-50 cursor-pointer"
              >
                النمط الداكن المتباين
              </button>
            </div>
          </AdminCard>

          <AdminCard title="تخصيص القائمة الجانبية (Sidebar) والمحتوى">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              <ColorField label="خلفية القائمة الجانبية" value={adminTheme.sidebarBg} onChange={(c) => setAdminTheme({ ...adminTheme, sidebarBg: c, mode: 'custom' })} />
              <ColorField label="خلفية ترويسة القائمة" value={adminTheme.sidebarHeaderBg} onChange={(c) => setAdminTheme({ ...adminTheme, sidebarHeaderBg: c, mode: 'custom' })} />
              <ColorField label="لون نص القائمة" value={adminTheme.sidebarText} onChange={(c) => setAdminTheme({ ...adminTheme, sidebarText: c, mode: 'custom' })} />
              <ColorField label="لون أيقونات القائمة" value={adminTheme.sidebarIconColor} onChange={(c) => setAdminTheme({ ...adminTheme, sidebarIconColor: c, mode: 'custom' })} />
              <ColorField label="خلفية العنصر النشط" value={adminTheme.activeMenuBg} onChange={(c) => setAdminTheme({ ...adminTheme, activeMenuBg: c, mode: 'custom' })} />
              <ColorField label="نص العنصر النشط" value={adminTheme.activeMenuText} onChange={(c) => setAdminTheme({ ...adminTheme, activeMenuText: c, mode: 'custom' })} />
              <ColorField label="خلفية التمرير (Hover)" value={adminTheme.hoverBg} onChange={(c) => setAdminTheme({ ...adminTheme, hoverBg: c, mode: 'custom' })} />
              <ColorField label="خلفية مساحة العمل" value={adminTheme.mainBg} onChange={(c) => setAdminTheme({ ...adminTheme, mainBg: c, mode: 'custom' })} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">عرض القائمة الجانبية (px)</label>
                <input
                  type="number"
                  min={220}
                  max={360}
                  value={adminTheme.sidebarWidth}
                  onChange={(e) => setAdminTheme({ ...adminTheme, sidebarWidth: Number(e.target.value) })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">حجم خط القائمة (px)</label>
                <input
                  type="number"
                  min={11}
                  max={18}
                  value={adminTheme.menuFontSize}
                  onChange={(e) => setAdminTheme({ ...adminTheme, menuFontSize: Number(e.target.value) })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">عنوان الترويسة</label>
                <input
                  type="text"
                  value={adminTheme.sidebarTitle}
                  onChange={(e) => setAdminTheme({ ...adminTheme, sidebarTitle: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">الوصف الفرعي</label>
                <input
                  type="text"
                  value={adminTheme.sidebarSubtitle}
                  onChange={(e) => setAdminTheme({ ...adminTheme, sidebarSubtitle: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                />
              </div>
            </div>
          </AdminCard>
        </div>
      ) : (
        <div className="space-y-5">
          <AdminCard title="معاينة فورية لشاشة دخول المالك (التحقق المزدوج)">
            <div
              className={`rounded-xl border border-neutral-200 p-6 flex items-center min-h-[240px] bg-cover bg-center ${
                loginTheme.cardPosition === 'right'
                  ? 'justify-start'
                  : loginTheme.cardPosition === 'left'
                    ? 'justify-end'
                    : 'justify-center'
              }`}
              style={{
                backgroundColor: loginTheme.bgColor,
                backgroundImage: loginTheme.bgImageUrl
                  ? `url(${loginTheme.bgImageUrl})`
                  : loginTheme.gradient?.enabled
                    ? buildGradientCss(loginTheme.gradient)
                    : undefined,
              }}
            >
              <div
                className="p-4 shadow-lg border border-black/10 w-full space-y-2.5"
                style={{
                  backgroundColor: loginTheme.cardBg,
                  borderRadius: `${loginTheme.cardRadius}px`,
                  maxWidth: `${Math.min(loginTheme.cardWidth || 380, 340)}px`,
                }}
              >
                <div className="flex items-center gap-2">
                  <KeyRound size={16} style={{ color: loginTheme.buttonBg }} />
                  <div>
                    <div className="text-xs font-extrabold text-neutral-900">{loginTheme.title}</div>
                    <div className="text-[10px] text-neutral-500">{loginTheme.subtitle}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className="rounded px-2 py-1.5 text-[11px] font-mono border"
                    style={{
                      backgroundColor: loginTheme.inputBg,
                      color: loginTheme.inputText,
                      borderColor: loginTheme.inputBorder,
                    }}
                  >
                    ••••••
                  </div>
                  <div
                    className="rounded px-2 py-1.5 text-[11px] font-mono border"
                    style={{
                      backgroundColor: loginTheme.inputBg,
                      color: loginTheme.inputText,
                      borderColor: loginTheme.inputBorder,
                    }}
                  >
                    ••••••
                  </div>
                </div>
                <div className="text-[10px] font-semibold" style={{ color: loginTheme.errorColor }}>
                  مثال تنبيه خطأ التحقق
                </div>
                <button
                  type="button"
                  className="w-full py-1.5 rounded text-xs font-bold"
                  style={{ backgroundColor: loginTheme.buttonBg, color: loginTheme.buttonText }}
                >
                  دخول آمن
                </button>
              </div>
            </div>
          </AdminCard>

          <AdminCard title="خلفية ومظهر شاشة دخول المالك">
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">عنوان شاشة الدخول</label>
                  <input
                    type="text"
                    value={loginTheme.title}
                    onChange={(e) => setLoginTheme({ ...loginTheme, title: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">العنوان الفرعي</label>
                  <input
                    type="text"
                    value={loginTheme.subtitle}
                    onChange={(e) => setLoginTheme({ ...loginTheme, subtitle: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">موضع البطاقة</label>
                  <select
                    value={loginTheme.cardPosition}
                    onChange={(e) => setLoginTheme({ ...loginTheme, cardPosition: e.target.value as any })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs"
                  >
                    <option value="center">المنتصف</option>
                    <option value="right">اليمين</option>
                    <option value="left">اليسار</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ColorField label="خلفية الشاشة" value={loginTheme.bgColor} onChange={(c) => setLoginTheme({ ...loginTheme, bgColor: c })} />
                <ColorField label="خلفية البطاقة" value={loginTheme.cardBg} onChange={(c) => setLoginTheme({ ...loginTheme, cardBg: c })} />
                <ColorField label="لون زر الدخول" value={loginTheme.buttonBg} onChange={(c) => setLoginTheme({ ...loginTheme, buttonBg: c })} />
                <ColorField label="لون نص الزر" value={loginTheme.buttonText} onChange={(c) => setLoginTheme({ ...loginTheme, buttonText: c })} />
                <ColorField label="خلفية الحقول" value={loginTheme.inputBg} onChange={(c) => setLoginTheme({ ...loginTheme, inputBg: c })} />
                <ColorField label="نص الحقول" value={loginTheme.inputText} onChange={(c) => setLoginTheme({ ...loginTheme, inputText: c })} />
                <ColorField label="حدود الحقول" value={loginTheme.inputBorder} onChange={(c) => setLoginTheme({ ...loginTheme, inputBorder: c })} />
                <ColorField label="لون الخطأ" value={loginTheme.errorColor} onChange={(c) => setLoginTheme({ ...loginTheme, errorColor: c })} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">عرض البطاقة (px)</label>
                  <input
                    type="number"
                    min={320}
                    max={640}
                    value={loginTheme.cardWidth}
                    onChange={(e) => setLoginTheme({ ...loginTheme, cardWidth: Number(e.target.value) })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">استدارة البطاقة (px)</label>
                  <input
                    type="number"
                    min={0}
                    max={36}
                    value={loginTheme.cardRadius}
                    onChange={(e) => setLoginTheme({ ...loginTheme, cardRadius: Number(e.target.value) })}
                    className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                  />
                </div>
                <label className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold cursor-pointer">
                  <Upload size={14} />
                  <span>رفع صورة خلفية للشاشة</span>
                  <input type="file" accept="image/*" onChange={handleUploadLoginBg} className="hidden" />
                </label>
              </div>

              <GradientEditor
                value={loginTheme.gradient}
                onChange={(g) => setLoginTheme({ ...loginTheme, gradient: g })}
                title="تدرج خلفية شاشة تسجيل الدخول"
              />
            </div>
          </AdminCard>
        </div>
      )}
    </div>
  );
}
