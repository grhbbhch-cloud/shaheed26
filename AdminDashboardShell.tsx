import React, { useMemo, useState } from 'react';
import {
  Activity,
  BadgeCheck,
  Brush,
  Cloud,
  Code2,
  Database,
  ExternalLink,
  Feather,
  FileText,
  Film,
  FolderTree,
  Globe,
  HardDrive,
  HeartPulse,
  History,
  Home,
  Image as ImageIcon,
  Inbox,
  Languages,
  Layers,
  LayoutGrid,
  ListTree,
  LogOut,
  Menu,
  MoreHorizontal,
  Palette,
  PlaySquare,
  RefreshCw,
  Search,
  Settings,
  Shield,
  Sparkles,
  Subtitles,
  Trash2,
  Type,
  Upload,
  Users,
  Wand2,
  X,
} from 'lucide-react';
import { useAdmin, type AdminSectionId } from '../../context/AdminContext';
import { AdminActivity } from './sections/AdminActivity';
import { AdminBackups } from './sections/AdminBackups';
import { AdminBackgrounds } from './sections/AdminBackgrounds';
import { AdminButtonsLoaders } from './sections/AdminButtonsLoaders';
import { AdminColorsAppearance } from './sections/AdminColorsAppearance';
import { AdminContent } from './sections/AdminContent';
import { AdminCustomCode } from './sections/AdminCustomCode';
import { AdminDecorations } from './sections/AdminDecorations';
import { AdminGeneralIdentity } from './sections/AdminGeneralIdentity';
import { AdminHealth } from './sections/AdminHealth';
import { AdminHomepageBuilder } from './sections/AdminHomepageBuilder';
import { AdminImages } from './sections/AdminImages';
import { AdminNavigationFooter } from './sections/AdminNavigationFooter';
import { AdminOfficialAccount } from './sections/AdminOfficialAccount';
import { AdminOther } from './sections/AdminOther';
import { AdminOverview } from './sections/AdminOverview';
import { AdminPages } from './sections/AdminPages';
import { AdminPlayer } from './sections/AdminPlayer';
import { AdminPoemSubmissions } from './sections/AdminPoemSubmissions';
import { AdminPoetry } from './sections/AdminPoetry';
import { AdminPortalCustomizer } from './sections/AdminPortalCustomizer';
import { AdminRecycleBin } from './sections/AdminRecycleBin';
import { AdminSearchSettings } from './sections/AdminSearchSettings';
import { AdminSecurity } from './sections/AdminSecurity';
import { AdminSeo } from './sections/AdminSeo';
import { AdminStorageMedia } from './sections/AdminStorageMedia';
import { AdminSubtitles } from './sections/AdminSubtitles';
import { AdminTranslations } from './sections/AdminTranslations';
import { AdminTypography } from './sections/AdminTypography';
import { AdminUploads } from './sections/AdminUploads';
import { AdminUsersPermissions } from './sections/AdminUsersPermissions';
import { AdminVersions } from './sections/AdminVersions';
import { AdminVideos } from './sections/AdminVideos';

