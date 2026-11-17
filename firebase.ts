import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  doc,
  getDocFromServer,
  getFirestore,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);

export const OWNER_GOOGLE_EMAIL = 'uiryukfh@gmail.com';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: Array<{
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }>;
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData.map((provider) => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export interface ConnectionCheckResult {
  ok: boolean;
  offline: boolean;
  message: string;
}

export async function testConnection(): Promise<ConnectionCheckResult> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return { ok: true, offline: false, message: 'متصل بقاعدة بيانات Firestore السحابية' };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('the client is offline') || msg.includes('Failed to get document')) {
      return {
        ok: false,
        offline: true,
        message: 'تعذر الوصول إلى خادم Firestore (وضع عدم الاتصال أو مشكلة شبكة).',
      };
    }
    return {
      ok: true,
      offline: false,
      message: 'متصل بخدمة Firestore السحابية',
    };
  }
}

// Validate connection on boot non-blockingly
void testConnection();

export function subscribeFirebaseAuth(cb: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, cb);
}

export async function getCurrentFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  if (!auth.currentUser) return null;
  try {
    return await auth.currentUser.getIdToken(forceRefresh);
  } catch {
    return null;
  }
}

export async function signInWithGooglePopup(promptSelect = true): Promise<{
  user: User;
  idToken: string;
}> {
  const provider = new GoogleAuthProvider();
  if (promptSelect) {
    provider.setCustomParameters({ prompt: 'select_account' });
  }
  const cred = await signInWithPopup(auth, provider);
  const idToken = await cred.user.getIdToken(true);
  return { user: cred.user, idToken };
}

