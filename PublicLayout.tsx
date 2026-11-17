import React, { useEffect, useState } from 'react';
import { ArrowUp, ChevronDown, Menu, Search, X } from 'lucide-react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ActionButtons } from '../../components/ActionButtons';
import { CustomComponents } from '../../components/CustomComponents';
import { CustomLoader } from '../../components/CustomLoader';
import { CustomTextBlocks } from '../../components/CustomTextBlocks';
import { GeometricPattern } from '../../components/GeometricPattern';
import { usePlatform } from '../../context/PlatformContext';
import { buildBackgroundStyle, buildTextStyle } from '../../lib/styleEngine';
import type { NavItemConfig } from '../../types/platform';

export function PublicLayout() {
  const { settings, customCode, loading, fontScale, setFontScale, activeLang, setActiveLang, viewport } = usePlatform();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [expandedMobileIds, setExpandedMobileIds] = useState<Record<string, boolean>>({});
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [scrollPct, setScrollPct] = useState(0);
  const [showBackTop, setShowBackTop] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
    setOpenDropdownId(null);
  }, [location.pathname]);

  useEffect(() => {
    if (!openDropdownId) return;
    const onDocClick = () => setOpenDropdownId(null);
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [openDropdownId]);

  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const total = doc.scrollHeight - doc.clientHeight;
      setScrollPct(total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 0);
      setShowBackTop(window.scrollY > 360);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (loading || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <CustomLoader
          config={settings?.loading?.pageNav}
          label={settings?.uiTexts?.loadingPlatform || 'جاري تحميل المنصة...'}
        />
      </div>
    );
  }

  const uiTexts = settings.uiTexts;

  if (settings.other?.maintenanceMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-950 text-white p-6 text-center">
        <div className="max-w-lg space-y-4 border border-[#B08D45]/60 bg-neutral-900 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-[#D4AF65]">{settings.identity.siteName}</h1>
          <p className="text-neutral-300 leading-relaxed">{settings.other.maintenanceMessage}</p>
        </div>
      </div>
    );
  }

  const navCfg = settings.navigation;
  const visibleNavItems = [...(navCfg.items || [])]
    .filter((i) => i.visible)
    .sort((a, b) => a.order - b.order);

  const siteTitleStyle = buildTextStyle(
    settings.typography.siteTitle,
    settings.colors.targets.siteTitle?.gradient,
    viewport
  );
  const navTextStyle = buildTextStyle(
    settings.typography.navigation,
    settings.colors.targets.navigation?.gradient,
    viewport
  );
  const buttonTextStyle = buildTextStyle(
    settings.typography.buttons,
    null,
    viewport
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchModalOpen(false);
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  const triggerMode = navCfg.desktopDropdownTrigger || 'hover';

  const renderDesktopNavNode = (item: NavItemConfig, depth = 0) => {
    const hasChildren = item.children && item.children.some((c) => c.visible);
    const linkTarget = item.url || '/';

    if (!hasChildren) {
      return item.openInNewTab ? (
        <a
          key={item.id}
          href={linkTarget}
          target="_blank"
          rel="noopener noreferrer"
          className="px-2 py-1.5 whitespace-nowrap shrink-0 transition-opacity hover:opacity-80"
          style={depth === 0 ? navTextStyle : { color: navCfg.dropdownText }}
        >
          {item.label}
        </a>
      ) : (
        <NavLink
          key={item.id}
          to={linkTarget}
          className={({ isActive }) =>
            `px-2 py-1.5 whitespace-nowrap shrink-0 transition-all ${
              depth === 0 && isActive ? 'border-b-2 border-white font-bold' : 'hover:opacity-80'
            }`
          }
          style={depth === 0 ? navTextStyle : { color: navCfg.dropdownText }}
        >
          {item.label}
        </NavLink>
      );
    }

    const isClickOpen = openDropdownId === item.id;
    const allowHover = triggerMode === 'hover' || triggerMode === 'both';
    const allowClick = triggerMode === 'click' || triggerMode === 'both';

    return (
      <div
        key={item.id}
        className={`relative ${allowHover ? 'group/nav' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center">
          <NavLink
            to={linkTarget}
            className={({ isActive }) =>
              `inline-flex items-center gap-1 px-2 py-1.5 whitespace-nowrap shrink-0 transition-all ${
                depth === 0 && isActive ? 'border-b-2 border-white font-bold' : 'hover:opacity-80'
              }`
            }
            style={depth === 0 ? navTextStyle : { color: navCfg.dropdownText }}
          >
            <span>{item.label}</span>
          </NavLink>
          <button
            type="button"
            aria-label={`قائمة ${item.label}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (allowClick) {
                setOpenDropdownId((prev) => (prev === item.id ? null : item.id));
              }
            }}
            className="p-1 text-white/85 hover:text-white cursor-pointer"
          >
            <ChevronDown
              size={14}
              className={`opacity-85 transition-transform ${
                isClickOpen ? 'rotate-180' : allowHover ? 'group-hover/nav:rotate-180' : ''
              }`}
            />
          </button>
        </div>

        {/* Dropdown */}
        <div
          className={`${
            isClickOpen
              ? 'visible opacity-100'
              : allowHover
                ? 'invisible opacity-0 group-hover/nav:visible group-hover/nav:opacity-100'
                : 'invisible opacity-0 pointer-events-none'
          } transition-all duration-150 absolute z-50 min-w-[190px] rounded-lg border border-white/15 py-1.5 shadow-xl ${
            depth === 0 ? 'top-full right-0 pt-2' : 'top-0 right-full mr-1'
          }`}
          style={{
            backgroundColor: navCfg.dropdownBg || '#8C6A2F',
            color: navCfg.dropdownText || '#FFFFFF',
          }}
        >
          {item.children
            .filter((c) => c.visible)
            .sort((a, b) => a.order - b.order)
            .map((child) => (
              <div key={child.id} className="px-2 py-0.5 hover:bg-white/10 rounded mx-1">
                {child.children && child.children.some((g) => g.visible) ? (
                  renderDesktopNavNode(child, depth + 1)
                ) : child.openInNewTab ? (
                  <a
                    href={child.url || '/'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-2 py-1.5 text-sm whitespace-nowrap"
                  >
                    {child.label}
                  </a>
                ) : (
                  <Link
                    to={child.url || '/'}
                    onClick={() => setOpenDropdownId(null)}
                    className="block px-2 py-1.5 text-sm whitespace-nowrap"
                  >
                    {child.label}
                  </Link>
                )}
              </div>
            ))}
        </div>
      </div>
    );
  };

  const renderMobileNavNode = (item: NavItemConfig, depth = 0) => {
    const visibleChildren = (item.children || []).filter((c) => c.visible);
    const expanded = Boolean(expandedMobileIds[item.id]);

    return (
      <div key={item.id} className="border-b border-white/10 last:border-b-0">
        <div
          className="flex items-center justify-between py-2.5"
          style={{ paddingRight: `${depth * 14}px` }}
        >
          {item.openInNewTab ? (
            <a
              href={item.url || '/'}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold text-white flex-1"
            >
              {item.label}
            </a>
          ) : (
            <Link to={item.url || '/'} className="text-sm font-semibold text-white flex-1">
              {item.label}
            </Link>
          )}
          {visibleChildren.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setExpandedMobileIds((prev) => ({ ...prev, [item.id]: !prev[item.id] }))
              }
              aria-label={`توسيع ${item.label}`}
              className="p-2 text-white/85 hover:text-white cursor-pointer"
            >
              <ChevronDown
                size={16}
                className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </button>
          )}
        </div>
        {visibleChildren.length > 0 && expanded && (
          <div className="pb-2 pr-3 space-y-1 bg-black/15 rounded-lg mb-2">
            {visibleChildren.map((ch) => renderMobileNavNode(ch, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const globalBgStyle = buildBackgroundStyle(settings.backgrounds.global);
  const footerBgStyle = buildBackgroundStyle(settings.backgrounds.footer);

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        ...globalBgStyle,
        fontSize: `${Math.round(16 * fontScale)}px`,
      }}
    >
      {/* Reading Progress Bar */}
      {settings.other?.readingProgressBarEnabled && (
        <div
          className="fixed top-0 inset-x-0 z-50 h-0.5 bg-transparent pointer-events-none"
          aria-hidden="true"
        >
          <div
            className="h-full transition-all duration-100"
            style={{
              width: `${scrollPct}%`,
              backgroundColor: settings.colors.goldAccent || '#9c932b',
            }}
          />
        </div>
      )}

      {/* Optional Announcement Bar */}
      {settings.other?.announcementBarEnabled && settings.other.announcementBarText && (
        <div
          className="w-full py-2 px-4 text-center text-xs font-semibold"
          style={{
            backgroundColor: settings.other.announcementBarBg || '#8C6A2F',
            color: settings.other.announcementBarColor || '#FFFFFF',
          }}
        >
          {settings.other.announcementBarLink ? (
            <a href={settings.other.announcementBarLink} className="hover:underline">
              {settings.other.announcementBarText}
            </a>
          ) : (
            <span>{settings.other.announcementBarText}</span>
          )}
        </div>
      )}

      {/* Main Header / Navigation Bar */}
      <header
        className="relative z-40 w-full"
        style={{
          backgroundColor: navCfg.backgroundColor || settings.colors.primary || '#B08D45',
          boxShadow: navCfg.shadow || undefined,
        }}
      >
        <GeometricPattern config={settings.decorations.header} />

        <div
          className={`relative max-w-[1320px] mx-auto px-4 sm:px-6 ${
            navCfg.alignment === 'center'
              ? 'flex items-center justify-between lg:grid lg:grid-cols-[1fr_auto_1fr] gap-4'
              : 'flex items-center justify-between gap-6'
          }`}
          style={{ minHeight: `${navCfg.height || 64}px` }}
        >
          {/* Brand Logo + Name on Right */}
          <Link
            to="/"
            className={`flex items-center gap-2.5 shrink-0 ${
              navCfg.alignment === 'center' ? 'lg:justify-self-start' : ''
            }`}
          >
            {(() => {
              const logoSrc =
                viewport === 'mobile' && settings.identity.mobileLogoUrl
                  ? settings.identity.mobileLogoUrl
                  : settings.identity.headerLogoUrl;
              if (settings.identity.logoHidden || !settings.identity.showLogoInHeader || !logoSrc) {
                return null;
              }
              return (
                <img
                  src={logoSrc}
                  alt={settings.identity.siteName}
                  style={{
                    width: `${settings.identity.logoWidth || 36}px`,
                    height: `${settings.identity.logoHeight || 36}px`,
                    objectFit: settings.identity.logoFit || 'contain',
                  }}
                />
              );
            })()}
            <span className="whitespace-nowrap shrink-0" style={siteTitleStyle}>
              {settings.identity.siteName}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav
            className={`hidden lg:flex items-center ${
              navCfg.alignment === 'center' ? 'lg:justify-self-center justify-center' : 'flex-1'
            }`}
            style={{
              gap: `${navCfg.itemSpacing || 20}px`,
              justifyContent:
                navCfg.alignment === 'center'
                  ? 'center'
                  : navCfg.alignment === 'space-between'
                    ? 'space-between'
                    : 'flex-start',
            }}
          >
            {visibleNavItems.map((item) => renderDesktopNavNode(item))}
          </nav>

          {/* Left Action: Account + Search + Language Switcher + Header Custom Buttons + Mobile Hamburger */}
          <div
            className={`flex items-center gap-2.5 shrink-0 ${
              navCfg.alignment === 'center' ? 'lg:justify-self-end' : ''
            }`}
          >
            <ActionButtons buttons={settings.buttons || []} placement="header" />

            {settings.i18n?.enabled &&
              settings.i18n?.showSwitcher &&
              (settings.i18n.languages?.length || 0) > 1 && (
                <select
                  aria-label="تبديل لغة الواجهة"
                  value={activeLang}
                  onChange={(e) => setActiveLang(e.target.value)}
                  className="px-2.5 py-1.5 rounded text-xs font-semibold border border-white/35 bg-black/20 text-white outline-hidden cursor-pointer"
                >
                  {settings.i18n.languages.map((lang) => (
                    <option key={lang.code} value={lang.code} className="text-neutral-900 bg-white">
                      {lang.label}
                    </option>
                  ))}
                </select>
              )}

            {settings.search.enabled && (
              <button
                type="button"
                onClick={() => setSearchModalOpen(true)}
                className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded text-sm font-medium border transition-colors hover:bg-white/10 whitespace-nowrap shrink-0 cursor-pointer"
                style={{
                  ...buttonTextStyle,
                  borderColor: navCfg.borderColor || 'rgba(255,255,255,0.35)',
                  color: settings.search.buttonText || '#FFFFFF',
                  backgroundColor: settings.search.buttonBg || 'transparent',
                }}
              >
                {settings.search.showIcon && <Search size={15} />}
                <span>{settings.search.buttonLabel ?? 'بحث'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="القائمة"
              className="lg:hidden p-2 rounded text-white hover:bg-white/10 cursor-pointer"
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div
            className="lg:hidden border-t border-white/15 px-4 py-3"
            style={{ backgroundColor: navCfg.dropdownBg || '#8C6A2F' }}
          >
            {visibleNavItems.map((item) => renderMobileNavNode(item))}
          </div>
        )}
      </header>

      {/* Diamond Pattern Separator below Navigation */}
      <GeometricPattern config={settings.decorations.navSeparator} height={22} />

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      <CustomComponents location="footer-top" />
      <CustomTextBlocks location="footer-top" className="py-3" />

      {/* Footer */}
      {settings.footer.enabled && (
        <footer
          className="relative mt-auto overflow-hidden border-t"
          style={{
            backgroundColor: settings.footer.backgroundColor || '#080808',
            color: settings.footer.textColor || '#E5E5E5',
            borderColor: settings.footer.separatorColor || '#262626',
            ...footerBgStyle,
          }}
        >
          <GeometricPattern config={settings.decorations.footer} height={18} />
          <div className="relative max-w-[1320px] mx-auto px-4 sm:px-6 py-10">
            <div
              className={`grid gap-8 ${
                settings.footer.layout === 'centered'
                  ? 'grid-cols-1 text-center justify-items-center'
                  : 'grid-cols-1 md:grid-cols-3'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  {!settings.identity.logoHidden &&
                    settings.identity.showLogoInFooter !== false &&
                    settings.footer.showLogo &&
                    (settings.identity.footerLogoUrl || settings.identity.headerLogoUrl) && (
                      <img
                        src={settings.identity.footerLogoUrl || settings.identity.headerLogoUrl}
                        alt={settings.identity.siteName}
                        style={{
                          width: `${settings.identity.logoWidth || 36}px`,
                          height: `${settings.identity.logoHeight || 36}px`,
                          objectFit: settings.identity.logoFit || 'contain',
                        }}
                      />
                    )}
                  <span className="text-lg font-bold text-white">{settings.identity.siteName}</span>
                </div>
                {settings.footer.text && (
                  <p
                    className="text-sm leading-relaxed max-w-md"
                    style={buildTextStyle(settings.typography.footer, null, viewport)}
                  >
                    {settings.footer.text}
                  </p>
                )}
              </div>

              <div className="space-y-2.5">
                {uiTexts?.footerLinksTitle ? (
                  <h3 className="text-sm font-bold text-white">
                    {uiTexts.footerLinksTitle}
                  </h3>
                ) : null}
                <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  {settings.footer.links
                    .filter((l) => l.visible)
                    .map((l) =>
                      l.openInNewTab ? (
                        <li key={l.id}>
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: settings.footer.linkColor || '#9c932b' }}
                            className="hover:underline"
                          >
                            {l.label}
                          </a>
                        </li>
                      ) : (
                        <li key={l.id}>
                          <Link
                            to={l.url}
                            style={{ color: settings.footer.linkColor || '#9c932b' }}
                            className="hover:underline"
                          >
                            {l.label}
                          </Link>
                        </li>
                      )
                    )}
                </ul>
              </div>

              <div className="space-y-3">
                {settings.identity.contactEmail && (
                  <p className="text-sm text-neutral-400">
                    {uiTexts?.footerEmailLabel ?? 'البريد الإلكتروني:'} {settings.identity.contactEmail}
                  </p>
                )}
                {(settings.footer.socialLinks || []).filter((s) => s.visible).length > 0 && (
                  <div className="flex flex-wrap gap-3 text-xs">
                    {settings.footer.socialLinks
                      .filter((s) => s.visible)
                      .map((s) => (
                        <a
                          key={s.id}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: settings.footer.linkColor || '#9c932b' }}
                          className="hover:underline font-semibold"
                        >
                          {s.label || s.platform}
                        </a>
                      ))}
                  </div>
                )}
                <ActionButtons buttons={settings.buttons || []} placement="footer" />
              </div>
            </div>

            <div
              className="mt-8 pt-5 border-t text-xs text-neutral-400 flex flex-col sm:flex-row items-center justify-between gap-2"
              style={{ borderColor: settings.footer.separatorColor || '#262626' }}
            >
              <span>{settings.footer.copyright}</span>
              {settings.other?.jsonFeedEnabled && uiTexts?.jsonFeedLabel !== '' && (
                <a href="/api/public/feed.json" className="hover:text-white transition-colors">
                  {uiTexts?.jsonFeedLabel ?? 'خلاصة JSON'}
                </a>
              )}
            </div>
          </div>
        </footer>
      )}

      {/* Global HTML/SVG Custom Code Snippets (public pages only) */}
      {customCode
        .filter((c) => c.scope === 'global' && (c.code_type === 'html' || c.code_type === 'svg'))
        .map((c) => (
          <div key={c.id} dangerouslySetInnerHTML={{ __html: c.code }} />
        ))}

      {/* Accessibility Text-Size Widget */}
      {settings.other?.accessibilityFontWidgetEnabled && (
        <div
          className="fixed bottom-4 left-4 z-40 inline-flex items-center bg-white border border-neutral-200 rounded-lg shadow-md divide-x divide-x-reverse divide-neutral-200 text-xs font-semibold text-neutral-700"
          aria-label="التحكم بحجم الخط"
        >
          <button
            type="button"
            onClick={() => setFontScale(Math.max(0.85, Number((fontScale - 0.1).toFixed(2))))}
            className="px-2.5 py-1.5 hover:bg-neutral-100 rounded-r-lg cursor-pointer"
          >
            {uiTexts?.fontScaleDecrease || 'أ-'}
          </button>
          <button
            type="button"
            onClick={() => setFontScale(1)}
            className={`px-2.5 py-1.5 hover:bg-neutral-100 cursor-pointer ${
              fontScale === 1 ? 'text-[#8C6A2F]' : ''
            }`}
          >
            {uiTexts?.fontScaleNormal || 'عادي'}
          </button>
          <button
            type="button"
            onClick={() => setFontScale(Math.min(1.3, Number((fontScale + 0.1).toFixed(2))))}
            className="px-2.5 py-1.5 hover:bg-neutral-100 rounded-l-lg cursor-pointer"
          >
            {uiTexts?.fontScaleIncrease || 'أ+'}
          </button>
        </div>
      )}

      {/* Back to top button */}
      {settings.other?.backToTopEnabled && showBackTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-4 right-4 z-40 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#8C6A2F] text-white text-xs font-semibold shadow-lg hover:bg-[#B08D45] transition-colors cursor-pointer"
          style={buttonTextStyle}
        >
          <ArrowUp size={14} />
          <span>{settings.other.backToTopLabel ?? 'العودة للأعلى'}</span>
        </button>
      )}

      {/* Search Overlay Modal */}
      {searchModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-20 px-4"
          onClick={() => setSearchModalOpen(false)}
        >
          <form
            onSubmit={handleSearchSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-xl bg-white p-4 shadow-2xl border border-neutral-200 flex items-center gap-2"
          >
            <Search size={18} className="text-neutral-400 shrink-0" />
            <input
              type="text"
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={settings.search.placeholder || 'ابحث في المنصة...'}
              className="flex-1 text-sm bg-transparent outline-hidden text-neutral-900"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg text-sm font-semibold text-white cursor-pointer"
              style={{ backgroundColor: settings.colors.primary || '#B08D45' }}
            >
              {settings.search.buttonLabel || 'بحث'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
