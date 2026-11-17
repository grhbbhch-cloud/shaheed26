import { execFile, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { HeadBucketCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import {
  CHUNKS_DIR,
  db,
  getAllSettings,
  logActivity,
  logSystemEvent,
  MEDIA_DIR,
  RENDITIONS_DIR,
  THUMBNAILS_DIR,
} from './db.ts';
import type { MediaFileRecord, StorageConfig } from '../src/types/platform.ts';

const execFileAsync = promisify(execFile);

export interface ThumbnailFrame {
  index: number;
  timestamp: number;
  url: string;
  filePath: string;
  width: number;
  height: number;
  selected?: boolean;
  isCustom?: boolean;
}

export interface VideoRendition {
  label: string; // e.g. '144p', '240p', '360p', '480p', '720p', '1080p', '720p (الأصلية)'
  height: number;
  width?: number;
  bitrate?: number;
  url: string;
  filePath: string;
  fileSize: number;
  isOriginal?: boolean;
  status?: 'waiting' | 'processing' | 'completed' | 'failed';
  enabled?: boolean;
  error?: string;
}

export function normalizeVideoQualityHeight(width: number, height: number): number {
  const w = Number(width || 0);
  const h = Number(height || 0);
  if (w > 0 && h > 0) return Math.min(w, h);
  return h > 0 ? h : w > 0 ? w : 0;
}

export function detectMediaKind(
  mimeType: string,
  originalName: string
): MediaFileRecord['media_kind'] {
  const lower = originalName.toLowerCase();
  if (mimeType.startsWith('video/') || /\.(mp4|webm|mov|mkv|avi|m4v)$/.test(lower)) {
    return 'video';
  }
  if (mimeType.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|ico|avif)$/.test(lower)) {
    return 'image';
  }
  if (mimeType.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac)$/.test(lower)) {
    return 'audio';
  }
  if (/\.(woff2?|ttf|otf)$/.test(lower)) {
    return 'font';
  }
  if (/\.(pdf|docx?|xlsx?|pptx?|txt|srt|vtt)$/.test(lower)) {
    return 'document';
  }
  return 'other';
}

export async function probeVideoFile(
  filePath: string
): Promise<{ duration: number; width: number; height: number; bitrate: number; hasAudio: boolean }> {
  let duration = 0;
  let width = 0;
  let height = 0;
  let bitrate = 0;
  let hasAudio = false;

  try {
    const { stdout } = await execFileAsync(
      'ffprobe',
      [
        '-v',
        'error',
        '-show_entries',
        'stream=codec_type,width,height,bit_rate,duration:format=duration,bit_rate',
        '-of',
        'json',
        filePath,
      ],
      { timeout: 20000 }
    );
    const parsed = JSON.parse(stdout) as {
      streams?: Array<{
        codec_type?: string;
        width?: number;
        height?: number;
        bit_rate?: string;
        duration?: string;
      }>;
      format?: { duration?: string; bit_rate?: string };
    };
    const streams = parsed.streams || [];
    const videoStream = streams.find((s) => s.codec_type === 'video') || streams[0] || {};
    hasAudio = streams.some((s) => s.codec_type === 'audio');
    width = Number(videoStream.width || 0);
    height = Number(videoStream.height || 0);
    const fmtDur = Number(parsed.format?.duration || 0);
    const streamDur = Number(videoStream.duration || 0);
    duration =
      Number.isFinite(fmtDur) && fmtDur > 0
        ? fmtDur
        : Number.isFinite(streamDur) && streamDur > 0
          ? streamDur
          : 0;
    const rawBr = Number(videoStream.bit_rate || parsed.format?.bit_rate || 0);
    bitrate = Number.isFinite(rawBr) && rawBr > 0 ? rawBr : 0;
  } catch (err) {
    logSystemEvent(
      'ffprobe_error',
      'تعذر قراءة بيانات الفيديو عبر ffprobe',
      err instanceof Error ? err.message : String(err)
    );
  }

  // Fallback duration via ffmpeg null pass if container/stream headers omitted duration (e.g., raw WebM)
  if (duration <= 0) {
    try {
      const res = await execFileAsync('ffmpeg', ['-i', filePath, '-f', 'null', '-'], { timeout: 25000 }).catch(
        (e) => ({ stdout: '', stderr: String(e?.stderr || '') })
      );
      const text = `${res.stderr || ''}`;
      const match = text.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g);
      const last = match?.[match.length - 1];
      if (last) {
        const m = last.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (m) {
          duration = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
        }
      }
    } catch {
      // ignore fallback probe failure
    }
  }

  return {
    duration: Number.isFinite(duration) ? duration : 0,
    width,
    height,
    bitrate,
    hasAudio,
  };
}

export async function checkFfmpegAvailable(): Promise<{ ffmpeg: boolean; ffprobe: boolean }> {
  let ffmpeg = false;
  let ffprobe = false;
  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 });
    ffmpeg = true;
  } catch {
    ffmpeg = false;
  }
  try {
    await execFileAsync('ffprobe', ['-version'], { timeout: 5000 });
    ffprobe = true;
  } catch {
    ffprobe = false;
  }
  return { ffmpeg, ffprobe };
}

function isFrameMostlyBlack(filePath: string): boolean {
  try {
    const stat = fs.statSync(filePath);
    return stat.size < 1800;
  } catch {
    return true;
  }
}

async function runFfmpegFrameGrab(
  videoPath: string,
  targetTime: number,
  outPath: string,
  accurateOutputSeek: boolean
): Promise<boolean> {
  const vf = 'scale=640:-2:flags=lanczos,format=yuvj420p';
  const args = accurateOutputSeek
    ? ['-y', '-i', videoPath, '-ss', targetTime.toFixed(3), '-frames:v', '1', '-vf', vf, '-q:v', '3', '-strict', '-2', outPath]
    : ['-y', '-ss', targetTime.toFixed(3), '-i', videoPath, '-frames:v', '1', '-vf', vf, '-q:v', '3', '-strict', '-2', outPath];

  try {
    await execFileAsync('ffmpeg', args, { timeout: 25000 });
    return fs.existsSync(outPath) && fs.statSync(outPath).size > 200;
  } catch {
    return false;
  }
}

export interface ExtractFramesOptions {
  mode?: 'spread' | 'interval' | 'append';
  count?: number;
  intervalSec?: number;
}

