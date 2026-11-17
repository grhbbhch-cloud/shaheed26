import React, { useEffect, useState } from 'react';
import { FileText, Search } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { CustomLoader } from '../../components/CustomLoader';
import { MediaCard } from '../../components/MediaCard';
import { usePlatform } from '../../context/PlatformContext';
import { buildTextStyle, CONTENT_TYPE_LABELS } from '../../lib/styleEngine';
import type { ContentRecord } from '../../types/platform';

interface MatchedPageItem {
  id: number;
  title: string;
  slug: string;
  seo_description: string;
  page_type: string;
}

export function SearchPage() {
  const { settings, viewport } = usePlatform();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState(settings?.search?.defaultSort || 'newest');
  const [items, setItems] = useState<ContentRecord[]>([]);
  const [pageMatches, setPageMatches] = useState<MatchedPageItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pageNum, setPageNum] = useState(1);

  const runSearch = async (qVal: string, tVal: string, sVal: string) => {
    setLoading(true);
    setPageNum(1);
    try {
      const params = new URLSearchParams();
      if (qVal.trim()) params.set('q', qVal.trim());
      if (tVal !== 'all') params.set('type', tVal);
      if (sVal) params.set('sort', sVal);
      const res = await fetch(`/api/public/search?${params.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
        setPageMatches(data.pageMatches || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const qFromUrl = searchParams.get('q') || '';
    setQuery(qFromUrl);
    runSearch(qFromUrl, typeFilter, sortBy);
  }, [searchParams, typeFilter, sortBy]);

  if (!settings) return null;
  const sc = settings.search;
  const uiTexts = settings.uiTexts;
  const typeLabels = uiTexts?.contentTypeLabels || CONTENT_TYPE_LABELS;
  const perPage = Math.max(1, Number(sc.resultsPerPage || 12));
  const totalPages = Math.max(1, Math.ceil(items.length / perPage));
  const safePageNum = Math.min(pageNum, totalPages);
  const paginated = items.slice((safePageNum - 1) * perPage, safePageNum * perPage);
  const totalFound = items.length + pageMatches.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchParams(query.trim() ? { q: query.trim() } : {});
  };

  return (
    <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-10 min-h-[65vh] space-y-6">
      <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1
            className="text-2xl font-bold text-neutral-900"
            style={buildTextStyle(
              settings.typography.sectionHeadings,
              settings.colors.targets.pageHeading?.gradient,
              viewport
            )}
          >
            {uiTexts?.searchHeading || 'البحث في المنصة'}
          </h1>
          {sc.showResultCount !== false && !loading && (
            <span className="text-xs font-semibold text-neutral-500 tabular-nums">
              {totalFound} نتيجة مطابقة
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div
            className="flex-1 flex items-center gap-2 rounded-lg border px-3 py-2"
            style={{
              backgroundColor: sc.inputBg || '#FFFFFF',
              borderColor: sc.inputBorder || '#D8D8D8',
              color: sc.inputText || '#171717',
            }}
          >
            {sc.showIcon && <Search size={18} className="text-neutral-400 shrink-0" />}
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (sc.behavior === 'instant') {
                  runSearch(e.target.value, typeFilter, sortBy);
                }
              }}
              placeholder={sc.placeholder}
              className="flex-1 bg-transparent text-sm outline-hidden"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2.5 rounded-lg text-sm font-semibold text-white cursor-pointer"
            style={{ backgroundColor: settings.colors.primary || '#B08D45' }}
          >
            {sc.buttonLabel || 'بحث'}
          </button>
        </form>

        {sc.showFilters && (
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs"
            >
              <option value="all">{uiTexts?.searchAllTypes || 'كل الأنواع'}</option>
              {(sc.searchableTypes || []).map((t) => (
                <option key={t} value={t}>
                  {typeLabels[t] || t}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs"
            >
              <option value="newest">{uiTexts?.sortNewest || 'الأحدث'}</option>
              <option value="oldest">{uiTexts?.sortOldest || 'الأقدم'}</option>
            </select>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-12 flex justify-center">
          <CustomLoader
            config={settings.loading.pageNav}
            label={uiTexts?.loadingSearch || 'جاري البحث...'}
          />
        </div>
      ) : totalFound === 0 ? (
        <div className="py-16 text-center text-sm text-neutral-500">
          {sc.emptyMessage || uiTexts?.searchEmptyMessage || 'لم يتم العثور على نتائج مطابقة لبحثك.'}
        </div>
      ) : (
        <div className="space-y-8">
          {pageMatches.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-sm font-bold text-neutral-700">الصفحات المطابقة ({pageMatches.length})</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {pageMatches.map((pg) => (
                  <Link
                    key={pg.id}
                    to={`/p/${pg.slug}`}
                    className="rounded-xl border border-neutral-200 bg-white p-4 hover:border-[#B08D45] transition-colors space-y-1.5"
                  >
                    <div className="flex items-center gap-2 text-sm font-bold text-neutral-900">
                      <FileText size={15} className="text-[#8C6A2F]" />
                      <span>{pg.title}</span>
                    </div>
                    {pg.seo_description && (
                      <p className="text-xs text-neutral-500 line-clamp-2">{pg.seo_description}</p>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {paginated.length > 0 && (
            <>
              {sc.resultsLayout === 'list' ? (
                <div className="space-y-4">
                  {paginated.map((item) => (
                    <MediaCard key={item.id} item={item} variant="compact" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginated.map((item) => (
                    <MediaCard key={item.id} item={item} />
                  ))}
                </div>
              )}

              {totalPages > 1 && (
                <div className="pt-4 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    disabled={safePageNum <= 1}
                    onClick={() => setPageNum((p) => Math.max(1, p - 1))}
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
                    onClick={() => setPageNum((p) => Math.min(totalPages, p + 1))}
                    className="px-3.5 py-1.5 rounded-lg border border-neutral-200 bg-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
                  >
                    التالي
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
