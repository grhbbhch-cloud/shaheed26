import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db, getAllSettings, logActivity } from './db.ts';

interface StoredOwnerAuth {
  code1Hash: string;
  code2Hash: string;
  updatedAt: string;
}

function getOrInitOwnerAuth(): StoredOwnerAuth {
  const row = db
    .prepare("SELECT value FROM settings WHERE key = '_internal_owner_auth'")
    .get() as { value: string } | undefined;
  if (row?.value) {
    try {
      const parsed = JSON.parse(row.value) as StoredOwnerAuth;
      if (parsed?.code1Hash && parsed?.code2Hash) {
        return parsed;
      }
    } catch {
      // re-init below
    }
  }
  const initial1 = process.env.ALHARBI_OWNER_CODE_1 || 'Alharbi@2026';
  const initial2 = process.env.ALHARBI_OWNER_CODE_2 || 'Alharbi@1121';
  const now = new Date().toISOString();
  const record: StoredOwnerAuth = {
    code1Hash: hashPasscodeInternal(initial1),
    code2Hash: hashPasscodeInternal(initial2),
    updatedAt: now,
  };
  db.prepare(
    "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('_internal_owner_auth', ?, ?)"
  ).run(JSON.stringify(record), now);
  return record;
}

function hashPasscodeInternal(passcode: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

// Persistent session signing secret stored in settings table or env
function getSessionSecret(): string {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 16) {
    return process.env.SESSION_SECRET;
  }
  const row = db
    .prepare("SELECT value FROM settings WHERE key = '_internal_session_secret'")
    .get() as { value: string } | undefined;
  if (row?.value) {
    return row.value;
  }
  const secret = crypto.randomBytes(32).toString('hex');
  db.prepare(
    "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('_internal_session_secret', ?, ?)"
  ).run(secret, new Date().toISOString());
  return secret;
}

const COOKIE_NAME = 'alharbi_owner_session';

interface AttemptRecord {
  count: number;
  lockedUntil: number;
}
const loginAttempts = new Map<string, AttemptRecord>();

export function getClientIp(req: Request): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length > 0) {
    return fwd.split(',')[0].trim();
  }
  return req.ip || req.socket.remoteAddress || 'unknown';
}

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  const result: Record<string, string> = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = decodeURIComponent(part.slice(idx + 1).trim());
    result[k] = v;
  }
  return result;
}

export interface SessionPayload {
  role: string;
  username?: string;
  displayName?: string;
  permissions?: Record<string, boolean>;
  exp: number;
  jti: string;
}