export async function extractVideoFrames(
  mediaId: number,
  videoPath: string,
  durationSeconds: number,
  options: ExtractFramesOptions = {}
): Promise<{ frames: ThumbnailFrame[]; newlyAdded: ThumbnailFrame[]; warning: string }> {
  const mode = options.mode || 'spread';
  const count = Math.max(1, Math.min(16, Number(options.count || (mode === 'append' ? 4 : 6))));
  const intervalSec = Math.max(0.5, Math.min(600, Number(options.intervalSec || 2)));

  let realDur = durationSeconds;
  let videoW = 1280;
  let videoH = 720;

  if (realDur <= 0.2) {
    const probed = await probeVideoFile(videoPath);
    if (probed.duration > 0) realDur = probed.duration;
    if (probed.width > 0) videoW = probed.width;
    if (probed.height > 0) videoH = probed.height;
    if (probed.duration > 0 || probed.width > 0) {
      db.prepare('UPDATE media_files SET duration = ?, width = ?, height = ? WHERE id = ?').run(
        probed.duration,
        probed.width,
        probed.height,
        mediaId
      );
    }
  } else {
    const row = db.prepare('SELECT width, height FROM media_files WHERE id = ?').get(mediaId) as
      | { width: number; height: number }
      | undefined;
    if (row?.width && row?.height) {
      videoW = row.width;
      videoH = row.height;
    }
  }

  const outHeight = videoW > 0 && videoH > 0 ? Math.max(120, Math.round((640 * videoH) / videoW)) : 360;
  const safeDur = realDur > 0.2 ? realDur : 1;
  const maxSafe = Math.max(0, safeDur - 0.12);
  const mediaThumbDir = path.join(THUMBNAILS_DIR, `media_${mediaId}`);
  fs.mkdirSync(mediaThumbDir, { recursive: true });

  const existingRow = db.prepare('SELECT thumbnails_json FROM media_files WHERE id = ?').get(mediaId) as
    | { thumbnails_json: string }
    | undefined;
  let existingAll: ThumbnailFrame[] = [];
  let prevSelectedUrl = '';
  try {
    const parsed: ThumbnailFrame[] = JSON.parse(existingRow?.thumbnails_json || '[]');
    existingAll = Array.isArray(parsed) ? parsed : [];
    prevSelectedUrl = existingAll.find((t) => t.selected)?.url || '';
  } catch {
    existingAll = [];
  }

  const existingCustom = existingAll.filter((t) => t.isCustom);

  if (mode !== 'append') {
    // Remove stale extracted thumb_*.jpg files before extracting fresh ones
    try {
      for (const f of fs.readdirSync(mediaThumbDir)) {
        if (f.startsWith('thumb_') && f.endsWith('.jpg')) {
          fs.unlinkSync(path.join(mediaThumbDir, f));
        }
      }
    } catch {
      // ignore cleanup issues
    }
  }

  // Compute target timestamps
  const targetTimes: number[] = [];
  if (mode === 'interval') {
    const startAt = Math.min(maxSafe, Math.min(1, safeDur * 0.04));
    for (let i = 0; i < count; i++) {
      const t = startAt + i * intervalSec;
      if (t > maxSafe) break;
      targetTimes.push(Number(Math.max(0, t).toFixed(2)));
    }
    if (targetTimes.length === 0) {
      targetTimes.push(Number(Math.min(maxSafe, safeDur * 0.1).toFixed(2)));
    }
  } else if (mode === 'append') {
    const existingTimestamps = existingAll
      .filter((f) => !f.isCustom || f.timestamp > 0)
      .map((f) => Number(f.timestamp || 0))
      .sort((a, b) => a - b);

    // Build candidate grid across duration and pick points furthest from existing timestamps
    const gridSteps = Math.max(24, count * 6);
    const candidates: Array<{ t: number; minDist: number }> = [];
    for (let i = 0; i < gridSteps; i++) {
      const pct = 0.03 + (0.91 * i) / Math.max(1, gridSteps - 1);
      const t = Number(Math.max(0, Math.min(maxSafe, safeDur * pct)).toFixed(2));
      const minDist =
        existingTimestamps.length > 0
          ? Math.min(...existingTimestamps.map((et) => Math.abs(et - t)))
          : safeDur;
      candidates.push({ t, minDist });
    }
    // Iteratively greedily pick furthest timestamp so newly appended ones spread cleanly
    const chosen: number[] = [];
    for (let k = 0; k < count && candidates.length > 0; k++) {
      candidates.sort((a, b) => b.minDist - a.minDist);
      const best = candidates.shift()!;
      if (best.minDist < 0.15 && chosen.length > 0) break;
      chosen.push(best.t);
      for (const c of candidates) {
        c.minDist = Math.min(c.minDist, Math.abs(c.t - best.t));
      }
    }
    chosen.sort((a, b) => a - b);
    targetTimes.push(...chosen);
  } else {
    // 'spread': cover beginning, middle, and end evenly
    const minPct = 0.04;
    const maxPct = 0.92;
    for (let i = 0; i < count; i++) {
      const pct = count === 1 ? 0.5 : minPct + ((maxPct - minPct) * i) / (count - 1);
      const t = Math.max(0, Math.min(maxSafe, safeDur * pct));
      targetTimes.push(Number(t.toFixed(2)));
    }
  }

  const frames: ThumbnailFrame[] = [];
  const failedIndices: number[] = [];
  const batchStamp = Date.now();
  const baseIndex = mode === 'append' ? existingAll.length : 0;

  for (let i = 0; i < targetTimes.length; i++) {
    const targetTime = targetTimes[i];
    const frameIndex = baseIndex + i + 1;
    const outName = `thumb_${frameIndex}_${batchStamp}.jpg`;
    const outPath = path.join(mediaThumbDir, outName);
    const publicUrl = `/uploads/thumbnails/media_${mediaId}/${outName}`;

    // Try fast input seek first, then accurate output seek, then safe earlier fallback
    let extracted = await runFfmpegFrameGrab(videoPath, targetTime, outPath, false);
    if (!extracted) {
      extracted = await runFfmpegFrameGrab(videoPath, targetTime, outPath, true);
    }
    if (!extracted && targetTime > 0.2) {
      extracted = await runFfmpegFrameGrab(videoPath, Math.max(0, targetTime * 0.5), outPath, true);
    }

    // Avoid mostly-black fade frames if video is long enough
    if (extracted && isFrameMostlyBlack(outPath) && safeDur > 3) {
      const altPath = path.join(mediaThumbDir, `alt_${outName}`);
      const altTime = Math.max(0, Math.min(maxSafe, targetTime + safeDur * 0.035));
      const altOk = await runFfmpegFrameGrab(videoPath, altTime, altPath, true);
      if (altOk) {
        const origSize = fs.statSync(outPath).size;
        const altSize = fs.statSync(altPath).size;
        if (altSize > origSize) {
          fs.renameSync(altPath, outPath);
        } else {
          fs.unlinkSync(altPath);
        }
      }
    }

    if (extracted && fs.existsSync(outPath) && fs.statSync(outPath).size > 0) {
      frames.push({
        index: frameIndex,
        timestamp: Number(targetTime.toFixed(2)),
        url: publicUrl,
        filePath: outPath,
        width: 640,
        height: outHeight,
      });
    } else {
      failedIndices.push(frameIndex);
    }
  }

  let warning = '';
  if (realDur > 0 && realDur < 1.5 && frames.length > 0) {
    warning = 'الفيديو قصير جداً؛ تم استخراج الإطارات الممكنة من المدة المتاحة.';
  } else if (failedIndices.length > 0 && frames.length > 0) {
    warning = `تم استخراج ${frames.length} من أصل ${targetTimes.length} صور مصغرة (تعذر الإطار رقم: ${failedIndices.join('، ')}).`;
  } else if (frames.length === 0) {
    warning = 'تعذر استخراج الصور المصغرة تلقائياً لهذا الفيديو. تأكد من سلامة ملف الفيديو ثم أعد المحاولة.';
    logSystemEvent('thumbnail_extraction_failed', `فشل استخراج الصور المصغرة للملف #${mediaId}`, videoPath);
  }

  const combined: ThumbnailFrame[] =
    mode === 'append' ? [...existingAll, ...frames] : [...existingCustom, ...frames];
  const hasPrevSelected = prevSelectedUrl && combined.some((c) => c.url === prevSelectedUrl);
  const marked = combined.map((item, idx) => ({
    ...item,
    selected: hasPrevSelected ? item.url === prevSelectedUrl : idx === 0,
  }));

  db.prepare('UPDATE media_files SET thumbnails_json = ? WHERE id = ?').run(
    JSON.stringify(marked),
    mediaId
  );

  // If linked content items have empty thumbnail_url, assign the selected/first extracted thumbnail automatically
  if (frames.length > 0) {
    const defaultUrl = marked.find((f) => f.selected)?.url || frames[0].url;
    db.prepare(
      "UPDATE content SET thumbnail_url = ?, updated_at = ? WHERE media_file_id = ? AND (thumbnail_url IS NULL OR thumbnail_url = '')"
    ).run(defaultUrl, new Date().toISOString(), mediaId);
  }

  return { frames: marked, newlyAdded: frames, warning };
}

