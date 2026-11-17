import React, { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, Download, ExternalLink, FileText, Maximize2, Share2, X } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { ActionButtons } from '../../components/ActionButtons';
import { CustomComponents } from '../../components/CustomComponents';
import { CustomLoader } from '../../components/CustomLoader';
import { CustomTextBlocks } from '../../components/CustomTextBlocks';
import { GeometricPattern } from '../../components/GeometricPattern';
import { InfoCard } from '../../components/InfoCard';
import { MediaCard } from '../../components/MediaCard';
import { OfficialAccountAttribution } from '../../components/OfficialAccountAttribution';
import { VideoPlayer, type PlayerRendition } from '../../components/VideoPlayer';
import { usePlatform } from '../../context/PlatformContext';
import {
  buildBackgroundStyle,
  buildTextStyle,
  CONTENT_TYPE_LABELS,
  formatArabicDate,
  syncPageSeo,
} from '../../lib/styleEngine';
import type { ContentRecord, MediaFileRecord, SubtitleTrackRecord } from '../../types/platform';

export function ContentDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { settings, viewport } = usePlatform();
  const [item, setItem] = useState<ContentRecord | null>(null);
  const [mediaFile, setMediaFile] = useState<MediaFileRecord | null>(null);
  const [subtitles, setSubtitles] = useState<SubtitleTrackRecord[]>([]);
  const [related, setRelated] = useState<ContentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [activeGalleryIdx, setActiveGalleryIdx] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    setActiveGalleryIdx(0);
    setLightboxOpen(false);

    fetch(`/api/public/content/${encodeURIComponent(slug)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          throw new Error(e.error || 'المادة غير موجودة');
        }
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setItem(data.item);
        setMediaFile(data.mediaFile || null);
        setSubtitles(data.subtitles || []);
        setRelated(data.related || []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'تعذر تحميل المادة');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  useEffect(() => {
    if (!item || !settings) return;
    syncPageSeo({
      title: `${item.title} | ${settings.identity.siteName}`,
      description: item.description || settings.identity.metaDescription,
      ogImage: item.thumbnail_url || item.media_url || settings.identity.defaultShareImage,
    });
  }, [item?.id, settings]);

  useEffect(() => {
    if (!lightboxOpen) return;
    const gUrls: string[] = (() => {
      try {
        return JSON.parse(item?.gallery_urls_json || '[]');
      } catch {
        return [];
      }
    })();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (gUrls.length > 1) {
        if (e.key === 'ArrowLeft') setActiveGalleryIdx((i) => (i + 1) % gUrls.length);
        if (e.key === 'ArrowRight') setActiveGalleryIdx((i) => (i - 1 + gUrls.length) % gUrls.length);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxOpen, item?.gallery_urls_json]);

  if (!settings) return null;

  const uiTexts = settings.uiTexts;
  const typeLabels = uiTexts?.contentTypeLabels || CONTENT_TYPE_LABELS;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <CustomLoader
          config={settings.loading.videoOpen}
          label={uiTexts?.loadingContent || 'جاري تحميل المادة...'}
        />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-neutral-600">{error || uiTexts?.detailNotFound || 'المادة غير موجودة'}</p>
        <Link
          to="/"
          className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: settings.colors.primary || '#B08D45' }}
        >
          {uiTexts?.backToHomeLabel || 'العودة للرئيسية'}
        </Link>
      </div>
    );
  }

  let itemSettings: any = {};
  try {
    itemSettings = JSON.parse(item.settings_json || '{}');
  } catch {
    itemSettings = {};
  }

  const renditions: PlayerRendition[] = (() => {
    if (!mediaFile?.renditions_json) return [];
    try {
      return JSON.parse(mediaFile.renditions_json);
    } catch {
      return [];
    }
  })();

  const galleryUrls: string[] = (() => {
    try {
      return JSON.parse(item.gallery_urls_json || '[]');
    } catch {
      return [];
    }
  })();

  const isVideo = item.content_type === 'video';
  const isImage = item.content_type === 'image' || item.content_type === 'gallery';
  const isAudio = item.content_type === 'audio';
  const isDoc = item.content_type === 'document';

  const bgConfig = isVideo
    ? settings.backgrounds.videoDetail
    : isImage
      ? settings.backgrounds.imageDetail
      : settings.backgrounds.articleDetail;

  const decoConfig = isVideo
    ? settings.decorations.videoPages
    : isImage
      ? settings.decorations.imagePages
      : settings.decorations.pages;

  const titleStyleKey = isVideo ? 'videoTitle' : isImage ? 'imageTitle' : 'postTitle';
  const titleGradientMode: 'inherit' | 'custom' | 'disabled' =
    itemSettings.titleGradientMode === 'disabled' ||
    itemSettings.titleStyleOverride?.gradient?.enabled === false
      ? 'disabled'
      : itemSettings.titleGradientMode === 'custom' ||
          itemSettings.titleStyleOverride?.gradient?.enabled === true
        ? 'custom'
        : 'inherit';

  const mergedTitleTypo = {
    ...settings.typography[titleStyleKey],
    ...(itemSettings.titleStyleOverride || {}),
    disableTargetGradient: titleGradientMode === 'disabled',
  };
  const mergedTitleGrad =
    titleGradientMode === 'disabled'
      ? null
      : titleGradientMode === 'custom'
        ? itemSettings.titleStyleOverride?.gradient
        : settings.colors.targets[titleStyleKey]?.gradient;
  const titleStyle = buildTextStyle(mergedTitleTypo, mergedTitleGrad, viewport);

  const playerConfig = itemSettings.playerOverride
    ? { ...settings.player, ...itemSettings.playerOverride }
    : settings.player;

  const relatedCfg = itemSettings.relatedOverride
    ? { ...settings.related, ...itemSettings.relatedOverride }
    : settings.related;
  const relatedVisible = relatedCfg.enabled && !relatedCfg.deleted;
  const maxRelated = Math.max(0, Number(relatedCfg.maxItems || 0));
  const boundedRelated = related.slice(0, maxRelated);

  const allowDownload =
    itemSettings.allowDownload !== undefined
      ? Boolean(itemSettings.allowDownload)
      : isVideo
        ? settings.links.allowVideoDownload
        : isAudio
          ? settings.links.allowAudioDownload
          : settings.links.allowImageDownload;

  const allowShare =
    itemSettings.allowShare !== undefined
      ? Boolean(itemSettings.allowShare)
      : settings.links.allowNativeShare;

  const handleCopyLink = async () => {
    await navigator.clipboard?.writeText(window.location.href).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: item.title, url: window.location.href }).catch(() => {});
    } else {
      handleCopyLink();
    }
  };

  const activeImageSrc =
    galleryUrls.length > 0 ? galleryUrls[activeGalleryIdx] || galleryUrls[0] : item.media_url || item.thumbnail_url;

  const displayedDate =
    itemSettings.dateIsManual && itemSettings.customPublishedAt
      ? itemSettings.customPublishedAt
      : formatArabicDate(item.published_at || item.created_at, settings.other.dateFormat);

  const itemCustomButtons = Array.isArray(itemSettings.customButtons) ? itemSettings.customButtons : [];
  const customLinkLabel =
    item.link_label || itemSettings.linkLabel || uiTexts?.openExternalLinkLabel || 'فتح الرابط المرتبط';

  const infoCardPos = itemSettings.infoCardOverride?.position || settings.infoCard?.position || 'left';
  const mobileInfoPos = itemSettings.infoCardOverride?.mobilePosition || settings.infoCard?.mobilePosition || 'below';
  const btnStyles = settings.links?.buttonStyles;
  const btnRadius = btnStyles?.borderRadius !== undefined ? `${btnStyles.borderRadius}px` : '8px';
  const btnSizeCls =
    btnStyles?.size === 'sm'
      ? 'px-3 py-1.5 text-[11px]'
      : btnStyles?.size === 'lg'
        ? 'px-5 py-2.5 text-sm'
        : 'px-4 py-2 text-xs';
  const safeFilenameBase = (item.slug || item.title || 'file').replace(/[\\/:*?"<>|]/g, '-');

  const desktopCols = Math.max(1, Math.min(4, Number(relatedCfg.cardDesign?.columns || 3)));
  const mobileCols = Math.max(1, Math.min(2, Number(relatedCfg.cardDesign?.columnsMobile || 1)));
  const relatedGridClass =
    relatedCfg.cardDesign?.layout === 'list'
      ? 'grid-cols-1'
      : `${mobileCols === 2 ? 'grid-cols-2' : 'grid-cols-1'} sm:grid-cols-2 ${
          desktopCols === 4 ? 'lg:grid-cols-4' : desktopCols === 2 ? 'lg:grid-cols-2' : 'lg:grid-cols-3'
        }`;

  return (
    <div className="relative min-h-[70vh] py-8" style={buildBackgroundStyle(bgConfig)}>
      <GeometricPattern config={decoConfig} />

      <div className="relative z-10 max-w-[1320px] mx-auto px-4 sm:px-6 space-y-8">
        <CustomComponents location="detail-top" pageId={item.page_id} />
        <CustomTextBlocks location="detail-top" />

        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
          <Link to="/" className="hover:text-[#8C6A2F]">
            {uiTexts?.breadcrumbHome || 'الرئيسية'}
          </Link>
          <span>/</span>
          {item.page_title && (
            <>
              <span>{item.page_title}</span>
              <span>/</span>
            </>
          )}
          <span className="text-neutral-800 font-semibold">{item.title}</span>
        </nav>

        {/* VIDEO DETAIL LAYOUT */}
        {isVideo ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div
              className={`${infoCardPos === 'below' ? 'lg:col-span-12' : 'lg:col-span-8'} ${
                infoCardPos === 'right' ? 'lg:order-2' : 'lg:order-1'
              } ${mobileInfoPos === 'above' ? 'order-2' : 'order-1'} space-y-5`}
            >
              <VideoPlayer
                src={item.media_url}
                poster={item.thumbnail_url}
                title={item.title}
                renditions={renditions}
                subtitles={subtitles}
                playerConfig={playerConfig}
                subtitleStyle={settings.subtitles}
                bufferLoader={settings.loading.videoBuffer}
                allowDownload={allowDownload}
                allowShare={allowShare}
                onShare={handleNativeShare}
              />

              <OfficialAccountAttribution item={item} placement="below-media" />

              <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-3">
                <h1 style={titleStyle}>{item.title}</h1>
                <OfficialAccountAttribution item={item} placement="below-title" />
                {item.description && (
                  <p
                    className="leading-relaxed whitespace-pre-line"
                    style={buildTextStyle(settings.typography.description, null, viewport)}
                  >
                    {item.description}
                  </p>
                )}
                <OfficialAccountAttribution item={item} placement="below-content" />

                <div className="pt-3 border-t border-neutral-100 flex flex-wrap items-center gap-2.5">
                  {allowDownload && item.media_url && (
                    <a
                      href={item.media_url}
                      download={safeFilenameBase}
                      className={`inline-flex items-center gap-1.5 font-semibold transition-opacity hover:opacity-90 ${btnSizeCls}`}
                      style={{
                        backgroundColor: btnStyles?.downloadBg || settings.colors.primary || '#B08D45',
                        color: btnStyles?.downloadText || '#FFFFFF',
                        borderRadius: btnRadius,
                      }}
                    >
                      <Download size={14} />
                      <span>{uiTexts?.downloadVideoLabel || 'تحميل الفيديو'}</span>
                    </a>
                  )}
                  {allowShare && (
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className={`inline-flex items-center gap-1.5 font-semibold border border-neutral-200 hover:opacity-90 cursor-pointer ${btnSizeCls}`}
                      style={{
                        backgroundColor: btnStyles?.shareBg || '#FFFFFF',
                        color: btnStyles?.shareText || '#404040',
                        borderRadius: btnRadius,
                      }}
                    >
                      <Share2 size={14} />
                      <span>{uiTexts?.shareLabel || 'مشاركة'}</span>
                    </button>
                  )}
                  {settings.links.allowCopyLink && (
                    <button
                      type="button"
                      onClick={handleCopyLink}
                      className={`inline-flex items-center gap-1.5 font-semibold border border-neutral-200 hover:opacity-90 cursor-pointer ${btnSizeCls}`}
                      style={{
                        backgroundColor: btnStyles?.copyBg || '#FFFFFF',
                        color: btnStyles?.copyText || '#404040',
                        borderRadius: btnRadius,
                      }}
                    >
                      {copied ? <Check size={14} className="text-[#8C6A2F]" /> : <Copy size={14} />}
                      <span>
                        {copied
                          ? uiTexts?.copiedLinkLabel || 'تم نسخ الرابط'
                          : uiTexts?.copyLinkLabel || 'نسخ الرابط'}
                      </span>
                    </button>
                  )}
                  {item.link_enabled && item.link_url && (
                    <a
                      href={item.link_url}
                      target={item.link_new_tab ? '_blank' : undefined}
                      rel={item.link_new_tab ? 'noopener noreferrer' : undefined}
                      className={`inline-flex items-center gap-1.5 font-semibold text-white ${btnSizeCls}`}
                      style={{
                        backgroundColor: settings.colors.goldAccent || '#9c932b',
                        borderRadius: btnRadius,
                      }}
                    >
                      <ExternalLink size={14} />
                      <span>{customLinkLabel}</span>
                    </a>
                  )}
                  <ActionButtons
                    buttons={[...(settings.buttons || []), ...itemCustomButtons]}
                    placement="video"
                    downloadUrl={item.media_url}
                    contextTitle={item.title}
                  />
                </div>
              </div>
            </div>

            <div
              className={`${infoCardPos === 'below' ? 'lg:col-span-12' : 'lg:col-span-4'} ${
                infoCardPos === 'right' ? 'lg:order-1' : 'lg:order-2'
              } ${
                mobileInfoPos === 'hidden'
                  ? 'hidden lg:block'
                  : mobileInfoPos === 'above'
                    ? 'order-1'
                    : 'order-2'
              } space-y-6`}
            >
              <InfoCard
                item={item}
                config={settings.infoCard}
                dateFormat={settings.other.dateFormat}
              />

              {relatedCfg.position === 'sidebar' && relatedVisible && boundedRelated.length > 0 && (
                <div className="space-y-3">
                  <h2
                    className="text-base font-bold text-neutral-900"
                    style={buildTextStyle(
                      settings.typography.related,
                      settings.colors.targets.related?.gradient?.enabled
                        ? settings.colors.targets.related.gradient
                        : settings.colors.targets.pageHeading?.gradient,
                      viewport
                    )}
                  >
                    {relatedCfg.title}
                  </h2>
                  <div className="space-y-3">
                    {boundedRelated.map((rel) => (
                      <MediaCard
                        key={rel.id}
                        item={rel}
                        variant="compact"
                        showThumbnail={relatedCfg.cardDesign.showThumbnail}
                        showTitle={relatedCfg.cardDesign.showTitle}
                        showDate={relatedCfg.cardDesign.showDate}
                        showDescription={relatedCfg.cardDesign.showDescription}
                        showBadge={relatedCfg.cardDesign.showBadge}
                        showPlayButton={relatedCfg.cardDesign.showPlayButton}
                        cardDesignOverride={relatedCfg.cardDesign}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : isImage ? (
          /* IMAGE / GALLERY DETAIL */
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden p-4 sm:p-6 space-y-5">
              {activeImageSrc && (
                <div className="relative overflow-hidden rounded-lg bg-neutral-950 flex justify-center group">
                  {item.link_enabled && item.link_url ? (
                    item.link_url.startsWith('/') && !item.link_new_tab ? (
                      <Link to={item.link_url} className="block max-w-full">
                        <img
                          src={activeImageSrc}
                          alt={itemSettings.altText || item.title}
                          style={{ objectPosition: itemSettings.imageFocalPoint || 'center' }}
                          className="max-h-[75vh] w-auto object-contain mx-auto"
                        />
                      </Link>
                    ) : (
                      <a
                        href={item.link_url}
                        target={item.link_new_tab ? '_blank' : undefined}
                        rel={item.link_new_tab ? 'noopener noreferrer' : undefined}
                        className="block max-w-full"
                      >
                        <img
                          src={activeImageSrc}
                          alt={itemSettings.altText || item.title}
                          style={{ objectPosition: itemSettings.imageFocalPoint || 'center' }}
                          className="max-h-[75vh] w-auto object-contain mx-auto"
                        />
                      </a>
                    )
                  ) : (
                    <img
                      src={activeImageSrc}
                      alt={itemSettings.altText || item.title}
                      onClick={() => setLightboxOpen(true)}
                      style={{ objectPosition: itemSettings.imageFocalPoint || 'center' }}
                      className="max-h-[75vh] w-auto object-contain mx-auto cursor-zoom-in"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    aria-label="عرض بالحجم الكامل"
                    className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/70 text-white text-xs font-semibold hover:bg-black/90 transition-colors cursor-pointer"
                  >
                    <Maximize2 size={13} />
                    <span>تكبير</span>
                  </button>
                </div>
              )}

              {galleryUrls.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {galleryUrls.map((u, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveGalleryIdx(idx)}
                      className={`h-16 w-24 overflow-hidden rounded-lg border-2 cursor-pointer ${
                        idx === activeGalleryIdx ? 'border-[#B08D45]' : 'border-transparent opacity-70'
                      }`}
                    >
                      <img src={u} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <OfficialAccountAttribution item={item} placement="below-media" />

              <div className="space-y-3 pt-2">
                <div className="text-xs text-neutral-500 flex items-center gap-2">
                  <span>{typeLabels[item.content_type] || item.content_type}</span>
                  <span>·</span>
                  <span>{displayedDate}</span>
                </div>
                <h1 style={titleStyle}>{item.title}</h1>
                <OfficialAccountAttribution item={item} placement="below-title" />
                {item.description && (
                  <p className="text-neutral-700 leading-relaxed whitespace-pre-line">{item.description}</p>
                )}
                <OfficialAccountAttribution item={item} placement="below-content" />

                <div className="pt-3 border-t border-neutral-100 flex flex-wrap items-center gap-2.5">
                  {item.link_enabled && item.link_url && (
                    item.link_url.startsWith('/') && !item.link_new_tab ? (
                      <Link
                        to={item.link_url}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white"
                        style={{ backgroundColor: settings.colors.primary || '#B08D45' }}
                      >
                        <ExternalLink size={14} />
                        <span>{customLinkLabel}</span>
                      </Link>
                    ) : (
                      <a
                        href={item.link_url}
                        target={item.link_new_tab ? '_blank' : undefined}
                        rel={item.link_new_tab ? 'noopener noreferrer' : undefined}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-white"
                        style={{ backgroundColor: settings.colors.primary || '#B08D45' }}
                      >
                        <ExternalLink size={14} />
                        <span>{customLinkLabel}</span>
                      </a>
                    )
                  )}
                  {allowDownload && activeImageSrc && (
                    <a
                      href={activeImageSrc}
                      download={safeFilenameBase}
                      className={`inline-flex items-center gap-1.5 font-semibold border border-neutral-200 hover:opacity-90 ${btnSizeCls}`}
                      style={{
                        backgroundColor: btnStyles?.downloadBg || '#FFFFFF',
                        color: btnStyles?.downloadText || '#404040',
                        borderRadius: btnRadius,
                      }}
                    >
                      <Download size={14} />
                      <span>{uiTexts?.downloadImageLabel || 'تحميل الصورة'}</span>
                    </a>
                  )}
                  {allowShare && (
                    <button
                      type="button"
                      onClick={handleNativeShare}
                      className={`inline-flex items-center gap-1.5 font-semibold border border-neutral-200 hover:opacity-90 cursor-pointer ${btnSizeCls}`}
                      style={{
                        backgroundColor: btnStyles?.shareBg || '#FFFFFF',
                        color: btnStyles?.shareText || '#404040',
                        borderRadius: btnRadius,
                      }}
                    >
                      <Share2 size={14} />
                      <span>{uiTexts?.shareLabel || 'مشاركة'}</span>
                    </button>
                  )}
                  <ActionButtons
                    buttons={[...(settings.buttons || []), ...itemCustomButtons]}
                    placement="image"
                    downloadUrl={activeImageSrc}
                    contextTitle={item.title}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* ARTICLE / REPORT / POST / AUDIO / DOCUMENT */
          <article className="max-w-4xl mx-auto bg-white rounded-xl border border-neutral-200 p-6 sm:p-10 space-y-6">
            <div className="space-y-3 border-b border-neutral-200 pb-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                <span className="font-semibold text-[#8C6A2F]">
                  {typeLabels[item.content_type] || item.content_type}
                </span>
                <span>·</span>
                <span>{displayedDate}</span>
                {item.editor_label && (
                  <>
                    <span>·</span>
                    <span>{item.editor_label}</span>
                  </>
                )}
              </div>
              <h1 style={titleStyle}>{item.title}</h1>
              <OfficialAccountAttribution item={item} placement="below-title" />
              {item.description && (
                <p className="text-base text-neutral-600 leading-relaxed">{item.description}</p>
              )}
            </div>

            {item.thumbnail_url && (
              <img
                src={item.thumbnail_url}
                alt={itemSettings.altText || item.title}
                className="w-full max-h-[460px] object-cover rounded-xl border border-neutral-200"
              />
            )}

            <OfficialAccountAttribution item={item} placement="below-media" />

            {isAudio && item.media_url && (
              <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200">
                <audio controls src={item.media_url} className="w-full" />
              </div>
            )}

            {isDoc && item.media_url && (
              <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <FileText size={22} className="text-[#8C6A2F]" />
                  <span className="text-sm font-semibold text-neutral-800">
                    {uiTexts?.documentAttachedLabel || 'ملف الوثيقة المرفق'}
                  </span>
                </div>
                <a
                  href={item.media_url}
                  download={safeFilenameBase}
                  className={`inline-flex items-center gap-1.5 font-semibold ${btnSizeCls}`}
                  style={{
                    backgroundColor: btnStyles?.downloadBg || settings.colors.primary || '#B08D45',
                    color: btnStyles?.downloadText || '#FFFFFF',
                    borderRadius: btnRadius,
                  }}
                >
                  <Download size={14} />
                  <span>{uiTexts?.downloadDocumentLabel || 'تحميل الوثيقة'}</span>
                </a>
              </div>
            )}

            {item.body && (
              <div
                className="prose prose-neutral max-w-none leading-loose whitespace-pre-line"
                style={buildTextStyle(settings.typography.description, null, viewport)}
              >
                {item.body}
              </div>
            )}

            <OfficialAccountAttribution item={item} placement="below-content" />

            <div className="pt-4 border-t border-neutral-200 flex flex-wrap items-center gap-2.5">
              {item.link_enabled && item.link_url && (
                <a
                  href={item.link_url}
                  target={item.link_new_tab ? '_blank' : undefined}
                  rel={item.link_new_tab ? 'noopener noreferrer' : undefined}
                  className={`inline-flex items-center gap-1.5 font-semibold text-white ${btnSizeCls}`}
                  style={{
                    backgroundColor: settings.colors.primary || '#B08D45',
                    borderRadius: btnRadius,
                  }}
                >
                  <ExternalLink size={14} />
                  <span>{customLinkLabel}</span>
                </a>
              )}
              {allowShare && (
                <button
                  type="button"
                  onClick={handleNativeShare}
                  className={`inline-flex items-center gap-1.5 font-semibold border border-neutral-200 hover:opacity-90 cursor-pointer ${btnSizeCls}`}
                  style={{
                    backgroundColor: btnStyles?.shareBg || '#FFFFFF',
                    color: btnStyles?.shareText || '#404040',
                    borderRadius: btnRadius,
                  }}
                >
                  <Share2 size={14} />
                  <span>{uiTexts?.shareLabel || 'مشاركة'}</span>
                </button>
              )}
              {settings.links.allowCopyLink && (
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className={`inline-flex items-center gap-1.5 font-semibold border border-neutral-200 hover:opacity-90 cursor-pointer ${btnSizeCls}`}
                  style={{
                    backgroundColor: btnStyles?.copyBg || '#FFFFFF',
                    color: btnStyles?.copyText || '#404040',
                    borderRadius: btnRadius,
                  }}
                >
                  {copied ? <Check size={14} className="text-[#8C6A2F]" /> : <Copy size={14} />}
                  <span>
                    {copied
                      ? uiTexts?.copiedLinkLabel || 'تم نسخ الرابط'
                      : uiTexts?.copyLinkLabel || 'نسخ الرابط'}
                  </span>
                </button>
              )}
              <ActionButtons
                buttons={[...(settings.buttons || []), ...itemCustomButtons]}
                placement="article"
                contextTitle={item.title}
              />
            </div>
          </article>
        )}

        {/* RELATED CONTENT SECTION (Below main content) */}
        {relatedVisible &&
          (relatedCfg.position !== 'sidebar' || !isVideo) &&
          boundedRelated.length > 0 && (
            <section className="pt-6 border-t border-neutral-200 space-y-5">
              <div>
                <h2
                  className="text-xl font-bold text-neutral-900"
                  style={buildTextStyle(
                    settings.typography.related,
                    settings.colors.targets.related?.gradient?.enabled
                      ? settings.colors.targets.related.gradient
                      : settings.colors.targets.pageHeading?.gradient,
                    viewport
                  )}
                >
                  {relatedCfg.title}
                </h2>
                {relatedCfg.description && (
                  <p className="text-sm text-neutral-500 mt-1">{relatedCfg.description}</p>
                )}
              </div>

              <div
                className={`grid ${relatedGridClass}`}
                style={{ gap: `${relatedCfg.cardDesign?.spacing ?? 20}px` }}
              >
                {boundedRelated.map((rel) => (
                  <MediaCard
                    key={rel.id}
                    item={rel}
                    variant={relatedCfg.cardDesign.layout === 'list' ? 'compact' : 'editorial'}
                    showThumbnail={relatedCfg.cardDesign.showThumbnail}
                    showTitle={relatedCfg.cardDesign.showTitle}
                    showDate={relatedCfg.cardDesign.showDate}
                    showDescription={relatedCfg.cardDesign.showDescription}
                    showBadge={relatedCfg.cardDesign.showBadge}
                    showPlayButton={relatedCfg.cardDesign.showPlayButton}
                    cardDesignOverride={relatedCfg.cardDesign}
                  />
                ))}
              </div>
            </section>
          )}
      </div>

      {/* Image Lightbox Modal */}
      {lightboxOpen && activeImageSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            aria-label="إغلاق المعاينة"
            className="absolute top-4 left-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
          >
            <X size={20} />
          </button>
          {galleryUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveGalleryIdx((i) => (i - 1 + galleryUrls.length) % galleryUrls.length);
                }}
                aria-label="الصورة السابقة"
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
              >
                <ChevronRight size={22} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveGalleryIdx((i) => (i + 1) % galleryUrls.length);
                }}
                aria-label="الصورة التالية"
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
              >
                <ChevronLeft size={22} />
              </button>
            </>
          )}
          <img
            src={activeImageSrc}
            alt={itemSettings.altText || item.title}
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[92vw] object-contain rounded-lg shadow-2xl"
          />
          {galleryUrls.length > 1 && (
            <div className="absolute bottom-4 inset-x-0 text-center text-xs text-white/80 tabular-nums">
              {activeGalleryIdx + 1} / {galleryUrls.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
