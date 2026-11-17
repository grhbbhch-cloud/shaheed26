import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express, { type Express, type Request, type Response } from 'express';
import {
  handleAuthSession,
  handleOwnerLogin,
  handleOwnerLogout,
  handleSubAdminLogin,
  hashPasscode,
  requireOwner,
  updateOwnerCodes,
  verifyOwnerCodes,
  verifyPasscode,
} from './auth.ts';
import {
  BACKUPS_DIR,
  CHUNKS_DIR,
  DB_PATH,
  db,
  getAllSettings,
  getPublicSettings,
  logActivity,
  logSystemEvent,
  publishDueScheduledContent,
  publishDueScheduledPoems,
  saveEntityVersion,
  saveSettingCategory,
} from './db.ts';
import { DEFAULT_SETTINGS } from './defaults.ts';
import {
  gatherLocalSyncSnapshot,
  getCloudSyncStatus,
  recordCloudSyncState,
} from './firestoreBridge.ts';
import {
  checkFfmpegAvailable,
  cleanupOrphanedMediaFiles,
  deleteMediaArtifacts,
  deleteVideoRendition,
  deleteVideoThumbnail,
  ensureVideoThumbnails,
  extractCustomTimestampFrame,
  extractVideoFrames,
  finalizeChunkedUpload,
  generateVideoRenditions,
  getMediaQualityPlan,
  getMediaUsage,
  getStorageSummary,
  testExternalStorageConnection,
  toggleVideoRendition,
  uploadFileToExternalStorageIfConfigured,
} from './media.ts';
import type {
  AllSettings,
  ContentRecord,
  PageRecord,
  PoemRecord,
  PoemSubmissionRecord,
} from '../src/types/platform.ts';

function getActor(req: Request): string {
  return (req as any).adminSession?.username || 'owner';
}

function slugify(input: string): string {
  const base = input
    .trim()
    .toLowerCase()
    .replace(/[^\u0600-\u06FFa-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || `item-${Date.now()}`;
}

function makeUniqueSlug(table: 'pages' | 'content' | 'poems', desired: string, excludeId?: number): string {
  const clean = slugify(desired);
  let candidate = clean;
  let counter = 2;
  while (true) {
    const row = excludeId
      ? (db
          .prepare(`SELECT id FROM ${table} WHERE slug = ? AND id != ?`)
          .get(candidate, excludeId) as { id: number } | undefined)
      : (db.prepare(`SELECT id FROM ${table} WHERE slug = ?`).get(candidate) as
          | { id: number }
          | undefined);
    if (!row) return candidate;
    candidate = `${clean}-${counter++}`;
  }
}

function collectDescendantPageIds(rootPageId: number, allPages: PageRecord[]): number[] {
  const ids = [rootPageId];
  const queue = [rootPageId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const p of allPages) {
      if (p.parent_id === curr && !ids.includes(p.id)) {
        ids.push(p.id);
        queue.push(p.id);
      }
    }
  }
  return ids;
}

function buildContentFilterSql(alias = 'c'): string {
  return `${alias}.status = 'published'`;
}

function normalizePageIds(raw: unknown): number[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    } catch {
      list = [];
    }
  }
  const unique = new Set<number>();
  for (const v of list) {
    const n = Number(v);
    if (Number.isInteger(n) && n > 0) unique.add(n);
  }
  return Array.from(unique);
}

function getContentByIdJoined(id: number): ContentRecord | undefined {
  return db
    .prepare(
      `SELECT c.*, p1.title as page_title, p2.title as child_page_title
       FROM content c
       LEFT JOIN pages p1 ON c.page_id = p1.id
       LEFT JOIN pages p2 ON c.child_page_id = p2.id
       WHERE c.id = ?`
    )
    .get(id) as ContentRecord | undefined;
}

function sanitizePublicContent(item: ContentRecord): ContentRecord {
  let cleanSettingsJson = item.settings_json || '{}';
  try {
    const parsed = JSON.parse(cleanSettingsJson);
    if (parsed && typeof parsed === 'object') {
      delete parsed.customViewsDisplay;
      delete parsed.viewsIsManual;
      parsed.hideViewsOverride = true;
      cleanSettingsJson = JSON.stringify(parsed);
    }
  } catch {
    // preserve raw string if malformed
  }
  return {
    ...item,
    views: 0,
    settings_json: cleanSettingsJson,
  };
}