export async function extractSixThumbnails(
  mediaId: number,
  videoPath: string,
  durationSeconds: number
): Promise<{ frames: ThumbnailFrame[]; warning: string }> {
  const { frames, warning } = await extractVideoFrames(mediaId, videoPath, durationSeconds, {
    mode: 'spread',
    count: 6,
  });
  return { frames, warning };
}

export function deleteVideoThumbnail(
  mediaId: number,
  opts: { url?: string; clearAll?: boolean }
): { frames: ThumbnailFrame[]; removedUrls: string[] } {
  const row = db.prepare('SELECT thumbnails_json FROM media_files WHERE id = ?').get(mediaId) as
    | { thumbnails_json: string }
    | undefined;
  if (!row) {
    throw new Error('ملف الفيديو غير موجود.');
  }
  let existing: ThumbnailFrame[] = [];
  try {
    existing = JSON.parse(row.thumbnails_json || '[]');
  } catch {
    existing = [];
  }

  const mediaThumbDir = path.resolve(path.join(THUMBNAILS_DIR, `media_${mediaId}`));
  const safeDeleteThumbFile = (fp?: string) => {
    if (!fp) return;
    try {
      const resolved = path.resolve(fp);
      if (resolved.startsWith(mediaThumbDir) && fs.existsSync(resolved)) {
        fs.unlinkSync(resolved);
      }
    } catch {
      // ignore disk cleanup failure
    }
  };

  const removedUrls: string[] = [];
  let nextFrames: ThumbnailFrame[] = [];

  if (opts.clearAll) {
    for (const f of existing) {
      removedUrls.push(f.url);
      safeDeleteThumbFile(f.filePath);
    }
    nextFrames = [];
    db.prepare('UPDATE media_files SET thumbnails_json = ? WHERE id = ?').run('[]', mediaId);
    db.prepare('UPDATE content SET thumbnail_url = ?, updated_at = ? WHERE media_file_id = ?').run(
      '',
      new Date().toISOString(),
      mediaId
    );
  } else if (opts.url) {
    const targetUrl = String(opts.url);
    const targetFrame = existing.find((f) => f.url === targetUrl);
    if (targetFrame) {
      removedUrls.push(targetFrame.url);
      safeDeleteThumbFile(targetFrame.filePath);
    }
    const filtered = existing.filter((f) => f.url !== targetUrl);
    const wasSelected = Boolean(targetFrame?.selected);
    nextFrames = filtered.map((f, idx) => ({
      ...f,
      selected: wasSelected ? idx === 0 : Boolean(f.selected),
    }));
    const fallbackUrl = nextFrames.find((f) => f.selected)?.url || nextFrames[0]?.url || '';
    db.prepare('UPDATE media_files SET thumbnails_json = ? WHERE id = ?').run(
      JSON.stringify(nextFrames),
      mediaId
    );
    if (wasSelected || !nextFrames.length) {
      db.prepare('UPDATE content SET thumbnail_url = ?, updated_at = ? WHERE media_file_id = ? AND thumbnail_url = ?').run(
        fallbackUrl,
        new Date().toISOString(),
        mediaId,
        targetUrl
      );
    }
  }

  return { frames: nextFrames, removedUrls };
}

export async function extractCustomTimestampFrame(
  mediaId: number,
  videoPath: string,
  timestampSeconds: number
): Promise<{ frame: ThumbnailFrame; frames: ThumbnailFrame[] }> {
  const row = db.prepare('SELECT duration, width, height, thumbnails_json FROM media_files WHERE id = ?').get(mediaId) as
    | { duration: number; width: number; height: number; thumbnails_json: string }
    | undefined;
  if (!row) {
    throw new Error('ملف الفيديو غير موجود.');
  }

  let realDur = Number(row.duration || 0);
  if (realDur <= 0.2) {
    const probed = await probeVideoFile(videoPath);
    if (probed.duration > 0) realDur = probed.duration;
  }

  const maxSafe = realDur > 0.2 ? Math.max(0, realDur - 0.1) : Math.max(0, timestampSeconds);
  const clamped = Math.max(0, Math.min(maxSafe > 0 ? maxSafe : timestampSeconds, timestampSeconds));

  const mediaThumbDir = path.join(THUMBNAILS_DIR, `media_${mediaId}`);
  fs.mkdirSync(mediaThumbDir, { recursive: true });
  const stamp = Date.now();
  const outName = `frame_at_${Math.round(clamped * 100)}_${stamp}.jpg`;
  const outPath = path.join(mediaThumbDir, outName);
  const publicUrl = `/uploads/thumbnails/media_${mediaId}/${outName}`;

  let extracted = await runFfmpegFrameGrab(videoPath, clamped, outPath, true);
  if (!extracted) {
    extracted = await runFfmpegFrameGrab(videoPath, clamped, outPath, false);
  }
  if (!extracted || !fs.existsSync(outPath)) {
    throw new Error('تعذر التقاط إطار من هذا التوقيت عبر FFmpeg.');
  }

  const videoW = row.width || 1280;
  const videoH = row.height || 720;
  const outHeight = videoW > 0 && videoH > 0 ? Math.max(120, Math.round((640 * videoH) / videoW)) : 360;

  let existing: ThumbnailFrame[] = [];
  try {
    existing = JSON.parse(row.thumbnails_json || '[]');
  } catch {
    existing = [];
  }

  const newFrame: ThumbnailFrame = {
    index: existing.length + 1,
    timestamp: Number(clamped.toFixed(2)),
    url: publicUrl,
    filePath: outPath,
    width: 640,
    height: outHeight,
    selected: true,
    isCustom: true,
  };

  const nextFrames = [newFrame, ...existing.map((f) => ({ ...f, selected: false }))];
  db.prepare('UPDATE media_files SET thumbnails_json = ? WHERE id = ?').run(JSON.stringify(nextFrames), mediaId);
  db.prepare('UPDATE content SET thumbnail_url = ?, updated_at = ? WHERE media_file_id = ?').run(
    publicUrl,
    new Date().toISOString(),
    mediaId
  );

  return { frame: newFrame, frames: nextFrames };
}

