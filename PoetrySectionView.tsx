import React, { useEffect, useMemo, useState } from 'react';
import {
  Download,
  Feather,
  PenLine,
  Pin,
  Plus,
  Search,
  Send,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePlatform } from '../context/PlatformContext';
import { exportPoemAsPng } from '../lib/poemImageExport';
import {
  buildTextStyle,
  buildTitleGradientProps,
  formatArabicDate,
} from '../lib/styleEngine';
import type { PageRecord, PoemDesignOverride, PoemRecord } from '../types/platform';
import { GeometricPattern } from './GeometricPattern';

interface PoetrySectionViewProps {
  page?: PageRecord | null;
}

function renderSeparator(
  style: string | undefined,
  color: string | undefined
): React.ReactNode {
  if (!style || style === 'none') return null;
  const c = color || '#B08D45';
  return (
    <div className="my-4 flex items-center justify-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 max-w-[90px] opacity-35" style={{ backgroundColor: c }} />
      {style === 'diamond' && (
        <span
          className="w-2.5 h-2.5 rotate-45 inline-block"
          style={{ backgroundColor: c }}
        />
      )}
      {style === 'star' && <span style={{ color: c }}>✦</span>}
      {style === 'dots' && (
        <span className="tracking-widest text-xs" style={{ color: c }}>
          •••
        </span>
      )}
      {style === 'ornament' && <span style={{ color: c }}>❦</span>}
      {style === 'line' && (
        <span className="w-6 h-0.5 rounded-full" style={{ backgroundColor: c }} />
      )}
      <span className="h-px flex-1 max-w-[90px] opacity-35" style={{ backgroundColor: c }} />
    </div>
  );
}