export function registerRoutes(app: Express): void {
  // ---------------------------------------------------------------------------
  // AUTH ROUTES
  // ---------------------------------------------------------------------------
  app.post('/api/auth/login', handleOwnerLogin);
  app.post('/api/auth/subadmin-login', handleSubAdminLogin);
  app.post('/api/auth/logout', handleOwnerLogout);
  app.get('/api/auth/session', handleAuthSession);

  // ---------------------------------------------------------------------------
  // PUBLIC ROUTES (No authentication required; strictly published data only)
  // ---------------------------------------------------------------------------
  app.use('/api/public', (_req: Request, res: Response, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    next();
  });

  app.get('/api/public/bootstrap', (_req: Request, res: Response) => {
    publishDueScheduledContent();
    publishDueScheduledPoems();
    const settings = getPublicSettings();
    const pages = db
      .prepare(
        "SELECT * FROM pages WHERE status = 'published' ORDER BY sort_order ASC, id ASC"
      )
      .all() as unknown as PageRecord[];
    const customCode = db
      .prepare(
        "SELECT id, name, scope, target_page_id, target_selector, code_type, code FROM custom_code WHERE enabled = 1 AND status = 'published'"
      )
      .all();
    res.json({ settings, pages, customCode });
  });

  app.get('/api/public/pages/:slug', (req: Request, res: Response) => {
    publishDueScheduledContent();
    publishDueScheduledPoems();
    const slug = decodeURIComponent(String(req.params.slug || ''));
    const allPages = db
      .prepare("SELECT * FROM pages WHERE status = 'published' ORDER BY sort_order ASC, id ASC")
      .all() as unknown as PageRecord[];
    const page = allPages.find((p) => p.slug === slug);
    if (!page) {
      res.status(404).json({ error: 'الصفحة غير موجودة أو غير منشورة' });
      return;
    }

    const childPages = allPages.filter((p) => p.parent_id === page.id);
    let pageSettings: Record<string, any> = {};
    try {
      pageSettings = JSON.parse(page.settings_json || '{}');
    } catch {
      pageSettings = {};
    }
    const childDisplayMode: string = pageSettings.childDisplayMode || (page.aggregate_children ? 'all' : 'direct-only');
    const selectedChildIds: number[] = Array.isArray(pageSettings.selectedChildIds)
      ? pageSettings.selectedChildIds.map(Number).filter((n: number) => Number.isInteger(n) && n > 0)
      : [];

    let targetIds: number[];
    if (childDisplayMode === 'direct-only' || !page.aggregate_children) {
      targetIds = [page.id];
    } else if (childDisplayMode === 'selected-children' && selectedChildIds.length > 0) {
      targetIds = [page.id, ...selectedChildIds];
    } else {
      targetIds = collectDescendantPageIds(page.id, allPages);
    }

    const filterChildId = req.query.childPageId ? Number(req.query.childPageId) : null;
    const filterType = typeof req.query.type === 'string' ? req.query.type : '';
    const filterCategory = typeof req.query.category === 'string' ? req.query.category : '';
    const sort =
      typeof req.query.sort === 'string' && req.query.sort
        ? req.query.sort
        : pageSettings.defaultSort || 'newest';

    const allPublished = db
      .prepare(
        `SELECT c.*, p1.title as page_title, p2.title as child_page_title
         FROM content c
         LEFT JOIN pages p1 ON c.page_id = p1.id
         LEFT JOIN pages p2 ON c.child_page_id = p2.id
         WHERE ${buildContentFilterSql('c')}`
      )
      .all() as unknown as ContentRecord[];

    const matched = allPublished.filter((item) => {
      const extraIds = normalizePageIds(item.extra_page_ids_json);

      if (filterChildId) {
        const hitChild =
          item.child_page_id === filterChildId ||
          item.page_id === filterChildId ||
          extraIds.includes(filterChildId);
        if (!hitChild) return false;
      } else if (page.page_type !== 'home') {
        if (childDisplayMode === 'direct-only' || !page.aggregate_children) {
          const hitDirect =
            item.page_id === page.id &&
            (!item.child_page_id || item.child_page_id === page.id);
          const hitExtra = extraIds.includes(page.id);
          if (!hitDirect && !hitExtra) return false;
        } else {
          const hitPage =
            (item.page_id !== null && targetIds.includes(item.page_id)) ||
            (item.child_page_id !== null && targetIds.includes(item.child_page_id)) ||
            extraIds.some((eid) => targetIds.includes(eid));
          if (!hitPage) return false;
        }
      }

      if (filterType && filterType !== 'all' && item.content_type !== filterType) return false;
      if (filterCategory && item.category !== filterCategory) return false;
      return true;
    });

    matched.sort((a, b) => {
      if (sort === 'oldest') {
        return (a.published_at || a.created_at).localeCompare(b.published_at || b.created_at);
      }
      return (b.published_at || b.created_at).localeCompare(a.published_at || a.created_at);
    });

    res.json({ page, childPages, items: matched.map(sanitizePublicContent) });
  });

  app.get('/api/public/content', (req: Request, res: Response) => {
    publishDueScheduledContent();
    const type = typeof req.query.type === 'string' ? req.query.type : 'all';
    const pageId = req.query.pageId ? Number(req.query.pageId) : null;
    const childPageId = req.query.childPageId ? Number(req.query.childPageId) : null;
    const featured = req.query.featured === '1';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'newest';
    const limit = req.query.limit ? Math.max(1, Math.min(100, Number(req.query.limit))) : 50;

    const allPages = db
      .prepare("SELECT * FROM pages WHERE status = 'published'")
      .all() as unknown as PageRecord[];

    const rows = db
      .prepare(
        `SELECT c.*, p1.title as page_title, p2.title as child_page_title
         FROM content c
         LEFT JOIN pages p1 ON c.page_id = p1.id
         LEFT JOIN pages p2 ON c.child_page_id = p2.id
         WHERE c.status = 'published'`
      )
      .all() as unknown as ContentRecord[];

    let filtered = rows.filter((item) => {
      if (type && type !== 'all' && item.content_type !== type) return false;
      if (featured && !item.featured) return false;

      const extraIds = normalizePageIds(item.extra_page_ids_json);

      if (childPageId) {
        if (
          item.child_page_id !== childPageId &&
          item.page_id !== childPageId &&
          !extraIds.includes(childPageId)
        ) {
          return false;
        }
      } else if (pageId) {
        const reqPage = allPages.find((p) => p.id === pageId);
        if (reqPage?.page_type === 'home') {
          const hitHome =
            item.page_id === pageId ||
            item.child_page_id === pageId ||
            extraIds.includes(pageId) ||
            item.featured === 1;
          if (!hitHome) return false;
        } else {
          const descendants = collectDescendantPageIds(pageId, allPages);
          const hit =
            (item.page_id !== null && descendants.includes(item.page_id)) ||
            (item.child_page_id !== null && descendants.includes(item.child_page_id)) ||
            extraIds.some((id) => descendants.includes(id));
          if (!hit) return false;
        }
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sort === 'oldest') {
        return (a.published_at || a.created_at).localeCompare(b.published_at || b.created_at);
      }
      if (sort === 'featured') {
        if (b.featured !== a.featured) return b.featured - a.featured;
      }
      return (b.published_at || b.created_at).localeCompare(a.published_at || a.created_at);
    });

    filtered = filtered.slice(0, limit).map(sanitizePublicContent);
    res.json({ items: filtered });
  });

  app.get('/api/public/content/:slugOrId', (req: Request, res: Response) => {
    publishDueScheduledContent();
    const raw = decodeURIComponent(String(req.params.slugOrId || ''));
    const isNumeric = /^\d+$/.test(raw);
    const item = (
      isNumeric
        ? db
            .prepare(
              `SELECT c.*, p1.title as page_title, p2.title as child_page_title
               FROM content c
               LEFT JOIN pages p1 ON c.page_id = p1.id
               LEFT JOIN pages p2 ON c.child_page_id = p2.id
               WHERE (c.slug = ? OR c.id = ?) AND c.status = 'published'`
            )
            .get(raw, Number(raw))
        : db
            .prepare(
              `SELECT c.*, p1.title as page_title, p2.title as child_page_title
               FROM content c
               LEFT JOIN pages p1 ON c.page_id = p1.id
               LEFT JOIN pages p2 ON c.child_page_id = p2.id
               WHERE c.slug = ? AND c.status = 'published'`
            )
            .get(raw)
    ) as ContentRecord | undefined;

    if (!item) {
      res.status(404).json({ error: 'المحتوى غير موجود أو غير منشور' });
      return;
    }

    const settings = getAllSettings();

    let mediaFile = null;
    if (item.media_file_id) {
      mediaFile = db.prepare('SELECT * FROM media_files WHERE id = ?').get(item.media_file_id);
    }

    const subtitles = db
      .prepare(
        "SELECT * FROM subtitles WHERE content_id = ? AND visible = 1 AND status = 'published' ORDER BY id ASC"
      )
      .all(item.id);

    // Compute related items strictly obeying maxItems and exclusion rules
    const relatedCfg = settings.related;
    let relatedItems: ContentRecord[] = [];
    if (relatedCfg.enabled && !relatedCfg.deleted && relatedCfg.maxItems > 0) {
      let itemCustomRelated: Partial<typeof relatedCfg> | null = null;
      try {
        const parsedSettings = JSON.parse(item.settings_json || '{}');
        if (parsedSettings.relatedOverride) {
          itemCustomRelated = parsedSettings.relatedOverride;
        }
      } catch {
        // ignore
      }
      const eff = { ...relatedCfg, ...(itemCustomRelated || {}) };
      const maxItems = Math.max(0, Number(eff.maxItems || 0));
      if (eff.enabled !== false && !eff.deleted && maxItems > 0) {
        const allPublished = db
          .prepare(
            `SELECT c.*, p1.title as page_title, p2.title as child_page_title
             FROM content c
             LEFT JOIN pages p1 ON c.page_id = p1.id
             LEFT JOIN pages p2 ON c.child_page_id = p2.id
             WHERE c.status = 'published'
             ORDER BY COALESCE(c.published_at, c.created_at) DESC`
          )
          .all() as unknown as ContentRecord[];

        let candidates = allPublished.filter((cand) => {
          if (eff.excludeCurrent && cand.id === item.id) return false;
          if (eff.contentTypes?.length && !eff.contentTypes.includes(cand.content_type)) return false;
          if (eff.sourcePageIds?.length && (!cand.page_id || !eff.sourcePageIds.includes(cand.page_id))) {
            return false;
          }
          if (
            eff.sourceChildPageIds?.length &&
            (!cand.child_page_id || !eff.sourceChildPageIds.includes(cand.child_page_id))
          ) {
            return false;
          }
          if (eff.filterCategory && cand.category !== eff.filterCategory) return false;
          if (eff.filterTags?.length) {
            try {
              const tags: string[] = JSON.parse(cand.tags_json || '[]');
              if (!eff.filterTags.some((t) => tags.includes(t))) return false;
            } catch {
              return false;
            }
          }
          return true;
        });

        if (eff.selectionMode === 'oldest') {
          candidates = [...candidates].sort((a, b) =>
            (a.published_at || a.created_at).localeCompare(b.published_at || b.created_at)
          );
        } else if (eff.selectionMode === 'manual' && eff.manualIds?.length) {
          const manualSet = new Set(eff.manualIds);
          candidates = candidates.filter((c) => manualSet.has(c.id));
        } else if (eff.selectionMode === 'category' && item.category) {
          const sameCat = candidates.filter((c) => c.category === item.category);
          if (sameCat.length > 0) candidates = sameCat;
        }

        // Deduplicate by ID and strictly slice to maxItems (never duplicate!)
        const seen = new Set<number>();
        relatedItems = [];
        for (const c of candidates) {
          if (seen.has(c.id)) continue;
          seen.add(c.id);
          relatedItems.push(c);
          if (relatedItems.length >= maxItems) break;
        }
      }
    }

    res.json({
      item: sanitizePublicContent(item),
      mediaFile,
      subtitles,
      related: relatedItems.map(sanitizePublicContent),
    });
  });

  app.get('/api/public/search', (req: Request, res: Response) => {
    publishDueScheduledContent();
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const type = typeof req.query.type === 'string' ? req.query.type : 'all';
    const sort = typeof req.query.sort === 'string' ? req.query.sort : 'newest';
    const settings = getAllSettings();
    const searchCfg = settings.search;

    const rows = db
      .prepare(
        `SELECT c.*, p1.title as page_title, p2.title as child_page_title
         FROM content c
         LEFT JOIN pages p1 ON c.page_id = p1.id
         LEFT JOIN pages p2 ON c.child_page_id = p2.id
         WHERE c.status = 'published'`
      )
      .all() as unknown as ContentRecord[];

    const matched = rows.filter((item) => {
      if (searchCfg.searchableTypes?.length && !searchCfg.searchableTypes.includes(item.content_type)) {
        return false;
      }
      if (
        searchCfg.searchablePageIds?.length &&
        (!item.page_id || !searchCfg.searchablePageIds.includes(item.page_id))
      ) {
        return false;
      }
      if (type && type !== 'all' && item.content_type !== type) return false;
      if (!q) return true;
      const haystack = `${item.title} ${item.description} ${item.body} ${item.category} ${item.tags_json}`.toLowerCase();
      return haystack.includes(q);
    });

    matched.sort((a, b) => {
      if (sort === 'oldest') {
        return (a.published_at || a.created_at).localeCompare(b.published_at || b.created_at);
      }
      return (b.published_at || b.created_at).localeCompare(a.published_at || a.created_at);
    });

    let pageMatches: Array<{ id: number; title: string; slug: string; seo_description: string; page_type: string }> = [];
    if (searchCfg.searchPageTitles !== false && q) {
      const pubPages = db
        .prepare("SELECT id, title, slug, seo_description, page_type FROM pages WHERE status = 'published' ORDER BY sort_order ASC")
        .all() as Array<{ id: number; title: string; slug: string; seo_description: string; page_type: string }>;
      pageMatches = pubPages.filter(
        (pg) =>
          (!searchCfg.searchablePageIds?.length || searchCfg.searchablePageIds.includes(pg.id)) &&
          `${pg.title} ${pg.seo_description} ${pg.slug}`.toLowerCase().includes(q)
      );
    }

    res.json({ items: matched.map(sanitizePublicContent), pageMatches, totalItems: matched.length + pageMatches.length });
  });

  app.get('/api/public/subtitles/:trackId.vtt', (req: Request, res: Response) => {
    const trackId = Number(req.params.trackId);
    const track = db
      .prepare("SELECT * FROM subtitles WHERE id = ? AND visible = 1 AND status = 'published'")
      .get(trackId) as { cues_json: string } | undefined;
    if (!track) {
      res.status(404).send('WEBVTT\n\n');
      return;
    }
    let cues: Array<{ start: string; end: string; text: string }> = [];
    try {
      cues = JSON.parse(track.cues_json || '[]');
    } catch {
      cues = [];
    }
    const lines = ['WEBVTT', ''];
    for (const c of cues) {
      lines.push(`${c.start.replace(',', '.')} --> ${c.end.replace(',', '.')}`);
      lines.push(c.text);
      lines.push('');
    }
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.send(lines.join('\n'));
  });

  app.get('/api/public/feed.json', (_req: Request, res: Response) => {
    const settings = getAllSettings();
    if (!settings.other.jsonFeedEnabled) {
      res.status(404).json({ error: 'الخلاصة غير مفعّلة حالياً' });
      return;
    }
    const items = db
      .prepare(
        "SELECT id, title, slug, content_type, description, thumbnail_url, published_at FROM content WHERE status = 'published' ORDER BY COALESCE(published_at, created_at) DESC LIMIT 50"
      )
      .all();
    res.json({
      version: 'https://jsonfeed.org/version/1.1',
      title: settings.identity.siteName,
      description: settings.identity.metaDescription,
      items,
    });
  });

  // Public Poetry Page Routes (strictly published poems only; NEVER expose poem_submissions!)
  app.get('/api/public/poems', (req: Request, res: Response) => {
    publishDueScheduledPoems();
    const settings = getPublicSettings();
    const poetryPage = db
      .prepare("SELECT * FROM pages WHERE (slug = 'poems' OR page_type = 'poetry') AND status = 'published' LIMIT 1")
      .get() as PageRecord | undefined;

    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const poet = typeof req.query.poet === 'string' ? req.query.poet.trim() : '';
    const sort =
      typeof req.query.sort === 'string' && req.query.sort
        ? req.query.sort
        : settings.poetry?.defaultSort || 'pinned-newest';

    const publishedPoems = db
      .prepare("SELECT * FROM poems WHERE status = 'published'")
      .all() as unknown as PoemRecord[];

    const poets = Array.from(
      new Set(publishedPoems.map((p) => (p.poet_name || '').trim()).filter(Boolean))
    );

    let filtered = publishedPoems.filter((p) => {
      if (poet && poet !== 'all' && p.poet_name.trim() !== poet) return false;
      if (q) {
        const hay = `${p.title} ${p.poet_name} ${p.intro_text} ${p.verses_text}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    filtered.sort((a, b) => {
      if (sort === 'manual-order') {
        return a.sort_order - b.sort_order || b.id - a.id;
      }
      if (sort === 'oldest') {
        return (a.published_at || a.created_at).localeCompare(b.published_at || b.created_at);
      }
      if (sort === 'newest') {
        return (b.published_at || b.created_at).localeCompare(a.published_at || a.created_at);
      }
      // default: pinned-newest
      if (Number(b.pinned) !== Number(a.pinned)) {
        return Number(b.pinned) - Number(a.pinned);
      }
      if (a.sort_order !== b.sort_order) {
        return a.sort_order - b.sort_order;
      }
      return (b.published_at || b.created_at).localeCompare(a.published_at || a.created_at);
    });

    const page = Math.max(1, Number(req.query.page || 1));
    const perPage = Math.max(1, Math.min(60, Number(req.query.limit || settings.poetry?.poemsPerPage || 8)));
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / perPage));
    const paged = req.query.all === '1' ? filtered : filtered.slice((page - 1) * perPage, page * perPage);

    res.json({
      page: poetryPage || null,
      poems: paged,
      total,
      currentPage: page,
      totalPages,
      perPage,
      poets,
    });
  });

  app.get('/api/public/poems/:slugOrId', (req: Request, res: Response) => {
    publishDueScheduledPoems();
    const param = decodeURIComponent(String(req.params.slugOrId || ''));
    const poem = db
      .prepare("SELECT * FROM poems WHERE (slug = ? OR id = ?) AND status = 'published'")
      .get(param, Number(param) || -1) as PoemRecord | undefined;
    if (!poem) {
      res.status(404).json({ error: 'القصيدة غير موجودة أو غير منشورة' });
      return;
    }
    res.json({ poem });
  });

  app.post('/api/public/poems/submit', (req: Request, res: Response) => {
    const allSettings = getAllSettings();
    const poetryCfg = allSettings.poetry;
    if (!poetryCfg?.submissionsEnabled) {
      res.status(403).json({
        error: 'المشاركات مغلقة حالياً من قِبل إدارة المنصة.',
      });
      return;
    }

    const body = req.body || {};
    const formCfg = poetryCfg.submissionForm;
    const title = String(body.title || '').trim();
    const versesText = String(body.verses_text || '').trim();
    const showPoetName = formCfg?.showPoetName !== false;
    const poetName = showPoetName ? String(body.poet_name || '').trim() : '';
    const extraInfo = formCfg?.showExtraInfo !== false ? String(body.extra_info || '').trim() : '';
    const maxChars = Math.max(200, Math.min(30000, Number(formCfg?.maxCharacters || 6000)));

    if (!title || !versesText) {
      res.status(400).json({
        error: formCfg?.errorMessage || 'عنوان القصيدة وأبياتها مطلوبان.',
      });
      return;
    }
    if (showPoetName && formCfg?.requirePoetName && !poetName) {
      res.status(400).json({ error: `حقل "${formCfg.labelPoetName || 'اسم الشاعر'}" مطلوب.` });
      return;
    }
    if (formCfg?.showExtraInfo !== false && formCfg?.requireExtraInfo && !extraInfo) {
      res.status(400).json({ error: `حقل "${formCfg.labelExtraInfo || 'الملاحظات'}" مطلوب.` });
      return;
    }
    if (versesText.length > maxChars || title.length > 250) {
      res.status(400).json({ error: `يتجاوز النص الحد الأقصى المسموح به (${maxChars} حرف).` });
      return;
    }

    const configuredFields = Array.isArray(formCfg?.customFields) ? formCfg.customFields : [];
    const incomingCustom =
      body.custom_fields && typeof body.custom_fields === 'object' ? (body.custom_fields as Record<string, unknown>) : {};
    const savedCustomFields: Array<{ id: string; label: string; value: string }> = [];
    for (const cf of configuredFields) {
      if (!cf?.id) continue;
      const val = String(incomingCustom[cf.id] ?? '').trim().slice(0, 4000);
      if (cf.required && !val) {
        res.status(400).json({ error: `الحقل "${cf.label || cf.id}" مطلوب.` });
        return;
      }
      if (val) {
        savedCustomFields.push({ id: cf.id, label: cf.label || cf.id, value: val });
      }
    }

    const ipRaw = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '');
    const ipHash = crypto.createHash('sha256').update(ipRaw).digest('hex').slice(0, 16);
    const now = new Date().toISOString();

    const info = db
      .prepare(
        `INSERT INTO poem_submissions (user_id, title, verses_text, poet_name, extra_info, custom_fields_json, status, admin_notes, published_poem_id, ip_hash, created_at, updated_at)
         VALUES (NULL, ?, ?, ?, ?, ?, 'pending', '', NULL, ?, ?, ?)`
      )
      .run(
        title,
        versesText,
        poetName,
        extraInfo,
        JSON.stringify(savedCustomFields),
        ipHash,
        now,
        now
      );

    logActivity(
      'استلام مشاركة قصيدة خاصة',
      'poetry',
      `تم استلام مشاركة جديدة بعنوان "${title}" وحفظها للمراجعة الخاصة.`,
      'visitor',
      ipRaw
    );

    res.status(201).json({
      ok: true,
      submissionId: Number(info.lastInsertRowid),
      message:
        formCfg?.successMessage ||
        'شكراً لك، تم استلام مشاركتك وحفظها لدى إدارة المنصة للمراجعة الخاصة.',
    });
  });

  // ---------------------------------------------------------------------------
  // PROTECTED OWNER ADMIN ROUTES
  // ---------------------------------------------------------------------------
  app.use('/api/admin', requireOwner);

  app.get('/api/admin/overview', async (req: Request, res: Response) => {
    publishDueScheduledContent();
    publishDueScheduledPoems();
    const allSettings = getAllSettings();
    const requestedLimit = Number(req.query.limit || allSettings.overview?.recentActivityLimit || 12);
    const activityLimit = Math.max(1, Math.min(50, Number.isFinite(requestedLimit) ? requestedLimit : 12));
    const pages = db.prepare('SELECT id, parent_id FROM pages').all() as Array<{
      id: number;
      parent_id: number | null;
    }>;
    const totalPages = pages.length;
    const childPages = pages.filter((p) => p.parent_id !== null).length;

    const contentRows = db
      .prepare('SELECT id, status, content_type, title, thumbnail_url, created_at FROM content ORDER BY created_at DESC')
      .all() as Array<{
      id: number;
      status: string;
      content_type: string;
      title: string;
      thumbnail_url: string;
      created_at: string;
    }>;

    const statusCounts: Record<string, number> = {
      published: 0,
      draft: 0,
      scheduled: 0,
      hidden: 0,
      archived: 0,
      processing: 0,
      failed: 0,
    };
    const typeCounts: Record<string, number> = {
      video: 0,
      image: 0,
      gallery: 0,
      article: 0,
      post: 0,
      report: 0,
      news: 0,
      poetry: 0,
      audio: 0,
      document: 0,
    };

    for (const c of contentRows) {
      statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
      typeCounts[c.content_type] = (typeCounts[c.content_type] || 0) + 1;
    }

    const uploadsInProgress = (
      db.prepare("SELECT COUNT(*) as cnt FROM upload_sessions WHERE status = 'uploading'").get() as {
        cnt: number;
      }
    ).cnt;
    const processingMedia = (
      db.prepare("SELECT COUNT(*) as cnt FROM media_files WHERE status = 'processing'").get() as {
        cnt: number;
      }
    ).cnt;

    const storage = getStorageSummary();
    const dbSizeBytes = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
    const unresolvedErrors = (
      db.prepare('SELECT COUNT(*) as cnt FROM system_events WHERE resolved = 0').get() as {
        cnt: number;
      }
    ).cnt;
    const backupRow = db
      .prepare('SELECT COUNT(*) as cnt, MAX(created_at) as latest FROM backups')
      .get() as { cnt: number; latest: string | null };

    const recentActivity = db
      .prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT ?')
      .all(activityLimit);
    const recentMedia = db
      .prepare('SELECT * FROM media_files ORDER BY id DESC LIMIT 8')
      .all();
    const recentContent = contentRows.slice(0, 8);
    const ffmpeg = await checkFfmpegAvailable();
    const publishedPoems = (
      db.prepare("SELECT COUNT(*) as cnt FROM poems WHERE status = 'published'").get() as { cnt: number }
    ).cnt;
    const totalPoems = (
      db.prepare('SELECT COUNT(*) as cnt FROM poems').get() as { cnt: number }
    ).cnt;
    const pendingPoemSubmissions = (
      db.prepare("SELECT COUNT(*) as cnt FROM poem_submissions WHERE status = 'pending'").get() as { cnt: number }
    ).cnt;

    res.json({
      stats: {
        totalPages,
        childPages,
        totalContent: contentRows.length,
        publishedContent: statusCounts.published,
        draftContent: statusCounts.draft,
        scheduledContent: statusCounts.scheduled,
        hiddenContent: statusCounts.hidden,
        archivedContent: statusCounts.archived,
        videoCount: typeCounts.video,
        imageCount: (typeCounts.image || 0) + (typeCounts.gallery || 0),
        articleCount:
          (typeCounts.article || 0) +
          (typeCounts.report || 0) +
          (typeCounts.post || 0) +
          (typeCounts.news || 0) +
          (typeCounts.poetry || 0),
        audioCount: typeCounts.audio,
        documentCount: typeCounts.document,
        uploadsInProgress,
        processingItems: (statusCounts.processing || 0) + processingMedia,
        storageUsedBytes: storage.totalBytes + dbSizeBytes,
        mediaBytes: storage.totalBytes,
        dbSizeBytes,
        fileCount: storage.fileCount,
        missingFilesCount: storage.missingFiles.length,
        recentErrors: unresolvedErrors,
        backupCount: backupRow.cnt,
        lastBackupAt: backupRow.latest,
        ffmpegReady: ffmpeg.ffmpeg && ffmpeg.ffprobe,
        totalPoems,
        publishedPoems,
        pendingPoemSubmissions,
      },
      recentActivity,
      recentMedia,
      recentContent,
    });
  });

  // ---------------------------------------------------------------------------
  // SETTINGS & VERSIONING
  // ---------------------------------------------------------------------------
  app.get('/api/admin/settings', (_req: Request, res: Response) => {
    res.json({ settings: getAllSettings() });
  });

  app.put('/api/admin/settings/:category', (req: Request, res: Response) => {
    const category = String(req.params.category) as keyof AllSettings;
    if (!(category in DEFAULT_SETTINGS)) {
      res.status(400).json({ error: 'فئة الإعدادات غير صالحة' });
      return;
    }
    const { value, label } = req.body as { value?: any; label?: string };
    if (value === undefined) {
      res.status(400).json({ error: 'القيمة مطلوبة' });
      return;
    }
    const actor = getActor(req);
    const saved = saveSettingCategory(category, value, true, label, actor);
    logActivity('تحديث الإعدادات', 'settings', `تم تحديث إعدادات (${category})`, actor);
    res.json({ category, value: saved });
  });

  app.post('/api/admin/settings/:category/reset', (req: Request, res: Response) => {
    const category = String(req.params.category) as keyof AllSettings;
    if (!(category in DEFAULT_SETTINGS)) {
      res.status(400).json({ error: 'فئة الإعدادات غير صالحة' });
      return;
    }
    const actor = getActor(req);
    const saved = saveSettingCategory(
      category,
      DEFAULT_SETTINGS[category],
      true,
      `استعادة الإعدادات الافتراضية (${category})`,
      actor
    );
    logActivity(
      'استعادة الإعدادات الافتراضية',
      'settings',
      `تمت استعادة الإعدادات الافتراضية لفئة (${category})`,
      actor
    );
    res.json({ category, value: saved });
  });

  // ---------------------------------------------------------------------------
  // PAGES TREE CRUD
  // ---------------------------------------------------------------------------
  app.get('/api/admin/pages', (req: Request, res: Response) => {
    const includeDeleted = req.query.includeDeleted === '1';
    const pages = db
      .prepare(
        includeDeleted
          ? 'SELECT * FROM pages ORDER BY sort_order ASC, id ASC'
          : "SELECT * FROM pages WHERE status != 'deleted' ORDER BY sort_order ASC, id ASC"
      )
      .all() as unknown as PageRecord[];
    res.json({ pages });
  });

  app.post('/api/admin/pages', (req: Request, res: Response) => {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    if (!title) {
      res.status(400).json({ error: 'اسم الصفحة مطلوب' });
      return;
    }
    const slug = makeUniqueSlug('pages', String(body.slug || title));
    const parentId = body.parent_id ? Number(body.parent_id) : null;
    const now = new Date().toISOString();
    const maxOrder = (
      db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM pages').get() as { m: number }
    ).m;

    const info = db
      .prepare(
        `INSERT INTO pages (
          title, slug, parent_id, page_type, layout, sort_order, status,
          nav_visible, aggregate_children, seo_title, seo_description,
          custom_content, sections_json, settings_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        slug,
        parentId,
        body.page_type || 'collection',
        body.layout || 'grid',
        body.sort_order ?? maxOrder + 1,
        body.status || 'published',
        body.nav_visible ?? 1,
        body.aggregate_children ?? 1,
        body.seo_title || `${title} | أرشيف الشهيد`,
        body.seo_description || '',
        body.custom_content || '',
        typeof body.sections_json === 'string'
          ? body.sections_json
          : JSON.stringify(body.sections || []),
        typeof body.settings_json === 'string'
          ? body.settings_json
          : JSON.stringify(body.settings || {}),
        now,
        now
      );

    const created = db
      .prepare('SELECT * FROM pages WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as unknown as PageRecord;

    // Also optionally append to navigation if nav_visible and not already linked
    if (created.nav_visible) {
      const settings = getAllSettings();
      const nav = settings.navigation;
      const newNavItem = {
        id: `nav-page-${created.id}`,
        label: created.title,
        url: `/p/${created.slug}`,
        type: 'page' as const,
        pageId: created.id,
        icon: '',
        visible: true,
        order: nav.items.length + 1,
        openInNewTab: false,
        children: [],
      };
      if (created.parent_id) {
        const parentPage = db
          .prepare('SELECT slug FROM pages WHERE id = ?')
          .get(created.parent_id) as { slug: string } | undefined;
        const parentNav = nav.items.find(
          (i) => i.pageId === created.parent_id || (parentPage && i.url === `/p/${parentPage.slug}`)
        );
        if (parentNav) {
          parentNav.children.push(newNavItem);
          saveSettingCategory('navigation', nav, false);
        }
      } else {
        nav.items.push(newNavItem);
        saveSettingCategory('navigation', nav, false);
      }
    }

    logActivity('إنشاء صفحة', 'pages', `تم إنشاء الصفحة "${created.title}" (${created.slug})`, 'owner');
    res.status(201).json({ page: created });
  });

  app.put('/api/admin/pages/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as
      | PageRecord
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'الصفحة غير موجودة' });
      return;
    }

    const body = req.body || {};
    const title = body.title !== undefined ? String(body.title).trim() : existing.title;
    if (!title) {
      res.status(400).json({ error: 'اسم الصفحة لا يمكن أن يكون فارغاً' });
      return;
    }

    const slug =
      body.slug !== undefined && String(body.slug).trim() !== ''
        ? makeUniqueSlug('pages', String(body.slug), id)
        : existing.slug;
    const parentId =
      body.parent_id === undefined
        ? existing.parent_id
        : body.parent_id === null || body.parent_id === ''
          ? null
          : Number(body.parent_id);

    if (parentId !== null) {
      const allPages = db.prepare('SELECT id, parent_id FROM pages').all() as unknown as PageRecord[];
      const blockedIds = collectDescendantPageIds(id, allPages);
      if (blockedIds.includes(parentId)) {
        res.status(400).json({
          error: 'لا يمكن جعل الصفحة تابعة لنفسها أو لإحدى صفحاتها الفرعية (منع التكرار الدائري).',
        });
        return;
      }
    }

    const actor = getActor(req);
    saveEntityVersion('page', id, `نسخة قبل تعديل الصفحة: ${existing.title}`, existing, actor);

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE pages SET
        title = ?, slug = ?, parent_id = ?, page_type = ?, layout = ?, sort_order = ?,
        status = ?, nav_visible = ?, aggregate_children = ?, seo_title = ?,
        seo_description = ?, custom_content = ?, sections_json = ?, settings_json = ?, updated_at = ?
      WHERE id = ?`
    ).run(
      title,
      slug,
      parentId,
      body.page_type ?? existing.page_type,
      body.layout ?? existing.layout,
      body.sort_order ?? existing.sort_order,
      body.status ?? existing.status,
      body.nav_visible ?? existing.nav_visible,
      body.aggregate_children ?? existing.aggregate_children,
      body.seo_title ?? existing.seo_title,
      body.seo_description ?? existing.seo_description,
      body.custom_content ?? existing.custom_content,
      body.sections !== undefined
        ? JSON.stringify(body.sections)
        : (body.sections_json ?? existing.sections_json),
      body.settings !== undefined
        ? JSON.stringify(body.settings)
        : (body.settings_json ?? existing.settings_json),
      now,
      id
    );

    const updated = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as unknown as PageRecord;
    logActivity('تحديث صفحة', 'pages', `تم تحديث الصفحة "${updated.title}"`, actor);
    res.json({ page: updated });
  });

  app.post('/api/admin/pages/:id/duplicate', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as PageRecord | undefined;
    if (!existing) {
      res.status(404).json({ error: 'الصفحة غير موجودة' });
      return;
    }
    const newTitle = `${existing.title} (نسخة)`;
    const newSlug = makeUniqueSlug('pages', `${existing.slug}-copy`);
    const now = new Date().toISOString();
    const maxOrder = (
      db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM pages').get() as { m: number }
    ).m;
    const info = db
      .prepare(
        `INSERT INTO pages (
          title, slug, parent_id, page_type, layout, sort_order, status,
          nav_visible, aggregate_children, seo_title, seo_description,
          custom_content, sections_json, settings_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        newTitle,
        newSlug,
        existing.parent_id,
        existing.page_type,
        existing.layout,
        maxOrder + 1,
        'draft',
        0,
        existing.aggregate_children,
        `${newTitle} | أرشيف الشهيد`,
        existing.seo_description,
        existing.custom_content,
        existing.sections_json,
        existing.settings_json,
        now,
        now
      );
    const created = db.prepare('SELECT * FROM pages WHERE id = ?').get(Number(info.lastInsertRowid)) as unknown as PageRecord;
    logActivity('نسخ صفحة', 'pages', `تم نسخ الصفحة "${existing.title}" إلى "${newTitle}"`, getActor(req));
    res.status(201).json({ page: created });
  });

  app.post('/api/admin/pages/reorder', (req: Request, res: Response) => {
    const items = (req.body?.items || []) as Array<{
      id: number;
      sort_order: number;
      parent_id?: number | null;
    }>;
    const allPages = db.prepare('SELECT id, parent_id FROM pages').all() as unknown as PageRecord[];
    for (const item of items) {
      if (item.parent_id !== undefined && item.parent_id !== null) {
        const descendants = collectDescendantPageIds(item.id, allPages);
        if (descendants.includes(Number(item.parent_id))) {
          res.status(400).json({ error: 'ترتيب غير صالح: يؤدي إلى حلقة دائرية بين الصفحات.' });
          return;
        }
      }
    }
    const stmt = db.prepare(
      'UPDATE pages SET sort_order = ?, parent_id = COALESCE(?, parent_id), updated_at = ? WHERE id = ?'
    );
    const now = new Date().toISOString();
    for (const item of items) {
      stmt.run(item.sort_order, item.parent_id === undefined ? null : item.parent_id, now, item.id);
    }
    logActivity('إعادة ترتيب الصفحات', 'pages', `تم تحديث ترتيب ${items.length} صفحة`, getActor(req));
    res.json({ ok: true });
  });

  app.delete('/api/admin/pages/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const permanent = req.query.permanent === '1';
    const existing = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as
      | PageRecord
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'الصفحة غير موجودة' });
      return;
    }
    if (permanent || existing.status === 'deleted') {
      db.prepare('UPDATE pages SET parent_id = ? WHERE parent_id = ?').run(existing.parent_id, id);
      db.prepare('DELETE FROM pages WHERE id = ?').run(id);
      logActivity('حذف صفحة نهائياً', 'pages', `تم حذف الصفحة "${existing.title}" نهائياً`, getActor(req), '', 'warning');
      res.json({ ok: true, mode: 'permanent' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare("UPDATE pages SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ?").run(
      now,
      now,
      id
    );
    logActivity('نقل صفحة للمحذوفات', 'pages', `تم نقل الصفحة "${existing.title}" إلى المحذوفات (قابلة للاستعادة)`, getActor(req), '', 'warning');
    res.json({ ok: true, mode: 'soft' });
  });

  app.post('/api/admin/pages/:id/restore', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as
      | PageRecord
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'الصفحة غير موجودة' });
      return;
    }
    db.prepare("UPDATE pages SET status = 'published', deleted_at = NULL, updated_at = ? WHERE id = ?").run(
      new Date().toISOString(),
      id
    );
    const restored = db.prepare('SELECT * FROM pages WHERE id = ?').get(id) as unknown as PageRecord;
    logActivity('استعادة صفحة', 'pages', `تمت استعادة الصفحة "${restored.title}"`, getActor(req));
    res.json({ page: restored });
  });

  // ---------------------------------------------------------------------------
  // CONTENT CRUD
  // ---------------------------------------------------------------------------
  app.get('/api/admin/content', (req: Request, res: Response) => {
    publishDueScheduledContent();
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const includeDeleted = req.query.includeDeleted === '1';
    const type = typeof req.query.type === 'string' ? req.query.type : '';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';

    const rows = db
      .prepare(
        `SELECT c.*, p1.title as page_title, p2.title as child_page_title
         FROM content c
         LEFT JOIN pages p1 ON c.page_id = p1.id
         LEFT JOIN pages p2 ON c.child_page_id = p2.id
         ORDER BY c.created_at DESC`
      )
      .all() as unknown as ContentRecord[];

    const filtered = rows.filter((r) => {
      if (!includeDeleted && status !== 'deleted' && r.status === 'deleted') return false;
      if (status && status !== 'all' && r.status !== status) return false;
      if (type && type !== 'all' && r.content_type !== type) return false;
      if (q) {
        const hay = `${r.title} ${r.description} ${r.category}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    res.json({ items: filtered });
  });

  app.post('/api/admin/content', (req: Request, res: Response) => {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    if (!title) {
      res.status(400).json({ error: 'عنوان المادة مطلوب' });
      return;
    }
    const slug = makeUniqueSlug('content', String(body.slug || title));
    const now = new Date().toISOString();
    const status = body.status || 'draft';
    const publishedAt =
      status === 'published' ? body.published_at || now : body.published_at || null;

    const normalizedExtraPageIds =
      body.extra_page_ids_json !== undefined
        ? normalizePageIds(body.extra_page_ids_json)
        : normalizePageIds(body.extra_page_ids);

    const info = db
      .prepare(
        `INSERT INTO content (
          title, slug, content_type, description, body, status, featured,
          page_id, child_page_id, extra_page_ids_json, category, tags_json,
          thumbnail_url, media_url, media_file_id, gallery_urls_json,
          link_url, link_label, link_enabled, link_new_tab, duration, resolution, width, height,
          views, source_label, editor_label, custom_metadata_json, settings_json,
          published_at, scheduled_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        slug,
        body.content_type || 'post',
        body.description || '',
        body.body || '',
        status,
        body.featured ? 1 : 0,
        body.page_id ? Number(body.page_id) : null,
        body.child_page_id ? Number(body.child_page_id) : null,
        JSON.stringify(normalizedExtraPageIds),
        body.category || '',
        typeof body.tags_json === 'string' ? body.tags_json : JSON.stringify(body.tags || []),
        typeof body.thumbnail_url === 'string' ? body.thumbnail_url : body.thumbnail_url?.url || '',
        typeof body.media_url === 'string' ? body.media_url : body.media_url?.url || '',
        body.media_file_id ? Number(body.media_file_id) : null,
        typeof body.gallery_urls_json === 'string'
          ? body.gallery_urls_json
          : JSON.stringify(body.gallery_urls || []),
        body.link_url || '',
        body.link_label || '',
        body.link_enabled ? 1 : 0,
        body.link_new_tab ? 1 : 0,
        Number(body.duration || 0),
        body.resolution || '',
        Number(body.width || 0),
        Number(body.height || 0),
        Number(body.views || 0),
        body.source_label || '',
        body.editor_label || '',
        typeof body.custom_metadata_json === 'string'
          ? body.custom_metadata_json
          : JSON.stringify(body.custom_metadata || {}),
        typeof body.settings_json === 'string'
          ? body.settings_json
          : JSON.stringify(body.settings || {}),
        publishedAt,
        body.scheduled_at || null,
        now,
        now
      );

    const created = getContentByIdJoined(Number(info.lastInsertRowid));
    if (!created) {
      res.status(500).json({ error: 'تعذر التحقق من حفظ المادة في قاعدة البيانات' });
      return;
    }
    logActivity(
      'إضافة محتوى',
      'content',
      `تم إنشاء مادة (${created.content_type}): "${created.title}" [${created.status}]`,
      getActor(req)
    );
    res.status(201).json({ item: created });
  });

  app.put('/api/admin/content/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM content WHERE id = ?').get(id) as
      | ContentRecord
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'المادة غير موجودة' });
      return;
    }

    const body = req.body || {};
    const title = body.title !== undefined ? String(body.title).trim() : existing.title;
    if (!title) {
      res.status(400).json({ error: 'العنوان مطلوب' });
      return;
    }
    const slug =
      body.slug !== undefined && String(body.slug).trim() !== ''
        ? makeUniqueSlug('content', String(body.slug), id)
        : existing.slug;

    const actor = getActor(req);
    saveEntityVersion('content', id, `نسخة قبل تعديل المادة: ${existing.title}`, existing, actor);

    const now = new Date().toISOString();
    const nextStatus = body.status ?? existing.status;
    let publishedAt = body.published_at !== undefined ? body.published_at : existing.published_at;
    if (nextStatus === 'published' && !publishedAt) {
      publishedAt = now;
    }

    db.prepare(
      `UPDATE content SET
        title = ?, slug = ?, content_type = ?, description = ?, body = ?,
        status = ?, featured = ?, page_id = ?, child_page_id = ?, extra_page_ids_json = ?,
        category = ?, tags_json = ?, thumbnail_url = ?, media_url = ?, media_file_id = ?,
        gallery_urls_json = ?, link_url = ?, link_label = ?, link_enabled = ?, link_new_tab = ?,
        duration = ?, resolution = ?, width = ?, height = ?, views = ?, source_label = ?,
        editor_label = ?, custom_metadata_json = ?, settings_json = ?,
        published_at = ?, scheduled_at = ?, updated_at = ?
      WHERE id = ?`
    ).run(
      title,
      slug,
      body.content_type ?? existing.content_type,
      body.description ?? existing.description,
      body.body ?? existing.body,
      nextStatus,
      body.featured !== undefined ? (body.featured ? 1 : 0) : existing.featured,
      body.page_id === undefined
        ? existing.page_id
        : body.page_id
          ? Number(body.page_id)
          : null,
      body.child_page_id === undefined
        ? existing.child_page_id
        : body.child_page_id
          ? Number(body.child_page_id)
          : null,
      body.extra_page_ids_json !== undefined
        ? JSON.stringify(normalizePageIds(body.extra_page_ids_json))
        : body.extra_page_ids !== undefined
          ? JSON.stringify(normalizePageIds(body.extra_page_ids))
          : existing.extra_page_ids_json,
      body.category ?? existing.category,
      body.tags_json ?? (body.tags ? JSON.stringify(body.tags) : existing.tags_json),
      body.thumbnail_url !== undefined
        ? (typeof body.thumbnail_url === 'string' ? body.thumbnail_url : body.thumbnail_url?.url || '')
        : existing.thumbnail_url,
      body.media_url !== undefined
        ? (typeof body.media_url === 'string' ? body.media_url : body.media_url?.url || '')
        : existing.media_url,
      body.media_file_id === undefined
        ? existing.media_file_id
        : body.media_file_id
          ? Number(body.media_file_id)
          : null,
      body.gallery_urls_json ??
        (body.gallery_urls ? JSON.stringify(body.gallery_urls) : existing.gallery_urls_json),
      body.link_url ?? existing.link_url,
      body.link_label !== undefined ? body.link_label : (existing as any).link_label || '',
      body.link_enabled !== undefined ? (body.link_enabled ? 1 : 0) : existing.link_enabled,
      body.link_new_tab !== undefined ? (body.link_new_tab ? 1 : 0) : existing.link_new_tab,
      body.duration ?? existing.duration,
      body.resolution ?? existing.resolution,
      body.width ?? existing.width,
      body.height ?? existing.height,
      body.views !== undefined ? Number(body.views) : existing.views,
      body.source_label ?? existing.source_label,
      body.editor_label ?? existing.editor_label,
      body.custom_metadata !== undefined
        ? JSON.stringify(body.custom_metadata)
        : (body.custom_metadata_json ?? existing.custom_metadata_json),
      body.settings !== undefined
        ? JSON.stringify(body.settings)
        : (body.settings_json ?? existing.settings_json),
      publishedAt,
      body.scheduled_at !== undefined ? body.scheduled_at : existing.scheduled_at,
      now,
      id
    );

    const updated = getContentByIdJoined(id);
    if (!updated) {
      res.status(500).json({ error: 'تعذر التحقق من تحديث المادة في قاعدة البيانات' });
      return;
    }
    logActivity('تحديث محتوى', 'content', `تم تحديث المادة "${updated.title}"`, getActor(req));
    res.json({ item: updated });
  });

  app.post('/api/admin/content/:id/duplicate', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM content WHERE id = ?').get(id) as ContentRecord | undefined;
    if (!existing) {
      res.status(404).json({ error: 'المادة غير موجودة' });
      return;
    }
    const newTitle = `${existing.title} (نسخة)`;
    const newSlug = makeUniqueSlug('content', `${existing.slug}-copy`);
    const now = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO content (
          title, slug, content_type, description, body, status, featured,
          page_id, child_page_id, extra_page_ids_json, category, tags_json,
          thumbnail_url, media_url, media_file_id, gallery_urls_json,
          link_url, link_label, link_enabled, link_new_tab, duration, resolution, width, height,
          views, source_label, editor_label, custom_metadata_json, settings_json,
          published_at, scheduled_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'draft', 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, NULL, NULL, ?, ?)`
      )
      .run(
        newTitle,
        newSlug,
        existing.content_type,
        existing.description,
        existing.body,
        existing.page_id,
        existing.child_page_id,
        existing.extra_page_ids_json,
        existing.category,
        existing.tags_json,
        existing.thumbnail_url,
        existing.media_url,
        existing.media_file_id,
        existing.gallery_urls_json,
        existing.link_url,
        (existing as any).link_label || '',
        existing.link_enabled,
        existing.link_new_tab,
        existing.duration,
        existing.resolution,
        existing.width,
        existing.height,
        existing.source_label,
        existing.editor_label,
        existing.custom_metadata_json,
        existing.settings_json,
        now,
        now
      );
    const created = getContentByIdJoined(Number(info.lastInsertRowid));
    logActivity('نسخ محتوى', 'content', `تم نسخ المادة "${existing.title}" إلى "${newTitle}"`, 'owner');
    res.status(201).json({ item: created });
  });

  function cleanupDeletedContentReferences(deletedIds: number[]): void {
    if (!deletedIds.length) return;
    const delSet = new Set(deletedIds);
    const all = getAllSettings();
    let homeChanged = false;
    const nextSections = all.homepage.sections.map((sec) => {
      if (!Array.isArray(sec.manualItemIds) || sec.manualItemIds.length === 0) return sec;
      const filtered = sec.manualItemIds.filter((cid) => !delSet.has(Number(cid)));
      if (filtered.length !== sec.manualItemIds.length) {
        homeChanged = true;
        return { ...sec, manualItemIds: filtered };
      }
      return sec;
    });
    if (homeChanged) {
      saveSettingCategory('homepage', { ...all.homepage, sections: nextSections }, false);
    }
    if (Array.isArray(all.related.manualIds) && all.related.manualIds.length > 0) {
      const nextRel = all.related.manualIds.filter((cid) => !delSet.has(Number(cid)));
      if (nextRel.length !== all.related.manualIds.length) {
        saveSettingCategory('related', { ...all.related, manualIds: nextRel }, false);
      }
    }
  }

  app.delete('/api/admin/content/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const permanent = req.query.permanent === '1';
    const existing = db.prepare('SELECT * FROM content WHERE id = ?').get(id) as
      | ContentRecord
      | undefined;
    if (!existing) {
      res.status(404).json({ error: 'المادة غير موجودة' });
      return;
    }
    if (permanent || existing.status === 'deleted') {
      db.prepare('DELETE FROM content WHERE id = ?').run(id);
      cleanupDeletedContentReferences([id]);
      logActivity('حذف محتوى نهائياً', 'content', `تم حذف المادة "${existing.title}" نهائياً`, getActor(req), '', 'warning');
      res.json({ ok: true, mode: 'permanent' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare("UPDATE content SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ?").run(
      now,
      now,
      id
    );
    logActivity('نقل محتوى للمحذوفات', 'content', `تم نقل المادة "${existing.title}" إلى سلة المحذوفات`, getActor(req), '', 'warning');
    res.json({ ok: true, mode: 'soft' });
  });

  app.post('/api/admin/content/bulk', (req: Request, res: Response) => {
    const { action, ids, permanent } = (req.body || {}) as { action: string; ids: number[]; permanent?: boolean };
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: 'لم يتم تحديد أي عناصر' });
      return;
    }
    const now = new Date().toISOString();
    const placeholders = ids.map(() => '?').join(',');
    if (action === 'delete') {
      if (permanent) {
        db.prepare(`DELETE FROM content WHERE id IN (${placeholders})`).run(...ids);
        cleanupDeletedContentReferences(ids.map((n) => Number(n)));
      } else {
        db.prepare(`UPDATE content SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id IN (${placeholders})`).run(
          now,
          now,
          ...ids
        );
      }
    } else if (['published', 'unpublished', 'draft', 'hidden', 'archived'].includes(action)) {
      db.prepare(
        `UPDATE content SET status = ?, deleted_at = NULL, published_at = CASE WHEN ? = 'published' THEN COALESCE(published_at, ?) ELSE published_at END, updated_at = ? WHERE id IN (${placeholders})`
      ).run(action, action, now, now, ...ids);
    } else {
      res.status(400).json({ error: 'إجراء غير مدعوم' });
      return;
    }
    logActivity('إجراء جماعي', 'content', `إجراء (${action}) على ${ids.length} مادة`, getActor(req));
    res.json({ ok: true, count: ids.length });
  });

  // ---------------------------------------------------------------------------
  // CHUNKED RESUMABLE UPLOAD & MEDIA PROCESSING
  // ---------------------------------------------------------------------------
  app.post('/api/admin/uploads/init', async (req: Request, res: Response) => {
    const { originalName, mimeType, totalSize, totalChunks, sha256, allowDuplicate } = (req.body ||
      {}) as {
      originalName: string;
      mimeType: string;
      totalSize: number;
      totalChunks: number;
      sha256?: string;
      allowDuplicate?: boolean;
    };

    if (!originalName || !totalChunks || totalChunks < 1) {
      res.status(400).json({ error: 'بيانات تهيئة الرفع غير مكتملة' });
      return;
    }

    // Duplicate check via SHA-256
    if (sha256 && !allowDuplicate) {
      const existing = db
        .prepare('SELECT * FROM media_files WHERE sha256 = ?')
        .get(sha256) as any;
      if (existing && fs.existsSync(existing.file_path)) {
        const repaired = await ensureVideoThumbnails(existing);
        res.json({
          duplicate: true,
          media: repaired.media,
          thumbnailWarning: repaired.warning || '',
        });
        return;
      }
      // Also check resumable incomplete session with same sha256 & size
      const resumable = db
        .prepare(
          "SELECT * FROM upload_sessions WHERE sha256 = ? AND total_size = ? AND status = 'uploading' ORDER BY created_at DESC LIMIT 1"
        )
        .get(sha256, totalSize) as any;
      if (resumable) {
        res.json({
          duplicate: false,
          resumed: true,
          sessionId: resumable.id,
          receivedChunks: JSON.parse(resumable.received_chunks_json || '[]'),
        });
        return;
      }
    }

    const sessionId = crypto.randomUUID();
    fs.mkdirSync(path.join(CHUNKS_DIR, sessionId), { recursive: true });
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO upload_sessions (id, original_name, mime_type, total_size, total_chunks, received_chunks_json, sha256, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, '[]', ?, 'uploading', ?, ?)`
    ).run(
      sessionId,
      originalName,
      mimeType || 'application/octet-stream',
      Number(totalSize || 0),
      Number(totalChunks),
      sha256 || null,
      now,
      now
    );

    res.json({ duplicate: false, resumed: false, sessionId, receivedChunks: [] });
  });

  app.put(
    '/api/admin/uploads/:sessionId/chunk/:index',
    express.raw({ type: '*/*', limit: '25mb' }),
    (req: Request, res: Response) => {
      const sessionId = String(req.params.sessionId);
      const index = Number(req.params.index);
      const session = db.prepare('SELECT * FROM upload_sessions WHERE id = ?').get(sessionId) as
        | { total_chunks: number; received_chunks_json: string }
        | undefined;
      if (!session) {
        res.status(404).json({ error: 'جلسة الرفع غير موجودة' });
        return;
      }
      if (!Number.isInteger(index) || index < 0 || index >= session.total_chunks) {
        res.status(400).json({ error: 'رقم الجزء غير صالح' });
        return;
      }
      const buf = Buffer.isBuffer(req.body) ? req.body : Buffer.from(req.body || '');
      const chunkDir = path.join(CHUNKS_DIR, sessionId);
      fs.mkdirSync(chunkDir, { recursive: true });
      fs.writeFileSync(path.join(chunkDir, `chunk_${index}`), buf);

      let received: number[] = [];
      try {
        received = JSON.parse(session.received_chunks_json || '[]');
      } catch {
        received = [];
      }
      if (!received.includes(index)) {
        received.push(index);
        received.sort((a, b) => a - b);
      }
      db.prepare('UPDATE upload_sessions SET received_chunks_json = ?, updated_at = ? WHERE id = ?').run(
        JSON.stringify(received),
        new Date().toISOString(),
        sessionId
      );

      res.json({ ok: true, index, receivedCount: received.length, totalChunks: session.total_chunks });
    }
  );

  app.post('/api/admin/uploads/:sessionId/complete', async (req: Request, res: Response) => {
    const sessionId = String(req.params.sessionId);
    try {
      const result = await finalizeChunkedUpload(sessionId, getActor(req));
      if (result?.media?.file_path && result?.media?.stored_name) {
        const extRes = await uploadFileToExternalStorageIfConfigured(
          result.media.file_path,
          `media/${result.media.stored_name}`,
          result.media.mime_type
        );
        if (extRes.uploaded && extRes.publicUrl) {
          db.prepare('UPDATE media_files SET public_url = ? WHERE id = ?').run(extRes.publicUrl, result.media.id);
          result.media.public_url = extRes.publicUrl;
        }
        (result as any).externalStorage = extRes;
      }
      res.json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      db.prepare("UPDATE upload_sessions SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?").run(
        msg,
        new Date().toISOString(),
        sessionId
      );
      logSystemEvent('upload_complete_error', `فشل إكمال الرفع ${sessionId}`, msg);
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/admin/uploads/sessions', (_req: Request, res: Response) => {
    const sessions = db
      .prepare('SELECT * FROM upload_sessions ORDER BY created_at DESC LIMIT 30')
      .all();
    res.json({ sessions });
  });

  app.get('/api/admin/media', (req: Request, res: Response) => {
    const kind = typeof req.query.kind === 'string' ? req.query.kind : '';
    const rows = kind
      ? db.prepare('SELECT * FROM media_files WHERE media_kind = ? ORDER BY id DESC').all(kind)
      : db.prepare('SELECT * FROM media_files ORDER BY id DESC').all();
    res.json({ files: rows });
  });

  app.get('/api/admin/media/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const file = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id);
    if (!file) {
      res.status(404).json({ error: 'الملف غير موجود' });
      return;
    }
    res.json({ file });
  });

  app.post('/api/admin/media/:id/extract-thumbnails', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const media = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id) as any;
    if (!media || media.media_kind !== 'video') {
      res.status(404).json({ error: 'ملف الفيديو غير موجود' });
      return;
    }
    if (!fs.existsSync(media.file_path)) {
      res.status(404).json({ error: 'ملف الفيديو الأصلي مفقود على الخادم' });
      return;
    }
    try {
      const modeRaw = String(req.body?.mode || 'spread');
      const mode = modeRaw === 'interval' || modeRaw === 'append' ? modeRaw : 'spread';
      const count = req.body?.count ? Number(req.body.count) : undefined;
      const intervalSec = req.body?.intervalSec ? Number(req.body.intervalSec) : undefined;
      const result = await extractVideoFrames(id, media.file_path, Number(media.duration || 1), {
        mode,
        count,
        intervalSec,
      });
      const updated = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id);
      if (result.newlyAdded.length === 0) {
        res.status(422).json({
          error: result.warning || 'تعذر استخراج أي إطار من هذا الفيديو',
          warning: result.warning,
          file: updated,
          frames: result.frames,
        });
        return;
      }
      res.json({ file: updated, frames: result.frames, newlyAdded: result.newlyAdded, warning: result.warning });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/admin/media/:id/thumbnail', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const clearAll = req.query.all === '1' || req.body?.clearAll === true;
    const url = typeof req.query.url === 'string' ? req.query.url : typeof req.body?.url === 'string' ? req.body.url : '';
    if (!clearAll && !url) {
      res.status(400).json({ error: 'حدد رابط الصورة المصغرة أو clearAll لحذف الكل' });
      return;
    }
    try {
      const result = deleteVideoThumbnail(id, { url, clearAll });
      const updated = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id);
      res.json({ ok: true, file: updated, frames: result.frames, removedUrls: result.removedUrls });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/admin/media/:id/extract-frame-at', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const timestamp = Number(req.body?.timestamp ?? 0);
    if (!Number.isFinite(timestamp) || timestamp < 0) {
      res.status(400).json({ error: 'توقيت الإطار غير صالح' });
      return;
    }
    const media = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id) as any;
    if (!media || media.media_kind !== 'video' || !fs.existsSync(media.file_path)) {
      res.status(404).json({ error: 'ملف الفيديو غير موجود' });
      return;
    }
    try {
      const result = await extractCustomTimestampFrame(id, media.file_path, timestamp);
      const updated = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id);
      res.json({ file: updated, frame: result.frame, frames: result.frames });
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/admin/media/:id/quality-plan', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    try {
      const plan = await getMediaQualityPlan(id);
      const media = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id);
      res.json({ plan, file: media });
    } catch (err) {
      res.status(404).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/admin/media/:id/transcode', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const qualities = Array.isArray(req.body?.qualities) ? (req.body.qualities as string[]) : undefined;
    const force = req.body?.force === true;
    // Start transcoding asynchronously and return current status immediately
    generateVideoRenditions(id, qualities, { force }).catch(() => {});
    const media = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id);
    res.json({ started: true, file: media });
  });

  app.patch('/api/admin/media/:id/rendition', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const label = String(req.body?.label || '').trim();
    const enabled = Boolean(req.body?.enabled);
    if (!label) {
      res.status(400).json({ error: 'اسم الجودة مطلوب' });
      return;
    }
    try {
      const result = toggleVideoRendition(id, label, enabled);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.delete('/api/admin/media/:id/rendition', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const label =
      typeof req.query.label === 'string'
        ? req.query.label
        : typeof req.body?.label === 'string'
          ? req.body.label
          : '';
    if (!label) {
      res.status(400).json({ error: 'حدد اسم الجودة المطلوب حذفها' });
      return;
    }
    try {
      const result = deleteVideoRendition(id, label);
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.post('/api/admin/media/:id/custom-thumbnail', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const url = String(req.body?.url || req.body?.thumbnailUrl || '').trim();
    const applyToLinkedContent = req.body?.applyToLinkedContent !== false;
    const media = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id) as any;
    if (!media || !url) {
      res.status(400).json({ error: 'معرف الملف ورابط الصورة المصغرة مطلوبان' });
      return;
    }
    let thumbs: any[] = [];
    try {
      thumbs = JSON.parse(media.thumbnails_json || '[]');
    } catch {
      thumbs = [];
    }
    const filtered = thumbs
      .filter((t) => !t.isCustom && t.url !== url)
      .map((t) => ({ ...t, selected: false }));
    filtered.unshift({
      index: 0,
      timestamp: 0,
      url,
      isCustom: true,
      selected: true,
      width: 640,
      height: 360,
    });
    db.prepare('UPDATE media_files SET thumbnails_json = ? WHERE id = ?').run(JSON.stringify(filtered), id);
    if (applyToLinkedContent) {
      db.prepare('UPDATE content SET thumbnail_url = ?, updated_at = ? WHERE media_file_id = ?').run(
        url,
        new Date().toISOString(),
        id
      );
    }
    const updated = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id);
    res.json({ file: updated, frames: filtered, url });
  });

  app.post('/api/admin/media/:id/select-thumbnail', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const url = String(req.body?.url || req.body?.thumbnailUrl || '').trim();
    const applyToLinkedContent = req.body?.applyToLinkedContent !== false;
    const media = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id) as any;
    if (!media || !url) {
      res.status(400).json({ error: 'معرف الملف ورابط الصورة المصغرة مطلوبان' });
      return;
    }
    let thumbs: any[] = [];
    try {
      thumbs = JSON.parse(media.thumbnails_json || '[]');
    } catch {
      thumbs = [];
    }
    let found = false;
    let nextThumbs = thumbs.map((t) => {
      if (t.url === url) {
        found = true;
        return { ...t, selected: true };
      }
      return { ...t, selected: false };
    });
    if (!found) {
      nextThumbs = [
        {
          index: 0,
          timestamp: 0,
          url,
          isCustom: true,
          selected: true,
          width: 640,
          height: 360,
        },
        ...nextThumbs,
      ];
    }
    db.prepare('UPDATE media_files SET thumbnails_json = ? WHERE id = ?').run(JSON.stringify(nextThumbs), id);
    if (applyToLinkedContent) {
      db.prepare('UPDATE content SET thumbnail_url = ?, updated_at = ? WHERE media_file_id = ?').run(
        url,
        new Date().toISOString(),
        id
      );
    }
    const updated = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id);
    res.json({ file: updated, frames: nextThumbs, url });
  });

  app.get('/api/admin/media/:id/usage', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const media = db.prepare('SELECT id, original_name FROM media_files WHERE id = ?').get(id);
    if (!media) {
      res.status(404).json({ error: 'الملف غير موجود' });
      return;
    }
    const references = getMediaUsage(id);
    res.json({ inUse: references.length > 0, references });
  });

  app.delete('/api/admin/media/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const force = req.query.force === '1';
    const media = db.prepare('SELECT * FROM media_files WHERE id = ?').get(id) as any;
    if (!media) {
      res.status(404).json({ error: 'الملف غير موجود' });
      return;
    }
    const references = getMediaUsage(id);
    if (references.length > 0 && !force) {
      res.status(409).json({
        inUse: true,
        references,
        error: `هذا الملف مستخدم حالياً في ${references.length} موضع بالموقع. راجع الارتباطات قبل تأكيد الحذف.`,
      });
      return;
    }
    deleteMediaArtifacts(id, media.file_path);
    db.prepare('DELETE FROM media_files WHERE id = ?').run(id);
    logActivity(
      'حذف ملف وسائط',
      'media',
      `تم حذف الملف "${media.original_name}"${force && references.length > 0 ? ' (حذف مؤكد مع فك الارتباط)' : ''}`,
      getActor(req),
      '',
      'warning'
    );
    res.json({ ok: true });
  });

  app.post('/api/admin/media/cleanup-chunks', (req: Request, res: Response) => {
    let removed = 0;
    if (fs.existsSync(CHUNKS_DIR)) {
      for (const entry of fs.readdirSync(CHUNKS_DIR)) {
        fs.rmSync(path.join(CHUNKS_DIR, entry), { recursive: true, force: true });
        removed++;
      }
    }
    db.prepare("UPDATE upload_sessions SET status = 'cancelled' WHERE status = 'uploading'").run();
    logActivity('تنظيف أجزاء الرفع', 'media', `تم تنظيف ${removed} مجلد أجزاء رفع مؤقت`, getActor(req));
    res.json({ ok: true, removed });
  });

  app.post('/api/admin/media/cleanup-orphans', (req: Request, res: Response) => {
    const result = cleanupOrphanedMediaFiles();
    logActivity(
      'تنظيف الملفات اليتيمة',
      'media',
      `تم حذف ${result.removed} ملف غير مرتبط على القرص (${result.freedBytes} بايت)`,
      getActor(req)
    );
    res.json({ ok: true, ...result });
  });

  app.post('/api/admin/storage/test', async (req: Request, res: Response) => {
    const all = getAllSettings();
    const cfg = { ...all.storage, ...(req.body || {}) };
    const result = await testExternalStorageConnection(cfg);
    res.status(result.ok ? 200 : 400).json({
      ...result,
      activeMode: result.ok ? result.mode : 'local',
      needsExternalConfig: !result.ok && cfg.mode !== 'local',
    });
  });

  // ---------------------------------------------------------------------------
  // SUBTITLES CRUD
  // ---------------------------------------------------------------------------
  app.get('/api/admin/subtitles', (req: Request, res: Response) => {
    const contentId = req.query.contentId ? Number(req.query.contentId) : null;
    const tracks = contentId
      ? db
          .prepare('SELECT * FROM subtitles WHERE content_id = ? ORDER BY id ASC')
          .all(contentId)
      : db.prepare('SELECT * FROM subtitles ORDER BY id DESC').all();
    res.json({ tracks });
  });

  app.post('/api/admin/subtitles', (req: Request, res: Response) => {
    const body = req.body || {};
    const contentId = Number(body.content_id);
    if (!contentId) {
      res.status(400).json({ error: 'يجب تحديد الفيديو أولاً' });
      return;
    }
    const isDefault = body.is_default ? 1 : 0;
    if (isDefault) {
      db.prepare('UPDATE subtitles SET is_default = 0 WHERE content_id = ?').run(contentId);
    }
    const now = new Date().toISOString();
    const info = db
      .prepare(
        `INSERT INTO subtitles (content_id, language, language_label, title, cues_json, style_json, visible, is_default, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        contentId,
        body.language || 'ar',
        body.language_label || 'العربية',
        body.title || 'ترجمة عربية',
        typeof body.cues_json === 'string' ? body.cues_json : JSON.stringify(body.cues || []),
        typeof body.style_json === 'string' ? body.style_json : JSON.stringify(body.style || {}),
        body.visible ?? 1,
        isDefault,
        body.status || 'published',
        now,
        now
      );
    const track = db.prepare('SELECT * FROM subtitles WHERE id = ?').get(Number(info.lastInsertRowid));
    logActivity('إضافة مسار ترجمة', 'subtitles', `تمت إضافة ترجمة (${body.language_label || 'ar'}) للفيديو #${contentId}`, 'owner');
    res.status(201).json({ track });
  });

  app.put('/api/admin/subtitles/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM subtitles WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'مسار الترجمة غير موجود' });
      return;
    }
    const body = req.body || {};
    const isDefault = body.is_default !== undefined ? (body.is_default ? 1 : 0) : (existing.is_default || 0);
    if (isDefault) {
      db.prepare('UPDATE subtitles SET is_default = 0 WHERE content_id = ? AND id != ?').run(existing.content_id, id);
    }
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE subtitles SET language = ?, language_label = ?, title = ?, cues_json = ?, style_json = ?, visible = ?, is_default = ?, status = ?, updated_at = ? WHERE id = ?`
    ).run(
      body.language ?? existing.language,
      body.language_label ?? existing.language_label,
      body.title ?? existing.title,
      body.cues !== undefined ? JSON.stringify(body.cues) : (body.cues_json ?? existing.cues_json),
      body.style !== undefined ? JSON.stringify(body.style) : (body.style_json ?? existing.style_json),
      body.visible ?? existing.visible,
      isDefault,
      body.status ?? existing.status,
      now,
      id
    );
    const track = db.prepare('SELECT * FROM subtitles WHERE id = ?').get(id);
    logActivity('تحديث مسار ترجمة', 'subtitles', `تم تحديث الترجمة #${id}`, 'owner');
    res.json({ track });
  });

  app.delete('/api/admin/subtitles/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM subtitles WHERE id = ?').run(id);
    logActivity('حذف مسار ترجمة', 'subtitles', `تم حذف الترجمة #${id}`, 'owner', '', 'warning');
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // CUSTOM CODE CRUD + VALIDATION + ROLLBACK
  // ---------------------------------------------------------------------------
  app.get('/api/admin/custom-code', (_req: Request, res: Response) => {
    const snippets = db.prepare('SELECT * FROM custom_code ORDER BY id DESC').all();
    res.json({ snippets });
  });

  function validateCustomCodeSyntax(codeType: string, code: string): string | null {
    if (/Alharbi@|document\.cookie|localStorage\.getItem|sessionStorage\.getItem|\/api\/auth\//i.test(code)) {
      return 'تم رفض الكود لأسباب أمنية (محاولة الوصول لملفات تعريف الارتباط أو بيانات المصادقة الحساسة).';
    }
    if (codeType === 'js') {
      try {
        // Parse JS syntax without executing it
        new Function(code);
      } catch (err) {
        return `خطأ في صياغة JavaScript: ${err instanceof Error ? err.message : String(err)}`;
      }
    } else if (codeType === 'css') {
      let depth = 0;
      for (const ch of code) {
        if (ch === '{') depth++;
        else if (ch === '}') depth--;
        if (depth < 0) return 'خطأ في صياغة CSS: قوس إغلاق "}" زائد قبل الفتح.';
      }
      if (depth !== 0) return 'خطأ في صياغة CSS: يوجد قوس "{" غير مغلق.';
    } else if (codeType === 'html' || codeType === 'svg') {
      if (/<script[^>]*>[\s\S]*?(document\.cookie|Alharbi@)/i.test(code)) {
        return 'تم رفض وسم HTML/Script لأسباب أمنية.';
      }
    }
    return null;
  }

  app.post('/api/admin/custom-code/validate', (req: Request, res: Response) => {
    const codeType = String(req.body?.code_type || 'css');
    const code = String(req.body?.code || '');
    const err = validateCustomCodeSyntax(codeType, code);
    if (err) {
      res.status(400).json({ valid: false, error: err });
      return;
    }
    res.json({ valid: true, error: '' });
  });

  app.post('/api/admin/custom-code', (req: Request, res: Response) => {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const codeType = String(body.code_type || 'css');
    const code = String(body.code || '');
    if (!name) {
      res.status(400).json({ error: 'اسم الكود مطلوب' });
      return;
    }
    const validationErr = validateCustomCodeSyntax(codeType, code);
    if (validationErr) {
      res.status(400).json({ error: validationErr });
      return;
    }

    const now = new Date().toISOString();
    const status = body.status || 'draft';
    const enabled = body.enabled ? 1 : 0;
    const info = db
      .prepare(
        `INSERT INTO custom_code (name, scope, target_page_id, target_selector, code_type, code, last_working_code, enabled, status, last_error, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, '', ?, ?)`
      )
      .run(
        name,
        body.scope || 'global',
        body.target_page_id ? Number(body.target_page_id) : null,
        String(body.target_selector || ''),
        codeType,
        code,
        status === 'published' ? code : '',
        enabled,
        status,
        now,
        now
      );

    const snippet = db.prepare('SELECT * FROM custom_code WHERE id = ?').get(Number(info.lastInsertRowid));
    logActivity('إنشاء كود مخصص', 'code', `تم حفظ الكود "${name}" (${codeType})`, 'owner');
    res.status(201).json({ snippet });
  });

  app.put('/api/admin/custom-code/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM custom_code WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'المقطع البرمجي غير موجود' });
      return;
    }
    const body = req.body || {};
    const codeType = String(body.code_type ?? existing.code_type);
    const code = body.code !== undefined ? String(body.code) : existing.code;
    const validationErr = validateCustomCodeSyntax(codeType, code);
    if (validationErr) {
      db.prepare('UPDATE custom_code SET last_error = ? WHERE id = ?').run(validationErr, id);
      res.status(400).json({ error: `${validationErr} — تم الإبقاء على آخر نسخة عاملة.` });
      return;
    }

    const nextStatus = body.status ?? existing.status;
    const lastWorking =
      nextStatus === 'published' && body.enabled !== 0 ? code : existing.last_working_code;
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE custom_code SET name = ?, scope = ?, target_page_id = ?, target_selector = ?, code_type = ?, code = ?, last_working_code = ?, enabled = ?, status = ?, last_error = '', updated_at = ? WHERE id = ?`
    ).run(
      body.name ?? existing.name,
      body.scope ?? existing.scope,
      body.target_page_id === undefined
        ? existing.target_page_id
        : body.target_page_id
          ? Number(body.target_page_id)
          : null,
      body.target_selector !== undefined ? String(body.target_selector) : (existing.target_selector || ''),
      codeType,
      code,
      lastWorking,
      body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing.enabled,
      nextStatus,
      now,
      id
    );
    const snippet = db.prepare('SELECT * FROM custom_code WHERE id = ?').get(id);
    logActivity('تحديث كود مخصص', 'code', `تم تحديث الكود "${body.name ?? existing.name}"`, 'owner');
    res.json({ snippet });
  });

  app.post('/api/admin/custom-code/:id/rollback', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM custom_code WHERE id = ?').get(id) as any;
    if (!existing || !existing.last_working_code) {
      res.status(400).json({ error: 'لا توجد نسخة عاملة سابقة للاسترجاع' });
      return;
    }
    db.prepare('UPDATE custom_code SET code = ?, updated_at = ? WHERE id = ?').run(
      existing.last_working_code,
      new Date().toISOString(),
      id
    );
    const snippet = db.prepare('SELECT * FROM custom_code WHERE id = ?').get(id);
    logActivity('تراجع عن كود مخصص', 'code', `تم استرجاع آخر نسخة عاملة للكود #${id}`, 'owner');
    res.json({ snippet });
  });

  app.delete('/api/admin/custom-code/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    db.prepare('DELETE FROM custom_code WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // USERS & PERMISSIONS
  // ---------------------------------------------------------------------------
  app.get('/api/admin/users', (_req: Request, res: Response) => {
    const users = (db.prepare('SELECT id, username, display_name, role, permissions_json, passcode_hash, active, last_login_at, created_at FROM roles_users ORDER BY id ASC').all() as any[]).map(
      ({ passcode_hash, ...rest }) => ({ ...rest, has_passcode: Boolean(passcode_hash) })
    );
    res.json({ users });
  });

  app.post('/api/admin/users', (req: Request, res: Response) => {
    const body = req.body || {};
    const username = String(body.username || '').trim();
    const displayName = String(body.display_name || '').trim();
    const passcode = typeof body.passcode === 'string' ? body.passcode.trim() : '';
    if (!username || !displayName) {
      res.status(400).json({ error: 'اسم المستخدم والاسم الظاهر مطلوبان' });
      return;
    }
    const now = new Date().toISOString();
    try {
      const passHash = passcode ? hashPasscode(passcode) : '';
      const info = db
        .prepare(
          'INSERT INTO roles_users (username, display_name, role, permissions_json, passcode_hash, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run(
          username,
          displayName,
          body.role || 'editor',
          JSON.stringify(body.permissions || {}),
          passHash,
          body.active === false ? 0 : 1,
          now
        );
      const rawUser = db.prepare('SELECT id, username, display_name, role, permissions_json, passcode_hash, active, last_login_at, created_at FROM roles_users WHERE id = ?').get(Number(info.lastInsertRowid)) as any;
      const { passcode_hash: _ph, ...safeUser } = rawUser;
      logActivity('إضافة مستخدم/دور', 'users', `تمت إضافة الحساب "${displayName}"`, 'owner');
      res.status(201).json({ user: { ...safeUser, has_passcode: Boolean(_ph) } });
    } catch {
      res.status(400).json({ error: 'اسم المستخدم موجود مسبقاً' });
    }
  });

  app.put('/api/admin/users/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM roles_users WHERE id = ?').get(id) as any;
    if (!existing) {
      res.status(404).json({ error: 'المستخدم غير موجود' });
      return;
    }
    const body = req.body || {};
    const nextPassHash =
      existing.username !== 'owner' && typeof body.passcode === 'string' && body.passcode.trim()
        ? hashPasscode(body.passcode.trim())
        : (existing.passcode_hash || '');
    db.prepare(
      'UPDATE roles_users SET display_name = ?, role = ?, permissions_json = ?, passcode_hash = ?, active = ? WHERE id = ?'
    ).run(
      body.display_name ?? existing.display_name,
      existing.username === 'owner' ? 'owner' : body.role ?? existing.role,
      body.permissions ? JSON.stringify(body.permissions) : existing.permissions_json,
      nextPassHash,
      existing.username === 'owner' ? 1 : body.active !== undefined ? (body.active ? 1 : 0) : existing.active,
      id
    );
    const rawUser = db.prepare('SELECT id, username, display_name, role, permissions_json, passcode_hash, active, last_login_at, created_at FROM roles_users WHERE id = ?').get(id) as any;
    const { passcode_hash: _ph, ...safeUser } = rawUser;
    logActivity('تحديث الصلاحيات', 'users', `تم تحديث صلاحيات "${existing.display_name}"`, 'owner');
    res.json({ user: { ...safeUser, has_passcode: Boolean(_ph) } });
  });

  app.delete('/api/admin/users/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM roles_users WHERE id = ?').get(id) as any;
    if (!existing || existing.username === 'owner') {
      res.status(400).json({ error: 'لا يمكن حذف حساب المالك الرئيسي' });
      return;
    }
    db.prepare('DELETE FROM roles_users WHERE id = ?').run(id);
    logActivity('حذف مستخدم', 'users', `تم حذف الحساب "${existing.display_name}"`, 'owner', '', 'warning');
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // VERSION HISTORY & ROLLBACK (Settings + Pages + Content + Poems)
  // ---------------------------------------------------------------------------
  app.get('/api/admin/versions', (req: Request, res: Response) => {
    const entityType = typeof req.query.entityType === 'string' ? req.query.entityType : '';
    const versions = entityType
      ? db
          .prepare(
            'SELECT id, category, entity_type, entity_id, label, snapshot_json, created_by, created_at FROM settings_versions WHERE entity_type = ? ORDER BY id DESC LIMIT 80'
          )
          .all(entityType)
      : db
          .prepare(
            'SELECT id, category, entity_type, entity_id, label, snapshot_json, created_by, created_at FROM settings_versions ORDER BY id DESC LIMIT 80'
          )
          .all();
    res.json({ versions });
  });

  app.post('/api/admin/versions/:id/rollback', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const ver = db.prepare('SELECT * FROM settings_versions WHERE id = ?').get(id) as
      | {
          id: number;
          category: string;
          entity_type?: string;
          entity_id?: string;
          label: string;
          snapshot_json: string;
        }
      | undefined;
    if (!ver) {
      res.status(404).json({ error: 'الإصدار غير موجود' });
      return;
    }
    const actor = getActor(req);
    const parsed = JSON.parse(ver.snapshot_json);
    const et = ver.entity_type || 'settings';
    const now = new Date().toISOString();

    if (et === 'page' && parsed?.id) {
      db.prepare(
        `UPDATE pages SET title = ?, slug = ?, parent_id = ?, page_type = ?, layout = ?, sort_order = ?, status = ?, nav_visible = ?, aggregate_children = ?, seo_title = ?, seo_description = ?, custom_content = ?, sections_json = ?, settings_json = ?, deleted_at = ?, updated_at = ? WHERE id = ?`
      ).run(
        parsed.title,
        parsed.slug,
        parsed.parent_id ?? null,
        parsed.page_type,
        parsed.layout,
        parsed.sort_order ?? 0,
        parsed.status === 'deleted' ? 'draft' : parsed.status,
        parsed.nav_visible ?? 1,
        parsed.aggregate_children ?? 1,
        parsed.seo_title || '',
        parsed.seo_description || '',
        parsed.custom_content || '',
        parsed.sections_json || '[]',
        parsed.settings_json || '{}',
        null,
        now,
        Number(parsed.id)
      );
      logActivity('استرجاع إصدار صفحة', 'versions', `تمت استعادة الصفحة "${parsed.title}" لإصدار #${id}`, actor);
      res.json({ ok: true, entityType: 'page', category: ver.category, value: parsed });
      return;
    }

    if (et === 'content' && parsed?.id) {
      db.prepare(
        `UPDATE content SET title = ?, slug = ?, content_type = ?, description = ?, body = ?, status = ?, featured = ?, page_id = ?, child_page_id = ?, extra_page_ids_json = ?, category = ?, tags_json = ?, thumbnail_url = ?, media_url = ?, media_file_id = ?, gallery_urls_json = ?, link_url = ?, link_label = ?, link_enabled = ?, link_new_tab = ?, source_label = ?, editor_label = ?, custom_metadata_json = ?, settings_json = ?, deleted_at = ?, updated_at = ? WHERE id = ?`
      ).run(
        parsed.title,
        parsed.slug,
        parsed.content_type,
        parsed.description || '',
        parsed.body || '',
        parsed.status === 'deleted' ? 'draft' : parsed.status,
        parsed.featured ? 1 : 0,
        parsed.page_id ?? null,
        parsed.child_page_id ?? null,
        parsed.extra_page_ids_json || '[]',
        parsed.category || '',
        parsed.tags_json || '[]',
        parsed.thumbnail_url || '',
        parsed.media_url || '',
        parsed.media_file_id ?? null,
        parsed.gallery_urls_json || '[]',
        parsed.link_url || '',
        parsed.link_label || '',
        parsed.link_enabled ? 1 : 0,
        parsed.link_new_tab ? 1 : 0,
        parsed.source_label || '',
        parsed.editor_label || '',
        parsed.custom_metadata_json || '{}',
        parsed.settings_json || '{}',
        null,
        now,
        Number(parsed.id)
      );
      logActivity('استرجاع إصدار محتوى', 'versions', `تمت استعادة المادة "${parsed.title}" لإصدار #${id}`, actor);
      res.json({ ok: true, entityType: 'content', category: ver.category, value: parsed });
      return;
    }

    if (et === 'poem' && parsed?.id) {
      db.prepare(
        `UPDATE poems SET title = ?, slug = ?, verses_text = ?, poet_name = ?, intro_text = ?, cover_image_url = ?, status = ?, pinned = ?, sort_order = ?, design_json = ?, deleted_at = ?, updated_at = ? WHERE id = ?`
      ).run(
        parsed.title,
        parsed.slug,
        parsed.verses_text || '',
        parsed.poet_name || '',
        parsed.intro_text || '',
        parsed.cover_image_url || '',
        parsed.status === 'deleted' ? 'draft' : parsed.status,
        parsed.pinned ? 1 : 0,
        parsed.sort_order ?? 0,
        parsed.design_json || '{}',
        null,
        now,
        Number(parsed.id)
      );
      logActivity('استرجاع إصدار قصيدة', 'versions', `تمت استعادة القصيدة "${parsed.title}" لإصدار #${id}`, actor);
      res.json({ ok: true, entityType: 'poem', category: ver.category, value: parsed });
      return;
    }

    saveSettingCategory(
      ver.category as keyof AllSettings,
      parsed,
      true,
      `تراجع إلى: ${ver.label}`,
      actor
    );
    logActivity('استرجاع إصدار سابق', 'versions', `تم التراجع لإصدار #${id} (${ver.category})`, actor);
    res.json({ ok: true, entityType: 'settings', category: ver.category, value: parsed });
  });

  // ---------------------------------------------------------------------------
  // BACKUPS & RESTORE (With Automatic Pre-Restore Safety Snapshot)
  // ---------------------------------------------------------------------------
  function createBackupSnapshot(
    label: string,
    backupType: 'manual' | 'automatic' | 'pre-restore' = 'manual',
    actor = 'owner'
  ) {
    const now = new Date().toISOString();
    const payload = {
      exportedAt: now,
      platform: 'أرشيف الشهيد',
      settings: getAllSettings(),
      pages: db.prepare('SELECT * FROM pages ORDER BY id ASC').all(),
      content: db.prepare('SELECT * FROM content ORDER BY id ASC').all(),
      poems: db.prepare('SELECT * FROM poems ORDER BY id ASC').all(),
      poem_submissions: db.prepare('SELECT * FROM poem_submissions ORDER BY id ASC').all(),
      subtitles: db.prepare('SELECT * FROM subtitles ORDER BY id ASC').all(),
      custom_code: db.prepare('SELECT * FROM custom_code ORDER BY id ASC').all(),
      roles_users: db.prepare('SELECT * FROM roles_users ORDER BY id ASC').all(),
    };

    const json = JSON.stringify(payload, null, 2);
    const checksum = crypto.createHash('sha256').update(json).digest('hex');
    const fileName = `backup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.json`;
    const filePath = path.join(BACKUPS_DIR, fileName);
    fs.writeFileSync(filePath, json, 'utf8');
    const fileSize = fs.statSync(filePath).size;

    const info = db
      .prepare(
        'INSERT INTO backups (label, backup_type, file_path, file_size, checksum, verified, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)'
      )
      .run(label, backupType, filePath, fileSize, checksum, now);

    const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(Number(info.lastInsertRowid));
    logActivity('إنشاء نسخة احتياطية', 'backup', `تم إنشاء نسخة احتياطية (${backupType}): "${label}"`, actor);
    return backup;
  }

  app.get('/api/admin/backups', (_req: Request, res: Response) => {
    const backups = db.prepare('SELECT * FROM backups ORDER BY id DESC').all();
    res.json({ backups });
  });

  app.post('/api/admin/backups', (req: Request, res: Response) => {
    const label = String(req.body?.label || `نسخة احتياطية ${new Date().toLocaleDateString('ar-EG')}`);
    const backupTypeRaw = String(req.body?.backup_type || 'manual');
    const backupType =
      backupTypeRaw === 'automatic' || backupTypeRaw === 'pre-restore' ? backupTypeRaw : 'manual';
    const backup = createBackupSnapshot(label, backupType, getActor(req));
    res.status(201).json({ backup });
  });

  app.get('/api/admin/backups/:id/download', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(id) as any;
    if (!backup || !fs.existsSync(backup.file_path)) {
      res.status(404).json({ error: 'ملف النسخة الاحتياطية غير موجود' });
      return;
    }
    res.download(backup.file_path, path.basename(backup.file_path));
  });

  function applyBackupPayload(payload: any, actor = 'owner'): void {
    const now = new Date().toISOString();
    if (payload.settings && typeof payload.settings === 'object') {
      for (const k of Object.keys(payload.settings)) {
        if (k in DEFAULT_SETTINGS) {
          saveSettingCategory(k as keyof AllSettings, payload.settings[k], false, undefined, actor);
        }
      }
    }
    if (Array.isArray(payload.pages)) {
      db.exec('DELETE FROM pages');
      const ins = db.prepare(`
        INSERT INTO pages (id, title, slug, parent_id, page_type, layout, sort_order, status, nav_visible, aggregate_children, seo_title, seo_description, custom_content, sections_json, settings_json, deleted_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const p of payload.pages) {
        ins.run(
          p.id,
          p.title,
          p.slug,
          p.parent_id ?? null,
          p.page_type,
          p.layout,
          p.sort_order,
          p.status,
          p.nav_visible,
          p.aggregate_children,
          p.seo_title || '',
          p.seo_description || '',
          p.custom_content || '',
          p.sections_json || '[]',
          p.settings_json || '{}',
          p.deleted_at ?? null,
          p.created_at || now,
          now
        );
      }
    }
    if (Array.isArray(payload.content)) {
      db.exec('DELETE FROM content');
      const insC = db.prepare(`
        INSERT INTO content (id, title, slug, content_type, description, body, status, featured, page_id, child_page_id, extra_page_ids_json, category, tags_json, thumbnail_url, media_url, media_file_id, gallery_urls_json, link_url, link_label, link_enabled, link_new_tab, duration, resolution, width, height, views, source_label, editor_label, custom_metadata_json, settings_json, published_at, scheduled_at, deleted_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const c of payload.content) {
        insC.run(
          c.id,
          c.title,
          c.slug,
          c.content_type,
          c.description || '',
          c.body || '',
          c.status || 'draft',
          c.featured || 0,
          c.page_id ?? null,
          c.child_page_id ?? null,
          c.extra_page_ids_json || '[]',
          c.category || '',
          c.tags_json || '[]',
          c.thumbnail_url || '',
          c.media_url || '',
          c.media_file_id ?? null,
          c.gallery_urls_json || '[]',
          c.link_url || '',
          c.link_label || '',
          c.link_enabled || 0,
          c.link_new_tab || 0,
          c.duration || 0,
          c.resolution || '',
          c.width || 0,
          c.height || 0,
          c.views || 0,
          c.source_label || '',
          c.editor_label || '',
          c.custom_metadata_json || '{}',
          c.settings_json || '{}',
          c.published_at ?? null,
          c.scheduled_at ?? null,
          c.deleted_at ?? null,
          c.created_at || now,
          now
        );
      }
    }
    if (Array.isArray(payload.subtitles)) {
      db.exec('DELETE FROM subtitles');
      const insSub = db.prepare(`
        INSERT INTO subtitles (id, content_id, language, language_label, title, cues_json, style_json, visible, is_default, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const s of payload.subtitles) {
        try {
          insSub.run(
            s.id,
            s.content_id,
            s.language || 'ar',
            s.language_label || 'العربية',
            s.title || '',
            s.cues_json || '[]',
            s.style_json || '{}',
            s.visible ?? 1,
            s.is_default ?? 0,
            s.status || 'published',
            s.created_at || now,
            now
          );
        } catch {
          // ignore orphan subtitle
        }
      }
    }
    if (Array.isArray(payload.custom_code)) {
      db.exec('DELETE FROM custom_code');
      const insCode = db.prepare(`
        INSERT INTO custom_code (id, name, scope, target_page_id, target_selector, code_type, code, last_working_code, enabled, status, last_error, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const cc of payload.custom_code) {
        insCode.run(
          cc.id,
          cc.name || 'كود مستورد',
          cc.scope || 'global',
          cc.target_page_id ?? null,
          cc.target_selector || '',
          cc.code_type || 'css',
          cc.code || '',
          cc.last_working_code || '',
          cc.enabled ? 1 : 0,
          cc.status || 'draft',
          cc.last_error || '',
          cc.created_at || now,
          now
        );
      }
    }
    if (Array.isArray(payload.roles_users)) {
      db.exec("DELETE FROM roles_users WHERE username != 'owner'");
      const insUser = db.prepare(`
        INSERT OR IGNORE INTO roles_users (username, display_name, role, permissions_json, passcode_hash, active, last_login_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const u of payload.roles_users) {
        if (!u?.username || u.username === 'owner') continue;
        insUser.run(
          u.username,
          u.display_name || u.username,
          u.role || 'editor',
          u.permissions_json || '{}',
          u.passcode_hash || '',
          u.active ?? 1,
          u.last_login_at ?? null,
          u.created_at || now
        );
      }
    }
    if (Array.isArray(payload.poems)) {
      db.exec('DELETE FROM poems');
      const insPoem = db.prepare(`
        INSERT INTO poems (id, title, slug, verses_text, poet_name, intro_text, cover_image_url, status, pinned, sort_order, design_json, published_at, scheduled_at, deleted_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const pm of payload.poems) {
        insPoem.run(
          pm.id,
          pm.title,
          pm.slug,
          pm.verses_text || '',
          pm.poet_name || '',
          pm.intro_text || '',
          pm.cover_image_url || '',
          pm.status || 'draft',
          pm.pinned ? 1 : 0,
          pm.sort_order ?? 0,
          pm.design_json || '{}',
          pm.published_at ?? null,
          pm.scheduled_at ?? null,
          pm.deleted_at ?? null,
          pm.created_at || now,
          now
        );
      }
    }
    if (Array.isArray(payload.poem_submissions)) {
      db.exec('DELETE FROM poem_submissions');
      const insSub = db.prepare(`
        INSERT INTO poem_submissions (id, user_id, title, verses_text, poet_name, extra_info, custom_fields_json, status, admin_notes, published_poem_id, ip_hash, deleted_at, created_at, updated_at)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const sub of payload.poem_submissions) {
        insSub.run(
          sub.id,
          sub.title,
          sub.verses_text || '',
          sub.poet_name || '',
          sub.extra_info || '',
          sub.custom_fields_json || '[]',
          sub.status || 'pending',
          sub.admin_notes || '',
          sub.published_poem_id ?? null,
          sub.ip_hash || '',
          sub.deleted_at ?? null,
          sub.created_at || now,
          now
        );
      }
    }
  }

  app.post('/api/admin/backups/:id/restore', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(id) as any;
    if (!backup || !fs.existsSync(backup.file_path)) {
      res.status(404).json({ error: 'ملف النسخة الاحتياطية غير موجود' });
      return;
    }
    const raw = fs.readFileSync(backup.file_path, 'utf8');
    const actualSum = crypto.createHash('sha256').update(raw).digest('hex');
    if (backup.checksum && actualSum !== backup.checksum) {
      res.status(400).json({ error: 'فشل التحقق من سلامة النسخة الاحتياطية (checksum mismatch)' });
      return;
    }
    const payload = JSON.parse(raw);
    const actor = getActor(req);
    const safetyBackup = createBackupSnapshot(
      `نسخة أمان تلقائية قبل استعادة "${backup.label}"`,
      'pre-restore',
      actor
    );
    applyBackupPayload(payload, actor);
    logActivity('استعادة نسخة احتياطية', 'backup', `تمت استعادة النسخة "${backup.label}" مع حفظ نسخة أمان تلقائية مسبقاً`, actor, '', 'warning');
    res.json({ ok: true, safetyBackup });
  });

  app.post('/api/admin/backups/import', (req: Request, res: Response) => {
    const payload = req.body;
    if (!payload || typeof payload !== 'object' || !payload.settings) {
      res.status(400).json({ error: 'صيغة ملف النسخة الاحتياطية غير صالحة' });
      return;
    }
    const actor = getActor(req);
    const safetyBackup = createBackupSnapshot(
      `نسخة أمان تلقائية قبل الاستيراد (${new Date().toLocaleTimeString('ar-EG')})`,
      'pre-restore',
      actor
    );
    applyBackupPayload(payload, actor);
    logActivity('استيراد نسخة احتياطية', 'backup', 'تم استيراد واستعادة نسخة احتياطية خارجية مع نسخة أمان قبلية', actor, '', 'warning');
    res.json({ ok: true, safetyBackup });
  });

  app.delete('/api/admin/backups/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const backup = db.prepare('SELECT * FROM backups WHERE id = ?').get(id) as any;
    if (backup && fs.existsSync(backup.file_path)) {
      fs.unlinkSync(backup.file_path);
    }
    db.prepare('DELETE FROM backups WHERE id = ?').run(id);
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // ACTIVITY LOGS & SYSTEM HEALTH DIAGNOSTICS
  // ---------------------------------------------------------------------------
  app.get('/api/admin/activity', (req: Request, res: Response) => {
    const category = typeof req.query.category === 'string' ? req.query.category : '';
    const logs = category
      ? db
          .prepare('SELECT * FROM activity_logs WHERE category = ? ORDER BY id DESC LIMIT 200')
          .all(category)
      : db.prepare('SELECT * FROM activity_logs ORDER BY id DESC LIMIT 200').all();
    res.json({ logs });
  });

  app.get('/api/admin/health', async (_req: Request, res: Response) => {
    const ffmpeg = await checkFfmpegAvailable();
    const storage = getStorageSummary();
    const dbOk = (() => {
      try {
        const r = db.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
        return r.integrity_check === 'ok';
      } catch {
        return false;
      }
    })();

    const failedUploads = db
      .prepare("SELECT * FROM upload_sessions WHERE status = 'failed' ORDER BY updated_at DESC LIMIT 20")
      .all();
    const failedContent = db
      .prepare("SELECT id, title, content_type, status FROM content WHERE status = 'failed'")
      .all();

    // Scan for broken links in content items with link_enabled=1
    const linkedItems = db
      .prepare('SELECT id, title, link_url FROM content WHERE link_enabled = 1')
      .all() as Array<{ id: number; title: string; link_url: string }>;
    const brokenLinks = linkedItems.filter((i) => {
      if (!i.link_url) return true;
      return !/^(https?:\/\/|\/)/i.test(i.link_url.trim());
    });

    const events = db.prepare('SELECT * FROM system_events ORDER BY id DESC LIMIT 50').all();
    const backupCount = (db.prepare('SELECT COUNT(*) as cnt FROM backups').get() as { cnt: number }).cnt;

    res.json({
      diagnostics: {
        dbConnected: dbOk,
        walMode: true,
        storageWritable: fs.existsSync(DB_PATH),
        ffmpegAvailable: ffmpeg.ffmpeg,
        ffprobeAvailable: ffmpeg.ffprobe,
        totalFiles: storage.fileCount,
        totalMediaBytes: storage.totalBytes,
        byKind: storage.byKind,
        missingFiles: storage.missingFiles,
        orphanedFiles: storage.orphanedFiles,
        orphanedFilesCount: storage.orphanedFiles.length,
        failedUploads,
        failedContent,
        brokenLinks,
        backupCount,
      },
      events,
    });
  });

  app.post('/api/admin/health/events/:id/resolve', (req: Request, res: Response) => {
    db.prepare('UPDATE system_events SET resolved = 1 WHERE id = ?').run(Number(req.params.id));
    res.json({ ok: true });
  });

  app.delete('/api/admin/health/events/resolved', (_req: Request, res: Response) => {
    db.prepare('DELETE FROM system_events WHERE resolved = 1').run();
    res.json({ ok: true });
  });

  // ---------------------------------------------------------------------------
  // POETRY & PRIVATE SUBMISSIONS MANAGEMENT (Owner Only)
  // ---------------------------------------------------------------------------
  app.get('/api/admin/poems', (req: Request, res: Response) => {
    publishDueScheduledPoems();
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const includeDeleted = req.query.includeDeleted === '1';
    const q = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
    const rows = db
      .prepare('SELECT * FROM poems ORDER BY pinned DESC, sort_order ASC, id DESC')
      .all() as unknown as PoemRecord[];
    const filtered = rows.filter((p) => {
      if (!includeDeleted && status !== 'deleted' && p.status === 'deleted') return false;
      if (status && status !== 'all' && p.status !== status) return false;
      if (q) {
        const hay = `${p.title} ${p.poet_name} ${p.intro_text} ${p.verses_text}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    res.json({ poems: filtered });
  });

  app.post('/api/admin/poems', (req: Request, res: Response) => {
    const body = req.body || {};
    const title = String(body.title || '').trim();
    const versesText = String(body.verses_text || '').trim();
    if (!title || !versesText) {
      res.status(400).json({ error: 'عنوان القصيدة وأبياتها مطلوبان' });
      return;
    }
    const slug = makeUniqueSlug('poems', String(body.slug || title));
    const now = new Date().toISOString();
    const status = body.status || 'draft';
    const publishedAt =
      status === 'published' ? body.published_at || now : body.published_at || null;
    const maxOrder = (
      db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM poems').get() as { m: number }
    ).m;
    const designJson =
      typeof body.design_json === 'string'
        ? body.design_json
        : JSON.stringify(body.design || {});

    const info = db
      .prepare(
        `INSERT INTO poems (
          title, slug, verses_text, poet_name, intro_text, cover_image_url,
          status, pinned, sort_order, design_json, published_at, scheduled_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        title,
        slug,
        versesText,
        String(body.poet_name || '').trim(),
        String(body.intro_text || '').trim(),
        String(body.cover_image_url || '').trim(),
        status,
        body.pinned ? 1 : 0,
        body.sort_order ?? maxOrder + 1,
        designJson,
        publishedAt,
        body.scheduled_at || null,
        now,
        now
      );
    const created = db
      .prepare('SELECT * FROM poems WHERE id = ?')
      .get(Number(info.lastInsertRowid)) as unknown as PoemRecord;
    logActivity('إضافة قصيدة', 'poetry', `تم إنشاء قصيدة "${created.title}" [${created.status}]`, getActor(req));
    res.status(201).json({ poem: created });
  });

  app.put('/api/admin/poems/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM poems WHERE id = ?').get(id) as PoemRecord | undefined;
    if (!existing) {
      res.status(404).json({ error: 'القصيدة غير موجودة' });
      return;
    }
    const body = req.body || {};
    const title = body.title !== undefined ? String(body.title).trim() : existing.title;
    const versesText = body.verses_text !== undefined ? String(body.verses_text) : existing.verses_text;
    if (!title || !versesText.trim()) {
      res.status(400).json({ error: 'عنوان القصيدة وأبياتها مطلوبان' });
      return;
    }
    const slug =
      body.slug !== undefined && String(body.slug).trim() !== ''
        ? makeUniqueSlug('poems', String(body.slug), id)
        : existing.slug;
    const nextStatus = body.status ?? existing.status;
    const now = new Date().toISOString();
    let publishedAt = body.published_at !== undefined ? body.published_at : existing.published_at;
    if (nextStatus === 'published' && !publishedAt) {
      publishedAt = now;
    }
    const actor = getActor(req);
    saveEntityVersion('poem', id, `نسخة قبل تعديل القصيدة: ${existing.title}`, existing, actor);

    const designJson =
      body.design !== undefined
        ? JSON.stringify(body.design)
        : (body.design_json ?? existing.design_json);

    db.prepare(
      `UPDATE poems SET
        title = ?, slug = ?, verses_text = ?, poet_name = ?, intro_text = ?, cover_image_url = ?,
        status = ?, pinned = ?, sort_order = ?, design_json = ?, published_at = ?, scheduled_at = ?, updated_at = ?
      WHERE id = ?`
    ).run(
      title,
      slug,
      versesText,
      body.poet_name !== undefined ? String(body.poet_name).trim() : existing.poet_name,
      body.intro_text !== undefined ? String(body.intro_text).trim() : existing.intro_text,
      body.cover_image_url !== undefined ? String(body.cover_image_url).trim() : existing.cover_image_url,
      nextStatus,
      body.pinned !== undefined ? (body.pinned ? 1 : 0) : existing.pinned,
      body.sort_order !== undefined ? Number(body.sort_order) : existing.sort_order,
      designJson,
      publishedAt,
      body.scheduled_at !== undefined ? body.scheduled_at : existing.scheduled_at,
      now,
      id
    );
    const updated = db.prepare('SELECT * FROM poems WHERE id = ?').get(id) as unknown as PoemRecord;
    logActivity('تحديث قصيدة', 'poetry', `تم تحديث القصيدة "${updated.title}"`, getActor(req));
    res.json({ poem: updated });
  });

  app.post('/api/admin/poems/reorder', (req: Request, res: Response) => {
    const items = (req.body?.items || []) as Array<{ id: number; sort_order: number }>;
    const stmt = db.prepare('UPDATE poems SET sort_order = ?, updated_at = ? WHERE id = ?');
    const now = new Date().toISOString();
    for (const item of items) {
      stmt.run(Number(item.sort_order), now, Number(item.id));
    }
    res.json({ ok: true });
  });

  app.delete('/api/admin/poems/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const permanent = req.query.permanent === '1';
    const existing = db.prepare('SELECT * FROM poems WHERE id = ?').get(id) as PoemRecord | undefined;
    if (!existing) {
      res.status(404).json({ error: 'القصيدة غير موجودة' });
      return;
    }
    if (permanent || existing.status === 'deleted') {
      db.prepare('DELETE FROM poems WHERE id = ?').run(id);
      logActivity('حذف قصيدة نهائياً', 'poetry', `تم حذف القصيدة "${existing.title}" نهائياً`, getActor(req), '', 'warning');
      res.json({ ok: true, mode: 'permanent' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare("UPDATE poems SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ?").run(now, now, id);
    logActivity('نقل قصيدة للمحذوفات', 'poetry', `تم نقل القصيدة "${existing.title}" إلى سلة المحذوفات`, getActor(req), '', 'warning');
    res.json({ ok: true, mode: 'soft' });
  });

  app.get('/api/admin/poem-submissions', (req: Request, res: Response) => {
    const status = typeof req.query.status === 'string' ? req.query.status : 'all';
    const rows = db
      .prepare('SELECT * FROM poem_submissions ORDER BY id DESC')
      .all() as unknown as PoemSubmissionRecord[];
    const pendingCount = rows.filter((r) => r.status === 'pending').length;
    const deletedCount = rows.filter((r) => r.status === 'deleted').length;
    const filtered =
      status === 'deleted'
        ? rows.filter((r) => r.status === 'deleted')
        : status && status !== 'all'
          ? rows.filter((r) => r.status === status)
          : rows.filter((r) => r.status !== 'deleted');
    res.json({
      submissions: filtered,
      pendingCount,
      deletedCount,
      totalCount: rows.filter((r) => r.status !== 'deleted').length,
    });
  });

  app.put('/api/admin/poem-submissions/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db
      .prepare('SELECT * FROM poem_submissions WHERE id = ?')
      .get(id) as PoemSubmissionRecord | undefined;
    if (!existing) {
      res.status(404).json({ error: 'المشاركة غير موجودة' });
      return;
    }
    const body = req.body || {};
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE poem_submissions SET
        title = ?, verses_text = ?, poet_name = ?, extra_info = ?, admin_notes = ?, updated_at = ?
      WHERE id = ?`
    ).run(
      body.title !== undefined ? String(body.title).trim() : existing.title,
      body.verses_text !== undefined ? String(body.verses_text) : existing.verses_text,
      body.poet_name !== undefined ? String(body.poet_name).trim() : existing.poet_name,
      body.extra_info !== undefined ? String(body.extra_info).trim() : existing.extra_info,
      body.admin_notes !== undefined ? String(body.admin_notes) : existing.admin_notes,
      now,
      id
    );
    const updated = db
      .prepare('SELECT * FROM poem_submissions WHERE id = ?')
      .get(id) as unknown as PoemSubmissionRecord;
    res.json({ submission: updated });
  });

  app.post('/api/admin/poem-submissions/:id/status', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '').trim();
    if (!['pending', 'private', 'rejected', 'approved', 'deleted'].includes(status)) {
      res.status(400).json({ error: 'حالة غير صالحة' });
      return;
    }
    const existing = db
      .prepare('SELECT * FROM poem_submissions WHERE id = ?')
      .get(id) as PoemSubmissionRecord | undefined;
    if (!existing) {
      res.status(404).json({ error: 'المشاركة غير موجودة' });
      return;
    }
    const now = new Date().toISOString();
    const deletedAt = status === 'deleted' ? now : null;
    db.prepare('UPDATE poem_submissions SET status = ?, admin_notes = ?, deleted_at = ?, updated_at = ? WHERE id = ?').run(
      status,
      req.body?.admin_notes !== undefined ? String(req.body.admin_notes) : existing.admin_notes,
      deletedAt,
      now,
      id
    );
    const updated = db
      .prepare('SELECT * FROM poem_submissions WHERE id = ?')
      .get(id) as unknown as PoemSubmissionRecord;
    logActivity('تحديث حالة مشاركة قصيدة', 'poetry', `تم تغيير حالة المشاركة "${existing.title}" إلى (${status})`, getActor(req));
    res.json({ submission: updated });
  });

  app.post('/api/admin/poem-submissions/:id/restore', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const existing = db
      .prepare('SELECT * FROM poem_submissions WHERE id = ?')
      .get(id) as PoemSubmissionRecord | undefined;
    if (!existing) {
      res.status(404).json({ error: 'المشاركة غير موجودة' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare("UPDATE poem_submissions SET status = 'pending', deleted_at = NULL, updated_at = ? WHERE id = ?").run(now, id);
    const updated = db
      .prepare('SELECT * FROM poem_submissions WHERE id = ?')
      .get(id) as unknown as PoemSubmissionRecord;
    logActivity('استعادة مشاركة قصيدة', 'poetry', `تمت استعادة المشاركة "${existing.title}"`, getActor(req));
    res.json({ ok: true, submission: updated });
  });

  app.post('/api/admin/poem-submissions/:id/approve', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const sub = db
      .prepare('SELECT * FROM poem_submissions WHERE id = ?')
      .get(id) as PoemSubmissionRecord | undefined;
    if (!sub) {
      res.status(404).json({ error: 'المشاركة غير موجودة' });
      return;
    }

    // Approve-once idempotency guard
    if (sub.status === 'approved' && sub.published_poem_id) {
      const existingPoem = db
        .prepare('SELECT * FROM poems WHERE id = ?')
        .get(sub.published_poem_id) as unknown as PoemRecord | undefined;
      if (existingPoem) {
        res.json({ ok: true, alreadyApproved: true, poem: existingPoem, submission: sub });
        return;
      }
    }

    const body = req.body || {};
    const title = String(body.title ?? sub.title).trim();
    const versesText = String(body.verses_text ?? sub.verses_text).trim();
    const poetName = String(body.poet_name ?? sub.poet_name).trim();
    const introText = String(body.intro_text ?? sub.extra_info).trim();
    const coverImageUrl = String(body.cover_image_url || '').trim();
    const publishNow = body.publishNow !== false;
    const poemStatus = publishNow ? 'published' : 'draft';
    const designJson =
      typeof body.design_json === 'string'
        ? body.design_json
        : JSON.stringify(body.design || {});
    const now = new Date().toISOString();
    const slug = makeUniqueSlug('poems', title);
    const maxOrder = (
      db.prepare('SELECT COALESCE(MAX(sort_order), 0) as m FROM poems').get() as { m: number }
    ).m;

    const info = db
      .prepare(
        `INSERT INTO poems (
          title, slug, verses_text, poet_name, intro_text, cover_image_url,
          status, pinned, sort_order, design_json, published_at, scheduled_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?)`
      )
      .run(
        title,
        slug,
        versesText,
        poetName,
        introText,
        coverImageUrl,
        poemStatus,
        body.pinned ? 1 : 0,
        maxOrder + 1,
        designJson,
        publishNow ? now : null,
        now,
        now
      );
    const poemId = Number(info.lastInsertRowid);
    db.prepare(
      "UPDATE poem_submissions SET status = 'approved', published_poem_id = ?, deleted_at = NULL, title = ?, verses_text = ?, poet_name = ?, updated_at = ? WHERE id = ?"
    ).run(poemId, title, versesText, poetName, now, id);

    const poem = db.prepare('SELECT * FROM poems WHERE id = ?').get(poemId) as unknown as PoemRecord;
    const submission = db
      .prepare('SELECT * FROM poem_submissions WHERE id = ?')
      .get(id) as unknown as PoemSubmissionRecord;
    logActivity(
      'اعتماد ونشر مشاركة قصيدة',
      'poetry',
      `تم اعتماد المشاركة "${title}" (${publishNow ? 'منشورة' : 'كمسودة'}) في صفحة قصائد`,
      getActor(req)
    );
    res.json({ ok: true, poem, submission });
  });

  app.delete('/api/admin/poem-submissions/:id', (req: Request, res: Response) => {
    const id = Number(req.params.id);
    const permanent = req.query.permanent === '1';
    const existing = db
      .prepare('SELECT * FROM poem_submissions WHERE id = ?')
      .get(id) as PoemSubmissionRecord | undefined;
    if (!existing) {
      res.status(404).json({ error: 'المشاركة غير موجودة' });
      return;
    }
    if (permanent || existing.status === 'deleted') {
      db.prepare('DELETE FROM poem_submissions WHERE id = ?').run(id);
      logActivity('حذف مشاركة قصيدة نهائياً', 'poetry', `تم حذف المشاركة "${existing.title}" نهائياً`, getActor(req), '', 'warning');
      res.json({ ok: true, mode: 'permanent' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare("UPDATE poem_submissions SET status = 'deleted', deleted_at = ?, updated_at = ? WHERE id = ?").run(now, now, id);
    logActivity('نقل مشاركة للمحذوفات', 'poetry', `تم نقل المشاركة "${existing.title}" إلى المحذوفات`, getActor(req), '', 'warning');
    res.json({ ok: true, mode: 'soft' });
  });

  // ---------------------------------------------------------------------------
  // OWNER SECURITY CODE CHANGE & FIRESTORE CLOUD SYNC
  // ---------------------------------------------------------------------------
  app.put('/api/admin/security/codes', (req: Request, res: Response) => {
    const { currentCode1, currentCode2, newCode1, newCode2 } = (req.body || {}) as {
      currentCode1?: string;
      currentCode2?: string;
      newCode1?: string;
      newCode2?: string;
    };
    if (!currentCode1 || !currentCode2 || !newCode1 || !newCode2) {
      res.status(400).json({ error: 'يرجى إدخال الرمزين الحاليين والرمزين الجديدين.' });
      return;
    }
    if (!verifyOwnerCodes(currentCode1, currentCode2)) {
      res.status(401).json({ error: 'الرمز الأول أو الرمز الثاني الحالي غير صحيح.' });
      return;
    }
    if (newCode1.trim().length < 6 || newCode2.trim().length < 6) {
      res.status(400).json({ error: 'يجب أن يكون كل من الرمز الأول والثاني الجديد 6 أحرف على الأقل.' });
      return;
    }
    updateOwnerCodes(newCode1.trim(), newCode2.trim());
    logActivity('تحديث رموز المالك', 'security', 'تم تغيير رمزي الدخول المزدوج للمالك الرئيسي بنجاح', getActor(req));
    res.json({ ok: true, message: 'تم تحديث رمزي الدخول المزدوج بنجاح.' });
  });

  app.get('/api/admin/cloud/status', (req: Request, res: Response) => {
    const hasToken = Boolean(req.headers['x-firebase-id-token']);
    res.json({ cloud: getCloudSyncStatus(hasToken) });
  });

  app.get('/api/admin/cloud/snapshot', (_req: Request, res: Response) => {
    const snapshot = gatherLocalSyncSnapshot();
    res.json({ snapshot });
  });

  app.post('/api/admin/cloud/sync-ack', (req: Request, res: Response) => {
    const counts = req.body?.counts || {};
    const ownerEmail = typeof req.body?.ownerEmail === 'string' ? req.body.ownerEmail : 'uiryukfh@gmail.com';
    recordCloudSyncState('synced', counts, ownerEmail);
    logActivity(
      'مزامنة سحابية Firestore',
      'cloud',
      `تمت مزامنة البيانات المحلية مع Firestore (${JSON.stringify(counts)})`,
      getActor(req)
    );
    res.json({ ok: true, cloud: getCloudSyncStatus(true) });
  });

  // ---------------------------------------------------------------------------
  // RECYCLE BIN (SOFT-DELETED PAGES, CONTENT, POEMS, SUBMISSIONS)
  // ---------------------------------------------------------------------------
  app.get('/api/admin/trash', (_req: Request, res: Response) => {
    const pages = db
      .prepare("SELECT id, title, slug, page_type, deleted_at, updated_at FROM pages WHERE status = 'deleted' ORDER BY updated_at DESC")
      .all();
    const content = db
      .prepare("SELECT id, title, slug, content_type, deleted_at, updated_at FROM content WHERE status = 'deleted' ORDER BY updated_at DESC")
      .all();
    const poems = db
      .prepare("SELECT id, title, slug, poet_name, deleted_at, updated_at FROM poems WHERE status = 'deleted' ORDER BY updated_at DESC")
      .all();
    const submissions = db
      .prepare("SELECT id, title, poet_name, deleted_at, updated_at FROM poem_submissions WHERE status = 'deleted' ORDER BY updated_at DESC")
      .all();
    res.json({ pages, content, poems, submissions });
  });

  app.post('/api/admin/trash/:kind/:id/restore', (req: Request, res: Response) => {
    const kind = String(req.params.kind);
    const id = Number(req.params.id);
    const now = new Date().toISOString();
    if (kind === 'page') {
      db.prepare("UPDATE pages SET status = 'draft', deleted_at = NULL, updated_at = ? WHERE id = ?").run(now, id);
    } else if (kind === 'content') {
      db.prepare("UPDATE content SET status = 'draft', deleted_at = NULL, updated_at = ? WHERE id = ?").run(now, id);
    } else if (kind === 'poem') {
      db.prepare("UPDATE poems SET status = 'draft', deleted_at = NULL, updated_at = ? WHERE id = ?").run(now, id);
    } else if (kind === 'submission') {
      db.prepare("UPDATE poem_submissions SET status = 'pending', deleted_at = NULL, updated_at = ? WHERE id = ?").run(now, id);
    } else {
      res.status(400).json({ error: 'نوع العنصر غير صالح' });
      return;
    }
    logActivity('استعادة من سلة المحذوفات', 'trash', `تمت استعادة (${kind}) #${id}`, getActor(req));
    res.json({ ok: true });
  });

  app.delete('/api/admin/trash/:kind/:id', (req: Request, res: Response) => {
    const kind = String(req.params.kind);
    const id = Number(req.params.id);
    if (kind === 'page') {
      const existing = db.prepare('SELECT parent_id, title FROM pages WHERE id = ?').get(id) as any;
      if (existing) {
        db.prepare('UPDATE pages SET parent_id = ? WHERE parent_id = ?').run(existing.parent_id, id);
        db.prepare('DELETE FROM pages WHERE id = ?').run(id);
      }
    } else if (kind === 'content') {
      db.prepare('DELETE FROM content WHERE id = ?').run(id);
      cleanupDeletedContentReferences([id]);
    } else if (kind === 'poem') {
      db.prepare('DELETE FROM poems WHERE id = ?').run(id);
    } else if (kind === 'submission') {
      db.prepare('DELETE FROM poem_submissions WHERE id = ?').run(id);
    } else {
      res.status(400).json({ error: 'نوع العنصر غير صالح' });
      return;
    }
    logActivity('حذف نهائي من المحذوفات', 'trash', `تم حذف (${kind}) #${id} نهائياً`, getActor(req), '', 'warning');
    res.json({ ok: true });
  });

  app.post('/api/admin/trash/empty', (req: Request, res: Response) => {
    const delContent = db.prepare("SELECT id FROM content WHERE status = 'deleted'").all() as Array<{ id: number }>;
    db.exec("DELETE FROM pages WHERE status = 'deleted'");
    db.exec("DELETE FROM content WHERE status = 'deleted'");
    db.exec("DELETE FROM poems WHERE status = 'deleted'");
    db.exec("DELETE FROM poem_submissions WHERE status = 'deleted'");
    if (delContent.length > 0) {
      cleanupDeletedContentReferences(delContent.map((c) => c.id));
    }
    logActivity('إفراغ سلة المحذوفات', 'trash', 'تم إفراغ جميع العناصر المحذوفة نهائياً', getActor(req), '', 'warning');
    res.json({ ok: true });
  });
}