export async function ensureVideoThumbnails(media: MediaFileRecord): Promise<{
  media: MediaFileRecord;
  warning: string;
}> {
  if (media.media_kind !== 'video' || !fs.existsSync(media.file_path)) {
    return { media, warning: '' };
  }
  let existing: ThumbnailFrame[] = [];
  try {
    existing = JSON.parse(media.thumbnails_json || '[]');
  } catch {
    existing = [];
  }
  const validExtracted = existing.filter(
    (t) => !t.isCustom && t.filePath && fs.existsSync(t.filePath) && fs.statSync(t.filePath).size > 200
  );
  if (validExtracted.length >= 6) {
    return { media, warning: '' };
  }
  const { warning } = await extractSixThumbnails(media.id, media.file_path, Number(media.duration || 0));
  const refreshed = db.prepare('SELECT * FROM media_files WHERE id = ?').get(media.id) as unknown as MediaFileRecord;
  return { media: refreshed || media, warning };
}

const STANDARD_LADDER: Array<{ label: string; height: number; crf: string; audioBitrate: string }> = [
  { label: '144p', height: 144, crf: '31', audioBitrate: '64k' },
  { label: '240p', height: 240, crf: '29', audioBitrate: '64k' },
  { label: '360p', height: 360, crf: '27', audioBitrate: '96k' },
  { label: '480p', height: 480, crf: '25', audioBitrate: '128k' },
  { label: '720p', height: 720, crf: '23', audioBitrate: '128k' },
  { label: '1080p', height: 1080, crf: '22', audioBitrate: '160k' },
  { label: '1440p', height: 1440, crf: '21', audioBitrate: '192k' },
  { label: '2160p', height: 2160, crf: '20', audioBitrate: '192k' },
];

const activeTranscodes = new Set<number>();