export function PoetrySectionView({ page }: PoetrySectionViewProps) {
  const { settings, viewport } = usePlatform();
  const [poems, setPoems] = useState<PoemRecord[]>([]);
  const [poets, setPoets] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedPoet, setSelectedPoet] = useState('all');
  const [sortBy, setSortBy] = useState<string>(settings?.poetry?.defaultSort || 'pinned-newest');
  const [pageNum, setPageNum] = useState(1);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [shareHovered, setShareHovered] = useState(false);

  // Submission Modal state (public visitor submission — no login required)
  const [modalOpen, setModalOpen] = useState(false);
  const [subTitle, setSubTitle] = useState('');
  const [subVerses, setSubVerses] = useState('');
  const [subPoetName, setSubPoetName] = useState('');
  const [subExtraInfo, setSubExtraInfo] = useState('');
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitFeedback, setSubmitFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  useEffect(() => {
    if (settings?.poetry?.defaultSort) {
      setSortBy(settings.poetry.defaultSort);
    }
  }, [settings?.poetry?.defaultSort]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params = new URLSearchParams();
    if (sortBy) params.set('sort', sortBy);
    if (query.trim()) params.set('q', query.trim());
    if (selectedPoet && selectedPoet !== 'all') params.set('poet', selectedPoet);

    fetch(`/api/public/poems?${params.toString()}`, { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setPoems(data.poems || []);
        setPoets(data.poets || []);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sortBy, query, selectedPoet]);

  const poetryCfg = settings?.poetry;

  const visiblePoems = useMemo(() => {
    const perPage = Math.max(1, Number(poetryCfg?.poemsPerPage || 8));
    if (poetryCfg?.paginationMode === 'load-more') {
      return poems.slice(0, pageNum * perPage);
    }
    return poems.slice((pageNum - 1) * perPage, pageNum * perPage);
  }, [poems, pageNum, poetryCfg?.poemsPerPage, poetryCfg?.paginationMode]);

  const totalPages = Math.max(
    1,
    Math.ceil(poems.length / Math.max(1, Number(poetryCfg?.poemsPerPage || 8)))
  );

  if (!settings || !poetryCfg) return null;

  const shareBtn = poetryCfg.shareButton;
  const formCfg = poetryCfg.submissionForm;
  const customFields = Array.isArray(formCfg.customFields) ? formCfg.customFields : [];

  const ShareIcon =
    shareBtn?.icon === 'PenLine'
      ? PenLine
      : shareBtn?.icon === 'Send'
        ? Send
        : shareBtn?.icon === 'Sparkles'
          ? Sparkles
          : shareBtn?.icon === 'Plus'
            ? Plus
            : shareBtn?.icon === 'none'
              ? null
              : Feather;

  const bannerTitleGrad = buildTitleGradientProps(
    settings,
    'poetryPageTitle',
    buildTextStyle(poetryCfg.titleStyle, null, viewport),
    { pageId: page?.id }
  );

  const cardTitleBaseStyle = buildTextStyle(poetryCfg.poemTitleStyle, null, viewport);
  const poemCardGrad = buildTitleGradientProps(settings, 'poemCardTitle', cardTitleBaseStyle, {
    pageId: page?.id,
  });

  const handleSubmitPoem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitFeedback(null);
    try {
      const res = await fetch('/api/public/poems/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: subTitle,
          verses_text: subVerses,
          poet_name: formCfg.showPoetName === false ? '' : subPoetName,
          extra_info: formCfg.showExtraInfo ? subExtraInfo : '',
          custom_fields: customValues,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitFeedback({
          type: 'error',
          text: data.error || formCfg.errorMessage,
        });
        return;
      }
      setSubmitFeedback({
        type: 'success',
        text: data.message || formCfg.successMessage,
      });
      setSubTitle('');
      setSubVerses('');
      setSubPoetName('');
      setSubExtraInfo('');
      setCustomValues({});
    } catch {
      setSubmitFeedback({
        type: 'error',
        text: formCfg.errorMessage || 'تعذر إرسال المشاركة، حاول مجدداً.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const colsDesk = Math.max(1, Math.min(3, Number(poetryCfg.columnsDesktop || 2)));
  const gridClass =
    colsDesk === 1
      ? 'grid-cols-1'
      : colsDesk === 3
        ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
        : 'grid-cols-1 lg:grid-cols-2';

  const shareHoverClass =
    shareBtn?.hoverEffect === 'lift'
      ? 'hover:-translate-y-0.5'
      : shareBtn?.hoverEffect === 'scale'
        ? 'hover:scale-[1.03]'
        : shareBtn?.hoverEffect === 'glow'
          ? 'hover:shadow-[0_0_22px_rgba(212,175,101,0.5)]'
          : '';
  const shareClickClass = shareBtn?.clickEffect === 'none' ? '' : 'active:scale-[0.97]';

  const showShareButton = Boolean(poetryCfg.submissionsEnabled && shareBtn?.visible !== false);

  const shareButtonElement = showShareButton ? (
    <button
      type="button"
      onMouseEnter={() => setShareHovered(true)}
      onMouseLeave={() => setShareHovered(false)}
      onClick={() => {
        setSubmitFeedback(null);
        setModalOpen(true);
      }}
      className={`inline-flex items-center gap-2 font-bold transition-all cursor-pointer ${shareHoverClass} ${shareClickClass}`}
      style={{
        backgroundColor: shareHovered
          ? shareBtn.hoverBgColor || shareBtn.bgColor || '#1B6B3B'
          : shareBtn.bgColor || '#14532D',
        color: shareHovered
          ? shareBtn.hoverColor || shareBtn.color || '#FFFFFF'
          : shareBtn.color || '#FFFFFF',
        border: `${shareBtn.borderWidth ?? 1}px solid ${shareBtn.borderColor || '#B08D45'}`,
        borderRadius: `${shareBtn.borderRadius ?? 10}px`,
        boxShadow: shareBtn.shadow || undefined,
        padding:
          shareBtn.size === 'lg'
            ? '14px 26px'
            : shareBtn.size === 'sm'
              ? '8px 16px'
              : '11px 22px',
        fontSize:
          shareBtn.size === 'lg' ? '16px' : shareBtn.size === 'sm' ? '13px' : '15px',
      }}
    >
      {ShareIcon && <ShareIcon size={shareBtn.size === 'sm' ? 15 : shareBtn.size === 'lg' ? 20 : 18} />}
      <span>{shareBtn.label || 'شارك'}</span>
    </button>
  ) : null;

  const isShareCenter = shareBtn?.position === 'top-center';
  const isShareRight = shareBtn?.position === 'top-right';

  return (
    <div
      style={{
        backgroundColor: poetryCfg.pageBgColor || '#FAF7F0',
        backgroundImage: poetryCfg.pageBgImage ? `url(${poetryCfg.pageBgImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
      className="min-h-[75vh] relative"
    >
      {poetryCfg.customCss && <style>{poetryCfg.customCss}</style>}

      {/* Ornate Poetry Banner */}
      <section
        className="relative overflow-hidden py-14 px-4 sm:px-6"
        style={{
          backgroundColor: poetryCfg.headerBgColor || '#0A1C13',
          backgroundImage: poetryCfg.headerBgImage ? `url(${poetryCfg.headerBgImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {poetryCfg.headerBgImage && (
          <div
            className="absolute inset-0 bg-black"
            style={{ opacity: poetryCfg.headerOverlayOpacity ?? 0.72 }}
          />
        )}
        <GeometricPattern
          config={{
            enabled: poetryCfg.pattern !== 'none',
            pattern: poetryCfg.pattern,
            primaryColor: poetryCfg.patternPrimary,
            secondaryColor: poetryCfg.patternSecondary,
            opacity: poetryCfg.patternOpacity ?? 0.08,
            size: 54,
            rotation: 0,
            spacing: 0,
            density: 1,
            position: 'repeat',
            blendMode: 'normal',
            animation: 'none',
            animationSpeed: 20,
            lineThickness: 1,
            borderStyle: 'none',
          }}
        />
        <div
          className={`relative z-10 max-w-[1320px] mx-auto flex flex-col gap-6 ${
            isShareCenter
              ? 'items-center text-center'
              : 'md:flex-row md:items-center justify-between'
          }`}
          style={{
            textAlign: isShareCenter ? 'center' : poetryCfg.headerAlign || 'right',
          }}
        >
          <div className="space-y-3 flex-1">
            {poetryCfg.showBreadcrumb && (
              <div
                className={`text-xs text-neutral-300/80 flex items-center gap-1.5 ${
                  isShareCenter ? 'justify-center' : ''
                }`}
              >
                <Link to="/" className="hover:text-white">
                  {settings.uiTexts?.breadcrumbHome || 'الرئيسية'}
                </Link>
                <span>/</span>
                <span style={{ color: poetryCfg.goldColor || '#D4AF65' }}>
                  {page?.title || poetryCfg.pageTitle || 'قصائد'}
                </span>
              </div>
            )}
            <h1 className={bannerTitleGrad.className} style={bannerTitleGrad.style}>
              {page?.title || poetryCfg.pageTitle || 'قصائد'}
            </h1>
            {(page?.seo_description || poetryCfg.pageSubtitle) && (
              <p
                style={buildTextStyle(poetryCfg.subtitleStyle, null, viewport)}
                className={`max-w-2xl ${isShareCenter ? 'mx-auto' : ''}`}
              >
                {page?.seo_description || poetryCfg.pageSubtitle}
              </p>
            )}
          </div>

          {shareButtonElement && (
            <div
              className={`shrink-0 ${
                isShareRight ? 'md:order-first' : isShareCenter ? 'flex justify-center' : ''
              }`}
            >
              {shareButtonElement}
            </div>
          )}
        </div>
      </section>

      {/* Filters & Poems Grid */}
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 py-10 space-y-8">
        {(poetryCfg.showSearchFilter || poetryCfg.showPoetFilter) && (
          <div className="bg-white/90 border border-[#E8E0D0] rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[220px]">
              {poetryCfg.showSearchFilter && (
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                  <Search
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
                  />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setPageNum(1);
                    }}
                    placeholder="ابحث في القصائد والأبيات أو اسم الشاعر..."
                    className="w-full pr-9 pl-3 py-2 rounded-xl border border-[#E8E0D0] bg-[#FAF7F0] text-sm outline-hidden focus:border-[#B08D45]"
                  />
                </div>
              )}

              {poetryCfg.showPoetFilter && poets.length > 0 && (
                <select
                  value={selectedPoet}
                  onChange={(e) => {
                    setSelectedPoet(e.target.value);
                    setPageNum(1);
                  }}
                  className="px-3 py-2 rounded-xl border border-[#E8E0D0] bg-[#FAF7F0] text-sm"
                >
                  <option value="all">جميع الشعراء</option>
                  {poets.map((pt) => (
                    <option key={pt} value={pt}>
                      {pt}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">الترتيب:</span>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPageNum(1);
                }}
                className="px-3 py-2 rounded-xl border border-[#E8E0D0] bg-white text-sm"
              >
                <option value="pinned-newest">المثبتة ثم الأحدث</option>
                <option value="newest">الأحدث نشراً</option>
                <option value="oldest">الأقدم</option>
                <option value="manual-order">الترتيب اليدوي</option>
              </select>
            </div>
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center text-neutral-500 text-sm">جاري تحميل الديوان...</div>
        ) : poems.length === 0 ? (
          <div className="py-20 text-center bg-white border border-[#E8E0D0] rounded-2xl p-8 space-y-3">
            <Feather className="w-10 h-10 mx-auto text-[#B08D45]" />
            <p className="text-neutral-700 font-semibold">لا توجد قصائد منشورة مطابقة حالياً.</p>
            {showShareButton && (
              <button
                type="button"
                onClick={() => {
                  setSubmitFeedback(null);
                  setModalOpen(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-bold cursor-pointer"
              >
                {shareBtn.label || 'شارك'}
              </button>
            )}
          </div>
        ) : (
          <div className={`grid ${gridClass}`} style={{ gap: `${poetryCfg.cardGap || 24}px` }}>
            {visiblePoems.map((poem) => {
              let design: PoemDesignOverride = {};
              try {
                design = JSON.parse(poem.design_json || '{}');
              } catch {
                design = {};
              }

              const versesLines = (poem.verses_text || '').split('\n').slice(0, 12);
              const isTruncated = (poem.verses_text || '').split('\n').length > 12;

              const cardHoverClass =
                poetryCfg.hoverEffect === 'lift'
                  ? 'hover:-translate-y-1'
                  : poetryCfg.hoverEffect === 'glow'
                    ? 'hover:shadow-[0_12px_32px_rgba(176,141,69,0.22)]'
                    : poetryCfg.hoverEffect === 'border'
                      ? 'hover:border-[#B08D45]'
                      : '';

              return (
                <article
                  key={poem.id}
                  className={`flex flex-col justify-between transition-all ${cardHoverClass}`}
                  style={{
                    backgroundColor: design.cardBg || poetryCfg.cardBg || '#FFFFFF',
                    borderColor: design.borderColor || poetryCfg.cardBorderColor || '#DECBA0',
                    borderWidth: `${design.borderWidth ?? poetryCfg.cardBorderWidth ?? 1}px`,
                    borderStyle: poetryCfg.cardBorderStyle || 'solid',
                    borderRadius: `${design.borderRadius ?? poetryCfg.cardBorderRadius ?? 14}px`,
                    boxShadow: design.shadow || poetryCfg.cardShadow || undefined,
                    padding: `${poetryCfg.cardPadding ?? 28}px`,
                    textAlign: design.alignment || 'center',
                  }}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-3 text-xs text-neutral-500">
                      <span className="inline-flex items-center gap-1.5">
                        {Boolean(poem.pinned) && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                            <Pin size={12} /> مثبتة
                          </span>
                        )}
                        {poem.published_at && (
                          <span>
                            {formatArabicDate(
                              poem.published_at,
                              settings.other?.dateFormat || 'arabic'
                            )}
                          </span>
                        )}
                      </span>
                      {poem.poet_name && (
                        <span
                          className="inline-flex items-center gap-1"
                          style={{
                            ...buildTextStyle(poetryCfg.poetNameStyle, null, viewport),
                            ...(design.poetColor ? { color: design.poetColor } : {}),
                          }}
                        >
                          <User size={13} />
                          {poem.poet_name}
                        </span>
                      )}
                    </div>

                    <Link to={`/poem/${poem.slug}`} className="block group">
                      <h2
                        className={`${poemCardGrad.className} group-hover:opacity-85 transition`}
                        style={{
                          ...poemCardGrad.style,
                          ...(design.titleColor
                            ? { color: design.titleColor, WebkitTextFillColor: design.titleColor }
                            : {}),
                          ...(design.fontFamily
                            ? { fontFamily: `'${design.fontFamily}', 'Amiri', serif` }
                            : {}),
                        }}
                      >
                        {poem.title}
                      </h2>
                    </Link>

                    {poem.intro_text && (
                      <p
                        className="mt-2"
                        style={{
                          ...buildTextStyle(poetryCfg.poemIntroStyle, null, viewport),
                          ...(design.introColor ? { color: design.introColor } : {}),
                        }}
                      >
                        {poem.intro_text}
                      </p>
                    )}

                    {renderSeparator(
                      design.separatorStyle || poetryCfg.separatorStyle,
                      design.separatorColor || poetryCfg.separatorColor
                    )}

                    <div
                      className="space-y-2 whitespace-pre-line"
                      style={{
                        ...buildTextStyle(poetryCfg.poemVerseStyle, null, viewport),
                        ...(design.verseColor ? { color: design.verseColor } : {}),
                        ...(design.fontFamily
                          ? { fontFamily: `'${design.fontFamily}', 'Amiri', serif` }
                          : {}),
                      }}
                    >
                      {versesLines.join('\n')}
                      {isTruncated && (
                        <div className="pt-2">
                          <Link
                            to={`/poem/${poem.slug}`}
                            className="text-xs font-bold underline"
                            style={{ color: poetryCfg.goldColor || '#B08D45' }}
                          >
                            اقرأ القصيدة كاملة...
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[#E8E0D0]/70 flex flex-wrap items-center justify-between gap-2">
                    <Link
                      to={`/poem/${poem.slug}`}
                      className="text-xs font-bold px-3.5 py-1.5 rounded-lg border border-[#DECBA0] text-[#0A1C13] hover:bg-[#FAF7F0] transition"
                    >
                      عرض صفحة القصيدة
                    </Link>

                    <button
                      type="button"
                      disabled={exportingId === poem.id}
                      onClick={async () => {
                        setExportingId(poem.id);
                        try {
                          await exportPoemAsPng(poem, poetryCfg, settings.identity?.siteName);
                        } finally {
                          setExportingId(null);
                        }
                      }}
                      className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-lg bg-[#0A1C13] text-[#FDE68A] hover:bg-[#14532D] transition cursor-pointer disabled:opacity-50"
                    >
                      <Download size={14} />
                      {exportingId === poem.id ? 'جاري التصدير...' : 'حفظ كصورة PNG'}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* Pagination / Load More */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            {poetryCfg.paginationMode === 'load-more' ? (
              pageNum < totalPages && (
                <button
                  type="button"
                  onClick={() => setPageNum((p) => p + 1)}
                  className="px-6 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-bold cursor-pointer"
                >
                  عرض المزيد من القصائد
                </button>
              )
            ) : (
              Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPageNum(i + 1)}
                  className={`w-9 h-9 rounded-lg text-sm font-bold cursor-pointer ${
                    pageNum === i + 1
                      ? 'bg-[#14532D] text-white'
                      : 'bg-white border border-[#E8E0D0] text-neutral-700'
                  }`}
                >
                  {i + 1}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Visitor Poem Submission Modal (No account or login required) */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full p-6 sm:p-8 shadow-2xl relative my-8"
            style={{
              maxWidth: formCfg.width || '620px',
              backgroundColor: formCfg.bgColor || '#FFFFFF',
              border: `1px solid ${formCfg.borderColor || '#DECBA0'}`,
              borderRadius: `${formCfg.borderRadius ?? 16}px`,
              color: formCfg.textColor || '#171717',
            }}
          >
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 float-left cursor-pointer"
              aria-label="إغلاق"
            >
              <X size={20} />
            </button>

            <div className="space-y-1.5 mb-5">
              <h3 className="text-xl font-bold" style={{ color: formCfg.labelColor || '#0A1C13' }}>
                {formCfg.title}
              </h3>
              <p className="text-sm text-neutral-600 leading-relaxed">{formCfg.subtitle}</p>
            </div>

            {submitFeedback && (
              <div
                className={`mb-4 p-3.5 rounded-xl text-sm font-semibold border ${
                  submitFeedback.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}
              >
                {submitFeedback.text}
              </div>
            )}

            <form onSubmit={handleSubmitPoem} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-1" style={{ color: formCfg.labelColor }}>
                  {formCfg.labelTitle} *
                </label>
                <input
                  type="text"
                  required
                  value={subTitle}
                  onChange={(e) => setSubTitle(e.target.value)}
                  placeholder={formCfg.placeholderTitle}
                  className="w-full px-3.5 py-2.5 text-sm outline-hidden"
                  style={{
                    backgroundColor: formCfg.inputBg,
                    color: formCfg.inputText,
                    border: `1px solid ${formCfg.inputBorder}`,
                    borderRadius: `${formCfg.inputRadius ?? 10}px`,
                  }}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-1" style={{ color: formCfg.labelColor }}>
                  {formCfg.labelVerses} *
                </label>
                <textarea
                  required
                  rows={formCfg.textareaRows || 7}
                  maxLength={formCfg.maxCharacters || 6000}
                  value={subVerses}
                  onChange={(e) => setSubVerses(e.target.value)}
                  placeholder={formCfg.placeholderVerses}
                  className="w-full px-3.5 py-2.5 text-sm outline-hidden leading-relaxed"
                  style={{
                    backgroundColor: formCfg.inputBg,
                    color: formCfg.inputText,
                    border: `1px solid ${formCfg.inputBorder}`,
                    borderRadius: `${formCfg.inputRadius ?? 10}px`,
                  }}
                />
              </div>

              {formCfg.showPoetName !== false && (
                <div>
                  <label className="block text-sm font-bold mb-1" style={{ color: formCfg.labelColor }}>
                    {formCfg.labelPoetName} {formCfg.requirePoetName ? '*' : ''}
                  </label>
                  <input
                    type="text"
                    required={formCfg.requirePoetName}
                    value={subPoetName}
                    onChange={(e) => setSubPoetName(e.target.value)}
                    placeholder={formCfg.placeholderPoetName}
                    className="w-full px-3.5 py-2.5 text-sm outline-hidden"
                    style={{
                      backgroundColor: formCfg.inputBg,
                      color: formCfg.inputText,
                      border: `1px solid ${formCfg.inputBorder}`,
                      borderRadius: `${formCfg.inputRadius ?? 10}px`,
                    }}
                  />
                </div>
              )}

              {formCfg.showExtraInfo && (
                <div>
                  <label className="block text-sm font-bold mb-1" style={{ color: formCfg.labelColor }}>
                    {formCfg.labelExtraInfo} {formCfg.requireExtraInfo ? '*' : ''}
                  </label>
                  <textarea
                    rows={3}
                    required={formCfg.requireExtraInfo}
                    value={subExtraInfo}
                    onChange={(e) => setSubExtraInfo(e.target.value)}
                    placeholder={formCfg.placeholderExtraInfo}
                    className="w-full px-3.5 py-2.5 text-sm outline-hidden"
                    style={{
                      backgroundColor: formCfg.inputBg,
                      color: formCfg.inputText,
                      border: `1px solid ${formCfg.inputBorder}`,
                      borderRadius: `${formCfg.inputRadius ?? 10}px`,
                    }}
                  />
                </div>
              )}

              {customFields.map((cf) => (
                <div key={cf.id}>
                  <label className="block text-sm font-bold mb-1" style={{ color: formCfg.labelColor }}>
                    {cf.label} {cf.required ? '*' : ''}
                  </label>
                  {cf.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      required={cf.required}
                      value={customValues[cf.id] || ''}
                      onChange={(e) =>
                        setCustomValues((prev) => ({ ...prev, [cf.id]: e.target.value }))
                      }
                      placeholder={cf.placeholder}
                      className="w-full px-3.5 py-2.5 text-sm outline-hidden"
                      style={{
                        backgroundColor: formCfg.inputBg,
                        color: formCfg.inputText,
                        border: `1px solid ${formCfg.inputBorder}`,
                        borderRadius: `${formCfg.inputRadius ?? 10}px`,
                      }}
                    />
                  ) : (
                    <input
                      type={cf.type === 'email' ? 'email' : cf.type === 'phone' ? 'tel' : 'text'}
                      required={cf.required}
                      value={customValues[cf.id] || ''}
                      onChange={(e) =>
                        setCustomValues((prev) => ({ ...prev, [cf.id]: e.target.value }))
                      }
                      placeholder={cf.placeholder}
                      className="w-full px-3.5 py-2.5 text-sm outline-hidden"
                      style={{
                        backgroundColor: formCfg.inputBg,
                        color: formCfg.inputText,
                        border: `1px solid ${formCfg.inputBorder}`,
                        borderRadius: `${formCfg.inputRadius ?? 10}px`,
                      }}
                    />
                  )}
                </div>
              ))}

              {formCfg.privacyNotice && (
                <p className="text-xs text-neutral-600 bg-amber-50/70 border border-amber-200 rounded-xl p-3">
                  {formCfg.privacyNotice}
                </p>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-neutral-300 text-sm font-semibold cursor-pointer"
                >
                  إغلاق
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold cursor-pointer disabled:opacity-60"
                  style={{
                    backgroundColor: formCfg.submitBg || '#B08D45',
                    color: formCfg.submitText || '#FFFFFF',
                  }}
                >
                  {submitting ? 'جاري الإرسال...' : formCfg.submitLabel}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
