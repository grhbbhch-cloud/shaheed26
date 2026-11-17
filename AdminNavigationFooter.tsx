import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, Eye, EyeOff, Monitor, Plus, Search, Smartphone, Trash2 } from 'lucide-react';
import { AdminCard, AdminPanelHeader, ColorField } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import type { AllSettings, NavItemConfig } from '../../../types/platform';

export function AdminNavigationFooter() {
  const { settings, previousSettings, saveCategory, resetCategory, notify } = useAdmin();
  const [nav, setNav] = useState<AllSettings['navigation'] | null>(null);
  const [footer, setFooter] = useState<AllSettings['footer'] | null>(null);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings?.navigation) setNav(structuredClone(settings.navigation));
    if (settings?.footer) setFooter(structuredClone(settings.footer));
  }, [settings?.navigation, settings?.footer]);

  if (!settings || !nav || !footer) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('navigation', nav, 'تحديث القوائم والتنقل');
      await saveCategory('footer', footer, 'تحديث التذييل وروابطه');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setNav(structuredClone(settings.navigation));
    setFooter(structuredClone(settings.footer));
    notify('تم إلغاء التعديلات غير المحفوظة في التنقل والتذييل', 'info');
  };

  const handleRevertPrevious = () => {
    const prevNav = previousSettings.navigation as AllSettings['navigation'] | undefined;
    const prevFooter = previousSettings.footer as AllSettings['footer'] | undefined;
    if (!prevNav && !prevFooter) return;
    if (prevNav) setNav(structuredClone(prevNav));
    if (prevFooter) setFooter(structuredClone(prevFooter));
    notify('تمت استعادة الإعدادات السابقة في المعاينة؛ اضغط «حفظ وتطبيق التغييرات» لتثبيتها', 'info');
  };

  const hasUnsavedChanges =
    JSON.stringify(nav) !== JSON.stringify(settings.navigation) ||
    JSON.stringify(footer) !== JSON.stringify(settings.footer);
  const hasPreviousSnapshot = Boolean(previousSettings.navigation || previousSettings.footer);

  const addNavItem = (parentId?: string) => {
    const newItem: NavItemConfig = {
      id: `nav-${Date.now()}`,
      label: 'رابط جديد',
      url: '/p/posts',
      type: 'internal',
      icon: '',
      visible: true,
      order: nav.items.length + 1,
      openInNewTab: false,
      children: [],
    };
    if (!parentId) {
      setNav({ ...nav, items: [...nav.items, newItem] });
    } else {
      setNav({
        ...nav,
        items: nav.items.map((it) =>
          it.id === parentId ? { ...it, children: [...it.children, newItem] } : it
        ),
      });
    }
  };

  const moveNav = (idx: number, delta: number) => {
    const arr = [...nav.items];
    const target = idx + delta;
    if (target < 0 || target >= arr.length) return;
    const tmp = arr[idx];
    arr[idx] = arr[target];
    arr[target] = tmp;
    setNav({ ...nav, items: arr.map((it, i) => ({ ...it, order: i + 1 })) });
  };

  const addFooterLink = () => {
    setFooter({
      ...footer,
      links: [
        ...(footer.links || []),
        { id: `fl-${Date.now()}`, label: 'صفحة جديدة', url: '/p/about', openInNewTab: false, visible: true },
      ],
    });
  };

  const addSocialLink = () => {
    setFooter({
      ...footer,
      socialLinks: [
        ...(footer.socialLinks || []),
        { id: `sl-${Date.now()}`, platform: 'telegram', label: 'تلغرام', url: 'https://t.me/', icon: 'send', visible: true },
      ],
    });
  };

  const visibleNavItems = nav.items.filter((i) => i.visible);
  const visibleFooterLinks = (footer.links || []).filter((l) => l.visible);
  const visibleSocialLinks = (footer.socialLinks || []).filter((s) => s.visible);

  return (
    <div>
      <AdminPanelHeader
        title="إدارة القوائم والتنقل والتذييل"
        subtitle="التحكم الكامل بشريط التنقل العلوي، القوائم المنسدلة المتداخلة، ألوان الشريط، روابط التذييل ومنصات التواصل."
        onSave={handleSave}
        onCancel={handleCancel}
        onRevertPrevious={handleRevertPrevious}
        onReset={async () => {
          await resetCategory('navigation');
          await resetCategory('footer');
        }}
        saving={saving}
        hasUnsavedChanges={hasUnsavedChanges}
        hasPreviousSnapshot={hasPreviousSnapshot}
      />

      <div className="space-y-6">
        <AdminCard
          title="معاينة فورية لشريط التنقل والتذييل"
          subtitle="جرّب التبديل بين سطح المكتب والجوال أو النقر على القوائم المنسدلة قبل الحفظ"
        >
          <div className="space-y-3">
            <div className="flex justify-end">
              <div className="inline-flex rounded-lg border border-neutral-300 bg-neutral-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewDevice('desktop')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                    previewDevice === 'desktop' ? 'bg-[#B08D45] text-white' : 'text-neutral-600'
                  }`}
                >
                  <Monitor size={12} />
                  <span>سطح المكتب</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDevice('mobile')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer ${
                    previewDevice === 'mobile' ? 'bg-[#B08D45] text-white' : 'text-neutral-600'
                  }`}
                >
                  <Smartphone size={12} />
                  <span>الجوال</span>
                </button>
              </div>
            </div>

            <div
              className={`rounded-xl border border-neutral-200 overflow-hidden mx-auto transition-all ${
                previewDevice === 'mobile' ? 'max-w-[360px]' : 'w-full'
              }`}
            >
              {/* Navbar preview */}
              <div
                className="px-4 flex items-center flex-wrap border-b border-neutral-200/70"
                style={{
                  backgroundColor: nav.backgroundColor,
                  color: nav.textColor,
                  minHeight: Math.max(44, Math.min(nav.height || 64, 96)),
                  justifyContent:
                    nav.alignment === 'center'
                      ? 'center'
                      : nav.alignment === 'space-between'
                        ? 'space-between'
                        : 'flex-start',
                  gap: `${Math.min(nav.itemSpacing || 16, 32)}px`,
                }}
              >
                <span className="text-xs font-extrabold shrink-0">{settings.identity.siteName}</span>
                {previewDevice === 'desktop' ? (
                  <div className="flex items-center flex-wrap" style={{ gap: `${Math.min(nav.itemSpacing || 16, 32)}px` }}>
                    {visibleNavItems.map((it) => (
                      <div key={it.id} className="relative">
                        <button
                          type="button"
                          onClick={() => setOpenDropdownId(openDropdownId === it.id ? null : it.id)}
                          className="inline-flex items-center gap-1 text-xs font-semibold cursor-pointer py-1"
                        >
                          <span>{it.label}</span>
                          {it.children.length > 0 && <ChevronDown size={12} />}
                        </button>
                        {it.children.length > 0 && openDropdownId === it.id && (
                          <div
                            className="absolute right-0 top-full mt-1 rounded-lg shadow-lg border border-black/10 p-1.5 min-w-[140px] z-20"
                            style={{ backgroundColor: nav.dropdownBg, color: nav.dropdownText }}
                          >
                            {it.children.map((ch) => (
                              <div key={ch.id} className="px-2 py-1 text-[11px] rounded hover:bg-black/5">
                                {ch.label}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-[11px] opacity-80">قائمة الجوال ({visibleNavItems.length} روابط)</span>
                )}
                {settings.search.enabled && (
                  <span className="inline-flex items-center gap-1 text-[11px] opacity-80 ms-auto">
                    <Search size={13} />
                    <span>{settings.search.buttonLabel}</span>
                  </span>
                )}
              </div>

              <div className="bg-neutral-50/70 px-4 py-5 text-center text-[11px] text-neutral-400">
                منطقة محتوى الصفحة
              </div>

              {/* Footer preview */}
              {footer.enabled ? (
                <div
                  className="p-4 border-t"
                  style={{
                    backgroundColor: footer.backgroundColor,
                    color: footer.textColor,
                    borderColor: footer.separatorColor,
                  }}
                >
                  <div
                    className={
                      footer.layout === 'centered'
                        ? 'text-center space-y-2'
                        : footer.layout === 'minimal'
                          ? 'flex flex-wrap items-center justify-between gap-2'
                          : 'grid grid-cols-1 sm:grid-cols-3 gap-3'
                    }
                  >
                    <div>
                      {footer.showLogo && settings.identity.footerLogoUrl && (
                        <img src={settings.identity.footerLogoUrl} alt="" className="h-7 w-auto object-contain mb-1.5" />
                      )}
                      <p className="text-[11px] leading-relaxed opacity-90">{footer.text}</p>
                    </div>
                    {footer.layout !== 'minimal' && (
                      <div className="flex flex-wrap gap-2.5 text-[11px]" style={{ color: footer.linkColor }}>
                        {visibleFooterLinks.map((lnk) => (
                          <span key={lnk.id} className="underline/30">{lnk.label}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 text-[11px]" style={{ color: footer.linkColor }}>
                      {visibleSocialLinks.map((sl) => (
                        <span key={sl.id} className="px-2 py-0.5 rounded border border-current/25">
                          {sl.label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div
                    className="mt-3 pt-2 border-t text-[10px] opacity-80"
                    style={{ borderColor: footer.separatorColor }}
                  >
                    {footer.copyright}
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-neutral-100 text-center text-[11px] text-neutral-500">
                  التذييل معطّل حالياً
                </div>
              )}
            </div>
          </div>
        </AdminCard>

        <AdminCard title="مظهر وسلوك شريط التنقل">
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <ColorField
              label="خلفية شريط التنقل"
              value={nav.backgroundColor}
              onChange={(v) => setNav({ ...nav, backgroundColor: v })}
            />
            <ColorField
              label="لون الروابط"
              value={nav.textColor}
              onChange={(v) => setNav({ ...nav, textColor: v })}
            />
            <ColorField
              label="خلفية القائمة المنسدلة"
              value={nav.dropdownBg}
              onChange={(v) => setNav({ ...nav, dropdownBg: v })}
            />
            <ColorField
              label="نص القائمة المنسدلة"
              value={nav.dropdownText}
              onChange={(v) => setNav({ ...nav, dropdownText: v })}
            />
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">ارتفاع الشريط (px)</label>
              <input
                type="number"
                min={44}
                max={120}
                value={nav.height}
                onChange={(e) => setNav({ ...nav, height: Number(e.target.value) })}
                className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">التباعد بين الروابط (px)</label>
              <input
                type="number"
                min={8}
                max={48}
                value={nav.itemSpacing}
                onChange={(e) => setNav({ ...nav, itemSpacing: Number(e.target.value) })}
                className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">المحاذاة</label>
              <select
                value={nav.alignment}
                onChange={(e) => setNav({ ...nav, alignment: e.target.value as any })}
                className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
              >
                <option value="center">وسط (توسيط هندسي متوازن)</option>
                <option value="right">يمين</option>
                <option value="space-between">توزيع متباعد</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">فتح القوائم المنسدلة (سطح المكتب)</label>
              <select
                value={nav.desktopDropdownTrigger || 'hover'}
                onChange={(e) => setNav({ ...nav, desktopDropdownTrigger: e.target.value as any })}
                className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
              >
                <option value="hover">عند تمرير المؤشر (Hover)</option>
                <option value="click">عند النقر فقط (Click)</option>
                <option value="both">التمرير والنقر معاً</option>
              </select>
            </div>
          </div>
        </AdminCard>

        <AdminCard title="عناصر القائمة الرئيسية والقوائم المنسدلة">
          <div className="mb-3">
            <button
              type="button"
              onClick={() => addNavItem()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B08D45] text-white text-xs font-bold cursor-pointer"
            >
              <Plus size={14} /> إضافة عنصر قائمة
            </button>
          </div>
          <div className="space-y-3">
            {nav.items.map((item, idx) => (
              <div key={item.id} className="rounded-xl border border-neutral-200 p-3 bg-neutral-50 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    value={item.label}
                    onChange={(e) =>
                      setNav({
                        ...nav,
                        items: nav.items.map((x) =>
                          x.id === item.id ? { ...x, label: e.target.value } : x
                        ),
                      })
                    }
                    className="sm:col-span-4 rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-bold"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={item.url}
                    onChange={(e) =>
                      setNav({
                        ...nav,
                        items: nav.items.map((x) =>
                          x.id === item.id ? { ...x, url: e.target.value } : x
                        ),
                      })
                    }
                    className="sm:col-span-4 rounded border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                  <div className="sm:col-span-4 flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => addNavItem(item.id)}
                      className="px-2 py-1 rounded bg-white border border-neutral-300 text-[11px] font-semibold cursor-pointer"
                    >
                      + فرعي
                    </button>
                    <button type="button" onClick={() => moveNav(idx, -1)} className="p-1.5 cursor-pointer">
                      <ArrowUp size={13} />
                    </button>
                    <button type="button" onClick={() => moveNav(idx, 1)} className="p-1.5 cursor-pointer">
                      <ArrowDown size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNav({
                          ...nav,
                          items: nav.items.map((x) =>
                            x.id === item.id ? { ...x, visible: !x.visible } : x
                          ),
                        })
                      }
                      className="p-1.5 cursor-pointer"
                    >
                      {item.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNav({ ...nav, items: nav.items.filter((x) => x.id !== item.id) })
                      }
                      className="p-1.5 text-red-600 cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {item.children.length > 0 && (
                  <div className="pr-6 space-y-1.5 border-r-2 border-[#B08D45]/40">
                    {item.children.map((ch) => (
                      <div key={ch.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <input
                          type="text"
                          value={ch.label}
                          onChange={(e) =>
                            setNav({
                              ...nav,
                              items: nav.items.map((x) =>
                                x.id === item.id
                                  ? {
                                      ...x,
                                      children: x.children.map((c) =>
                                        c.id === ch.id ? { ...c, label: e.target.value } : c
                                      ),
                                    }
                                  : x
                              ),
                            })
                          }
                          className="sm:col-span-4 rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                        />
                        <input
                          type="text"
                          dir="ltr"
                          value={ch.url}
                          onChange={(e) =>
                            setNav({
                              ...nav,
                              items: nav.items.map((x) =>
                                x.id === item.id
                                  ? {
                                      ...x,
                                      children: x.children.map((c) =>
                                        c.id === ch.id ? { ...c, url: e.target.value } : c
                                      ),
                                    }
                                  : x
                              ),
                            })
                          }
                          className="sm:col-span-5 rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-mono"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setNav({
                              ...nav,
                              items: nav.items.map((x) =>
                                x.id === item.id
                                  ? { ...x, children: x.children.filter((c) => c.id !== ch.id) }
                                  : x
                              ),
                            })
                          }
                          className="p-1 text-red-600 cursor-pointer"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </AdminCard>

        <AdminCard title="إدارة تذييل الموقع (Footer) وروابطه">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-6">
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={footer.enabled}
                  onChange={(e) => setFooter({ ...footer, enabled: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>إظهار تذييل الموقع</span>
              </label>
              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={footer.showLogo}
                  onChange={(e) => setFooter({ ...footer, showLogo: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>إظهار الشعار في التذييل</span>
              </label>
              <div>
                <select
                  value={footer.layout}
                  onChange={(e) => setFooter({ ...footer, layout: e.target.value as any })}
                  className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1 text-xs"
                >
                  <option value="columns">أعمدة (3 أعمدة)</option>
                  <option value="centered">متمركز بالوسط</option>
                  <option value="minimal">مختصر</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">النص التعريفي في التذييل</label>
                <textarea
                  rows={2}
                  value={footer.text}
                  onChange={(e) => setFooter({ ...footer, text: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">نص حقوق النشر</label>
                <input
                  type="text"
                  value={footer.copyright}
                  onChange={(e) => setFooter({ ...footer, copyright: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-1.5 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <ColorField
                label="خلفية التذييل"
                value={footer.backgroundColor}
                onChange={(v) => setFooter({ ...footer, backgroundColor: v })}
              />
              <ColorField
                label="لون النص"
                value={footer.textColor}
                onChange={(v) => setFooter({ ...footer, textColor: v })}
              />
              <ColorField
                label="لون الروابط"
                value={footer.linkColor}
                onChange={(v) => setFooter({ ...footer, linkColor: v })}
              />
              <ColorField
                label="لون الفاصل"
                value={footer.separatorColor}
                onChange={(v) => setFooter({ ...footer, separatorColor: v })}
              />
            </div>

            {/* Footer Links CRUD */}
            <div className="pt-4 border-t border-neutral-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800">روابط التذييل السريعة</span>
                <button
                  type="button"
                  onClick={addFooterLink}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-[#B08D45] text-white text-xs font-bold cursor-pointer"
                >
                  <Plus size={12} /> إضافة رابط
                </button>
              </div>
              <div className="space-y-2">
                {(footer.links || []).map((lnk) => (
                  <div key={lnk.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-lg bg-neutral-50 border border-neutral-200">
                    <input
                      type="text"
                      value={lnk.label}
                      onChange={(e) =>
                        setFooter({
                          ...footer,
                          links: footer.links.map((x) => (x.id === lnk.id ? { ...x, label: e.target.value } : x)),
                        })
                      }
                      className="sm:col-span-4 rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      value={lnk.url}
                      onChange={(e) =>
                        setFooter({
                          ...footer,
                          links: footer.links.map((x) => (x.id === lnk.id ? { ...x, url: e.target.value } : x)),
                        })
                      }
                      className="sm:col-span-5 rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-mono"
                    />
                    <div className="sm:col-span-3 flex items-center justify-end gap-2">
                      <label className="inline-flex items-center gap-1 text-[11px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={lnk.visible}
                          onChange={(e) =>
                            setFooter({
                              ...footer,
                              links: footer.links.map((x) =>
                                x.id === lnk.id ? { ...x, visible: e.target.checked } : x
                              ),
                            })
                          }
                        />
                        <span>ظاهر</span>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setFooter({ ...footer, links: footer.links.filter((x) => x.id !== lnk.id) })
                        }
                        className="text-red-600 p-1 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Social Links CRUD */}
            <div className="pt-4 border-t border-neutral-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-800">روابط ومنصات التواصل</span>
                <button
                  type="button"
                  onClick={addSocialLink}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-neutral-300 bg-white text-xs font-bold cursor-pointer"
                >
                  <Plus size={12} /> إضافة منصة
                </button>
              </div>
              <div className="space-y-2">
                {(footer.socialLinks || []).map((sl) => (
                  <div key={sl.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center p-2 rounded-lg bg-neutral-50 border border-neutral-200">
                    <input
                      type="text"
                      value={sl.label}
                      onChange={(e) =>
                        setFooter({
                          ...footer,
                          socialLinks: footer.socialLinks.map((x) =>
                            x.id === sl.id ? { ...x, label: e.target.value } : x
                          ),
                        })
                      }
                      placeholder="اسم المنصة"
                      className="sm:col-span-4 rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                    />
                    <input
                      type="text"
                      dir="ltr"
                      value={sl.url}
                      onChange={(e) =>
                        setFooter({
                          ...footer,
                          socialLinks: footer.socialLinks.map((x) =>
                            x.id === sl.id ? { ...x, url: e.target.value } : x
                          ),
                        })
                      }
                      placeholder="https://..."
                      className="sm:col-span-5 rounded border border-neutral-300 bg-white px-2 py-1 text-xs font-mono"
                    />
                    <div className="sm:col-span-3 flex items-center justify-end gap-2">
                      <label className="inline-flex items-center gap-1 text-[11px] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={sl.visible}
                          onChange={(e) =>
                            setFooter({
                              ...footer,
                              socialLinks: footer.socialLinks.map((x) =>
                                x.id === sl.id ? { ...x, visible: e.target.checked } : x
                              ),
                            })
                          }
                        />
                        <span>ظاهر</span>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setFooter({
                            ...footer,
                            socialLinks: footer.socialLinks.filter((x) => x.id !== sl.id),
                          })
                        }
                        className="text-red-600 p-1 cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </AdminCard>
      </div>
    </div>
  );
}