function parseRenditionsSafe(jsonStr: string): VideoRendition[] {
  try {
    const arr = JSON.parse(jsonStr || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.map((r) => ({
      ...r,
      status: r.status || 'completed',
      enabled: r.enabled !== false,
    }));
  } catch {
    return [];
  }
}

export async function getMediaQualityPlan(mediaId: number): Promise<{
  mediaId: number;
  sourceWidth: number;
  sourceHeight: number;
  effectiveHeight: number;
  duration: number;
  fileSize: number;
  bitrate: number;
  isTranscoding: boolean;
  allTiers: Array<{ label: string; height: number; allowed: boolean }>;
  eligibleTiers: Array<{ label: string; height: number }>;
  renditions: VideoRendition[];
}> {
  const media = db.prepare('SELECT * FROM media_files WHERE id = ?').get(mediaId) as
    | MediaFileRecord
    | undefined;
  if (!media || media.media_kind !== 'video') {
    throw new Error('ملف الفيديو غير موجود.');
  }

  let width = Number(media.width || 0);
  let height = Number(media.height || 0);
  let duration = Number(media.duration || 0);
  let bitrate = 0;

  if (fs.existsSync(media.file_path)) {
    const probed = await probeVideoFile(media.file_path);
    if (probed.width > 0) width = probed.width;
    if (probed.height > 0) height = probed.height;
    if (probed.duration > 0) duration = probed.duration;
    bitrate = probed.bitrate;
    if (width !== media.width || height !== media.height || (duration > 0 && media.duration <= 0)) {
      db.prepare('UPDATE media_files SET width = ?, height = ?, duration = ? WHERE id = ?').run(
        width,
        height,
        duration,
        mediaId
      );
    }
  }

  const effectiveHeight = normalizeVideoQualityHeight(width, height) || 720;
  const allTiers = STANDARD_LADDER.map((tier) => ({
    label: tier.label,
    height: tier.height,
    allowed: tier.height <= effectiveHeight,
  }));
  const eligibleTiers = allTiers
    .filter((t) => t.allowed)
    .map(({ label, height: h }) => ({ label, height: h }));

  let renditions = parseRenditionsSafe(media.renditions_json);
  const originalLabel = `${effectiveHeight}p (الأصلية)`;
  if (!renditions.some((r) => r.isOriginal) && fs.existsSync(media.file_path)) {
    renditions.unshift({
      label: originalLabel,
      height: effectiveHeight,
      width: width || undefined,
      bitrate: bitrate || undefined,
      url: media.public_url,
      filePath: media.file_path,
      fileSize: media.file_size,
      isOriginal: true,
      status: 'completed',
      enabled: true,
    });
  } else {
    renditions = renditions.map((r) =>
      r.isOriginal
        ? {
            ...r,
            height: effectiveHeight,
            width: r.width || width || undefined,
            bitrate: r.bitrate || bitrate || undefined,
            status: 'completed',
          }
        : r
    );
  }

  return {
    mediaId,
    sourceWidth: width,
    sourceHeight: height,
    effectiveHeight,
    duration,
    fileSize: media.file_size,
    bitrate,
    isTranscoding: activeTranscodes.has(mediaId),
    allTiers,
    eligibleTiers,
    renditions,
  };
}

export async function generateVideoRenditions(
  mediaId: number,
  requestedLabels?: string[],
  options: { force?: boolean } = {}
): Promise<VideoRendition[]> {
  if (activeTranscodes.has(mediaId)) {
    const row = db.prepare('SELECT renditions_json FROM media_files WHERE id = ?').get(mediaId) as
      | { renditions_json: string }
      | undefined;
    return row ? parseRenditionsSafe(row.renditions_json) : [];
  }

  const media = db.prepare('SELECT * FROM media_files WHERE id = ?').get(mediaId) as
    | MediaFileRecord
    | undefined;
  if (!media || media.media_kind !== 'video' || !fs.existsSync(media.file_path)) {
    throw new Error('ملف الفيديو الأصلي غير موجود.');
  }

  activeTranscodes.add(mediaId);
  try {
    let sourceWidth = Number(media.width || 0);
    let sourceHeight = Number(media.height || 0);
    let duration = Number(media.duration || 0);
    const probed = await probeVideoFile(media.file_path);
    if (probed.width > 0) sourceWidth = probed.width;
    if (probed.height > 0) sourceHeight = probed.height;
    if (probed.duration > 0) duration = probed.duration;

    if (sourceWidth !== media.width || sourceHeight !== media.height || duration !== media.duration) {
      db.prepare('UPDATE media_files SET width = ?, height = ?, duration = ? WHERE id = ?').run(
        sourceWidth,
        sourceHeight,
        duration,
        mediaId
      );
    }

    const effectiveHeight = normalizeVideoQualityHeight(sourceWidth, sourceHeight) || 720;
    const isPortrait = sourceHeight > sourceWidth && sourceWidth > 0;
    const originalLabel = `${effectiveHeight}p (الأصلية)`;

    let renditions = parseRenditionsSafe(media.renditions_json);
    if (!renditions.some((r) => r.isOriginal)) {
      renditions.unshift({
        label: originalLabel,
        height: effectiveHeight,
        width: sourceWidth || undefined,
        bitrate: probed.bitrate || undefined,
        url: media.public_url,
        filePath: media.file_path,
        fileSize: media.file_size,
        isOriginal: true,
        status: 'completed',
        enabled: true,
      });
    } else {
      renditions = renditions.map((r) =>
        r.isOriginal
          ? {
              ...r,
              label: originalLabel,
              height: effectiveHeight,
              width: sourceWidth || r.width,
              bitrate: probed.bitrate || r.bitrate,
              status: 'completed',
              enabled: r.enabled !== false,
            }
          : r
      );
    }

    const settings = getAllSettings();
    const defaultLadder =
      Array.isArray(settings.player?.defaultAutoGenerateQualities) &&
      settings.player.defaultAutoGenerateQualities.length > 0
        ? settings.player.defaultAutoGenerateQualities
        : ['360p', '480p', '720p'];

    // Strictly forbid inventing a higher quality than effectiveHeight!
    const targets = STANDARD_LADDER.filter((tier) => {
      if (tier.height > effectiveHeight) return false;
      if (requestedLabels && requestedLabels.length > 0) {
        return requestedLabels.includes(tier.label);
      }
      // Auto ladder only picks qualities strictly below source unless source isn't web-friendly mp4
      if (tier.height >= effectiveHeight && media.file_path.toLowerCase().endsWith('.mp4')) {
        return false;
      }
      return defaultLadder.includes(tier.label);
    });

    if (targets.length === 0) {
      db.prepare(
        "UPDATE media_files SET renditions_json = ?, status = 'ready', processing_progress = 100 WHERE id = ?"
      ).run(JSON.stringify(renditions), mediaId);
      return renditions;
    }

    const outDir = path.join(RENDITIONS_DIR, `media_${mediaId}`);
    fs.mkdirSync(outDir, { recursive: true });

    const pendingTargets = targets.filter((tier) => {
      const existingMatch = renditions.find((r) => !r.isOriginal && r.label === tier.label);
      if (
        !options.force &&
        existingMatch &&
        existingMatch.status === 'completed' &&
        existingMatch.filePath &&
        fs.existsSync(existingMatch.filePath) &&
        fs.statSync(existingMatch.filePath).size > 1024
      ) {
        return false;
      }
      return true;
    });

    if (pendingTargets.length === 0) {
      db.prepare(
        "UPDATE media_files SET renditions_json = ?, status = 'ready', processing_progress = 100 WHERE id = ?"
      ).run(JSON.stringify(renditions), mediaId);
      return renditions;
    }

    // Mark pending targets as waiting
    for (const tier of pendingTargets) {
      const idx = renditions.findIndex((r) => !r.isOriginal && r.label === tier.label);
      const placeholder: VideoRendition = {
        label: tier.label,
        height: tier.height,
        url: `/uploads/renditions/media_${mediaId}/${tier.label}.mp4`,
        filePath: path.join(outDir, `${tier.label}.mp4`),
        fileSize: 0,
        status: 'waiting',
        enabled: true,
        error: '',
      };
      if (idx >= 0) {
        renditions[idx] = { ...renditions[idx], ...placeholder };
      } else {
        renditions.push(placeholder);
      }
    }

    db.prepare(
      "UPDATE media_files SET renditions_json = ?, status = 'processing', processing_progress = 5, error_message = '' WHERE id = ?"
    ).run(JSON.stringify(renditions), mediaId);

    for (let idx = 0; idx < pendingTargets.length; idx++) {
      const tier = pendingTargets[idx];
      const outName = `${tier.label}.mp4`;
      const outPath = path.join(outDir, outName);
      const tmpPath = path.join(outDir, `${tier.label}.tmp.mp4`);
      const publicUrl = `/uploads/renditions/media_${mediaId}/${outName}`;

      const targetIdx = renditions.findIndex((r) => !r.isOriginal && r.label === tier.label);
      if (targetIdx >= 0) {
        renditions[targetIdx] = { ...renditions[targetIdx], status: 'processing', error: '' };
        db.prepare('UPDATE media_files SET renditions_json = ? WHERE id = ?').run(
          JSON.stringify(renditions),
          mediaId
        );
      }

      const scaleExpr = isPortrait ? `scale=${tier.height}:-2` : `scale=-2:${tier.height}`;
      const ffmpegArgs = [
        '-y',
        '-i',
        media.file_path,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0?',
        '-vf',
        scaleExpr,
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-preset',
        'veryfast',
        '-crf',
        tier.crf,
        '-c:a',
        'aac',
        '-b:a',
        tier.audioBitrate,
        '-movflags',
        '+faststart',
        tmpPath,
      ];

      try {
        if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
        await new Promise<void>((resolve, reject) => {
          const proc = spawn('ffmpeg', ffmpegArgs);
          let stderrTail = '';
          proc.stderr.on('data', (chunk: Buffer) => {
            stderrTail = (stderrTail + chunk.toString()).slice(-1400);
          });
          proc.on('error', (err) => reject(err));
          proc.on('close', (code) => {
            if (code === 0 && fs.existsSync(tmpPath) && fs.statSync(tmpPath).size > 1024) {
              resolve();
            } else {
              reject(new Error(`FFmpeg (${tier.label}) code ${code}: ${stderrTail}`));
            }
          });
        });

        const probedOut = await probeVideoFile(tmpPath);
        if (probedOut.width <= 0 || probedOut.height <= 0) {
          throw new Error(`الملف الناتج (${tier.label}) غير صالح للتشغيل.`);
        }
        fs.renameSync(tmpPath, outPath);
        const stat = fs.statSync(outPath);

        const completedEntry: VideoRendition = {
          label: tier.label,
          height: tier.height,
          width: probedOut.width,
          bitrate: probedOut.bitrate || undefined,
          url: publicUrl,
          filePath: outPath,
          fileSize: stat.size,
          status: 'completed',
          enabled: true,
          error: '',
        };
        if (targetIdx >= 0) {
          renditions[targetIdx] = completedEntry;
        } else {
          renditions.push(completedEntry);
        }
      } catch (tierErr) {
        if (fs.existsSync(tmpPath)) {
          try {
            fs.unlinkSync(tmpPath);
          } catch {
            // ignore
          }
        }
        const errMsg = tierErr instanceof Error ? tierErr.message : String(tierErr);
        if (targetIdx >= 0) {
          renditions[targetIdx] = {
            ...renditions[targetIdx],
            status: 'failed',
            enabled: false,
            error: errMsg,
          };
        }
        logSystemEvent('transcode_tier_error', `فشل ترميز جودة ${tier.label} للملف #${mediaId}`, errMsg);
      }

      const pct = Math.round(((idx + 1) / pendingTargets.length) * 100);
      db.prepare('UPDATE media_files SET renditions_json = ?, processing_progress = ? WHERE id = ?').run(
        JSON.stringify(renditions),
        pct,
        mediaId
      );
    }

    renditions.sort((a, b) => (a.isOriginal ? -1 : 0) - (b.isOriginal ? -1 : 0) || b.height - a.height);
    db.prepare(
      "UPDATE media_files SET renditions_json = ?, status = 'ready', processing_progress = 100 WHERE id = ?"
    ).run(JSON.stringify(renditions), mediaId);

    const readyLabels = renditions.filter((r) => r.status === 'completed').map((r) => r.label);
    logActivity(
      'معالجة جودات الفيديو',
      'media',
      `تم تجهيز جودات التشغيل (${readyLabels.join('، ')}) للملف #${mediaId}`,
      'owner'
    );
    return renditions;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    db.prepare(
      "UPDATE media_files SET status = 'ready', processing_progress = 100, error_message = ? WHERE id = ?"
    ).run(`تم حفظ الفيديو الأصلي بنجاح، ولكن تعذرت معالجة بعض الجودات الإضافية: ${msg}`, mediaId);
    logSystemEvent('transcode_error', `خطأ في معالجة جودات الفيديو #${mediaId}`, msg);
    throw err;
  } finally {
    activeTranscodes.delete(mediaId);
  }
}

export function toggleVideoRendition(
  mediaId: number,
  label: string,
  enabled: boolean
): { file: MediaFileRecord; renditions: VideoRendition[] } {
  const media = db.prepare('SELECT * FROM media_files WHERE id = ?').get(mediaId) as
    | MediaFileRecord
    | undefined;
  if (!media) {
    throw new Error('الملف غير موجود.');
  }
  const renditions = parseRenditionsSafe(media.renditions_json);
  const idx = renditions.findIndex((r) => r.label === label);
  if (idx < 0) {
    throw new Error('الجودة المحددة غير موجودة.');
  }
  renditions[idx] = { ...renditions[idx], enabled };
  db.prepare('UPDATE media_files SET renditions_json = ? WHERE id = ?').run(
    JSON.stringify(renditions),
    mediaId
  );
  const updated = db.prepare('SELECT * FROM media_files WHERE id = ?').get(mediaId) as unknown as MediaFileRecord;
  return { file: updated, renditions };
}

export function deleteVideoRendition(
  mediaId: number,
  label: string
): { file: MediaFileRecord; renditions: VideoRendition[] } {
  const media = db.prepare('SELECT * FROM media_files WHERE id = ?').get(mediaId) as
    | MediaFileRecord
    | undefined;
  if (!media) {
    throw new Error('الملف غير موجود.');
  }
  const renditions = parseRenditionsSafe(media.renditions_json);
  const target = renditions.find((r) => r.label === label);
  if (!target) {
    throw new Error('الجودة المحددة غير موجودة.');
  }
  if (target.isOriginal) {
    throw new Error('لا يمكن حذف النسخة الأصلية من هنا.');
  }
  if (target.filePath && fs.existsSync(target.filePath)) {
    const resolvedRendDir = path.resolve(RENDITIONS_DIR);
    const resolvedTarget = path.resolve(target.filePath);
    if (resolvedTarget.startsWith(resolvedRendDir + path.sep)) {
      try {
        fs.unlinkSync(resolvedTarget);
      } catch {
        // ignore file deletion error
      }
    }
  }
  const next = renditions.filter((r) => r.label !== label);
  db.prepare('UPDATE media_files SET renditions_json = ? WHERE id = ?').run(
    JSON.stringify(next),
    mediaId
  );
  const updated = db.prepare('SELECT * FROM media_files WHERE id = ?').get(mediaId) as unknown as MediaFileRecord;
  logActivity('حذف جودة فيديو', 'media', `تم حذف جودة (${label}) من الفيديو #${mediaId}`, 'owner');
  return { file: updated, renditions: next };
}

export async function finalizeChunkedUpload(
  sessionId: string,
  actor = 'owner'
): Promise<{
  media: MediaFileRecord;
  duplicate: boolean;
  thumbnailWarning: string;
}> {
  const session = db.prepare('SELECT * FROM upload_sessions WHERE id = ?').get(sessionId) as
    | {
        id: string;
        original_name: string;
        mime_type: string;
        total_size: number;
        total_chunks: number;
        received_chunks_json: string;
        sha256: string | null;
        status: string;
      }
    | undefined;

  if (!session) {
    throw new Error('جلسة الرفع غير موجودة.');
  }

  const sessionChunkDir = path.join(CHUNKS_DIR, sessionId);
  for (let i = 0; i < session.total_chunks; i++) {
    const p = path.join(sessionChunkDir, `chunk_${i}`);
    if (!fs.existsSync(p)) {
      throw new Error(`الجزء رقم ${i + 1} من أصل ${session.total_chunks} مفقود. يرجى إعادة المحاولة.`);
    }
  }

  const ext = path.extname(session.original_name) || '';
  const storedName = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
  const finalPath = path.join(MEDIA_DIR, storedName);
  const publicUrl = `/uploads/media/${storedName}`;

  const hash = crypto.createHash('sha256');
  const writeStream = fs.createWriteStream(finalPath);

  try {
    for (let i = 0; i < session.total_chunks; i++) {
      const chunkPath = path.join(sessionChunkDir, `chunk_${i}`);
      const buf = fs.readFileSync(chunkPath);
      hash.update(buf);
      writeStream.write(buf);
    }
    await new Promise<void>((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on('error', reject);
    });
  } catch (err) {
    if (fs.existsSync(finalPath)) fs.unlinkSync(finalPath);
    throw err;
  }

  // Clean up chunks safely
  fs.rmSync(sessionChunkDir, { recursive: true, force: true });

  const fileHash = hash.digest('hex');
  const fileStat = fs.statSync(finalPath);

  // Check duplicate by SHA-256
  const existingDup = db.prepare('SELECT * FROM media_files WHERE sha256 = ?').get(fileHash) as
    | MediaFileRecord
    | undefined;
  if (existingDup && fs.existsSync(existingDup.file_path)) {
    fs.unlinkSync(finalPath);
    db.prepare(
      "UPDATE upload_sessions SET status = 'completed', media_file_id = ?, sha256 = ?, updated_at = ? WHERE id = ?"
    ).run(existingDup.id, fileHash, new Date().toISOString(), sessionId);
    const repaired = await ensureVideoThumbnails(existingDup);
    return { media: repaired.media, duplicate: true, thumbnailWarning: repaired.warning };
  }

  const mediaKind = detectMediaKind(session.mime_type, session.original_name);
  let width = 0;
  let height = 0;
  let duration = 0;
  let renditions: VideoRendition[] = [];

  if (mediaKind === 'video') {
    const probed = await probeVideoFile(finalPath);
    width = probed.width;
    height = probed.height;
    duration = probed.duration;
    const effectiveHeight = normalizeVideoQualityHeight(width, height) || 720;
    renditions = [
      {
        label: `${effectiveHeight}p (الأصلية)`,
        height: effectiveHeight,
        width: width || undefined,
        bitrate: probed.bitrate || undefined,
        url: publicUrl,
        filePath: finalPath,
        fileSize: fileStat.size,
        isOriginal: true,
        status: 'completed',
        enabled: true,
      },
    ];
  }

  const now = new Date().toISOString();
  const res = db
    .prepare(
      `INSERT INTO media_files (
        original_name, stored_name, file_path, public_url, mime_type, media_kind,
        file_size, sha256, width, height, duration, status, processing_progress,
        error_message, thumbnails_json, renditions_json, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ready', 100, '', '[]', ?, ?)`
    )
    .run(
      session.original_name,
      storedName,
      finalPath,
      publicUrl,
      session.mime_type || 'application/octet-stream',
      mediaKind,
      fileStat.size,
      fileHash,
      width,
      height,
      duration,
      JSON.stringify(renditions),
      now
    );

  const mediaId = Number(res.lastInsertRowid);
  db.prepare(
    "UPDATE upload_sessions SET status = 'completed', media_file_id = ?, sha256 = ?, updated_at = ? WHERE id = ?"
  ).run(mediaId, fileHash, now, sessionId);

  let thumbnailWarning = '';
  if (mediaKind === 'video') {
    const thumbResult = await extractSixThumbnails(mediaId, finalPath, duration);
    thumbnailWarning = thumbResult.warning;
    const allSettings = getAllSettings();
    if (allSettings.storage?.autoTranscodeOnUpload) {
      generateVideoRenditions(mediaId, allSettings.player?.defaultAutoGenerateQualities).catch(() => {});
    }
  }

  const saved = db.prepare('SELECT * FROM media_files WHERE id = ?').get(mediaId) as unknown as MediaFileRecord;
  logActivity(
    'رفع ملف وسائط',
    'upload',
    `تم رفع الملف "${session.original_name}" (${(fileStat.size / (1024 * 1024)).toFixed(2)} م.ب)`,
    actor
  );

  return { media: saved, duplicate: false, thumbnailWarning };
}

export interface MediaUsageReference {
  kind: 'content' | 'page' | 'settings' | 'custom_code';
  id: number | string;
  title: string;
  location: string;
}

export function getMediaUsage(mediaId: number): MediaUsageReference[] {
  const media = db.prepare('SELECT * FROM media_files WHERE id = ?').get(mediaId) as
    | MediaFileRecord
    | undefined;
  if (!media) return [];

  const refs: MediaUsageReference[] = [];
  const pubUrl = media.public_url;

  const contentRows = db
    .prepare(
      'SELECT id, title, content_type, status, media_file_id, media_url, thumbnail_url, gallery_urls_json FROM content'
    )
    .all() as Array<{
    id: number;
    title: string;
    content_type: string;
    status: string;
    media_file_id: number | null;
    media_url: string;
    thumbnail_url: string;
    gallery_urls_json: string;
  }>;

  for (const c of contentRows) {
    if (
      c.media_file_id === mediaId ||
      c.media_url === pubUrl ||
      c.thumbnail_url === pubUrl ||
      (c.gallery_urls_json && c.gallery_urls_json.includes(pubUrl))
    ) {
      refs.push({
        kind: 'content',
        id: c.id,
        title: c.title,
        location: `مادة (${c.content_type}) - [${c.status}]`,
      });
    }
  }

  const pageRows = db
    .prepare('SELECT id, title, slug, settings_json, custom_content FROM pages')
    .all() as Array<{
    id: number;
    title: string;
    slug: string;
    settings_json: string;
    custom_content: string;
  }>;

  for (const p of pageRows) {
    if (
      (p.settings_json && p.settings_json.includes(pubUrl)) ||
      (p.custom_content && p.custom_content.includes(pubUrl))
    ) {
      refs.push({
        kind: 'page',
        id: p.id,
        title: p.title,
        location: `صفحة (/${p.slug})`,
      });
    }
  }

  const settings = getAllSettings();
  const settingsJson = JSON.stringify(settings);
  if (settingsJson.includes(pubUrl)) {
    refs.push({
      kind: 'settings',
      id: 'settings',
      title: 'إعدادات الموقع والمظهر',
      location: 'الهوية أو الخلفيات أو الصفحة الرئيسية أو الأزرار',
    });
  }

  const codeRows = db.prepare('SELECT id, name, code FROM custom_code').all() as Array<{
    id: number;
    name: string;
    code: string;
  }>;
  for (const cc of codeRows) {
    if (cc.code && cc.code.includes(pubUrl)) {
      refs.push({
        kind: 'custom_code',
        id: cc.id,
        title: cc.name,
        location: 'الأكواد المخصصة',
      });
    }
  }

  try {
    const poemRows = db.prepare('SELECT id, title, cover_image_url, design_json FROM poems').all() as Array<{
      id: number;
      title: string;
      cover_image_url: string;
      design_json: string;
    }>;
    for (const pm of poemRows) {
      if (pm.cover_image_url === pubUrl || (pm.design_json && pm.design_json.includes(pubUrl))) {
        refs.push({
          kind: 'content',
          id: pm.id,
          title: pm.title,
          location: 'صفحة قصائد',
        });
      }
    }
  } catch {
    // ignore if poems table doesn't exist yet
  }

  return refs;
}

export function deleteMediaArtifacts(mediaId: number, filePath?: string): void {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
  }
  const thumbDir = path.join(THUMBNAILS_DIR, `media_${mediaId}`);
  if (fs.existsSync(thumbDir)) {
    fs.rmSync(thumbDir, { recursive: true, force: true });
  }
  const rendDir = path.join(RENDITIONS_DIR, `media_${mediaId}`);
  if (fs.existsSync(rendDir)) {
    fs.rmSync(rendDir, { recursive: true, force: true });
  }
}