export function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(passcode, salt, 32).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPasscode(passcode: string, stored: string): boolean {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hex] = stored.split(':');
  if (!salt || !hex) return false;
  try {
    const derived = crypto.scryptSync(passcode, salt, 32);
    const expected = Buffer.from(hex, 'hex');
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function signToken(payload: SessionPayload): string {
  const secret = getSessionSecret();
  const data = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

export function verifyToken(token: string | undefined): SessionPayload | null {
  if (!token || !token.includes('.')) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const secret = getSessionSecret();
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const decoded = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (!decoded || !decoded.role || Date.now() > decoded.exp) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function getSessionPayload(req: Request): SessionPayload | null {
  const cookies = parseCookies(req);
  const fromCookie = verifyToken(cookies[COOKIE_NAME]);
  if (fromCookie) return fromCookie;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const fromHeader = verifyToken(token);
    if (fromHeader) return fromHeader;
  }
  return null;
}

export function verifyOwnerSession(req: Request): boolean {
  const payload = getSessionPayload(req);
  return Boolean(payload);
}

const APPEARANCE_CATEGORIES = new Set([
  'colors',
  'typography',
  'decorations',
  'backgrounds',
  'buttons',
  'iconLibrary',
  'homepage',
  'navigation',
  'footer',
  'player',
  'loading',
  'infoCard',
  'related',
  'adminTheme',
  'loginTheme',
  'customComponents',
  'overview',
  'officialAccount',
  'poetry',
  'titleGradient',
]);

function resolveRequiredPermissions(req: Request): { anyOf: string[]; strict?: boolean } {
  const p = req.path || '';
  const m = req.method.toUpperCase();

  if (p.startsWith('/security')) return { anyOf: ['manage_security'], strict: true };
  if (p.startsWith('/cloud')) return { anyOf: ['manage_security', 'manage_backups'], strict: true };
  if (p.startsWith('/users')) return { anyOf: ['manage_users'], strict: true };
  if (p.startsWith('/backups')) {
    if (p.includes('/download')) return { anyOf: ['download', 'manage_backups'] };
    return { anyOf: ['manage_backups'] };
  }
  if (p.startsWith('/versions')) return { anyOf: ['manage_backups'] };
  if (p.startsWith('/trash')) {
    if (m === 'GET') return { anyOf: ['view'] };
    return { anyOf: ['delete', 'edit'] };
  }
  if (p.startsWith('/custom-code')) return { anyOf: ['manage_code'] };
  if (p.startsWith('/storage')) {
    return { anyOf: ['upload', 'manage_settings'] };
  }
  if (p.startsWith('/settings')) {
    if (m === 'GET') return { anyOf: ['view'] };
    if (p.includes('/security')) return { anyOf: ['manage_security'], strict: true };
    const cat = p.replace(/^\/settings\//, '').split('/')[0];
    if (APPEARANCE_CATEGORIES.has(cat)) {
      return { anyOf: ['manage_appearance', 'manage_settings'] };
    }
    return { anyOf: ['manage_settings'] };
  }
  if (p.startsWith('/uploads') || p.startsWith('/media')) {
    if (m === 'GET') return { anyOf: ['view'] };
    if (m === 'DELETE') return { anyOf: ['delete'] };
    return { anyOf: ['upload'] };
  }
  if (p.startsWith('/pages')) {
    if (m === 'GET') return { anyOf: ['view'] };
    if (m === 'DELETE') return { anyOf: ['delete'] };
    if (m === 'POST') return { anyOf: ['create'] };
    if (m === 'PUT') return { anyOf: ['edit'] };
  }
  if (p.startsWith('/poems') || p.startsWith('/poem-submissions')) {
    if (m === 'GET') return { anyOf: ['view'] };
    if (m === 'DELETE') return { anyOf: ['delete'] };
    if (m === 'POST') return { anyOf: ['create', 'publish', 'edit'] };
    if (m === 'PUT') return { anyOf: ['edit', 'publish'] };
  }
  if (p.startsWith('/content')) {
    if (m === 'GET') return { anyOf: ['view'] };
    if (m === 'DELETE') return { anyOf: ['delete'] };
    if (p === '/content/bulk' && m === 'POST') {
      const action = String((req.body || {}).action || '');
      if (action === 'delete') return { anyOf: ['delete'] };
      if (action === 'published') return { anyOf: ['publish'] };
      if (['unpublished', 'hidden', 'archived'].includes(action)) return { anyOf: ['unpublish'] };
      return { anyOf: ['edit'] };
    }
    if (m === 'POST') {
      const st = String((req.body || {}).status || 'draft');
      if (st === 'published') return { anyOf: ['publish'] };
      return { anyOf: ['create'] };
    }
    if (m === 'PUT') {
      const st = (req.body || {}).status;
      if (st === 'published') return { anyOf: ['publish'] };
      if (st === 'unpublished' || st === 'hidden' || st === 'archived') return { anyOf: ['unpublish'] };
      return { anyOf: ['edit'] };
    }
  }
  if (p.startsWith('/subtitles')) {
    if (m === 'GET') return { anyOf: ['view'] };
    if (m === 'DELETE') return { anyOf: ['delete'] };
    if (m === 'POST') return { anyOf: ['create', 'edit'] };
    if (m === 'PUT') return { anyOf: ['edit'] };
  }
  if (p.startsWith('/activity')) {
    return { anyOf: ['manage_security', 'view'] };
  }
  if (p.startsWith('/health') && m !== 'GET') {
    return { anyOf: ['manage_security', 'manage_settings'] };
  }
  return { anyOf: ['view'] };
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  const session = getSessionPayload(req);
  if (!session) {
    res.status(401).json({ error: 'غير مصرح. يرجى تسجيل الدخول للإدارة.' });
    return;
  }
  if (session.role !== 'owner') {
    const reqSpec = resolveRequiredPermissions(req);
    const perms = session.permissions || {};
    const hasMatch = reqSpec.anyOf.some((k) => Boolean(perms[k]));
    const hasSuperSettings = !reqSpec.strict && Boolean(perms['manage_settings']);
    if (!hasMatch && !hasSuperSettings) {
      res.status(403).json({
        error: `لا تملك صلاحية (${reqSpec.anyOf.join(' أو ')}) لتنفيذ هذا الإجراء.`,
      });
      return;
    }
  }
  (req as any).adminSession = session;
  next();
}

export function verifyOwnerCodes(code1: string, code2: string): boolean {
  const authRecord = getOrInitOwnerAuth();
  return (
    verifyPasscode(code1, authRecord.code1Hash) &&
    verifyPasscode(code2, authRecord.code2Hash)
  );
}

export function updateOwnerCodes(newCode1: string, newCode2: string): void {
  const now = new Date().toISOString();
  const record: StoredOwnerAuth = {
    code1Hash: hashPasscode(newCode1),
    code2Hash: hashPasscode(newCode2),
    updatedAt: now,
  };
  db.prepare(
    "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('_internal_owner_auth', ?, ?)"
  ).run(JSON.stringify(record), now);
}

export function issueOwnerSession(req: Request, res: Response, methodNote = 'تسجيل دخول المالك الرئيسي بنجاح') {
  const ip = getClientIp(req);
  const settings = getAllSettings();
  const security = settings.security;
  const now = Date.now();
  const timeoutMins = Math.max(15, security.sessionTimeoutMinutes || 480);
  const exp = now + timeoutMins * 60 * 1000;
  const token = signToken({
    role: 'owner',
    username: 'owner',
    displayName: 'المالك الرئيسي - أرشيف الشهيد',
    exp,
    jti: crypto.randomUUID(),
  });

  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    (req.headers.origin || '').startsWith('https://');

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    maxAge: timeoutMins * 60 * 1000,
    path: '/',
  });

  db.prepare("UPDATE roles_users SET last_login_at = ? WHERE username = 'owner'").run(
    new Date().toISOString()
  );
  logActivity('تسجيل دخول ناجح', 'auth', methodNote, 'owner', ip, 'info');

  return {
    authenticated: true,
    role: 'owner',
    username: 'owner',
    displayName: 'المالك الرئيسي - أرشيف الشهيد',
    permissions: null,
    expiresAt: new Date(exp).toISOString(),
  };
}

export function handleOwnerLogin(req: Request, res: Response): void {
  const ip = getClientIp(req);
  const settings = getAllSettings();
  const security = settings.security;
  const now = Date.now();

  if (security.ipRateLimitEnabled) {
    const rec = loginAttempts.get(ip);
    if (rec && rec.lockedUntil > now) {
      const waitMins = Math.ceil((rec.lockedUntil - now) / 60000);
      res.status(429).json({
        error: `تم تجاوز الحد المسموح لمحاولات الدخول. يرجى الانتظار ${waitMins} دقيقة.`,
      });
      return;
    }
  }

  const { code1, code2 } = (req.body || {}) as { code1?: string; code2?: string };
  if (typeof code1 !== 'string' || typeof code2 !== 'string' || !code1 || !code2) {
    res.status(400).json({ error: 'يرجى إدخال الرمزين معاً للدخول.' });
    return;
  }

  const matched = verifyOwnerCodes(code1, code2);

  if (!matched) {
    const prev = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
    const nextCount = prev.count + 1;
    const maxAttempts = Math.max(3, security.maxLoginAttempts || 8);
    let lockedUntil = 0;
    if (security.ipRateLimitEnabled && nextCount >= maxAttempts) {
      lockedUntil = now + (security.lockoutMinutes || 10) * 60 * 1000;
    }
    loginAttempts.set(ip, { count: nextCount, lockedUntil });
    logActivity(
      'محاولة دخول فاشلة',
      'auth',
      `فشل التحقق من رمزي الدخول المزدوج (المحاولة ${nextCount})`,
      'anonymous',
      ip,
      'warning'
    );
    res.status(401).json({
      error: 'أحد الرمزين أو كلاهما غير صحيح. يجب إدخال الرمزين الصحيحين معاً.',
    });
    return;
  }

  loginAttempts.delete(ip);
  const payload = issueOwnerSession(req, res, 'تم تسجيل دخول المالك الرئيسي بنجاح');
  res.json(payload);
}

export function handleSubAdminLogin(req: Request, res: Response): void {
  const ip = getClientIp(req);
  const settings = getAllSettings();
  const security = settings.security;
  const now = Date.now();

  if (security.ipRateLimitEnabled) {
    const rec = loginAttempts.get(ip);
    if (rec && rec.lockedUntil > now) {
      const waitMins = Math.ceil((rec.lockedUntil - now) / 60000);
      res.status(429).json({
        error: `تم تجاوز الحد المسموح لمحاولات الدخول. يرجى الانتظار ${waitMins} دقيقة.`,
      });
      return;
    }
  }

  const { username, passcode } = (req.body || {}) as { username?: string; passcode?: string };
  if (typeof username !== 'string' || typeof passcode !== 'string' || !username.trim() || !passcode) {
    res.status(400).json({ error: 'يرجى إدخال اسم المستخدم ورمز الدخول.' });
    return;
  }

  const user = db
    .prepare('SELECT * FROM roles_users WHERE username = ?')
    .get(username.trim()) as
    | {
        id: number;
        username: string;
        display_name: string;
        role: string;
        permissions_json: string;
        passcode_hash: string;
        active: number;
      }
    | undefined;

  if (!user || !user.active || user.username === 'owner' || !verifyPasscode(passcode, user.passcode_hash)) {
    const prev = loginAttempts.get(ip) || { count: 0, lockedUntil: 0 };
    const nextCount = prev.count + 1;
    const maxAttempts = Math.max(3, security.maxLoginAttempts || 8);
    let lockedUntil = 0;
    if (security.ipRateLimitEnabled && nextCount >= maxAttempts) {
      lockedUntil = now + (security.lockoutMinutes || 10) * 60 * 1000;
    }
    loginAttempts.set(ip, { count: nextCount, lockedUntil });
    logActivity('محاولة دخول مشرف فاشلة', 'auth', `فشل دخول المستخدم "${username}"`, 'anonymous', ip, 'warning');
    res.status(401).json({ error: 'بيانات الدخول غير صحيحة أو الحساب غير مفعّل.' });
    return;
  }

  loginAttempts.delete(ip);
  let perms: Record<string, boolean> = {};
  try {
    perms = JSON.parse(user.permissions_json || '{}');
  } catch {
    perms = {};
  }

  const timeoutMins = Math.max(15, security.sessionTimeoutMinutes || 480);
  const exp = now + timeoutMins * 60 * 1000;
  const token = signToken({
    role: user.role || 'editor',
    username: user.username,
    displayName: user.display_name,
    permissions: perms,
    exp,
    jti: crypto.randomUUID(),
  });

  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    (req.headers.origin || '').startsWith('https://');

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    maxAge: timeoutMins * 60 * 1000,
    path: '/',
  });

  db.prepare('UPDATE roles_users SET last_login_at = ? WHERE id = ?').run(
    new Date().toISOString(),
    user.id
  );
  logActivity('تسجيل دخول مشرف', 'auth', `دخول "${user.display_name}" (${user.role})`, user.username, ip, 'info');

  res.json({
    authenticated: true,
    role: user.role,
    username: user.username,
    displayName: user.display_name,
    permissions: perms,
    expiresAt: new Date(exp).toISOString(),
  });
}

export function handleOwnerLogout(req: Request, res: Response): void {
  const ip = getClientIp(req);
  const existingSession = getSessionPayload(req);
  const isHttps =
    req.secure ||
    req.headers['x-forwarded-proto'] === 'https' ||
    (req.headers.origin || '').startsWith('https://');

  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: isHttps,
    sameSite: isHttps ? 'none' : 'lax',
    path: '/',
  });
  logActivity('تسجيل خروج', 'auth', 'تم إنهاء جلسة الإدارة', existingSession?.username || 'owner', ip, 'info');
  res.json({ authenticated: false });
}

export function handleAuthSession(req: Request, res: Response): void {
  const payload = getSessionPayload(req);
  if (!payload) {
    res.json({ authenticated: false, role: null, username: null, displayName: null, permissions: null });
    return;
  }
  res.json({
    authenticated: true,
    role: payload.role,
    username: payload.username || (payload.role === 'owner' ? 'owner' : ''),
    displayName: payload.displayName || 'المالك الرئيسي - أرشيف الشهيد',
    permissions: payload.role === 'owner' ? null : payload.permissions || {},
  });
}
