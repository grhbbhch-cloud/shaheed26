import fs from 'node:fs';
import path from 'node:path';
import { db } from './db.ts';

interface FirebaseAppletConfig {
  projectId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId: string;
}

const OWNER_EMAIL = 'uiryukfh@gmail.com';

let cachedConfig: FirebaseAppletConfig | null = null;
export function getFirebaseConfig(): FirebaseAppletConfig | null {
  if (cachedConfig) return cachedConfig;
  const cfgPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(cfgPath)) return null;
  try {
    cachedConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as FirebaseAppletConfig;
    return cachedConfig;
  } catch {
    return null;
  }
}

export interface VerifiedFirebaseIdentity {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  photoUrl: string;
}

export async function verifyFirebaseGoogleToken(
  idToken: string
): Promise<VerifiedFirebaseIdentity | null> {
  const cfg = getFirebaseConfig();
  if (!cfg?.apiKey || !idToken) return null;
  try {
    const resp = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(cfg.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    );
    if (!resp.ok) return null;
    const json = (await resp.json()) as {
      users?: Array<{
        localId: string;
        email?: string;
        emailVerified?: boolean;
        displayName?: string;
        photoUrl?: string;
      }>;
    };
    const u = json.users?.[0];
    if (!u || !u.localId || !u.email) return null;
    return {
      uid: u.localId,
      email: u.email,
      emailVerified: Boolean(u.emailVerified),
      displayName: u.displayName || u.email.split('@')[0] || 'مستخدم',
      photoUrl: u.photoUrl || '',
    };
  } catch {
    return null;
  }
}

export function getCloudSyncStatus(hasBearerToken = false) {
  const cfg = getFirebaseConfig();
  const lastSyncRow = db
    .prepare("SELECT value, updated_at FROM settings WHERE key = '_internal_last_cloud_sync'")
    .get() as { value: string; updated_at: string } | undefined;

  let lastSyncMeta: { lastSyncAt?: string; ownerEmail?: string; status?: string; counts?: Record<string, number> } = {};
  if (lastSyncRow?.value) {
    try {
      lastSyncMeta = JSON.parse(lastSyncRow.value);
    } catch {
      lastSyncMeta = {};
    }
  }

  return {
    configured: Boolean(cfg?.projectId && cfg?.firestoreDatabaseId),
    projectId: cfg?.projectId || '',
    databaseId: cfg?.firestoreDatabaseId || '',
    ownerEmail: OWNER_EMAIL,
    hasLiveToken: hasBearerToken,
    hasServiceAccount: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    lastSyncAt: lastSyncMeta.lastSyncAt || lastSyncRow?.updated_at || null,
    lastSyncStatus: lastSyncMeta.status || (hasBearerToken ? 'ready' : 'needs_owner_google_signin'),
    lastSyncCounts: lastSyncMeta.counts || null,
  };
}

export function recordCloudSyncState(
  status: 'synced' | 'error',
  counts?: Record<string, number>,
  ownerEmail?: string
): void {
  const now = new Date().toISOString();
  db.prepare(
    "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES ('_internal_last_cloud_sync', ?, ?)"
  ).run(
    JSON.stringify({
      lastSyncAt: now,
      status,
      counts: counts || null,
      ownerEmail: ownerEmail || OWNER_EMAIL,
    }),
    now
  );
}

function toFirestoreValue(val: unknown): any {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (Array.isArray(val)) {
    return { arrayValue: { values: val.map((item) => toFirestoreValue(item)) } };
  }
  if (typeof val === 'object') {
    const fields: Record<string, any> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        fields[k] = toFirestoreValue(v);
      }
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

export async function firestoreRestUpsert(
  idToken: string,
  collectionPath: string,
  docId: string,
  fieldsObj: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const cfg = getFirebaseConfig();
  if (!cfg?.projectId || !cfg?.firestoreDatabaseId) {
    return { ok: false, error: 'Firebase غير مهيأ' };
  }
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(cfg.projectId)}/databases/${encodeURIComponent(cfg.firestoreDatabaseId)}/documents/${collectionPath}/${encodeURIComponent(docId)}`;
  const fields: Record<string, any> = {};
  for (const [k, v] of Object.entries(fieldsObj)) {
    if (v !== undefined) {
      fields[k] = toFirestoreValue(v);
    }
  }
  try {
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ fields }),
    });
    if (!resp.ok) {
      const txt = await resp.text();
      return { ok: false, error: txt };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function gatherLocalSyncSnapshot() {
  const settingsRows = db.prepare('SELECT key, value FROM settings').all() as Array<{
    key: string;
    value: string;
  }>;
  const settings: Record<string, any> = {};
  for (const r of settingsRows) {
    if (r.key.startsWith('_internal_')) continue;
    try {
      settings[r.key] = JSON.parse(r.value);
    } catch {
      settings[r.key] = r.value;
    }
  }

  return {
    settings,
    pages: db.prepare('SELECT * FROM pages ORDER BY id ASC').all(),
    content: db.prepare('SELECT * FROM content ORDER BY id ASC').all(),
    poems: db.prepare('SELECT * FROM poems ORDER BY id ASC').all(),
    subtitles: db.prepare('SELECT * FROM subtitles ORDER BY id ASC').all(),
    customCode: db.prepare('SELECT * FROM custom_code ORDER BY id ASC').all(),
    rolesUsers: db
      .prepare('SELECT id, username, display_name, role, permissions_json, active, last_login_at, created_at FROM roles_users ORDER BY id ASC')
      .all(),
    poemSubmissions: db.prepare('SELECT * FROM poem_submissions ORDER BY id ASC').all(),
  };
}
