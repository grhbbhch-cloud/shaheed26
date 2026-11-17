import React, { useEffect, useState } from 'react';
import { ArrowLeft, Feather, Pin, User } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ActionButtons } from '../../components/ActionButtons';
import { CustomComponents } from '../../components/CustomComponents';
import { CustomLoader } from '../../components/CustomLoader';
import { CustomTextBlocks } from '../../components/CustomTextBlocks';
import { GeometricPattern } from '../../components/GeometricPattern';
import { MediaCard } from '../../components/MediaCard';
import { usePlatform } from '../../context/PlatformContext';
import { buildBackgroundStyle, buildTextStyle } from '../../lib/styleEngine';
import type { ContentRecord, HomepageSectionConfig, PoemRecord } from '../../types/platform';

export function HomePage() {
  const { settings, customCode, viewport } = usePlatform();
  const [sectionItems, setSectionItems] = useState<Record<string, ContentRecord[]>>({});
  const [sectionPoems, setSectionPoems] = useState<Record<string, PoemRecord[]>>({});
  const [loadingSections, setLoadingSections] = useState(true);

  const homeSnippets = customCode.filter((c) => c.scope === 'home');

  useEffect(() => {
    const jsSnips = homeSnippets.filter((c) => c.code_type === 'js');
    for (const s of jsSnips) {
      try {
        new Function(s.code)();
      } catch (err) {
        console.warn(`[Home CustomCode JS Error #${s.id}]:`, err);
      }
    }
  }, [customCode]);

  useEffect(() => {
    if (!settings) return;
    const sections = (settings.homepage?.sections || []).filter((s) => s.visible && !s.deleted);
    if (sections.length === 0) {
      setLoadingSections(false);
      return;
    }

    let cancelled = false;
    setLoadingSections(true);

    Promise.all(
      sections.map(async (sec) => {
        if (sec.type === 'latest-poems' || sec.type === 'featured-poems') {
          const pParams = new URLSearchParams();
          pParams.set('sort', sec.type === 'featured-poems' ? 'pinned-newest' : sec.sortBy === 'oldest' ? 'oldest' : 'newest');
          pParams.set('limit', String(Math.max(1, sec.maxItems || 6)));
          const res = await fetch(`/api/public/poems?${pParams.toString()}`, { cache: 'no-store' });
          if (!res.ok) return { id: sec.id, kind: 'poems' as const, items: [] as PoemRecord[] };
          const data = await res.json();
          let list: PoemRecord[] = data.poems || [];
          if (sec.type === 'featured-poems') {
            const pinnedOnly = list.filter((p) => p.pinned === 1);
            if (pinnedOnly.length > 0) list = pinnedOnly;
          }
          return {
            id: sec.id,
            kind: 'poems' as const,
            items: list.slice(0, Math.max(1, sec.maxItems || 6)),
          };
        }

        const params = new URLSearchParams();
        if (sec.contentType && sec.contentType !== 'all') {
          params.set('type', sec.contentType);
        }
        if (sec.sourceChildPageId) {
          params.set('childPageId', String(sec.sourceChildPageId));
        } else if (sec.sourcePageId) {
          params.set('pageId', String(sec.sourcePageId));
        }
        if (sec.type === 'featured-videos' || sec.type === 'featured-posts') {
          params.set('featured', '1');
        }
        params.set('sort', sec.sortBy || 'newest');
        params.set('limit', String(Math.max(1, sec.maxItems || 6)));

        const res = await fetch(`/api/public/content?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return { id: sec.id, kind: 'content' as const, items: [] as ContentRecord[] };
        const data = await res.json();
        let list: ContentRecord[] = data.items || [];
        if (sec.manualItemIds && sec.manualItemIds.length > 0) {
          const manualSet = new Set(sec.manualItemIds);
          const allRes = await fetch('/api/public/content?limit=100', { cache: 'no-store' });
          if (allRes.ok) {
            const allData = await allRes.json();
            list = (allData.items || [])
              .filter((it: ContentRecord) => manualSet.has(it.id))
              .slice(0, Math.max(1, sec.maxItems || 6));
          }
        }
        return {
          id: sec.id,
          kind: 'content' as const,
          items: list.slice(0, Math.max(1, sec.maxItems || 6)),
        };
      })
    )
      .then((entries) => {
        if (cancelled) return;
        const map: Record<string, ContentRecord[]> = {};
        const poemsMap: Record<string, PoemRecord[]> = {};
        for (const entry of entries) {
          if (entry.kind === 'poems') {
            poemsMap[entry.id] = entry.items;
          } else {
            map[entry.id] = entry.items;
          }
        }
        setSectionItems(map);
        setSectionPoems(poemsMap);
      })
      .finally(() => {
        if (!cancelled) setLoadingSections(false);
      });

    return () => {
      cancelled = true;
    };
  }, [settings]);

  if (!settings) return null;

  const uiTexts = settings.uiTexts;
  const hero = settings.homepage.hero;
  const heroBgStyle = buildBackgroundStyle(settings.backgrounds.hero);

  const heroVisibleForViewport =
    hero.enabled &&
    !(viewport === 'mobile' && hero.showMobile === false) &&
    !(viewport === 'tablet' && hero.showTablet === false) &&
    !(viewport === 'desktop' && hero.showDesktop === false);

  const heroTitleTypo = {
    ...settings.typography.homeHeadings,
    ...(hero.titleStyle || {}),
    gradient: hero.titleStyle?.gradient?.enabled
      ? hero.titleStyle.gradient
      : settings.typography.homeHeadings?.gradient,
  };
  const heroFallbackTargetGrad = settings.colors.targets.pageHeading?.gradient?.enabled
    ? settings.colors.targets.pageHeading.gradient
    : settings.colors.targets.siteTitle?.gradient;
  const heroTitleStyle = buildTextStyle(
    heroTitleTypo,
    heroFallbackTargetGrad,
    viewport
  );
  const heroSubtitleStyle = buildTextStyle(
    { ...settings.typography.description, color: '#D4D4D4', ...(hero.subtitleStyle || {}) },
    null,
    viewport
  );
  const heroIntroStyle = buildTextStyle(
    { ...settings.typography.description, fontSizeDesktop: '14px', color: '#D4D4D4', ...(hero.introStyle || {}) },
    null,
    viewport
  );

  const activeSections: HomepageSectionConfig[] = [...(settings.homepage.sections || [])]
    .filter((s) => s.visible && !s.deleted)
    .filter((s) => {
      if (viewport === 'mobile') return s.showMobile !== false;
      if (viewport === 'tablet') return s.showTablet !== false;
      return s.showDesktop !== false;
    })
    .sort((a, b) => a.order - b.order);

  const sectionHeadingStyle = buildTextStyle(
    settings.typography.sectionHeadings,
    settings.colors.targets.pageHeading?.gradient,
    viewport
  );

  const siteImgCfg = settings.identity.siteImage;
  const activeSiteImgUrl =
    siteImgCfg?.enabled
      ? (viewport === 'mobile' && siteImgCfg.mobileUrl ? siteImgCfg.mobileUrl : siteImgCfg.desktopUrl)
      : '';

  const renderSiteImageElement = (className = '') => {
    if (!activeSiteImgUrl || !siteImgCfg) return null;
    const imgEl = (
      <img
        src={activeSiteImgUrl}
        alt={siteImgCfg.alt || settings.identity.siteName}
        className={className}
        style={{
          width: siteImgCfg.position === 'background' ? '100%' : siteImgCfg.width || '100%',
          height: siteImgCfg.position === 'background' ? '100%' : siteImgCfg.height || 'auto',
          objectFit: siteImgCfg.fit || 'cover',
          objectPosition: siteImgCfg.objectPosition || 'center',
          opacity: siteImgCfg.opacity ?? 1,
          borderRadius: siteImgCfg.borderRadius ? `${siteImgCfg.borderRadius}px` : undefined,
        }}
      />
    );
    if (siteImgCfg.linkEnabled && siteImgCfg.linkUrl) {
      return siteImgCfg.linkUrl.startsWith('/') && !siteImgCfg.openInNewTab ? (
        <Link to={siteImgCfg.linkUrl} className="block">
          {imgEl}
        </Link>
      ) : (
        <a
          href={siteImgCfg.linkUrl}
          target={siteImgCfg.openInNewTab ? '_blank' : undefined}
          rel={siteImgCfg.openInNewTab ? 'noopener noreferrer' : undefined}
          className="block"
        >
          {imgEl}
        </a>
      );
    }
    return imgEl;
  };

  return (
    <div style={buildBackgroundStyle(settings.backgrounds.homepage)}>
      {homeSnippets
        .filter((s) => s.code_type === 'css')
        .map((s) => (
          <style key={s.id}>{s.code}</style>
        ))}

      <CustomComponents location="hero-top" />
      <CustomTextBlocks location="hero-top" className="py-3" />

      {/* Hero Section */}
      {heroVisibleForViewport && (
        <section
          className="relative overflow-hidden"
          style={{
            backgroundColor: '#080808',
            ...heroBgStyle,
            paddingTop: `${hero.paddingY || 72}px`,
            paddingBottom: `${hero.paddingY || 72}px`,
            minHeight: `${hero.minHeight || 260}px`,
          }}
        >
          {activeSiteImgUrl && siteImgCfg?.position === 'background' ? (
            <div className="absolute inset-0 w-full h-full pointer-events-none">
              {renderSiteImageElement('w-full h-full')}
            </div>
          ) : (
            hero.customImageUrl && (
              <img
                src={hero.customImageUrl}
                alt=""
                className="absolute inset-0 w-full h-full object-cover opacity-35"
              />
            )
          )}
          <GeometricPattern config={settings.decorations.hero} />

          <div
            className={`relative z-10 max-w-[1320px] mx-auto px-4 sm:px-6 ${
              activeSiteImgUrl && (siteImgCfg?.position === 'right' || siteImgCfg?.position === 'left')
                ? 'grid grid-cols-1 lg:grid-cols-12 gap-8 items-center'
                : 'flex flex-col justify-center'
            }`}
          >
            {activeSiteImgUrl && siteImgCfg?.position === 'right' && (
              <div className="lg:col-span-5">{renderSiteImageElement('w-full')}</div>
            )}

            <div
              className={`${
                activeSiteImgUrl && (siteImgCfg?.position === 'right' || siteImgCfg?.position === 'left')
                  ? 'lg:col-span-7 '
                  : ''
              }flex flex-col justify-center ${
                hero.alignment === 'center'
                  ? 'items-center text-center'
                  : hero.alignment === 'left'
                    ? 'items-end text-left'
                    : 'items-start text-right'
              }`}
            >
              {activeSiteImgUrl && siteImgCfg?.position === 'above-title' && (
                <div className="mb-5 w-full">{renderSiteImageElement()}</div>
              )}
              {hero.showTitle && !hero.titleDeleted && hero.title && (
                <h1 className="max-w-4xl text-balance" style={heroTitleStyle}>
                  {hero.title}
                </h1>
              )}
              {hero.showSubtitle && !hero.subtitleDeleted && hero.subtitle && (
                <p className="mt-4 max-w-3xl leading-relaxed" style={heroSubtitleStyle}>
                  {hero.subtitle}
                </p>
              )}
              {activeSiteImgUrl && siteImgCfg?.position === 'below-title' && (
                <div className="mt-5 w-full">{renderSiteImageElement()}</div>
              )}
              {hero.showIntro && !hero.introDeleted && hero.introText && (
                <p className="mt-3 max-w-2xl leading-relaxed" style={heroIntroStyle}>
                  {hero.introText}
                </p>
              )}
              <ActionButtons
                buttons={(settings.buttons || []).filter(
                  (b) =>
                    b.placement === 'hero' ||
                    (hero.ctaButtonIds && hero.ctaButtonIds.includes(b.id))
                )}
                className="mt-6"
              />
            </div>

            {activeSiteImgUrl && siteImgCfg?.position === 'left' && (
              <div className="lg:col-span-5">{renderSiteImageElement('w-full')}</div>
            )}
          </div>
        </section>
      )}

      {homeSnippets
        .filter((s) => s.code_type === 'html' || s.code_type === 'svg')
        .map((s) => (
          <div key={s.id} className="max-w-[1320px] mx-auto px-4 sm:px-6 py-2" dangerouslySetInnerHTML={{ __html: s.code }} />
        ))}

      <CustomComponents location="hero-bottom" />
      <CustomTextBlocks location="hero-bottom" className="py-3" />

      {/* Homepage Builder Sections */}
      <div className="relative">
        <GeometricPattern config={settings.decorations.homepage} />

        {activeSections.map((sec) => {
          const items = sectionItems[sec.id] || [];
          const colsClass =
            sec.columns === 4
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
              : sec.columns === 2
                ? 'grid-cols-1 md:grid-cols-2'
                : sec.columns === 1
                  ? 'grid-cols-1'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

          const emptyMsg =
            sec.emptyMessage !== undefined
              ? sec.emptyMessage
              : (uiTexts?.homeEmptySection ?? 'لا توجد مواد منشورة ضمن هذا القسم بعد.');

          const hasBannerLink = sec.bannerLinkEnabled !== false && Boolean(sec.bannerLinkUrl);

          return (
            <section
              key={sec.id}
              className="relative py-12"
              style={{
                backgroundColor: sec.backgroundColor || 'transparent',
                minHeight: sec.minHeight ? `${sec.minHeight}px` : undefined,
                paddingTop: sec.paddingY !== undefined ? `${sec.paddingY}px` : undefined,
                paddingBottom: sec.paddingY !== undefined ? `${sec.paddingY}px` : undefined,
                borderTop:
                  sec.borderWidth && sec.borderWidth > 0
                    ? `${sec.borderWidth}px solid ${sec.borderColor || '#E5E5E5'}`
                    : undefined,
                boxShadow: sec.shadow && sec.shadow !== 'none' ? sec.shadow : undefined,
              }}
            >
              <div
                className="mx-auto px-4 sm:px-6"
                style={{ maxWidth: sec.maxWidth || '1320px' }}
              >
                {/* Section Header */}
                {(sec.title || sec.subtitle || sec.showViewAll) && (
                  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-neutral-200 mb-7">
                    <div>
                      {sec.title && (
                        <h2
                          style={
                            sec.titleStyle
                              ? buildTextStyle(
                                  {
                                    ...settings.typography.sectionHeadings,
                                    ...sec.titleStyle,
                                    gradient: sec.titleStyle.gradient?.enabled
                                      ? sec.titleStyle.gradient
                                      : settings.typography.sectionHeadings?.gradient,
                                  },
                                  settings.colors.targets.pageHeading?.gradient,
                                  viewport
                                )
                              : sectionHeadingStyle
                          }
                        >
                          {sec.title}
                        </h2>
                      )}
                      {sec.subtitle && (
                        <p
                          className="mt-1 text-sm text-neutral-500"
                          style={sec.subtitleStyle ? buildTextStyle(sec.subtitleStyle, null, viewport) : undefined}
                        >
                          {sec.subtitle}
                        </p>
                      )}
                    </div>

                    {sec.showViewAll && sec.viewAllUrl && (sec.viewAllLabel || uiTexts?.viewAllDefaultLabel) && (
                      <Link
                        to={sec.viewAllUrl}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80 shrink-0"
                        style={{ color: settings.colors.primary || '#B08D45' }}
                      >
                        <span>{sec.viewAllLabel || uiTexts?.viewAllDefaultLabel}</span>
                        <ArrowLeft size={15} />
                      </Link>
                    )}
                  </div>
                )}

                {/* Special Banner / Linked Image Section */}
                {(sec.type === 'banner' || sec.type === 'linked-image') && sec.bannerImageUrl && (
                  <div className="space-y-2">
                    <div className="overflow-hidden rounded-xl border border-neutral-200">
                      {hasBannerLink ? (
                        sec.bannerLinkUrl!.startsWith('/') && !sec.bannerOpenNewTab ? (
                          <Link to={sec.bannerLinkUrl!} className="block">
                            <img
                              src={sec.bannerImageUrl}
                              alt={sec.bannerAlt || sec.title}
                              className="w-full max-h-[420px] object-cover hover:scale-[1.01] transition-transform duration-300"
                            />
                          </Link>
                        ) : (
                          <a
                            href={sec.bannerLinkUrl}
                            target={sec.bannerOpenNewTab ? '_blank' : undefined}
                            rel={sec.bannerOpenNewTab ? 'noopener noreferrer' : undefined}
                            className="block"
                          >
                            <img
                              src={sec.bannerImageUrl}
                              alt={sec.bannerAlt || sec.title}
                              className="w-full max-h-[420px] object-cover hover:scale-[1.01] transition-transform duration-300"
                            />
                          </a>
                        )
                      ) : (
                        <img
                          src={sec.bannerImageUrl}
                          alt={sec.bannerAlt || sec.title}
                          className="w-full max-h-[420px] object-cover"
                        />
                      )}
                    </div>
                    {hasBannerLink && sec.bannerLinkLabel && (
                      <div className="flex justify-end">
                        <a
                          href={sec.bannerLinkUrl}
                          target={sec.bannerOpenNewTab ? '_blank' : undefined}
                          rel={sec.bannerOpenNewTab ? 'noopener noreferrer' : undefined}
                          className="text-xs font-semibold hover:underline"
                          style={{ color: settings.colors.primary || '#B08D45' }}
                        >
                          {sec.bannerLinkLabel}
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Custom Text / Announcement Section */}
                {(sec.type === 'custom-text' || sec.type === 'announcement') && sec.customText && (
                  <div
                    className="rounded-xl border border-neutral-200 bg-white p-6 text-neutral-800 leading-relaxed whitespace-pre-line"
                    style={sec.customTextStyle ? buildTextStyle(sec.customTextStyle, null, viewport) : undefined}
                  >
                    {sec.customText}
                  </div>
                )}

                {/* Custom Buttons Section */}
                {sec.type === 'custom-buttons' && (
                  <ActionButtons
                    buttons={(settings.buttons || []).filter(
                      (b) => !sec.buttonIds?.length || sec.buttonIds.includes(b.id)
                    )}
                  />
                )}

                {/* Poems Section */}
                {(sec.type === 'latest-poems' || sec.type === 'featured-poems') && (
                  <>
                    {loadingSections ? (
                      <div className="py-10 flex justify-center">
                        <CustomLoader config={settings.loading.relatedLoad} />
                      </div>
                    ) : (sectionPoems[sec.id] || []).length === 0 ? (
                      sec.showEmptyMessage !== false && emptyMsg ? (
                        <p className="py-8 text-center text-sm text-neutral-500">{emptyMsg}</p>
                      ) : null
                    ) : (
                      <div className={`grid gap-6 ${colsClass}`}>
                        {(sectionPoems[sec.id] || []).map((poem) => (
                          <Link
                            key={poem.id}
                            to={`/poem/${poem.slug}`}
                            className="group rounded-xl border border-[#E6DEC8] bg-[#FCFBF7] p-5 transition-all hover:shadow-md hover:border-[#B08D45]"
                          >
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <h3 className="text-lg font-extrabold text-[#171717] group-hover:text-[#8C6A2F] transition-colors">
                                {poem.title}
                              </h3>
                              {poem.pinned === 1 ? (
                                <Pin size={14} className="text-[#B08D45] shrink-0 mt-1" />
                              ) : (
                                <Feather size={14} className="text-[#B08D45]/70 shrink-0 mt-1" />
                              )}
                            </div>
                            <p className="text-sm text-neutral-700 leading-loose line-clamp-4 whitespace-pre-line mb-4">
                              {poem.verses_text}
                            </p>
                            <div className="flex items-center justify-between text-xs text-neutral-500 pt-3 border-t border-[#E6DEC8]/70">
                              <span className="inline-flex items-center gap-1">
                                {poem.poet_name && <User size={12} />}
                                {poem.poet_name || 'ديوان الشهيد'}
                              </span>
                              <span className="font-bold text-[#8C6A2F]">قراءة القصيدة ←</span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* Content Collection Sections */}
                {![
                  'banner',
                  'linked-image',
                  'custom-text',
                  'announcement',
                  'custom-buttons',
                  'latest-poems',
                  'featured-poems',
                ].includes(sec.type) && (
                  <>
                    {loadingSections ? (
                      <div className="py-10 flex justify-center">
                        <CustomLoader config={settings.loading.relatedLoad} />
                      </div>
                    ) : items.length === 0 ? (
                      sec.showEmptyMessage !== false && emptyMsg ? (
                        <p className="py-8 text-center text-sm text-neutral-500">{emptyMsg}</p>
                      ) : null
                    ) : sec.layout === 'list' ? (
                      <div className="space-y-4">
                        {items.map((item) => (
                          <MediaCard key={item.id} item={item} variant="compact" />
                        ))}
                      </div>
                    ) : (
                      <div className={`grid gap-6 ${colsClass}`}>
                        {items.map((item) => (
                          <MediaCard
                            key={item.id}
                            item={item}
                            variant={sec.cardStyle || 'editorial'}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <CustomComponents location="home-after-sections" />
      <CustomTextBlocks location="home-after-sections" className="py-4" />
    </div>
  );
}
