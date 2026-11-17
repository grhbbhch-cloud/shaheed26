import React from 'react';
import { usePlatform } from '../context/PlatformContext';
import { buildTextStyle } from '../lib/styleEngine';
import type { CustomTextElementConfig } from '../types/platform';

interface CustomTextBlocksProps {
  location: CustomTextElementConfig['location'];
  blocksOverride?: CustomTextElementConfig[];
  className?: string;
}

export function CustomTextBlocks({ location, blocksOverride, className = '' }: CustomTextBlocksProps) {
  const { settings, viewport } = usePlatform();
  const blocks = (blocksOverride ?? settings?.uiTexts?.customTextBlocks ?? [])
    .filter((b) => b.location === location && b.visible && !b.deleted)
    .filter((b) => {
      if (viewport === 'mobile') return b.showMobile !== false;
      if (viewport === 'tablet') return b.showTablet !== false;
      return b.showDesktop !== false;
    })
    .sort((a, b) => a.order - b.order);

  if (blocks.length === 0) return null;

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((blk) => (
        <div
          key={blk.id}
          className="max-w-[1320px] mx-auto px-4 sm:px-6"
        >
          <div
            className="whitespace-pre-line"
            style={{
              backgroundColor:
                blk.background && blk.background !== 'transparent' ? blk.background : undefined,
              border:
                blk.borderWidth > 0
                  ? `${blk.borderWidth}px solid ${blk.borderColor || '#D8D8D8'}`
                  : undefined,
              borderRadius: blk.borderRadius ? `${blk.borderRadius}px` : undefined,
              boxShadow: blk.shadow && blk.shadow !== 'none' ? blk.shadow : undefined,
              padding: blk.padding ? `${blk.padding}px` : undefined,
              ...buildTextStyle(blk.style, null, viewport),
            }}
          >
            {blk.text}
          </div>
        </div>
      ))}
    </div>
  );
}
