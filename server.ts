import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import {
  BACKUPS_DIR,
  db,
  getAllSettings,
  getPublicSettings,
  logActivity,
  saveSettingCategory,
  UPLOADS_DIR,
} from './server/db.ts';
import { registerRoutes } from './server/routes.ts';

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);

  // JSON parser (skip raw chunk uploads which use express.raw inside route)
  app.use((req, res, next) => {
    if (req.path.includes('/api/admin/uploads/') && req.path.includes('/chunk/')) {
      next();
      return;
    }
    express.json({ limit: '50mb' })(req, res, next);
  });

  // Serve persistent uploaded media, thumbnails, renditions, fonts, favicons
  app.use(
    '/uploads',
    express.static(UPLOADS_DIR, {
      acceptRanges: true,
      maxAge: '7d',
      fallthrough: false,
    })
  );

  // Dynamic favicon endpoint so browser tab updates reliably
  app.get('/favicon.ico', (_req, res) => {
    try {
      const pub = getPublicSettings();
      const fav = pub.identity?.faviconUrl;
      if (fav && fav.startsWith('/uploads/')) {
        const local = path.join(UPLOADS_DIR, fav.replace(/^\/uploads\//, ''));
        if (fs.existsSync(local)) {
          res.setHeader('Cache-Control', 'no-cache');
          res.sendFile(local);
          return;
        }
      }
      const staticPublicFav = path.resolve(process.cwd(), 'public/favicon.ico');
      if (fs.existsSync(staticPublicFav)) {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(staticPublicFav);
        return;
      }
    } catch {
      // ignore
    }
    // Clean minimal gold geometric SVG fallback favicon
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="#B08D45"/><path d="M32 10l5.5 14.5L52 30l-14.5 5.5L32 50l-5.5-14.5L12 30l14.5-5.5z" fill="#FFFFFF"/></svg>`
    );
  });

  // Dynamic SEO robots.txt & sitemap.xml
  app.get('/robots.txt', (_req, res) => {
    try {
      const settings = getAllSettings();
      const robots =
        settings.seo?.robotsTxt ||
        'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/';
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(robots);
    } catch {
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send('User-agent: *\nAllow: /\nDisallow: /admin\n');
    }
  });

  app.get('/sitemap.xml', (req, res) => {
    try {
      const settings = getAllSettings();
      if (settings.seo && settings.seo.sitemapEnabled === false) {
        res.status(404).send('Sitemap disabled');
        return;
      }
      const proto = (req.headers['x-forwarded-proto'] as string) || req.protocol || 'https';
      const host = req.get('host') || 'localhost:3000';
      const baseUrl = (settings.seo?.siteUrl || `${proto}://${host}`).replace(/\/+$/, '');
      const urls: Array<{ loc: string; lastmod?: string }> = [{ loc: `${baseUrl}/` }];

      const pages = db
        .prepare("SELECT slug, updated_at FROM pages WHERE status = 'published'")
        .all() as Array<{ slug: string; updated_at: string }>;
      for (const p of pages) {
        if (p.slug === 'home') continue;
        urls.push({ loc: `${baseUrl}/p/${encodeURIComponent(p.slug)}`, lastmod: p.updated_at });
      }
      const items = db
        .prepare("SELECT slug, updated_at FROM content WHERE status = 'published'")
        .all() as Array<{ slug: string; updated_at: string }>;
      for (const c of items) {
        urls.push({ loc: `${baseUrl}/content/${encodeURIComponent(c.slug)}`, lastmod: c.updated_at });
      }
      const poems = db
        .prepare("SELECT slug, updated_at FROM poems WHERE status = 'published'")
        .all() as Array<{ slug: string; updated_at: string }>;
      for (const pm of poems) {
        urls.push({ loc: `${baseUrl}/poem/${encodeURIComponent(pm.slug)}`, lastmod: pm.updated_at });
      }

      const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls
          .map(
            (u) =>
              `  <url><loc>${escapeHtml(u.loc)}</loc>${u.lastmod ? `<lastmod>${escapeHtml(u.lastmod.slice(0, 10))}</lastmod>` : ''}</url>`
          )
          .join('\n') +
        `\n</urlset>`;
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      res.send(xml);
    } catch {
      res.status(500).send('Sitemap error');
    }
  });

  // Register all API routes
  registerRoutes(app);

  // Ensure unmatched /api/* endpoints return JSON 404 rather than SPA HTML
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'نقطة النهاية غير موجودة' });
  });

  // Error handler for upload / JSON errors
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err?.status || 500;
    res.status(status).json({ error: err?.message || 'حدث خطأ غير متوقع في الخادم' });
  });

  function injectMetaIntoHtml(html: string): string {
    try {
      const pub = getPublicSettings();
      const title = pub.identity.browserTitle || pub.identity.siteName || 'أرشيف الشهيد';
      const desc = pub.identity.metaDescription || '';
      const favUrl = pub.identity.faviconUrl
        ? `${pub.identity.faviconUrl}?v=${pub.identity.faviconVersion || 1}`
        : `/favicon.ico?v=${pub.identity.faviconVersion || 1}`;
      const ogImg = pub.identity.defaultShareImage || '';

      let out = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(title)}</title>`);
      out = out.replace(
        /<meta name="description" content="[^"]*"\s*\/?>/i,
        `<meta name="description" content="${escapeHtml(desc)}" />`
      );
      out = out.replace(
        /<meta property="og:title" content="[^"]*"\s*\/?>/i,
        `<meta property="og:title" content="${escapeHtml(title)}" />`
      );
      out = out.replace(
        /<meta property="og:description" content="[^"]*"\s*\/?>/i,
        `<meta property="og:description" content="${escapeHtml(desc)}" />`
      );
      const favTag = `<link rel="icon" href="${escapeHtml(favUrl)}" />`;
      const ogImgTag = ogImg ? `<meta property="og:image" content="${escapeHtml(ogImg)}" />` : '';
      out = out.replace('</head>', `  ${favTag}\n  ${ogImgTag}\n  </head>`);
      return out;
    } catch {
      return html;
    }
  }

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api/') || req.originalUrl.startsWith('/uploads/')) {
        next();
        return;
      }
      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let html = fs.readFileSync(indexPath, 'utf8');
        html = await vite.transformIndexHtml(req.originalUrl, html);
        html = injectMetaIntoHtml(html);
        res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { index: false }));
    app.get('*', (req, res, next) => {
      if (req.originalUrl.startsWith('/api/') || req.originalUrl.startsWith('/uploads/')) {
        next();
        return;
      }
      const indexPath = path.join(distDir, 'index.html');
      if (!fs.existsSync(indexPath)) {
        res.status(500).send('Application build missing. Run npm run build.');
        return;
      }
      const html = injectMetaIntoHtml(fs.readFileSync(indexPath, 'utf8'));
      res.status(200).set({ 'Content-Type': 'text/html; charset=utf-8' }).end(html);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Alharbi Media server running on http://0.0.0.0:${PORT}`);
  });

  // Scheduled automatic backups check every 30 minutes
  const runScheduledBackupCheck = () => {
    try {
      const settings = getAllSettings();
      const sched = settings.backupSchedule;
      const freq =
        sched?.frequency && sched.frequency !== 'off'
          ? sched.frequency
          : settings.other?.autoBackupEnabled
            ? 'daily'
            : 'off';
      if (freq === 'off') return;

      const lastRunMs = sched?.lastRunAt ? Date.parse(sched.lastRunAt) : 0;
      const intervalMs =
        freq === 'monthly'
          ? 30 * 24 * 60 * 60 * 1000
          : freq === 'weekly'
            ? 7 * 24 * 60 * 60 * 1000
            : 24 * 60 * 60 * 1000;
      if (lastRunMs && Date.now() - lastRunMs < intervalMs) return;

      const now = new Date().toISOString();
      const payload = {
        exportedAt: now,
        platform: 'أرشيف الشهيد',
        settings,
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
      const filePath = path.join(BACKUPS_DIR, `auto_backup_${Date.now()}.json`);
      fs.writeFileSync(filePath, json, 'utf8');
      const fileSize = fs.statSync(filePath).size;
      db.prepare(
        "INSERT INTO backups (label, backup_type, file_path, file_size, checksum, verified, created_at) VALUES (?, 'automatic', ?, ?, ?, 1, ?)"
      ).run(`نسخة مجدولة تلقائية (${freq})`, filePath, fileSize, checksum, now);

      saveSettingCategory(
        'backupSchedule',
        { ...sched, frequency: freq, lastRunAt: now },
        false,
        undefined,
        'scheduler'
      );

      // Retention cleanup for automatic backups
      const keep = Math.max(2, Number(sched?.retentionCount || 10));
      const autos = db
        .prepare("SELECT id, file_path FROM backups WHERE backup_type = 'automatic' ORDER BY id DESC")
        .all() as Array<{ id: number; file_path: string }>;
      for (const old of autos.slice(keep)) {
        if (old.file_path && fs.existsSync(old.file_path)) {
          try {
            fs.unlinkSync(old.file_path);
          } catch {
            // ignore
          }
        }
        db.prepare('DELETE FROM backups WHERE id = ?').run(old.id);
      }

      logActivity('نسخ احتياطي مجدول', 'backup', `تم إنشاء نسخة احتياطية تلقائية (${freq})`, 'scheduler');
    } catch {
      // non-fatal background task
    }
  };
  setTimeout(runScheduledBackupCheck, 15000);
  setInterval(runScheduledBackupCheck, 30 * 60 * 1000);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

startServer();
