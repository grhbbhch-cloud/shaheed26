import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CustomComponents } from '../../components/CustomComponents';
import { CustomLoader } from '../../components/CustomLoader';
import { CustomTextBlocks } from '../../components/CustomTextBlocks';
import { GeometricPattern } from '../../components/GeometricPattern';
import { MediaCard } from '../../components/MediaCard';
import { PoetrySectionView } from '../../components/PoetrySectionView';
import { usePlatform } from '../../context/PlatformContext';
import { buildBackgroundStyle, buildTextStyle, CONTENT_TYPE_LABELS, syncPageSeo } from '../../lib/styleEngine';
import type { ContentRecord, PageRecord } from '../../types/platform';

function scopePageCss(rawCss: string, scopeSelector: string): string {
  if (!rawCss || !scopeSelector) return rawCss;
  // Prefix top-level CSS selectors outside @-rules so per-page CSS stays isolated
  return rawCss.replace(/(^|\})\s*([^@{}][^{]*)\{/g, (match, prefix, selector) => {
    const trimmed = String(selector).trim();
    if (!trimmed) return match;
    if (trimmed.includes(scopeSelector)) return match;
    const scoped = trimmed
      .split(',')
      .map((part) => {
        const p = part.trim();
        if (!p) return p;
        if (p === 'body' || p === 'html' || p === ':root') return scopeSelector;
        return `${scopeSelector} ${p}`;
      })
      .join(', ');
    return `${prefix}\n${scoped} {`;
  });
}

export function CollectionPage() {
  const { slug } = useParams<{ slug: string }>();
  const { settings, customCode, viewport } = usePlatform();
  const [page, setPage] = useState<PageRecord | null>(null);
  const [childPages, setChildPages] = useState<PageRecord[]>([]);
  const [items, setItems] = useState<ContentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selectedChildId, setSelectedChildId] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [currentPageNum, setCurrentPageNum] = useState<number>(1);

  useEffect(() => {
    setSelectedChildId('');
    setSelectedType('all');
    setSortBy('newest');
    setCurrentPageNum(1);
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    const params = new URLSearchParams();
    if (selectedChildId) params.set('childPageId', selectedChildId);
    if (selectedType && selectedType !== 'all') params.set('type', selectedType);
    if (sortBy) params.set('sort', sortBy);

    fetch(`/api/public/pages/${encodeURIComponent(slug)}?${params.toString()}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error || 'الصفحة غير موجودة');
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setPage(data.page);
        setChildPages(data.childPages || []);
        setItems(data.items || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'تعذر تحميل الصفحة');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug, selectedChildId, selectedType, sortBy]);

  const pageSettings = (() => {
    try {
      return JSON.parse(page?.settings_json || '{}');
    } catch {
      return {};
    }
  })();

  const pageScopedSnippets = customCode.filter(
    (c) => c.scope === 'page' && c.target_page_id === page?.id
  );

  useEffect(() => {
    if (!page || !settings) return;
    if (pageSettings.defaultSort && sortBy === 'newest' && pageSettings.defaultSort === 'oldest') {
      setSortBy(pageSettings.defaultSort);
    }
    syncPageSeo({
      title: `${page.seo_title || page.title} | ${settings.identity.siteName}`,
      description: page.seo_description || settings.identity.metaDescription,
      ogImage: pageSettings.seoOgImage || settings.identity.defaultShareImage,
      canonical: pageSettings.seoCanonical || undefined,
      noIndex: Boolean(pageSettings.seoNoIndex),
    });
  }, [page?.id, settings]);

  useEffect(() => {
    if (!page) return;
    const jsSnippets = pageScopedSnippets.filter((s) => s.code_type === 'js');
    for (const s of jsSnippets) {
      try {
        new Function(s.code)();
      } catch (err) {
        console.warn(`[Page CustomCode JS Error #${s.id}]:`, err);
      }
    }
    if (pageSettings.customJs && typeof pageSettings.customJs === 'string') {
      try {
        new Function(pageSettings.customJs)();
      } catch (err) {
        console.warn(`[Page Settings JS Error #${page.id}]:`, err);
      }
    }
  }, [page?.id, customCode]);

  if (!settings) return null;

  const uiTexts = settings.uiTexts;
  const typeLabels = uiTexts?.contentTypeLabels || CONTENT_TYPE_LABELS;

  const headingStyle = buildTextStyle(
    {
      ...settings.typography.sectionHeadings,
      ...(pageSettings.typographyFamily ? { fontFamily: pageSettings.typographyFamily } : {}),
      color: pageSettings.headingColor || '#FFFFFF',
    },
    settings.colors.targets.pageHeading?.gradient,
    viewport
  );

  const pageWrapperStyle: React.CSSProperties = {
    ...buildBackgroundStyle(settings.backgrounds.pages),
    ...(pageSettings.backgroundColor ? { backgroundColor: pageSettings.backgroundColor } : {}),
    ...(pageSettings.backgroundImage
      ? {
          backgroundImage: `url(${pageSettings.backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }
      : {}),
    ...(pageSettings.typographyColor ? { color: pageSettings.typographyColor } : {}),
    ...(pageSettings.typographyFamily
      ? { fontFamily: `'${pageSettings.typographyFamily}', 'Cairo', sans-serif` }
      : {}),
  };

  const pageDeco =
    pageSettings.decorationPattern && pageSettings.decorationPattern !== 'inherit'
      ? {
          ...settings.decorations.pages,
          enabled: pageSettings.decorationPattern !== 'none',
          pattern: pageSettings.decorationPattern,
          ...(pageSettings.decorationColor ? { primaryColor: pageSettings.decorationColor } : {}),
          ...(pageSettings.decorationOpacity !== undefined
            ? { opacity: Number(pageSettings.decorationOpacity) }
            : {}),
        }
      : settings.decorations.pages;

  const pageSize = Math.max(1, Number(pageSettings.pageSize || 12));
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePageNum = Math.min(currentPageNum, totalPages);
  const paginatedItems = items.slice((safePageNum - 1) * pageSize, safePageNum * pageSize);

  const deskCols = Math.max(1, Math.min(4, Number(pageSettings.columnsDesktop || 3)));
  const tabCols = Math.max(1, Math.min(3, Number(pageSettings.columnsTablet || 2)));
  const mobCols = Math.max(1, Math.min(2, Number(pageSettings.columnsMobile || 1)));
  const gridColsClass = `${mobCols === 2 ? 'grid-cols-2' : 'grid-cols-1'} ${
    tabCols === 3 ? 'sm:grid-cols-3' : tabCols === 1 ? 'sm:grid-cols-1' : 'sm:grid-cols-2'
  } ${
    deskCols === 4
      ? 'lg:grid-cols-4'
      : deskCols === 2
        ? 'lg:grid-cols-2'
        : deskCols === 1
          ? 'lg:grid-cols-1'
          : 'lg:grid-cols-3'
  }`;

  const pageScopeId = page ? `page-${page.id}` : undefined;
  const scopeSelector = pageScopeId ? `[data-page-scope="${pageScopeId}"]` : '';

  if (!loading && (page?.page_type === 'poetry' || (!error && slug === 'poems'))) {
    return (
      <div data-page-scope={pageScopeId}>
        {pageScopedSnippets
          .filter((s) => s.code_type === 'css')
          .map((s) => (
            <style key={s.id}>{scopePageCss(s.code, scopeSelector)}</style>
          ))}
        {pageSettings.customCss && (
          <style>{scopePageCss(pageSettings.customCss, scopeSelector)}</style>
        )}
        <PoetrySectionView page={page} />
      </div>
    );
  }

  return (
    <div data-page-scope={pageScopeId} style={pageWrapperStyle} className="min-h-[65vh]">
      {/* Scoped page custom CSS */}
      {pageScopedSnippets
        .filter((s) => s.code_type === 'css')
        .map((s) => (
          <style key={s.id}>{scopePageCss(s.code, scopeSelector)}</style>
        ))}
      {pageSettings.customCss && <style>{scopePageCss(pageSettings.customCss, scopeSelector)}</style>}

      {/* Page Banner */}
      <section
        className="relative overflow-hidden py-12"
        style={{ backgroundColor: pageSettings.bannerBg || '#080808' }}
      >
        <GeometricPattern config={pageDeco} />
        <div className="relative z-10 max-w-[1320px] mx-auto px-4 sm:px-6">
          <div className="text-xs text-neutral-400 mb-2 flex items-center gap-1.5">
            <Link to="/" className="hover:text-white">
              {uiTexts?.breadcrumbHome || 'الرئيسية'}
            </Link>
            <span>/</span>
            <span className="text-[#D4AF65]">{page?.title || slug}</span>
          </div>
          <h1 style={headingStyle}>{page?.title || slug}</h1>
          {page?.seo_description && (
            <p className="mt-2 text-sm text-neutral-300 max-w-2xl">{page.seo_description}</p>
          )}
        </div>
      </section>

      <CustomComponents location="collection-top" pageId={page?.id} />
      <CustomTextBlocks location="collection-top" className="pt-4" />

      <div
        className="mx-auto px-4 sm:px-6 py-8"
        style={{ maxWidth: pageSettings.maxWidth || '1320px' }}
      >
        {loading ? (
          <div className="py-16 flex justify-center">
            <CustomLoader
              config={settings.loading.pageNav}
              label={uiTexts?.loadingContent || 'جاري تحميل المحتوى...'}
            />
          </div>
        ) : error ? (
          <div className="py-16 text-center space-y-3">
            <p className="text-neutral-600">{error}</p>
            <Link
              to="/"
              className="inline-block px-4 py-2 rounded-lg text-sm font-semibold text-white"
              style={{ backgroundColor: settings.colors.primary || '#B08D45' }}
            >
              {uiTexts?.backToHomeLabel || 'العودة للرئيسية'}
            </Link>
          </div>
        ) : (
          <>
            {pageSettings.customNotice && (
              <div className="mb-6 rounded-xl border border-[#E8E0D0] bg-[#F7F4EC] p-4 text-sm text-[#171717]">
                {pageSettings.customNotice}
              </div>
            )}

            {/* Custom Static Page Body if present */}
            {page?.custom_content && (
              <div className="mb-8 rounded-xl border border-neutral-200 bg-white p-6 leading-relaxed text-neutral-800 whitespace-pre-line">
                {page.custom_content}
              </div>
            )}

            {/* Scoped HTML/SVG Snippets */}
            {pageScopedSnippets
              .filter((s) => s.code_type === 'html' || s.code_type === 'svg')
              .map((s) => (
                <div key={s.id} className="mb-6" dangerouslySetInnerHTML={{ __html: s.code }} />
              ))}

            {/* Child Pages & Filter Toolbar */}
            {pageSettings.showFilters !== false &&
              (childPages.length > 0 || items.length > 0 || selectedType !== 'all' || selectedChildId) && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-200">
                <div className="flex flex-wrap items-center gap-2">
                  {childPages.length > 0 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setSelectedChildId('')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                          selectedChildId === ''
                            ? 'text-white border-transparent'
                            : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                        }`}
                        style={
                          selectedChildId === ''
                            ? { backgroundColor: settings.colors.primary || '#B08D45' }
                            : undefined
                        }
                      >
                        {uiTexts?.allItemsFilter || 'الكل'} ({items.length})
                      </button>
                      {childPages.map((ch) => (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setSelectedChildId(String(ch.id))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                            selectedChildId === String(ch.id)
                              ? 'text-white border-transparent'
                              : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                          }`}
                          style={
                            selectedChildId === String(ch.id)
                              ? { backgroundColor: settings.colors.primary || '#B08D45' }
                              : undefined
                          }
                        >
                          {ch.title}
                        </button>
                      ))}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e.target.value)}
                    aria-label="تصفية حسب النوع"
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700"
                  >
                    <option value="all">{uiTexts?.allTypesFilter || 'جميع الأنواع'}</option>
                    {Object.entries(typeLabels).map(([k, label]) => (
                      <option key={k} value={k}>
                        {label}
                      </option>
                    ))}
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    aria-label="الترتيب"
                    className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700"
                  >
                    <option value="newest">{uiTexts?.sortNewest || 'الأحدث'}</option>
                    <option value="oldest">{uiTexts?.sortOldest || 'الأقدم'}</option>
                  </select>
                </div>
              </div>
            )}

            {/* Content Grid / List / Editorial / Gallery + Pagination */}
            {items.length === 0 ? (
              page?.page_type === 'static' && page?.custom_content ? null : (
                <div className="py-12 text-center text-sm text-neutral-500">
                  {pageSettings.emptyMessage !== undefined
                    ? pageSettings.emptyMessage
                    : uiTexts?.collectionEmptyMessage || 'لا توجد مواد منشورة ضمن هذه الصفحة حتى الآن.'}
                </div>
              )
            ) : pageSettings.childDisplayMode === 'grouped' && !selectedChildId && childPages.length > 0 ? (
              <div className="space-y-10">
                {(() => {
                  const directItems = items.filter((it) => it.page_id === page?.id);
                  return (
                    <>
                      {directItems.length > 0 && (
                        <section className="space-y-4">
                          <h2 className="text-lg font-extrabold text-neutral-900 pb-2 border-b border-neutral-200">
                            {page?.title}
                          </h2>
                          <div className={`grid ${gridColsClass} gap-6`}>
                            {directItems.map((item) => (
                              <MediaCard key={item.id} item={item} />
                            ))}
                          </div>
                        </section>
                      )}
                      {childPages.map((ch) => {
                        const groupItems = items.filter((it) => it.page_id === ch.id);
                        if (groupItems.length === 0) return null;
                        return (
                          <section key={ch.id} className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                              <h2 className="text-lg font-extrabold text-neutral-900">{ch.title}</h2>
                              <Link
                                to={`/p/${ch.slug}`}
                                className="text-xs font-bold hover:underline"
                                style={{ color: settings.colors.primary || '#B08D45' }}
                              >
                                عرض القسم كاملاً ({groupItems.length})
                              </Link>
                            </div>
                            <div className={`grid ${gridColsClass} gap-6`}>
                              {groupItems.map((item) => (
                                <MediaCard key={item.id} item={item} />
                              ))}
                            </div>
                          </section>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
            ) : page?.layout === 'list' ? (
              <div className="space-y-4">
                {paginatedItems.map((item) => (
                  <MediaCard key={item.id} item={item} variant="compact" />
                ))}
              </div>
            ) : page?.layout === 'editorial' ? (
              <div className="space-y-6">
                {paginatedItems[0] && (
                  <MediaCard item={paginatedItems[0]} variant="editorial" />
                )}
                {paginatedItems.length > 1 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {paginatedItems.slice(1).map((item) => (
                      <MediaCard key={item.id} item={item} variant="editorial" />
                    ))}
                  </div>
                )}
              </div>
            ) : page?.layout === 'gallery' ? (
              <div className={`grid ${gridColsClass} gap-5`}>
                {paginatedItems.map((item) => (
                  <MediaCard
                    key={item.id}
                    item={item}
                    variant="media-first"
                    showDescription={false}
                    cardDesignOverride={{ imageAspectRatio: '4/3' }}
                  />
                ))}
              </div>
            ) : (
              <div className={`grid ${gridColsClass} gap-6`}>
                {paginatedItems.map((item) => (
                  <MediaCard key={item.id} item={item} />
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="mt-8 pt-6 border-t border-neutral-200 flex items-center justify-center gap-3">
                <button
                  type="button"
                  disabled={safePageNum <= 1}
                  onClick={() => setCurrentPageNum((p) => Math.max(1, p - 1))}
                  className="px-3.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
                >
                  السابق
                </button>
                <span className="text-xs font-semibold text-neutral-600 tabular-nums">
                  صفحة {safePageNum} من {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePageNum >= totalPages}
                  onClick={() => setCurrentPageNum((p) => Math.min(totalPages, p + 1))}
                  className="px-3.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
                >
                  التالي
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
