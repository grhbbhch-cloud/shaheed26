import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { AllSettings, ContentRecord, MediaFileRecord, PageRecord } from '../types/platform';
import { usePlatform } from './PlatformContext';

import type { User } from 'firebase/auth';
import {
  getCurrentFirebaseIdToken,
  pushFullSyncToFirestore,
  signInOwnerWithGoogle,
  signOutFirebase,
  subscribeFirebaseAuth,
  testConnection,
} from '../lib/firebase';

export type AdminSectionId =
  | 'overview'
  | 'pages'
  | 'content'
  | 'poetry'
  | 'submissions'
  | 'translations'
  | 'seo'
  | 'trash'
  | 'videos'
  | 'images'
  | 'uploads'
  | 'homepage'
  | 'navigation'
  | 'player'
  | 'subtitles'
  | 'buttons'
  | 'typography'
  | 'colors'
  | 'backgrounds'
  | 'decorations'
  | 'code'
  | 'search'
  | 'storage'
  | 'users'
  | 'backups'
  | 'versions'
  | 'activity'
  | 'security'
  | 'general'
  | 'officialAccount'
  | 'portal'
  | 'health'
  | 'other';

interface AdminToast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface AdminContextValue {
  checkingAuth: boolean;
  authenticated: boolean;
  sessionRole: string | null;
  sessionUsername: string | null;
  sessionDisplayName: string | null;
  sessionPermissions: Record<string, boolean> | null;
  hasPermission: (key: string) => boolean;
  activeSection: AdminSectionId;
  setActiveSection: (id: AdminSectionId) => void;
  settings: AllSettings | null;
  previousSettings: Partial<Record<keyof AllSettings, any>>;
  pages: PageRecord[];
  content: ContentRecord[];
  mediaFiles: MediaFileRecord[];
  overview: any;
  loadingData: boolean;
  notify: (message: string, type?: 'success' | 'error' | 'info') => void;
  checkAuth: () => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAll: () => Promise<void>;
  saveCategory: <K extends keyof AllSettings>(
    category: K,
    value: AllSettings[K],
    label?: string
  ) => Promise<boolean>;
  resetCategory: (category: keyof AllSettings) => Promise<boolean>;
  firebaseUser: User | null;
  cloudStatus: {
    configured: boolean;
    projectId: string;
    databaseId: string;
    ownerEmail: string;
    lastSyncAt: string | null;
    lastSyncStatus: string;
    lastSyncCounts: Record<string, number> | null;
    firestoreConnected: boolean;
  } | null;
  syncingCloud: boolean;
  connectOwnerGoogle: () => Promise<boolean>;
  disconnectOwnerGoogle: () => Promise<void>;
  syncNowToFirestore: (silent?: boolean) => Promise<boolean>;
}

const AdminContext = createContext<AdminContextValue>({} as AdminContextValue);