interface MenuItem {
  id: AdminSectionId;
  label: string;
  icon: React.ComponentType<any>;
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'overview', label: 'نظرة عامة', icon: LayoutGrid },
  { id: 'pages', label: 'إدارة الصفحات', icon: FolderTree },
  { id: 'content', label: 'إدارة المحتوى', icon: FileText },
  { id: 'poetry', label: 'قسم قصائد (الديوان)', icon: Feather },
  { id: 'submissions', label: 'مشاركات القصائد الواردة', icon: Inbox },
  { id: 'videos', label: 'مكتبة الفيديوهات', icon: Film },
  { id: 'images', label: 'مكتبة الصور والوسائط', icon: ImageIcon },
  { id: 'uploads', label: 'مركز الرفع', icon: Upload },
  { id: 'homepage', label: 'منشئ الصفحة الرئيسية', icon: Home },
  { id: 'navigation', label: 'إدارة القوائم والتنقل', icon: ListTree },
  { id: 'player', label: 'إدارة المشغل', icon: PlaySquare },
  { id: 'subtitles', label: 'ترجمة الفيديوهات (SRT)', icon: Subtitles },
  { id: 'translations', label: 'ترجمات الموقع واللغات', icon: Languages },
  { id: 'colors', label: 'إدارة الألوان والمظهر', icon: Palette },
  { id: 'buttons', label: 'إدارة الأزرار والرموز', icon: Wand2 },
  { id: 'typography', label: 'إدارة الخطوط والنصوص', icon: Type },
  { id: 'backgrounds', label: 'إدارة الخلفيات والمؤثرات', icon: Layers },
  { id: 'decorations', label: 'الزخارف الهندسية والإسلامية', icon: Sparkles },
  { id: 'code', label: 'إدارة الأكواد والميزات', icon: Code2 },
  { id: 'search', label: 'إدارة البحث', icon: Search },
  { id: 'seo', label: 'تحسين محركات البحث SEO', icon: Globe },
  { id: 'storage', label: 'التخزين ومعالجة الوسائط', icon: HardDrive },
  { id: 'users', label: 'مشرفو الإدارة والصلاحيات', icon: Users },
  { id: 'trash', label: 'سلة المحذوفات', icon: Trash2 },
  { id: 'backups', label: 'النسخ الاحتياطي والاستعادة', icon: Database },
  { id: 'versions', label: 'سجل الإصدارات والتراجع', icon: History },
  { id: 'activity', label: 'سجل النشاط والتغييرات', icon: Activity },
  { id: 'security', label: 'الأمان والمزامنة السحابية', icon: Shield },
  { id: 'general', label: 'الإعدادات العامة', icon: Settings },
  { id: 'officialAccount', label: 'الحساب الرسمي الموثق', icon: BadgeCheck },
  { id: 'portal', label: 'تخصيص بوابة الإدارة', icon: Brush },
  { id: 'health', label: 'صحة النظام والتشخيص', icon: HeartPulse },
  { id: 'other', label: 'غير ذلك والميزات الإضافية', icon: MoreHorizontal },
];

const SECTION_PERM_MAP: Record<AdminSectionId, string> = {
  overview: 'view',
  pages: 'edit',
  content: 'edit',
  poetry: 'edit',
  submissions: 'edit',
  translations: 'edit',
  seo: 'manage_settings',
  trash: 'delete',
  videos: 'view',
  images: 'view',
  uploads: 'upload',
  homepage: 'manage_appearance',
  navigation: 'manage_appearance',
  player: 'manage_appearance',
  subtitles: 'edit',
  buttons: 'manage_appearance',
  typography: 'manage_appearance',
  colors: 'manage_appearance',
  backgrounds: 'manage_appearance',
  decorations: 'manage_appearance',
  code: 'manage_code',
  search: 'manage_settings',
  storage: 'upload',
  users: 'manage_users',
  backups: 'manage_backups',
  versions: 'manage_backups',
  activity: 'manage_security',
  security: 'manage_security',
  general: 'manage_settings',
  officialAccount: 'manage_appearance',
  portal: 'manage_appearance',
  health: 'view',
  other: 'manage_settings',
};