export function findOrphanedMediaFiles(): Array<{ name: string; filePath: string; size: number }> {
  if (!fs.existsSync(MEDIA_DIR)) return [];
  const rows = db.prepare('SELECT file_path, stored_name FROM media_files').all() as Array<{
    file_path: string;
    stored_name: string;
  }>;
  const knownPaths = new Set(rows.map((r) => path.resolve(r.file_path)));
  const knownNames = new Set(rows.map((r) => r.stored_name));

  const orphans: Array<{ name: string; filePath: string; size: number }> = [];
  for (const entry of fs.readdirSync(MEDIA_DIR)) {
    const full = path.resolve(MEDIA_DIR, entry);
    try {
      const st = fs.statSync(full);
      if (st.isFile() && !knownPaths.has(full) && !knownNames.has(entry)) {
        orphans.push({ name: entry, filePath: full, size: st.size });
      }
    } catch {
      // ignore
    }
  }
  return orphans;
}

export function cleanupOrphanedMediaFiles(): { removed: number; freedBytes: number } {
  const orphans = findOrphanedMediaFiles();
  let removed = 0;
  let freedBytes = 0;
  for (const o of orphans) {
    try {
      fs.unlinkSync(o.filePath);
      removed += 1;
      freedBytes += o.size;
    } catch {
      // ignore
    }
  }
  return { removed, freedBytes };
}