export async function signInOwnerWithGoogle(): Promise<{
  user: User;
  idToken: string;
}> {
  const result = await signInWithGooglePopup(true);
  if ((result.user.email || '').toLowerCase() !== OWNER_GOOGLE_EMAIL.toLowerCase()) {
    await signOut(auth);
    throw new Error(`يجب تسجيل الدخول بحساب المالك المصرّح به (${OWNER_GOOGLE_EMAIL}).`);
  }
  if (!result.user.emailVerified) {
    await signOut(auth);
    throw new Error('البريد الإلكتروني لحساب Google غير موثق.');
  }
  try {
    await setDoc(doc(db, 'test', 'connection'), {
      ok: true,
      updatedBy: result.user.uid,
      updatedAt: serverTimestamp(),
    });
    await setDoc(doc(db, 'admins', result.user.uid), {
      uid: result.user.uid,
      email: result.user.email || OWNER_GOOGLE_EMAIL,
      role: 'owner',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // Non-fatal if doc already exists with matching createdAt
  }
  return result;
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

const PRIVATE_SETTINGS_KEYS = new Set(['security', 'storage', 'backupSchedule']);

function sanitizeDocId(raw: string | number): string {
  const cleaned = String(raw).replace(/[^a-zA-Z0-9_-]/g, '_');
  return cleaned.slice(0, 120) || 'item';
}

function safeJsonParse<T>(raw: string | undefined | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function clampString(val: unknown, maxLen: number): string {
  const str = typeof val === 'string' ? val : val == null ? '' : String(val);
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

export interface CloudSyncPayload {
  settings: Record<string, any>;
  pages: any[];
  content: any[];
  poems: any[];
  subtitles: any[];
  customCode: any[];
  rolesUsers: any[];
  poemSubmissions: any[];
}

export async function pushFullSyncToFirestore(payload: CloudSyncPayload): Promise<{
  syncedCounts: Record<string, number>;
}> {
  const user = auth.currentUser;
  if (!user || !user.emailVerified) {
    throw new Error('يجب ربط حساب المالك عبر Google أولاً للمزامنة مع Firestore.');
  }

  const syncedCounts: Record<string, number> = {
    settings: 0,
    pages: 0,
    content: 0,
    poems: 0,
    subtitles: 0,
    customCode: 0,
    rolesUsers: 0,
    poemSubmissions: 0,
  };

  // Ensure connection doc
  try {
    await setDoc(doc(db, 'test', 'connection'), {
      ok: true,
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, 'test/connection');
  }

  const ops: Array<{ ref: ReturnType<typeof doc>; data: Record<string, any>; bucket: keyof typeof syncedCounts }> = [];

  // 1. Settings
  for (const [category, data] of Object.entries(payload.settings || {})) {
    if (!category || category.startsWith('_') || typeof data !== 'object' || data === null) continue;
    const catId = sanitizeDocId(category);
    const colName = PRIVATE_SETTINGS_KEYS.has(category) ? 'settings_private' : 'settings_public';
    ops.push({
      bucket: 'settings',
      ref: doc(db, colName, catId),
      data: {
        category: catId,
        data,
        updatedBy: user.uid,
        updatedAt: serverTimestamp(),
      },
    });
  }

  // 2. Pages
  for (const p of payload.pages || []) {
    const allowedPageTypes = ['home', 'collection', 'videos', 'images', 'articles', 'reports', 'archive', 'poetry', 'static', 'custom'];
    const allowedLayouts = ['grid', 'list', 'editorial', 'gallery'];
    const allowedStatus = ['published', 'draft', 'hidden', 'deleted'];
    ops.push({
      bucket: 'pages',
      ref: doc(db, 'pages', String(p.id)),
      data: {
        id: Number(p.id),
        title: clampString(p.title || 'صفحة', 240),
        slug: clampString(p.slug || `page-${p.id}`, 180),
        parentId: p.parent_id != null ? Number(p.parent_id) : null,
        pageType: allowedPageTypes.includes(p.page_type) ? p.page_type : 'collection',
        layout: allowedLayouts.includes(p.layout) ? p.layout : 'grid',
        sortOrder: Number(p.sort_order || 0),
        status: allowedStatus.includes(p.status) ? p.status : 'published',
        navVisible: Boolean(p.nav_visible),
        aggregateChildren: Boolean(p.aggregate_children),
        seoTitle: clampString(p.seo_title || '', 240),
        seoDescription: clampString(p.seo_description || '', 600),
        customContent: clampString(p.custom_content || '', 48000),
        sections: safeJsonParse<any[]>(p.sections_json, []).slice(0, 50),
        settings: safeJsonParse<Record<string, any>>(p.settings_json, {}),
        deletedAt: p.deleted_at ? clampString(p.deleted_at, 64) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }

  // 3. Content
  const allowedContentTypes = ['video', 'image', 'gallery', 'post', 'article', 'news', 'report', 'poetry', 'audio', 'document', 'custom'];
  const allowedContentStatus = ['draft', 'published', 'unpublished', 'scheduled', 'hidden', 'archived', 'processing', 'failed', 'deleted'];
  for (const c of payload.content || []) {
    const extraIds = safeJsonParse<any[]>(c.extra_page_ids_json, []).map(Number).filter(Number.isInteger).slice(0, 20);
    const tags = safeJsonParse<any[]>(c.tags_json, []).map(String).slice(0, 30);
    const gallery = safeJsonParse<any[]>(c.gallery_urls_json, []).map(String).slice(0, 30);
    ops.push({
      bucket: 'content',
      ref: doc(db, 'content', String(c.id)),
      data: {
        id: Number(c.id),
        title: clampString(c.title || 'محتوى', 300),
        slug: clampString(c.slug || `item-${c.id}`, 200),
        contentType: allowedContentTypes.includes(c.content_type) ? c.content_type : 'post',
        description: clampString(c.description || '', 4000),
        body: clampString(c.body || '', 95000),
        status: allowedContentStatus.includes(c.status) ? c.status : 'draft',
        featured: Boolean(c.featured),
        pageId: c.page_id != null ? Number(c.page_id) : null,
        childPageId: c.child_page_id != null ? Number(c.child_page_id) : null,
        extraPageIds: extraIds,
        category: clampString(c.category || '', 120),
        tags,
        thumbnailUrl: clampString(c.thumbnail_url || '', 2048),
        mediaUrl: clampString(c.media_url || '', 2048),
        mediaFileId: c.media_file_id != null ? Number(c.media_file_id) : null,
        galleryUrls: gallery,
        linkUrl: clampString(c.link_url || '', 2048),
        linkLabel: clampString(c.link_label || '', 120),
        linkEnabled: Boolean(c.link_enabled),
        linkNewTab: Boolean(c.link_new_tab),
        duration: Number(c.duration || 0),
        resolution: clampString(c.resolution || '', 40),
        width: Number(c.width || 0),
        height: Number(c.height || 0),
        views: Number(c.views || 0),
        sourceLabel: clampString(c.source_label || '', 200),
        editorLabel: clampString(c.editor_label || '', 200),
        customMetadata: safeJsonParse<Record<string, any>>(c.custom_metadata_json, {}),
        settings: safeJsonParse<Record<string, any>>(c.settings_json, {}),
        publishedAt: c.published_at ? clampString(c.published_at, 64) : null,
        scheduledAt: c.scheduled_at ? clampString(c.scheduled_at, 64) : null,
        deletedAt: c.deleted_at ? clampString(c.deleted_at, 64) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }

  // 4. Poems
  const allowedPoemStatus = ['draft', 'published', 'unpublished', 'scheduled', 'hidden', 'deleted'];
  for (const pm of payload.poems || []) {
    ops.push({
      bucket: 'poems',
      ref: doc(db, 'poems', String(pm.id)),
      data: {
        id: Number(pm.id),
        title: clampString(pm.title || 'قصيدة', 240),
        slug: clampString(pm.slug || `poem-${pm.id}`, 180),
        versesText: clampString(pm.verses_text || ' ', 40000),
        poetName: clampString(pm.poet_name || '', 160),
        introText: clampString(pm.intro_text || '', 4000),
        coverImageUrl: clampString(pm.cover_image_url || '', 2048),
        status: allowedPoemStatus.includes(pm.status) ? pm.status : 'draft',
        pinned: Boolean(pm.pinned),
        sortOrder: Number(pm.sort_order || 0),
        design: safeJsonParse<Record<string, any>>(pm.design_json, {}),
        publishedAt: pm.published_at ? clampString(pm.published_at, 64) : null,
        scheduledAt: pm.scheduled_at ? clampString(pm.scheduled_at, 64) : null,
        deletedAt: pm.deleted_at ? clampString(pm.deleted_at, 64) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }

  // 5. Subtitles
  for (const sub of payload.subtitles || []) {
    ops.push({
      bucket: 'subtitles',
      ref: doc(db, 'subtitles', String(sub.id)),
      data: {
        id: Number(sub.id),
        contentId: Number(sub.content_id),
        language: clampString(sub.language || 'ar', 16),
        languageLabel: clampString(sub.language_label || 'العربية', 80),
        title: clampString(sub.title || '', 160),
        cues: safeJsonParse<any[]>(sub.cues_json, []).slice(0, 1000),
        style: safeJsonParse<Record<string, any>>(sub.style_json, {}),
        visible: Boolean(sub.visible),
        isDefault: Boolean(sub.is_default),
        status: ['published', 'draft', 'hidden'].includes(sub.status) ? sub.status : 'published',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }

  // 6. Custom code
  for (const cc of payload.customCode || []) {
    ops.push({
      bucket: 'customCode',
      ref: doc(db, 'custom_code', String(cc.id)),
      data: {
        id: Number(cc.id),
        name: clampString(cc.name || 'Snippet', 160),
        scope: ['global', 'page', 'home', 'component'].includes(cc.scope) ? cc.scope : 'global',
        targetPageId: cc.target_page_id != null ? Number(cc.target_page_id) : null,
        targetSelector: clampString(cc.target_selector || '', 200),
        codeType: ['css', 'html', 'js', 'svg'].includes(cc.code_type) ? cc.code_type : 'css',
        code: clampString(cc.code || '', 58000),
        lastWorkingCode: clampString(cc.last_working_code || '', 58000),
        enabled: Boolean(cc.enabled),
        status: ['published', 'draft'].includes(cc.status) ? cc.status : 'draft',
        lastError: clampString(cc.last_error || '', 1000),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }

  // 7. Roles users
  for (const ru of payload.rolesUsers || []) {
    ops.push({
      bucket: 'rolesUsers',
      ref: doc(db, 'roles_users', String(ru.id)),
      data: {
        id: Number(ru.id),
        username: clampString(ru.username || `user_${ru.id}`, 80),
        displayName: clampString(ru.display_name || ru.username || 'مستخدم', 120),
        role: ['owner', 'admin', 'editor', 'moderator', 'viewer'].includes(ru.role) ? ru.role : 'editor',
        permissions: safeJsonParse<Record<string, any>>(ru.permissions_json, {}),
        active: Boolean(ru.active),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }

  // 8. Poem submissions
  for (const ps of payload.poemSubmissions || []) {
    const id = sanitizeDocId(`sub_${ps.id}`);
    ops.push({
      bucket: 'poemSubmissions',
      ref: doc(db, 'poem_submissions', id),
      data: {
        id,
        authorUid: 'visitor',
        title: clampString(ps.title || 'مشاركة', 240),
        versesText: clampString(ps.verses_text || ' ', 12000),
        poetName: clampString(ps.poet_name || '', 160),
        extraInfo: clampString(ps.extra_info || '', 4000),
        customFields: safeJsonParse<any[]>(ps.custom_fields_json, []).slice(0, 30),
        status: ['pending', 'approved', 'private', 'rejected', 'deleted'].includes(ps.status)
          ? ps.status
          : 'pending',
        adminNotes: clampString(ps.admin_notes || '', 2000),
        publishedPoemId: ps.published_poem_id != null ? Number(ps.published_poem_id) : null,
        deletedAt: ps.deleted_at ? clampString(ps.deleted_at, 64) : null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
    });
  }

  // Commit in batches of 400 (Firestore max 500 writes per batch)
  const chunkSize = 400;
  for (let i = 0; i < ops.length; i += chunkSize) {
    const slice = ops.slice(i, i + chunkSize);
    const batch = writeBatch(db);
    for (const op of slice) {
      batch.set(op.ref, op.data, { merge: false });
      syncedCounts[op.bucket] += 1;
    }
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'batch_sync');
    }
  }

  return { syncedCounts };
}