export function AdminDashboardShell() {
  const {
    activeSection,
    setActiveSection,
    settings,
    logout,
    refreshAll,
    sessionRole,
    sessionDisplayName,
    hasPermission,
    firebaseUser,
    syncingCloud,
    connectOwnerGoogle,
    syncNowToFirestore,
  } = useAdmin();
  const [quickQuery, setQuickQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const visibleMenuItems = useMemo(() => {
    if (sessionRole === 'owner' || !sessionRole) return MENU_ITEMS;
    return MENU_ITEMS.filter((m) => hasPermission(SECTION_PERM_MAP[m.id] || 'view'));
  }, [sessionRole, hasPermission]);

  const theme = settings?.adminTheme;
  const activeMeta = useMemo(
    () => visibleMenuItems.find((m) => m.id === activeSection) || visibleMenuItems[0] || MENU_ITEMS[0],
    [activeSection, visibleMenuItems]
  );

  const filteredQuickMenu = useMemo(() => {
    const q = quickQuery.trim().toLowerCase();
    if (!q) return [];
    return visibleMenuItems.filter((m) => m.label.toLowerCase().includes(q));
  }, [quickQuery, visibleMenuItems]);

  const renderSection = () => {
    const reqPerm = SECTION_PERM_MAP[activeSection] || 'view';
    if (sessionRole && sessionRole !== 'owner' && !hasPermission(reqPerm)) {
      return (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-center text-sm font-semibold text-amber-900">
          ليس لديك صلاحية للوصول إلى هذا القسم ({reqPerm}). تواصل مع المالك الرئيسي لتعديل مصفوفة الصلاحيات.
        </div>
      );
    }
    switch (activeSection) {
      case 'overview':
        return <AdminOverview />;
      case 'pages':
        return <AdminPages />;
      case 'content':
        return <AdminContent />;
      case 'poetry':
        return <AdminPoetry />;
      case 'submissions':
        return <AdminPoemSubmissions />;
      case 'translations':
        return <AdminTranslations />;
      case 'seo':
        return <AdminSeo />;
      case 'trash':
        return <AdminRecycleBin />;
      case 'videos':
        return <AdminVideos />;
      case 'images':
        return <AdminImages />;
      case 'uploads':
        return <AdminUploads />;
      case 'homepage':
        return <AdminHomepageBuilder />;
      case 'navigation':
        return <AdminNavigationFooter />;
      case 'player':
        return <AdminPlayer />;
      case 'subtitles':
        return <AdminSubtitles />;
      case 'buttons':
        return <AdminButtonsLoaders />;
      case 'typography':
        return <AdminTypography />;
      case 'colors':
        return <AdminColorsAppearance />;
      case 'backgrounds':
        return <AdminBackgrounds />;
      case 'decorations':
        return <AdminDecorations />;
      case 'code':
        return <AdminCustomCode />;
      case 'search':
        return <AdminSearchSettings />;
      case 'storage':
        return <AdminStorageMedia />;
      case 'users':
        return <AdminUsersPermissions />;
      case 'backups':
        return <AdminBackups />;
      case 'versions':
        return <AdminVersions />;
      case 'activity':
        return <AdminActivity />;
      case 'security':
        return <AdminSecurity />;
      case 'general':
        return <AdminGeneralIdentity />;
      case 'officialAccount':
        return <AdminOfficialAccount />;
      case 'portal':
        return <AdminPortalCustomizer />;
      case 'health':
        return <AdminHealth />;
      case 'other':
        return <AdminOther />;
      default:
        return <AdminOverview />;
    }
  };

  const sidebarTypo = settings?.typography?.adminSidebar;
  const headingTypo = settings?.typography?.adminHeadings;
  const inputTypo = settings?.typography?.adminInputs;

  const sidebarContent = (
    <div
      className="flex flex-col h-full select-none"
      style={{
        backgroundColor: theme?.sidebarBg || '#151515',
        color: theme?.sidebarText || '#E5E7EB',
        fontFamily: sidebarTypo?.fontFamily
          ? `'${sidebarTypo.fontFamily}', 'Cairo', sans-serif`
          : theme?.menuFont
            ? `'${theme.menuFont}', 'Cairo', sans-serif`
            : undefined,
      }}
    >
      {/* Top gold branding block */}
      <div
        className="px-5 py-4 shrink-0"
        style={{ backgroundColor: theme?.sidebarHeaderBg || '#8C6A2F' }}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {settings?.identity?.adminLogoUrl && (
              <img
                src={settings.identity.adminLogoUrl}
                alt=""
                className="h-8 w-8 object-contain rounded bg-white/10 p-0.5 shrink-0"
              />
            )}
            <div className="min-w-0">
              <div className="text-base font-extrabold text-white truncate">
                {theme?.sidebarTitle !== undefined ? theme.sidebarTitle : (settings?.identity?.siteName || '')}
              </div>
              <div className="text-[11px] text-[#F7F4EC]/90 truncate">
                {theme?.sidebarSubtitle ?? 'لوحة التحكم المركزية'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden text-white p-1"
            aria-label="إغلاق القائمة"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Scrollable 27-item navigation */}
      <nav
        aria-label="أقسام لوحة التحكم"
        className="flex-1 overflow-y-auto px-3 py-3"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: `${theme?.menuSpacing ?? 4}px`,
        }}
      >
        {visibleMenuItems.map((item) => {
          const IconComp = item.icon;
          const active = item.id === activeSection;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                setActiveSection(item.id);
                setMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3 rounded-lg text-right transition-colors cursor-pointer shrink-0"
              style={{
                minHeight: `${theme?.menuItemHeight ?? 40}px`,
                fontSize: `${theme?.menuFontSize ?? 13}px`,
                fontWeight: active ? 700 : 500,
                backgroundColor: active ? theme?.activeMenuBg || '#B08D45' : 'transparent',
                color: active ? theme?.activeMenuText || '#FFFFFF' : theme?.sidebarText || '#E5E7EB',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = theme?.hoverBg || '#222222';
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <IconComp
                size={16}
                style={{
                  color: active
                    ? theme?.activeMenuText || '#FFFFFF'
                    : theme?.sidebarIconColor || '#9CA3AF',
                }}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Pinned bottom actions */}
      <div className="p-3 border-t border-white/10 space-y-1.5 shrink-0">
        <a
          href="/"
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold hover:bg-white/10 transition-colors"
          style={{ color: theme?.sidebarText || '#E5E7EB' }}
        >
          <ExternalLink size={15} />
          <span>عرض الموقع العام</span>
        </a>
        <button
          type="button"
          onClick={logout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
        >
          <LogOut size={15} />
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen flex"
      style={{ backgroundColor: theme?.mainBg || '#F4F5F6' }}
      dir="rtl"
    >
      {/* Desktop Fixed Right Sidebar */}
      <aside
        className="hidden lg:block shrink-0 sticky top-0 h-screen border-l border-neutral-800/30"
        style={{ width: `${theme?.sidebarWidth || 268}px` }}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="w-72 h-full shadow-2xl">{sidebarContent}</div>
          <div
            className="flex-1 bg-black/50"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-20 bg-white border-b border-neutral-200 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-neutral-200 text-neutral-700"
              aria-label="فتح القائمة الجانبية"
            >
              <Menu size={18} />
            </button>
            <div>
              <h1
                className="text-base font-extrabold text-neutral-900"
                style={{
                  fontFamily: headingTypo?.fontFamily ? `'${headingTypo.fontFamily}', 'Cairo', sans-serif` : undefined,
                  fontSize: headingTypo?.fontSizeDesktop || undefined,
                  fontWeight: (headingTypo?.fontWeight as any) || undefined,
                }}
              >
                {activeMeta.label}
              </h1>
              <p className="text-[11px] text-neutral-500">
                المسؤول: {sessionDisplayName || `المالك الرئيسي - ${settings?.identity?.siteName || ''}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                size={14}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
              />
              <input
                type="text"
                value={quickQuery}
                onChange={(e) => setQuickQuery(e.target.value)}
                placeholder="بحث إداري سريع..."
                style={{
                  fontFamily: inputTypo?.fontFamily ? `'${inputTypo.fontFamily}', 'Cairo', sans-serif` : undefined,
                }}
                className="w-48 sm:w-64 pr-8 pl-3 py-1.5 rounded-lg border border-neutral-300 bg-neutral-50 text-xs focus:bg-white focus:outline-hidden focus:border-[#B08D45]"
              />
              {filteredQuickMenu.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg p-1.5 z-40 max-h-64 overflow-y-auto">
                  {filteredQuickMenu.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setActiveSection(m.id);
                        setQuickQuery('');
                      }}
                      className="w-full text-right px-3 py-2 rounded-lg text-xs font-semibold text-neutral-800 hover:bg-[#F7F4EC] hover:text-[#8C6A2F] cursor-pointer"
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              type="button"
              disabled={syncingCloud}
              onClick={() => (firebaseUser ? syncNowToFirestore(false) : connectOwnerGoogle())}
              title={firebaseUser ? 'مزامنة سحابية فورية إلى Firestore' : 'ربط حساب Google للمزامنة السحابية'}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold shrink-0 cursor-pointer ${
                firebaseUser
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                  : 'border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              <Cloud size={14} className={syncingCloud ? 'animate-pulse' : ''} />
              <span className="hidden sm:inline">
                {syncingCloud ? 'جاري المزامنة...' : firebaseUser ? 'مزامنة سحابية' : 'ربط السحابة'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => refreshAll()}
              title="تحديث البيانات"
              className="p-1.5 rounded-lg border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 cursor-pointer shrink-0"
            >
              <RefreshCw size={14} />
            </button>

            <a
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#B08D45]/40 text-[#8C6A2F] bg-[#F7F4EC] hover:bg-[#E8E0D0]/60 text-xs font-bold shrink-0"
            >
              <ExternalLink size={14} />
              <span>الموقع العام</span>
            </a>
          </div>
        </header>

        {/* Active Section Body */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto">
          {renderSection()}
        </main>
      </div>
    </div>
  );
}
