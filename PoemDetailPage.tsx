import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, Copy, Download, Share2, User } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { CustomLoader } from '../../components/CustomLoader';
import { usePlatform } from '../../context/PlatformContext';
import { exportPoemAsPng } from '../../lib/poemImageExport';
import {
  buildTextStyle,
  buildTitleGradientProps,
  formatArabicDate,
  syncPageSeo,
} from '../../lib/styleEngine';
import type { PoemDesignOverride, PoemRecord } from '../../types/platform';

export function PoemDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { settings, viewport } = usePlatform();
  const [poem, setPoem] = useState<PoemRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetch(`/api/public/poems/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error || 'القصيدة غير موجودة');
        }
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setPoem(data.poem);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'تعذر تحميل القصيدة');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!poem || !settings) return;
    syncPageSeo({
      title: `${poem.title} | ${settings.identity.siteName}`,
      description: poem.intro_text || `${poem.title}${poem.poet_name ? ` - ${poem.poet_name}` : ''}`,
      ogImage: poem.cover_image_url || settings.identity.defaultShareImage,
    });
  }, [poem?.id, settings]);

  if (!settings) return null;
  const poetryCfg = settings.poetry;

  if (loading) {
    return (
      <div className="py-24 flex justify-center">
        <CustomLoader config={settings.loading.pageNav} label="جاري تحميل القصيدة..." />
      </div>
    );
  }

  if (error || !poem) {
    return (
      <div className="max-w-xl mx-auto py-20 px-4 text-center space-y-4">
        <p className="text-neutral-600">{error || 'القصيدة غير موجودة أو غير منشورة.'}</p>
        <Link
          to="/p/poems"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#14532D] text-white text-sm font-bold"
        >
          <ArrowRight size={16} />
          العودة إلى صفحة قصائد
        </Link>
      </div>
    );
  }

  let design: PoemDesignOverride = {};
  try {
    design = JSON.parse(poem.design_json || '{}');
  } catch {
    design = {};
  }

  const titleGrad = buildTitleGradientProps(
    settings,
    'poemCardTitle',
    buildTextStyle(poetryCfg.poemTitleStyle, null, viewport)
  );

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <div
      className="min-h-[75vh] py-12 px-4 sm:px-6"
      style={{
        backgroundColor: design.bgColor || poetryCfg.pageBgColor || '#FAF7F0',
        backgroundImage: design.bgImage ? `url(${design.bgImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <Link to="/p/poems" className="inline-flex items-center gap-1.5 hover:text-[#14532D] font-semibold">
            <ArrowRight size={14} />
            العودة إلى ديوان القصائد
          </Link>
          {poem.published_at && (
            <span>{formatArabicDate(poem.published_at, settings.other?.dateFormat || 'arabic')}</span>
          )}
        </div>

        <article
          className="p-7 sm:p-10 shadow-lg"
          style={{
            backgroundColor: design.cardBg || poetryCfg.cardBg || '#FFFFFF',
            borderColor: design.borderColor || poetryCfg.cardBorderColor || '#DECBA0',
            borderWidth: `${design.borderWidth ?? 1}px`,
            borderStyle: poetryCfg.cardBorderStyle || 'solid',
            borderRadius: `${design.borderRadius ?? 16}px`,
            textAlign: design.alignment || 'center',
          }}
        >
          {poem.cover_image_url && (
            <img
              src={poem.cover_image_url}
              alt={poem.title}
              className="w-full max-h-80 object-cover rounded-xl mb-6"
            />
          )}

          <h1
            className={titleGrad.className}
            style={{
              ...titleGrad.style,
              ...(design.titleColor ? { color: design.titleColor, WebkitTextFillColor: design.titleColor } : {}),
              ...(design.fontFamily ? { fontFamily: `'${design.fontFamily}', 'Amiri', serif` } : {}),
            }}
          >
            {poem.title}
          </h1>

          {poem.poet_name && (
            <div
              className="mt-3 inline-flex items-center gap-1.5 justify-center"
              style={{
                ...buildTextStyle(poetryCfg.poetNameStyle, null, viewport),
                ...(design.poetColor ? { color: design.poetColor } : {}),
              }}
            >
              <User size={15} />
              <span>{poem.poet_name}</span>
            </div>
          )}

          {poem.intro_text && (
            <p
              className="mt-4 max-w-xl mx-auto"
              style={{
                ...buildTextStyle(poetryCfg.poemIntroStyle, null, viewport),
                ...(design.introColor ? { color: design.introColor } : {}),
              }}
            >
              {poem.intro_text}
            </p>
          )}

          <div className="my-6 flex items-center justify-center gap-3">
            <span className="h-px w-20 bg-[#B08D45]/40" />
            <span className="w-2.5 h-2.5 rotate-45 bg-[#B08D45]" />
            <span className="h-px w-20 bg-[#B08D45]/40" />
          </div>

          <div
            className="whitespace-pre-line leading-loose"
            style={{
              ...buildTextStyle(poetryCfg.poemVerseStyle, null, viewport),
              ...(design.verseColor ? { color: design.verseColor } : {}),
              ...(design.fontFamily ? { fontFamily: `'${design.fontFamily}', 'Amiri', serif` } : {}),
            }}
          >
            {poem.verses_text}
          </div>

          <div className="mt-8 pt-6 border-t border-[#E8E0D0] flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              disabled={exporting}
              onClick={async () => {
                setExporting(true);
                try {
                  await exportPoemAsPng(poem, poetryCfg, settings.identity?.siteName);
                } finally {
                  setExporting(false);
                }
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0A1C13] text-[#FDE68A] text-sm font-bold hover:bg-[#14532D] transition cursor-pointer disabled:opacity-50"
            >
              <Download size={16} />
              {exporting ? 'جاري التصدير...' : 'حفظ القصيدة كصورة PNG'}
            </button>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#DECBA0] text-sm font-semibold hover:bg-[#FAF7F0] cursor-pointer"
            >
              {copied ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
              {copied ? 'تم نسخ الرابط' : 'نسخ رابط القصيدة'}
            </button>

            {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
              <button
                type="button"
                onClick={() => void navigator.share({ title: poem.title, url: shareUrl })}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[#DECBA0] text-sm font-semibold hover:bg-[#FAF7F0] cursor-pointer"
              >
                <Share2 size={16} />
                مشاركة
              </button>
            )}
          </div>
        </article>
      </div>
    </div>
  );
}