export function getStorageSummary(): {
  totalBytes: number;
  fileCount: number;
  byKind: Record<string, { count: number; bytes: number }>;
  missingFiles: Array<{ id: number; original_name: string; file_path: string }>;
  orphanedFiles: Array<{ name: string; filePath: string; size: number }>;
} {
  const rows = db
    .prepare('SELECT id, original_name, file_path, media_kind, file_size FROM media_files')
    .all() as Array<{
    id: number;
    original_name: string;
    file_path: string;
    media_kind: string;
    file_size: number;
  }>;

  let totalBytes = 0;
  const byKind: Record<string, { count: number; bytes: number }> = {};
  const missingFiles: Array<{ id: number; original_name: string; file_path: string }> = [];

  for (const r of rows) {
    totalBytes += Number(r.file_size || 0);
    if (!byKind[r.media_kind]) byKind[r.media_kind] = { count: 0, bytes: 0 };
    byKind[r.media_kind].count += 1;
    byKind[r.media_kind].bytes += Number(r.file_size || 0);
    if (!fs.existsSync(r.file_path)) {
      missingFiles.push({ id: r.id, original_name: r.original_name, file_path: r.file_path });
    }
  }

  const orphanedFiles = findOrphanedMediaFiles();

  return { totalBytes, fileCount: rows.length, byKind, missingFiles, orphanedFiles };
}