export function AdminProvider({ children }: { children: React.ReactNode }) {
  const { refreshBootstrap } = usePlatform();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionRole, setSessionRole] = useState<string | null>(null);
  const [sessionUsername, setSessionUsername] = useState<string | null>(null);
  const [sessionDisplayName, setSessionDisplayName] = useState<string | null>(null);
  const [sessionPermissions, setSessionPermissions] = useState<Record<string, boolean> | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSectionId>('overview');
  const [settings, setSettings] = useState<AllSettings | null>(null);
  const [previousSettings, setPreviousSettings] = useState<Partial<Record<keyof AllSettings, any>>>({});
  const [pages, setPages] = useState<PageRecord[]>([]);
  const [content, setContent] = useState<ContentRecord[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFileRecord[]>([]);
  const [overview, setOverview] = useState<any>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [toasts, setToasts] = useState<AdminToast[]>([]);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [cloudStatus, setCloudStatus] = useState<AdminContextValue['cloudStatus']>(null);
  const [syncingCloud, setSyncingCloud] = useState(false);

  const hasPermission = useCallback(
    (key: string): boolean => {
      if (!authenticated) return false;
      if (sessionRole === 'owner' || sessionPermissions === null) return true;
      if (key === 'manage_users' || key === 'manage_security') {
        return Boolean(sessionPermissions[key]);
      }
      return Boolean(sessionPermissions[key] || sessionPermissions['manage_settings']);
    },
    [authenticated, sessionRole, sessionPermissions]
  );

  const notify = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoadingData(true);
    try {
      const [setRes, pagesRes, contentRes, mediaRes, ovRes] = await Promise.all([
        fetch('/api/admin/settings', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/admin/pages', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/admin/content', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/admin/media', { credentials: 'include', cache: 'no-store' }),
        fetch('/api/admin/overview', { credentials: 'include', cache: 'no-store' }),
      ]);
      if (setRes.status === 401) {
        setAuthenticated(false);
        return;
      }
      if (setRes.ok) {
        const d = await setRes.json();
        setSettings(d.settings);
      }
      if (pagesRes.ok) {
        const d = await pagesRes.json();
        setPages(d.pages || []);
      }
      if (contentRes.ok) {
        const d = await contentRes.json();
        setContent(d.items || []);
      }
      if (mediaRes.ok) {
        const d = await mediaRes.json();
        setMediaFiles(d.files || []);
      }
      if (ovRes.ok) {
        const d = await ovRes.json();
        setOverview(d);
      }
    } finally {
      setLoadingData(false);
    }
  }, []);

  const checkAuth = useCallback(async () => {
    setCheckingAuth(true);
    try {
      const res = await fetch('/api/auth/session', { credentials: 'include' });
      const data = await res.json();
      const ok = Boolean(data.authenticated);
      setAuthenticated(ok);
      setSessionRole(ok ? data.role || 'owner' : null);
      setSessionUsername(ok ? data.username || 'owner' : null);
      setSessionDisplayName(ok ? data.displayName || null : null);
      setSessionPermissions(ok ? (data.role === 'owner' ? null : data.permissions || {}) : null);
      if (ok) {
        await refreshAll();
      }
      return ok;
    } catch {
      setAuthenticated(false);
      setSessionRole(null);
      setSessionUsername(null);
      setSessionDisplayName(null);
      setSessionPermissions(null);
      return false;
    } finally {
      setCheckingAuth(false);
    }
  }, [refreshAll]);

  const refreshCloudStatus = useCallback(async () => {
    try {
      const token = await getCurrentFirebaseIdToken();
      const [statusRes, conn] = await Promise.all([
        fetch('/api/admin/cloud/status', {
          credentials: 'include',
          headers: token ? { 'X-Firebase-Id-Token': token } : {},
        }),
        testConnection(),
      ]);
      if (statusRes.ok) {
        const d = await statusRes.json();
        setCloudStatus({
          ...(d.cloud || {}),
          firestoreConnected: conn.ok,
        });
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    const unsub = subscribeFirebaseAuth((user) => {
      setFirebaseUser(user);
    });
    return unsub;
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (authenticated) {
      void refreshCloudStatus();
    }
  }, [authenticated, firebaseUser, refreshCloudStatus]);

  const connectOwnerGoogle = useCallback(async () => {
    try {
      await signInOwnerWithGoogle();
      notify('تم ربط حساب المالك عبر Google والمصادقة مع Firestore بنجاح');
      await refreshCloudStatus();
      return true;
    } catch (err) {
      notify(err instanceof Error ? err.message : 'تعذر ربط حساب Google', 'error');
      return false;
    }
  }, [notify, refreshCloudStatus]);

  const disconnectOwnerGoogle = useCallback(async () => {
    await signOutFirebase();
    setFirebaseUser(null);
    notify('تم فصل جلسة Google السحابية عن هذا المتصفح', 'info');
    await refreshCloudStatus();
  }, [notify, refreshCloudStatus]);

  const syncNowToFirestore = useCallback(
    async (silent = false) => {
      if (!firebaseUser) {
        if (!silent) {
          notify('يرجى ربط حساب المالك عبر Google أولاً لتفعيل المزامنة السحابية.', 'error');
        }
        return false;
      }
      setSyncingCloud(true);
      try {
        const snapRes = await fetch('/api/admin/cloud/snapshot', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!snapRes.ok) {
          throw new Error('تعذر جلب لقطة البيانات من الخادم');
        }
        const { snapshot } = await snapRes.json();
        const { syncedCounts } = await pushFullSyncToFirestore(snapshot);
        await fetch('/api/admin/cloud/sync-ack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            counts: syncedCounts,
            ownerEmail: firebaseUser.email,
          }),
        });
        await refreshCloudStatus();
        if (!silent) {
          notify('تمت مزامنة كافة البيانات والإعدادات إلى Firestore بنجاح');
        }
        return true;
      } catch (err) {
        if (!silent) {
          notify(err instanceof Error ? err.message : 'فشلت المزامنة مع Firestore', 'error');
        }
        return false;
      } finally {
        setSyncingCloud(false);
      }
    },
    [firebaseUser, notify, refreshCloudStatus]
  );

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setAuthenticated(false);
    setSessionRole(null);
    setSessionUsername(null);
    setSessionDisplayName(null);
    setSessionPermissions(null);
    setSettings(null);
  }, []);

  const saveCategory = useCallback(
    async <K extends keyof AllSettings>(
      category: K,
      value: AllSettings[K],
      label?: string
    ): Promise<boolean> => {
      try {
        const res = await fetch(`/api/admin/settings/${String(category)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ value, label }),
        });
        if (!res.ok) {
          const e = await res.json().catch(() => ({}));
          notify(e.error || 'تعذر حفظ الإعدادات', 'error');
          return false;
        }
        const data = await res.json();
        setSettings((prev) => {
          if (!prev) return prev;
          const prevCat = prev[category];
          if (prevCat !== undefined) {
            setPreviousSettings((snaps) => ({
              ...snaps,
              [category]: structuredClone(prevCat),
            }));
          }
          return { ...prev, [category]: data.value };
        });
        await refreshBootstrap();
        notify('تم حفظ التغييرات وتطبيقها بنجاح');
        return true;
      } catch {
        notify('حدث خطأ في الاتصال بالخادم أثناء الحفظ', 'error');
        return false;
      }
    },
    [notify, refreshBootstrap]
  );

  const resetCategory = useCallback(
    async (category: keyof AllSettings): Promise<boolean> => {
      try {
        const res = await fetch(`/api/admin/settings/${String(category)}/reset`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) {
          notify('تعذر استعادة الإعدادات الافتراضية', 'error');
          return false;
        }
        const data = await res.json();
        setSettings((prev) => (prev ? { ...prev, [category]: data.value } : prev));
        await refreshBootstrap();
        notify('تمت استعادة الإعدادات الافتراضية');
        return true;
      } catch {
        notify('خطأ في الاتصال بالخادم', 'error');
        return false;
      }
    },
    [notify, refreshBootstrap]
  );

  return (
    <AdminContext.Provider
      value={{
        checkingAuth,
        authenticated,
        sessionRole,
        sessionUsername,
        sessionDisplayName,
        sessionPermissions,
        hasPermission,
        activeSection,
        setActiveSection,
        settings,
        previousSettings,
        pages,
        content,
        mediaFiles,
        overview,
        loadingData,
        notify,
        checkAuth,
        logout,
        refreshAll,
        saveCategory,
        resetCategory,
        firebaseUser,
        cloudStatus,
        syncingCloud,
        connectOwnerGoogle,
        disconnectOwnerGoogle,
        syncNowToFirestore,
      }}
    >
      {children}

      {/* Floating Admin Notifications */}
      <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-sm">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-lg shadow-lg text-xs font-semibold border ${
              t.type === 'error'
                ? 'bg-red-600 text-white border-red-700'
                : t.type === 'info'
                  ? 'bg-neutral-900 text-white border-neutral-700'
                  : 'bg-[#8C6A2F] text-white border-[#B08D45]'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  return useContext(AdminContext);
}
