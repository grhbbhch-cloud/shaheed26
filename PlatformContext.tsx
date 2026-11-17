import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { syncBrowserIdentity } from '../lib/styleEngine';
import type { AllSettings, PageRecord } from '../types/platform';

export interface CustomCodeSnippet {
  id: number;
  name: string;
  scope: string;
  target_page_id: number | null;
  target_selector?: string;
  code_type: 'html' | 'css' | 'js' | 'svg';
  code: string;
}

type PublicSettings = Omit<AllSettings, 'security' | 'storage'>;

interface PlatformContextValue {
  settings: PublicSettings | null;
  pages: PageRecord[];
  customCode: CustomCodeSnippet[];
  loading: boolean;
  fontScale: number;
  setFontScale: (scale: number) => void;
  activeLang: string;
  setActiveLang: (langCode: string) => void;
  viewport: 'desktop' | 'tablet' | 'mobile';
  refreshBootstrap: () => Promise<void>;
}

const PlatformContext = createContext<PlatformContextValue>({
  settings: null,
  pages: [],
  customCode: [],
  loading: true,
  fontScale: 1,
  setFontScale: () => {},
  activeLang: 'ar',
  setActiveLang: () => {},
  viewport: 'desktop',
  refreshBootstrap: async () => {},
});

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [rawSettings, setRawSettings] = useState<PublicSettings | null>(null);
  const [pages, setPages] = useState<PageRecord[]>([]);
  const [customCode, setCustomCode] = useState<CustomCodeSnippet[]>([]);
  const [loading, setLoading] = useState(true);
  const [fontScale, setFontScale] = useState<number>(1);
  const [activeLang, setActiveLangState] = useState<string>(() => {
    try {
      return window.localStorage.getItem('alharbi_site_lang') || 'ar';
    } catch {
      return 'ar';
    }
  });
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  const setActiveLang = useCallback((langCode: string) => {
    setActiveLangState(langCode);
    try {
      window.localStorage.setItem('alharbi_site_lang', langCode);
    } catch {
      // ignore storage failure
    }
  }, []);

  const refreshBootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/public/bootstrap', { credentials: 'include', cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setRawSettings(data.settings);
        setPages(data.pages || []);
        setCustomCode(data.customCode || []);
        if (data.settings?.identity) {
          syncBrowserIdentity(data.settings.identity);
        }
        if (data.settings?.i18n?.enabled === false) {
          setActiveLangState('ar');
        }
      }
    } catch {
      // keep existing state on transient error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshBootstrap();
  }, [refreshBootstrap]);

  // Apply document direction and language cleanly on public routes (keep /admin strictly RTL)
  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    if (window.location.pathname.startsWith('/admin')) {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
      return;
    }
    const i18n = rawSettings?.i18n;
    if (!i18n?.enabled) {
      document.documentElement.dir = 'rtl';
      document.documentElement.lang = 'ar';
      return;
    }
    const langObj =
      i18n.languages?.find((l) => l.code === activeLang) ||
      i18n.languages?.find((l) => l.code === i18n.defaultLang) ||
      i18n.languages?.[0];
    document.documentElement.dir = langObj?.dir || 'rtl';
    document.documentElement.lang = langObj?.code || 'ar';
  }, [rawSettings, activeLang]);

  const settings = useMemo<PublicSettings | null>(() => {
    if (!rawSettings) return null;
    const i18n = rawSettings.i18n;
    if (!i18n?.enabled) return rawSettings;
    const langObj =
      i18n.languages?.find((l) => l.code === activeLang) ||
      i18n.languages?.find((l) => l.code === i18n.defaultLang);
    if (!langObj || !langObj.overrides || Object.keys(langObj.overrides).length === 0) {
      return rawSettings;
    }
    return {
      ...rawSettings,
      uiTexts: {
        ...rawSettings.uiTexts,
        ...langObj.overrides,
      },
    };
  }, [rawSettings, activeLang]);

  useEffect(() => {
    const updateVp = () => {
      const w = window.innerWidth;
      if (w < 640) setViewport('mobile');
      else if (w < 1024) setViewport('tablet');
      else setViewport('desktop');
    };
    updateVp();
    window.addEventListener('resize', updateVp);
    return () => window.removeEventListener('resize', updateVp);
  }, []);

  // Apply global and component custom CSS + global JS safely on public pages only (never /admin)
  useEffect(() => {
    if (typeof window === 'undefined' || window.location.pathname.startsWith('/admin')) return;
    const styleId = 'alharbi-global-custom-css';
    const cssChunks = customCode
      .filter((c) => c.code_type === 'css' && (c.scope === 'global' || c.scope === 'component'))
      .map((c) => {
        if (c.scope === 'component' && c.target_selector && !c.code.includes('{')) {
          return `${c.target_selector} { ${c.code} }`;
        }
        return c.code;
      })
      .join('\n');
    let el = document.getElementById(styleId);
    if (cssChunks) {
      if (!el) {
        el = document.createElement('style');
        el.id = styleId;
        document.head.appendChild(el);
      }
      el.textContent = cssChunks;
    } else if (el) {
      el.remove();
    }

    const jsSnippets = customCode.filter(
      (c) => c.code_type === 'js' && (c.scope === 'global' || c.scope === 'component')
    );
    for (const snip of jsSnippets) {
      try {
        const fn = new Function(snip.code);
        fn();
      } catch (err) {
        console.warn(`[CustomCode JS Error #${snip.id} "${snip.name}"]:`, err);
      }
    }
  }, [customCode]);

  return (
    <PlatformContext.Provider
      value={{
        settings,
        pages,
        customCode,
        loading,
        fontScale,
        setFontScale,
        activeLang,
        setActiveLang,
        viewport,
        refreshBootstrap,
      }}
    >
      {children}
    </PlatformContext.Provider>
  );
}

export function usePlatform(): PlatformContextValue {
  return useContext(PlatformContext);
}
