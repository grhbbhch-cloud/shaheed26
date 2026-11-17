import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { DEFAULT_SETTINGS } from './defaults.ts';
import type { AllSettings } from '../src/types/platform.ts';

export const DATA_DIR = path.resolve(process.cwd(), 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const CHUNKS_DIR = path.join(UPLOADS_DIR, 'chunks');
export const MEDIA_DIR = path.join(UPLOADS_DIR, 'media');
export const THUMBNAILS_DIR = path.join(UPLOADS_DIR, 'thumbnails');
export const RENDITIONS_DIR = path.join(UPLOADS_DIR, 'renditions');
export const BACKUPS_DIR = path.join(DATA_DIR, 'backups');
export const DB_PATH = path.join(DATA_DIR, 'alharbi.db');

for (const dir of [
  DATA_DIR,
  UPLOADS_DIR,
  CHUNKS_DIR,
  MEDIA_DIR,
  THUMBNAILS_DIR,
  RENDITIONS_DIR,
  BACKUPS_DIR,
]) {
  fs.mkdirSync(dir, { recursive: true });
}

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA synchronous = NORMAL;

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    parent_id INTEGER REFERENCES pages(id) ON DELETE SET NULL,
    page_type TEXT NOT NULL DEFAULT 'collection',
    layout TEXT NOT NULL DEFAULT 'grid',
    sort_order INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'published',
    nav_visible INTEGER NOT NULL DEFAULT 1,
    aggregate_children INTEGER NOT NULL DEFAULT 1,
    seo_title TEXT NOT NULL DEFAULT '',
    seo_description TEXT NOT NULL DEFAULT '',
    custom_content TEXT NOT NULL DEFAULT '',
    sections_json TEXT NOT NULL DEFAULT '[]',
    settings_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS media_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    media_kind TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    sha256 TEXT,
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    duration REAL NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ready',
    processing_progress INTEGER NOT NULL DEFAULT 100,
    error_message TEXT NOT NULL DEFAULT '',
    thumbnails_json TEXT NOT NULL DEFAULT '[]',
    renditions_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS upload_sessions (
    id TEXT PRIMARY KEY,
    original_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    total_size INTEGER NOT NULL,
    total_chunks INTEGER NOT NULL,
    received_chunks_json TEXT NOT NULL DEFAULT '[]',
    sha256 TEXT,
    status TEXT NOT NULL DEFAULT 'uploading',
    media_file_id INTEGER,
    error_message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    content_type TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    body TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    featured INTEGER NOT NULL DEFAULT 0,
    page_id INTEGER REFERENCES pages(id) ON DELETE SET NULL,
    child_page_id INTEGER REFERENCES pages(id) ON DELETE SET NULL,
    extra_page_ids_json TEXT NOT NULL DEFAULT '[]',
    category TEXT NOT NULL DEFAULT '',
    tags_json TEXT NOT NULL DEFAULT '[]',
    thumbnail_url TEXT NOT NULL DEFAULT '',
    media_url TEXT NOT NULL DEFAULT '',
    media_file_id INTEGER REFERENCES media_files(id) ON DELETE SET NULL,
    gallery_urls_json TEXT NOT NULL DEFAULT '[]',
    link_url TEXT NOT NULL DEFAULT '',
    link_enabled INTEGER NOT NULL DEFAULT 0,
    link_new_tab INTEGER NOT NULL DEFAULT 0,
    duration REAL NOT NULL DEFAULT 0,
    resolution TEXT NOT NULL DEFAULT '',
    width INTEGER NOT NULL DEFAULT 0,
    height INTEGER NOT NULL DEFAULT 0,
    views INTEGER NOT NULL DEFAULT 0,
    source_label TEXT NOT NULL DEFAULT '',
    editor_label TEXT NOT NULL DEFAULT '',
    custom_metadata_json TEXT NOT NULL DEFAULT '{}',
    settings_json TEXT NOT NULL DEFAULT '{}',
    published_at TEXT,
    scheduled_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS subtitles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_id INTEGER NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    language TEXT NOT NULL,
    language_label TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    cues_json TEXT NOT NULL DEFAULT '[]',
    style_json TEXT NOT NULL DEFAULT '{}',
    visible INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'published',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS custom_code (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    scope TEXT NOT NULL DEFAULT 'global',
    target_page_id INTEGER,
    target_selector TEXT NOT NULL DEFAULT '',
    code_type TEXT NOT NULL,
    code TEXT NOT NULL DEFAULT '',
    last_working_code TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'draft',
    last_error TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS roles_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    permissions_json TEXT NOT NULL DEFAULT '{}',
    passcode_hash TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    last_login_at TEXT,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    label TEXT NOT NULL,
    snapshot_json TEXT NOT NULL,
    created_by TEXT NOT NULL DEFAULT 'owner',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    backup_type TEXT NOT NULL DEFAULT 'manual',
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    checksum TEXT NOT NULL DEFAULT '',
    verified INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    category TEXT NOT NULL,
    details TEXT NOT NULL,
    actor TEXT NOT NULL DEFAULT 'owner',
    ip_address TEXT NOT NULL DEFAULT '',
    severity TEXT NOT NULL DEFAULT 'info',
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS system_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    resolved INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS poems (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    verses_text TEXT NOT NULL DEFAULT '',
    poet_name TEXT NOT NULL DEFAULT '',
    intro_text TEXT NOT NULL DEFAULT '',
    cover_image_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft',
    pinned INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    design_json TEXT NOT NULL DEFAULT '{}',
    published_at TEXT,
    scheduled_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS poem_submissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    title TEXT NOT NULL,
    verses_text TEXT NOT NULL DEFAULT '',
    poet_name TEXT NOT NULL DEFAULT '',
    extra_info TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    admin_notes TEXT NOT NULL DEFAULT '',
    published_poem_id INTEGER,
    ip_hash TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS public_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    firebase_uid TEXT UNIQUE,
    username TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    phone TEXT NOT NULL DEFAULT '',
    password_hash TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    verified INTEGER NOT NULL DEFAULT 0,
    verification_type TEXT NOT NULL DEFAULT '',
    badge_label TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS verification_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES public_users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    entity_type TEXT NOT NULL DEFAULT 'individual',
    details TEXT NOT NULL DEFAULT '',
    attachment_url TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'pending',
    admin_notes TEXT NOT NULL DEFAULT '',
    reviewed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    subject TEXT NOT NULL DEFAULT '',
    message TEXT NOT NULL,
    target_type TEXT NOT NULL DEFAULT 'general',
    status TEXT NOT NULL DEFAULT 'new',
    admin_reply TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_pages_parent ON pages(parent_id);
  CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
  CREATE INDEX IF NOT EXISTS idx_content_page ON content(page_id);
  CREATE INDEX IF NOT EXISTS idx_content_child_page ON content(child_page_id);
  CREATE INDEX IF NOT EXISTS idx_content_type ON content(content_type);
  CREATE INDEX IF NOT EXISTS idx_subtitles_content ON subtitles(content_id);
  CREATE INDEX IF NOT EXISTS idx_poems_status ON poems(status);
  CREATE INDEX IF NOT EXISTS idx_poems_sort ON poems(pinned DESC, sort_order ASC, id DESC);
  CREATE INDEX IF NOT EXISTS idx_poem_sub_status ON poem_submissions(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_logs(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_public_users_email ON public_users(email);
  CREATE INDEX IF NOT EXISTS idx_verification_status ON verification_requests(status, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_suggestions_status ON suggestions(status, created_at DESC);
`);

// Safe idempotent column migrations preserving existing data
try {
  const cols = db.prepare('PRAGMA table_info(content)').all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === 'link_label')) {
    db.exec("ALTER TABLE content ADD COLUMN link_label TEXT NOT NULL DEFAULT ''");
  }
  const subCols = db.prepare('PRAGMA table_info(subtitles)').all() as Array<{ name: string }>;
  if (!subCols.some((c) => c.name === 'is_default')) {
    db.exec('ALTER TABLE subtitles ADD COLUMN is_default INTEGER NOT NULL DEFAULT 0');
  }
  const codeCols = db.prepare('PRAGMA table_info(custom_code)').all() as Array<{ name: string }>;
  if (!codeCols.some((c) => c.name === 'target_selector')) {
    db.exec("ALTER TABLE custom_code ADD COLUMN target_selector TEXT NOT NULL DEFAULT ''");
  }
  const userCols = db.prepare('PRAGMA table_info(roles_users)').all() as Array<{ name: string }>;
  if (!userCols.some((c) => c.name === 'passcode_hash')) {
    db.exec("ALTER TABLE roles_users ADD COLUMN passcode_hash TEXT NOT NULL DEFAULT ''");
  }
  const pageCols = db.prepare('PRAGMA table_info(pages)').all() as Array<{ name: string }>;
  if (!pageCols.some((c) => c.name === 'deleted_at')) {
    db.exec('ALTER TABLE pages ADD COLUMN deleted_at TEXT');
  }
  if (!cols.some((c) => c.name === 'deleted_at')) {
    db.exec('ALTER TABLE content ADD COLUMN deleted_at TEXT');
  }
  const poemCols = db.prepare('PRAGMA table_info(poems)').all() as Array<{ name: string }>;
  if (!poemCols.some((c) => c.name === 'deleted_at')) {
    db.exec('ALTER TABLE poems ADD COLUMN deleted_at TEXT');
  }
  const poemSubCols = db.prepare('PRAGMA table_info(poem_submissions)').all() as Array<{ name: string }>;
  if (!poemSubCols.some((c) => c.name === 'user_id')) {
    db.exec('ALTER TABLE poem_submissions ADD COLUMN user_id INTEGER');
  }
  if (!poemSubCols.some((c) => c.name === 'custom_fields_json')) {
    db.exec("ALTER TABLE poem_submissions ADD COLUMN custom_fields_json TEXT NOT NULL DEFAULT '[]'");
  }
  if (!poemSubCols.some((c) => c.name === 'deleted_at')) {
    db.exec('ALTER TABLE poem_submissions ADD COLUMN deleted_at TEXT');
  }
  const verCols = db.prepare('PRAGMA table_info(settings_versions)').all() as Array<{ name: string }>;
  if (!verCols.some((c) => c.name === 'entity_type')) {
    db.exec("ALTER TABLE settings_versions ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'settings'");
  }
  if (!verCols.some((c) => c.name === 'entity_id')) {
    db.exec("ALTER TABLE settings_versions ADD COLUMN entity_id TEXT NOT NULL DEFAULT ''");
  }
} catch {
  // ignore if already present
}

function deepMerge<T extends Record<string, any>>(base: T, incoming: Partial<T>): T {
  const result: Record<string, any> = { ...base };
  for (const key of Object.keys(incoming)) {
    const val = (incoming as Record<string, any>)[key];
    if (
      val !== null &&
      typeof val === 'object' &&
      !Array.isArray(val) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], val);
    } else if (val !== undefined) {
      result[key] = val;
    }
  }
  return result as T;
}

export function seedInitialData(): void {
  const now = new Date().toISOString();

  // Seed default settings keys if missing (never overwrite existing keys)
  const existingSettingKeys = new Set(
    (db.prepare('SELECT key FROM settings').all() as Array<{ key: string }>).map((r) => r.key)
  );
  const insertSetting = db.prepare(
    'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)'
  );

  for (const key of Object.keys(DEFAULT_SETTINGS) as Array<keyof AllSettings>) {
    if (!existingSettingKeys.has(key)) {
      insertSetting.run(key, JSON.stringify(DEFAULT_SETTINGS[key]), now);
    }
  }

  // Seed initial 9 main pages + 5 child pages = 14 pages only if pages table is empty
  const pageCountRow = db.prepare('SELECT COUNT(*) as cnt FROM pages').get() as { cnt: number };
  if (pageCountRow.cnt === 0) {
    const insertPage = db.prepare(`
      INSERT INTO pages (
        title, slug, parent_id, page_type, layout, sort_order, status,
        nav_visible, aggregate_children, seo_title, seo_description,
        custom_content, sections_json, settings_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const mainPages: Array<[string, string, string, string, number]> = [
      ['الرئيسية', 'home', 'home', 'grid', 1],
      ['المنشورات', 'posts', 'collection', 'grid', 2],
      ['الفيديوهات', 'videos', 'videos', 'grid', 3],
      ['الصور', 'images', 'images', 'gallery', 4],
      ['المقالات', 'articles', 'articles', 'editorial', 5],
      ['التقارير', 'reports', 'reports', 'list', 6],
      ['الأرشيف', 'archive', 'archive', 'grid', 7],
      ['قصائد', 'poems', 'poetry', 'editorial', 8],
      ['من نحن', 'about', 'static', 'editorial', 9],
      ['اتصل بنا', 'contact', 'static', 'editorial', 10],
    ];

    const idBySlug: Record<string, number> = {};
    for (const [title, slug, pageType, layout, order] of mainPages) {
      const customContent =
        slug === 'about'
          ? 'منصة أرشيف الشهيد منصة توثيقية وإعلامية تعنى بحفظ الذاكرة البصرية، نشر التقارير الميدانية، والدراسات التحليلية والأرشيف الوثائقي.'
          : slug === 'contact'
            ? 'للتواصل والمراسلات الإعلامية والأرشيفية، يمكنكم مراسلتنا عبر البريد الإلكتروني الرسمي للمنصة.'
            : '';
      const res = insertPage.run(
        title,
        slug,
        null,
        pageType,
        layout,
        order,
        'published',
        slug === 'contact' ? 0 : 1,
        1,
        `${title} | أرشيف الشهيد`,
        `قسم ${title} في منصة أرشيف الشهيد`,
        customContent,
        '[]',
        '{}',
        now,
        now
      );
      idBySlug[slug] = Number(res.lastInsertRowid);
    }

    const childPages: Array<[string, string, number, string, string, number]> = [
      ['مقابلات', 'videos-interviews', idBySlug['videos'], 'videos', 'grid', 1],
      ['تقارير مصورة', 'videos-reports', idBySlug['videos'], 'videos', 'grid', 2],
      ['وثائقيات', 'videos-documentaries', idBySlug['videos'], 'videos', 'grid', 3],
      ['تاريخية', 'images-historical', idBySlug['images'], 'images', 'gallery', 1],
      ['فعاليات', 'images-events', idBySlug['images'], 'images', 'gallery', 2],
    ];

    for (const [title, slug, parentId, pageType, layout, order] of childPages) {
      insertPage.run(
        title,
        slug,
        parentId,
        pageType,
        layout,
        order,
        'published',
        1,
        1,
        `${title} | أرشيف الشهيد`,
        `تصنيف ${title}`,
        '',
        '[]',
        '{}',
        now,
        now
      );
    }
  }

  // Seed primary owner user record
  const userCount = db.prepare('SELECT COUNT(*) as cnt FROM roles_users').get() as { cnt: number };
  if (userCount.cnt === 0) {
    const allPerms = {
      view: true,
      create: true,
      edit: true,
      delete: true,
      publish: true,
      unpublish: true,
      upload: true,
      download: true,
      manage_settings: true,
      manage_users: true,
      manage_security: true,
      manage_backups: true,
      manage_code: true,
      manage_appearance: true,
    };
    db.prepare(`
      INSERT INTO roles_users (username, display_name, role, permissions_json, active, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
    `).run('owner', 'المالك الرئيسي - أرشيف الشهيد', 'owner', JSON.stringify(allPerms), now);
  }

  // One-time idempotent migration for existing databases:
  // rename "الإعلام الحربي" -> "أرشيف الشهيد" and switch default green palette tokens to luxury Gold theme
  const migApplied = db.prepare("SELECT 1 FROM settings WHERE key = '_internal_brand_gold_v1'").get();
  if (!migApplied) {
    const transformString = (str: string): string =>
      str
        .replace(/الإعلام الحربي/g, 'أرشيف الشهيد')
        .replace(/info@alharbi-media\.org/gi, 'info@shaheed-archive.org')
        .replace(/#006B3C/gi, '#B08D45')
        .replace(/#00532F/gi, '#8C6A2F')
        .replace(/#087A49/gi, '#D4AF65')
        .replace(/#008B4E/gi, '#D4AF65')
        .replace(/#1E3A2A/gi, '#8C6A2F')
        .replace(/#0E3B26/gi, '#8C6A2F')
        .replace(/#E7F3ED/gi, '#F7F4EC')
        .replace(/#D4F5E4/gi, '#F7F4EC')
        .replace(/rgba\(\s*0\s*,\s*107\s*,\s*60\s*,/gi, 'rgba(176,141,69,');

    const walkJson = (val: any): any => {
      if (typeof val === 'string') return transformString(val);
      if (Array.isArray(val)) return val.map(walkJson);
      if (val && typeof val === 'object') {
        const out: Record<string, any> = {};
        for (const k of Object.keys(val)) out[k] = walkJson(val[k]);
        return out;
      }
      return val;
    };

    const settingRows = db.prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>;
    const updSetting = db.prepare('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?');
    for (const row of settingRows) {
      if (row.key.startsWith('_internal_')) continue;
      try {
        const parsed = JSON.parse(row.value);
        const next = walkJson(parsed);
        if (row.key === 'colors' && next && typeof next === 'object') {
          next.primary = '#B08D45';
          next.deepPrimary = '#8C6A2F';
          next.secondary = '#D4AF65';
          next.accent = '#B08D45';
          next.goldAccent = '#9c932b';
          next.black = '#080808';
          next.darkBg = '#080808';
          next.mainText = '#171717';
          next.lightBg = '#F7F4EC';
          next.lightGray = '#E8E0D0';
          next.border = '#E8E0D0';
          next.icon = '#B08D45';
          next.buttonBg = '#B08D45';
          next.hover = '#8C6A2F';
          next.active = '#8C6A2F';
          next.focus = '#B08D45';
          next.loadingColor = '#B08D45';
          next.glowColor = 'rgba(176,141,69,0.35)';
          if (next.targets?.badges) {
            next.targets.badges.color = '#8C6A2F';
            next.targets.badges.background = '#F7F4EC';
            next.targets.badges.borderColor = '#E8E0D0';
          }
          if (next.targets?.cards) {
            next.targets.cards.borderColor = '#E8E0D0';
          }
          if (next.targets?.borders) {
            next.targets.borders.color = '#E8E0D0';
            next.targets.borders.borderColor = '#E8E0D0';
          }
          if (next.targets?.related) {
            next.targets.related.borderColor = '#E8E0D0';
          }
          if (next.targets?.admin) {
            next.targets.admin.background = '#F7F4EC';
            next.targets.admin.borderColor = '#E8E0D0';
          }
        } else if (row.key === 'adminTheme' && next && typeof next === 'object') {
          next.mainBg = '#F7F4EC';
          next.cardBorder = '#E8E0D0';
          next.inputBorder = '#E8E0D0';
          next.tableHeaderBg = '#F7F4EC';
          next.scrollbarColor = '#B08D45';
        } else if (row.key === 'loginTheme' && next && typeof next === 'object') {
          next.cardBorder = '#E8E0D0';
          next.inputBorder = '#E8E0D0';
          next.inputBg = '#F7F4EC';
        } else if (row.key === 'infoCard' && next && typeof next === 'object') {
          if (next.borderColor === '#D8D8D8') next.borderColor = '#E8E0D0';
          if (next.separatorColor === '#E7E7E7') next.separatorColor = '#E8E0D0';
        } else if (row.key === 'related' && next?.cardDesign) {
          if (next.cardDesign.borderColor === '#D8D8D8') next.cardDesign.borderColor = '#E8E0D0';
        } else if (row.key === 'homepage' && Array.isArray(next?.sections)) {
          next.sections = next.sections.map((s: any) =>
            s?.backgroundColor === '#F5F5F5' ? { ...s, backgroundColor: '#F7F4EC' } : s
          );
        }
        updSetting.run(JSON.stringify(next), now, row.key);
      } catch {
        // skip invalid json row
      }
    }

    const pageRows = db.prepare('SELECT id, seo_title, seo_description, custom_content FROM pages').all() as Array<{
      id: number;
      seo_title: string;
      seo_description: string;
      custom_content: string;
    }>;
    const updPage = db.prepare('UPDATE pages SET seo_title = ?, seo_description = ?, custom_content = ?, updated_at = ? WHERE id = ?');
    for (const p of pageRows) {
      updPage.run(
        (p.seo_title || '').replace(/الإعلام الحربي/g, 'أرشيف الشهيد'),
        (p.seo_description || '').replace(/الإعلام الحربي/g, 'أرشيف الشهيد'),
        (p.custom_content || '').replace(/الإعلام الحربي/g, 'أرشيف الشهيد'),
        now,
        p.id
      );
    }

    const userRows = db.prepare('SELECT id, display_name FROM roles_users').all() as Array<{
      id: number;
      display_name: string;
    }>;
    const updUser = db.prepare('UPDATE roles_users SET display_name = ? WHERE id = ?');
    for (const u of userRows) {
      updUser.run((u.display_name || '').replace(/الإعلام الحربي/g, 'أرشيف الشهيد'), u.id);
    }

    db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(
      '_internal_brand_gold_v1',
      JSON.stringify({ applied: true, at: now }),
      now
    );
  }

  // Idempotent non-destructive setup for independent Poetry page (قصائد) + nav link on existing DBs
  const poetrySetupApplied = db.prepare("SELECT 1 FROM settings WHERE key = '_internal_poetry_setup_v1'").get();
  if (!poetrySetupApplied) {
    let existingPoetryPage = db
      .prepare("SELECT id, slug FROM pages WHERE slug = 'poems' OR page_type = 'poetry' LIMIT 1")
      .get() as { id: number; slug: string } | undefined;

    if (!existingPoetryPage) {
      const maxOrderRow = db
        .prepare('SELECT COALESCE(MAX(sort_order), 0) as maxOrder FROM pages WHERE parent_id IS NULL')
        .get() as { maxOrder: number };
      const res = db
        .prepare(`
          INSERT INTO pages (
            title, slug, parent_id, page_type, layout, sort_order, status,
            nav_visible, aggregate_children, seo_title, seo_description,
            custom_content, sections_json, settings_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          'قصائد',
          'poems',
          null,
          'poetry',
          'editorial',
          Number(maxOrderRow?.maxOrder || 0) + 1,
          'published',
          1,
          1,
          'قصائد | أرشيف الشهيد',
          'ديوان القصائد والمراثي الأدبية في منصة أرشيف الشهيد',
          '',
          '[]',
          '{}',
          now,
          now
        );
      existingPoetryPage = { id: Number(res.lastInsertRowid), slug: 'poems' };
    }

    const navRow = db.prepare("SELECT value FROM settings WHERE key = 'navigation'").get() as
      | { value: string }
      | undefined;
    if (navRow?.value) {
      try {
        const navParsed = JSON.parse(navRow.value);
        if (Array.isArray(navParsed?.items)) {
          const hasPoemsNav = navParsed.items.some(
            (item: any) =>
              item?.url === '/p/poems' ||
              item?.url === '/poems' ||
              (existingPoetryPage && Number(item?.pageId) === existingPoetryPage.id)
          );
          if (!hasPoemsNav) {
            const maxNavOrder = navParsed.items.reduce(
              (acc: number, it: any) => Math.max(acc, Number(it?.order || 0)),
              0
            );
            navParsed.items.push({
              id: 'nav-poems',
              label: 'قصائد',
              url: `/p/${existingPoetryPage.slug}`,
              type: 'page',
              pageId: existingPoetryPage.id,
              icon: '',
              visible: true,
              order: maxNavOrder + 1,
              openInNewTab: false,
              children: [],
            });
            db.prepare('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?').run(
              JSON.stringify(navParsed),
              now,
              'navigation'
            );
          }
        }
      } catch {
        // leave existing navigation untouched if malformed
      }
    }

    db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(
      '_internal_poetry_setup_v1',
      JSON.stringify({ applied: true, pageId: existingPoetryPage.id, at: now }),
      now
    );
  }

  // Idempotent one-time center-align navbar default upgrade
  const navCenterApplied = db.prepare("SELECT 1 FROM settings WHERE key = '_internal_nav_center_v1'").get();
  if (!navCenterApplied) {
    const navRow = db.prepare("SELECT value FROM settings WHERE key = 'navigation'").get() as
      | { value: string }
      | undefined;
    if (navRow?.value) {
      try {
        const navParsed = JSON.parse(navRow.value);
        if (navParsed && navParsed.alignment === 'right') {
          navParsed.alignment = 'center';
          db.prepare('UPDATE settings SET value = ?, updated_at = ? WHERE key = ?').run(
            JSON.stringify(navParsed),
            now,
            'navigation'
          );
        }
      } catch {
        // ignore
      }
    }
    db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(
      '_internal_nav_center_v1',
      JSON.stringify({ applied: true, at: now }),
      now
    );
  }
}

export function getAllSettings(): AllSettings {
  const rows = db.prepare('SELECT key, value FROM settings').all() as Array<{
    key: string;
    value: string;
  }>;
  const assembled: Record<string, any> = {};
  for (const row of rows) {
    if (row.key.startsWith('_internal_')) continue;
    try {
      assembled[row.key] = JSON.parse(row.value);
    } catch {
      // ignore corrupted row, fallback to default
    }
  }
  const merged = deepMerge(DEFAULT_SETTINGS, assembled as Partial<AllSettings>);
  if (merged.infoCard && Array.isArray(merged.infoCard.fields)) {
    merged.infoCard = {
      ...merged.infoCard,
      fields: merged.infoCard.fields.filter((f) => f.key !== 'views'),
    };
  }
  if (merged.related?.cardDesign) {
    merged.related = {
      ...merged.related,
      cardDesign: { ...merged.related.cardDesign, showViews: false },
    };
  }
  return merged;
}

export function getPublicSettings(): Omit<AllSettings, 'security' | 'storage' | 'backupSchedule'> {
  const all = getAllSettings() as Record<string, any>;
  const {
    security: _sec,
    storage: _stor,
    backupSchedule: _bs,
    accounts: _acc,
    verification: _ver,
    suggestions: _sug,
    ...publicSafe
  } = all;
  if (publicSafe.search && (publicSafe.search.defaultSort as string) === 'views') {
    publicSafe.search = { ...publicSafe.search, defaultSort: 'newest' };
  }
  if (publicSafe.officialAccount?.deleted) {
    publicSafe.officialAccount = {
      ...publicSafe.officialAccount,
      enabled: false,
      deleted: true,
    };
  }
  return publicSafe as Omit<AllSettings, 'security' | 'storage' | 'backupSchedule'>;
}

export function saveSettingCategory<K extends keyof AllSettings>(
  key: K,
  value: AllSettings[K],
  createVersion = true,
  label?: string,
  actor = 'owner'
): AllSettings[K] {
  const now = new Date().toISOString();
  const json = JSON.stringify(value);
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run(String(key), json, now);

  if (createVersion) {
    db.prepare(`
      INSERT INTO settings_versions (category, entity_type, entity_id, label, snapshot_json, created_by, created_at)
      VALUES (?, 'settings', ?, ?, ?, ?, ?)
    `).run(String(key), String(key), label || `تحديث إعدادات (${String(key)})`, json, actor, now);
  }
  return value;
}

export function saveEntityVersion(
  entityType: 'page' | 'content' | 'poem',
  entityId: number | string,
  label: string,
  snapshot: unknown,
  actor = 'owner'
): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO settings_versions (category, entity_type, entity_id, label, snapshot_json, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(entityType, entityType, String(entityId), label, JSON.stringify(snapshot), actor, now);
}

export function logActivity(
  action: string,
  category: string,
  details: string,
  actor = 'owner',
  ipAddress = '',
  severity: 'info' | 'warning' | 'error' = 'info'
): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO activity_logs (action, category, details, actor, ip_address, severity, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(action, category, details, actor, ipAddress, severity, now);
}

export function logSystemEvent(
  eventType: string,
  message: string,
  details = ''
): void {
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO system_events (event_type, message, details, resolved, created_at)
    VALUES (?, ?, ?, 0, ?)
  `).run(eventType, message, details, now);
}

// Run scheduled content publisher automatically
export function publishDueScheduledContent(): number {
  const now = new Date().toISOString();
  const res = db.prepare(`
    UPDATE content
    SET status = 'published', published_at = COALESCE(published_at, scheduled_at, ?), updated_at = ?
    WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
  `).run(now, now, now);
  return Number(res.changes || 0);
}

// Run scheduled poem publisher automatically
export function publishDueScheduledPoems(): number {
  const now = new Date().toISOString();
  const res = db.prepare(`
    UPDATE poems
    SET status = 'published', published_at = COALESCE(published_at, scheduled_at, ?), updated_at = ?
    WHERE status = 'scheduled' AND scheduled_at IS NOT NULL AND scheduled_at <= ?
  `).run(now, now, now);
  return Number(res.changes || 0);
}

seedInitialData();