export function getExternalStorageSecret(): string {
  return (
    process.env.STORAGE_SECRET_ACCESS_KEY ||
    process.env.S3_SECRET_ACCESS_KEY ||
    process.env.R2_SECRET_ACCESS_KEY ||
    ''
  ).trim();
}

function buildS3Client(cfg: StorageConfig): S3Client {
  const secret = getExternalStorageSecret();
  return new S3Client({
    region: cfg.region || (cfg.mode === 'r2' ? 'auto' : 'us-east-1'),
    endpoint: cfg.endpoint || undefined,
    forcePathStyle: Boolean(cfg.endpoint && cfg.mode !== 's3'),
    credentials: {
      accessKeyId: cfg.accessKeyId,
      secretAccessKey: secret,
    },
  });
}

export async function testExternalStorageConnection(cfg: StorageConfig): Promise<{
  ok: boolean;
  mode: string;
  hasSecret: boolean;
  message: string;
}> {
  const hasSecret = Boolean(getExternalStorageSecret());
  if (cfg.mode === 'local') {
    const writable = fs.existsSync(MEDIA_DIR);
    return {
      ok: writable,
      mode: 'local',
      hasSecret,
      message: writable
        ? 'التخزين المحلي يعمل بشكل سليم وجاهز للرفع.'
        : 'مجلد التخزين المحلي غير متاح.',
    };
  }
  if (cfg.mode === 'firebase') {
    return {
      ok: true,
      mode: 'firebase',
      hasSecret,
      message:
        'وضع Firebase Storage مهيأ بالمشروع، ويتطلب تفعيل حزمة Firebase Storage من لوحة Firebase عند استخدام الملفات السحابية المباشرة.',
    };
  }
  if (!cfg.bucket || !cfg.accessKeyId) {
    return {
      ok: false,
      mode: cfg.mode,
      hasSecret,
      message: 'يرجى إدخال اسم الحاوية (Bucket) ومعرّف الوصول (Access Key ID) أولاً.',
    };
  }
  if (!hasSecret) {
    return {
      ok: false,
      mode: cfg.mode,
      hasSecret: false,
      message:
        'المفتاح السري للتخزين الخارجي غير مضبوط في متغيرات البيئة (STORAGE_SECRET_ACCESS_KEY أو S3_SECRET_ACCESS_KEY أو R2_SECRET_ACCESS_KEY). لن يتم محاكاة اتصال وهمي.',
    };
  }
  try {
    const client = buildS3Client(cfg);
    await client.send(new HeadBucketCommand({ Bucket: cfg.bucket }));
    return {
      ok: true,
      mode: cfg.mode,
      hasSecret: true,
      message: `تم التحقق بنجاح من الاتصال بالحاوية (${cfg.bucket}) عبر ${cfg.mode.toUpperCase()}.`,
    };
  } catch (err) {
    return {
      ok: false,
      mode: cfg.mode,
      hasSecret: true,
      message: `فشل الاتصال بالحاوية (${cfg.bucket}): ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

export async function uploadFileToExternalStorageIfConfigured(
  filePath: string,
  objectKey: string,
  mimeType: string
): Promise<{ uploaded: boolean; publicUrl?: string; error?: string }> {
  const cfg = getAllSettings().storage;
  if (!cfg || (cfg.mode !== 's3' && cfg.mode !== 'r2' && cfg.mode !== 'gcs')) {
    return { uploaded: false };
  }
  if (!cfg.bucket || !cfg.accessKeyId || !getExternalStorageSecret()) {
    return { uploaded: false, error: 'إعدادات التخزين الخارجي أو STORAGE_SECRET_ACCESS_KEY غير مكتملة' };
  }
  try {
    const client = buildS3Client(cfg);
    const body = fs.readFileSync(filePath);
    await client.send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: objectKey,
        Body: body,
        ContentType: mimeType || 'application/octet-stream',
      })
    );
    const base = (cfg.publicBaseUrl || '').replace(/\/+$/, '');
    const publicUrl = base ? `${base}/${objectKey}` : undefined;
    return { uploaded: true, publicUrl };
  } catch (err) {
    return { uploaded: false, error: err instanceof Error ? err.message : String(err) };
  }
}

