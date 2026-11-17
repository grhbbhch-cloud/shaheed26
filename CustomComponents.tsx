import React, { useEffect } from 'react';
import { usePlatform } from '../context/PlatformContext';
import type { CustomComponentConfig } from '../types/platform';

interface CustomComponentsProps {
  location: CustomComponentConfig['location'];
  pageId?: number | null;
  className?: string;
}

export function CustomComponents({ location, pageId, className = '' }: CustomComponentsProps) {
  const { settings } = usePlatform();
  const list = (settings?.customComponents || []).filter(
    (c) =>
      c.visible &&
      c.location === location &&
      (!c.targetPageId || (pageId !== undefined && pageId !== null && c.targetPageId === pageId))
  );

  useEffect(() => {
    if (typeof window === 'undefined' || window.location.pathname.startsWith('/admin')) return;
    for (const comp of list) {
      if (!comp.js || !comp.js.trim()) continue;
      try {
        new Function(comp.js)();
      } catch (err) {
        console.warn(`[CustomComponent JS Error #${comp.id} "${comp.name}"]:`, err);
      }
    }
  }, [list.map((c) => `${c.id}:${c.js}`).join('|')]);

  if (list.length === 0) return null;

  return (
    <div className={className}>
      {list.map((comp) => (
        <div key={comp.id} data-custom-component={comp.id} className="max-w-[1320px] mx-auto px-4 sm:px-6 my-3">
          {comp.css && <style>{comp.css}</style>}
          {comp.html && <div dangerouslySetInnerHTML={{ __html: comp.html }} />}
        </div>
      ))}
    </div>
  );
}
