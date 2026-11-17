import type { PoemDesignOverride, PoemRecord, PoetrySettingsConfig } from '../types/platform';

function wrapArabicLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${current} ${words[i]}`;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

export async function exportPoemAsPng(
  poem: PoemRecord,
  poetryCfg?: PoetrySettingsConfig | null,
  siteName = 'أرشيف الشهيد'
): Promise<void> {
  if (typeof document === 'undefined') return;
  try {
    await document.fonts.ready;
  } catch {
    // proceed with loaded fonts
  }

  let design: PoemDesignOverride = {};
  try {
    design = JSON.parse(poem.design_json || '{}');
  } catch {
    design = {};
  }

  const width = 1200;
  const paddingX = 110;
  const maxContentWidth = width - paddingX * 2;
  const bgColor = design.cardBg || design.bgColor || poetryCfg?.headerBgColor || '#0A1C13';
  const isLight = /^#(f|e|d|c|fff|faf)/i.test(bgColor.trim());
  const titleColor = design.titleColor || (isLight ? '#0A1C13' : '#D4AF65');
  const verseColor = design.verseColor || (isLight ? '#171717' : '#F7F4EC');
  const poetColor = design.poetColor || (isLight ? '#14532D' : '#D4AF65');
  const introColor = design.introColor || (isLight ? '#57534E' : '#C8C2B4');
  const accentColor = design.accentColor || design.borderColor || '#B08D45';
  const fontFamily = design.fontFamily || poetryCfg?.poemVerseStyle?.fontFamily || 'Amiri';

  // Use offscreen measure canvas first to compute dynamic height
  const measureCanvas = document.createElement('canvas');
  const mctx = measureCanvas.getContext('2d');
  if (!mctx) return;

  mctx.direction = 'rtl';
  mctx.font = `700 44px "${fontFamily}", "Cairo", serif`;
  const titleLines = wrapArabicLine(mctx, poem.title || 'قصيدة', maxContentWidth);

  mctx.font = `400 22px "IBM Plex Sans Arabic", "Cairo", sans-serif`;
  const introLines = poem.intro_text
    ? poem.intro_text
        .split('\n')
        .flatMap((p) => wrapArabicLine(mctx, p, maxContentWidth))
    : [];

  mctx.font = `400 32px "${fontFamily}", "Amiri", serif`;
  const rawParagraphs = (poem.verses_text || '').split('\n');
  const verseLines: Array<{ text: string; isGap: boolean }> = [];
  for (const para of rawParagraphs) {
    if (!para.trim()) {
      verseLines.push({ text: '', isGap: true });
      continue;
    }
    for (const wl of wrapArabicLine(mctx, para, maxContentWidth)) {
      verseLines.push({ text: wl, isGap: false });
    }
  }

  const headerBlockH = 140 + titleLines.length * 64 + (introLines.length > 0 ? introLines.length * 36 + 32 : 0);
  const dividerH = 56;
  const versesBlockH = verseLines.reduce((acc, item) => acc + (item.isGap ? 28 : 54), 0);
  const footerBlockH = 150;
  const height = Math.max(760, headerBlockH + dividerH + versesBlockH + footerBlockH);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background fill + subtle vignette
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  const grad = ctx.createRadialGradient(width / 2, height * 0.35, 80, width / 2, height / 2, width * 0.75);
  grad.addColorStop(0, isLight ? 'rgba(176,141,69,0.08)' : 'rgba(212,175,101,0.10)');
  grad.addColorStop(1, isLight ? 'rgba(10,28,19,0.03)' : 'rgba(0,0,0,0.35)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Outer & Inner decorative archival frames
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, width - 72, height - 72);
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.45;
  ctx.strokeRect(48, 48, width - 96, height - 96);
  ctx.globalAlpha = 1;

  // Corner diamond ornaments
  const corners = [
    [48, 48],
    [width - 48, 48],
    [48, height - 48],
    [width - 48, height - 48],
  ];
  for (const [cx, cy] of corners) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = accentColor;
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();
  }

  ctx.direction = 'rtl';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Top label
  let y = 96;
  ctx.fillStyle = accentColor;
  ctx.font = '700 20px "Cairo", sans-serif';
  ctx.fillText('ديوان القصائد والمراثي', width / 2, y);
  y += 58;

  // Title
  ctx.fillStyle = titleColor;
  ctx.font = `700 44px "${fontFamily}", "Cairo", serif`;
  for (const line of titleLines) {
    ctx.fillText(line, width / 2, y);
    y += 64;
  }

  // Optional intro
  if (introLines.length > 0) {
    y += 8;
    ctx.fillStyle = introColor;
    ctx.font = '400 22px "IBM Plex Sans Arabic", "Cairo", sans-serif';
    for (const line of introLines) {
      ctx.fillText(line, width / 2, y);
      y += 36;
    }
    y += 16;
  }

  // Ornate divider
  ctx.strokeStyle = accentColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(width / 2 - 220, y);
  ctx.lineTo(width / 2 - 24, y);
  ctx.moveTo(width / 2 + 24, y);
  ctx.lineTo(width / 2 + 220, y);
  ctx.stroke();

  ctx.save();
  ctx.translate(width / 2, y);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = accentColor;
  ctx.fillRect(-6, -6, 12, 12);
  ctx.restore();
  y += 56;

  // Verses
  ctx.fillStyle = verseColor;
  ctx.font = `400 32px "${fontFamily}", "Amiri", serif`;
  for (const v of verseLines) {
    if (v.isGap) {
      y += 28;
      continue;
    }
    ctx.fillText(v.text, width / 2, y);
    y += 54;
  }

  // Footer attribution & watermark
  const footerY = height - 86;
  ctx.strokeStyle = accentColor;
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(paddingX, footerY - 34);
  ctx.lineTo(width - paddingX, footerY - 34);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (poem.poet_name) {
    ctx.fillStyle = poetColor;
    ctx.font = '700 22px "Cairo", sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`بقلم: ${poem.poet_name}`, width - paddingX, footerY);
  }

  ctx.fillStyle = introColor;
  ctx.font = '600 20px "Cairo", sans-serif';
  ctx.textAlign = poem.poet_name ? 'left' : 'center';
  ctx.fillText(siteName, poem.poet_name ? paddingX : width / 2, footerY);

  // Trigger PNG download
  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  link.download = `${poem.slug || `poem-${poem.id}`}.png`;
  link.href = dataUrl;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
