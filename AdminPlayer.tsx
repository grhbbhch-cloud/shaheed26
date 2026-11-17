import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Film,
  Monitor,
  Play,
  PlayCircle,
  Sliders,
  Smartphone,
  Triangle,
} from 'lucide-react';
import { VideoPlayer } from '../../../components/VideoPlayer';
import { AdminCard, AdminPanelHeader, ColorField } from '../../../components/admin/AdminSharedUI';
import { useAdmin } from '../../../context/AdminContext';
import { sanitizeSvgMarkup } from '../../../lib/styleEngine';
import type { AllSettings, PlayerControlItemConfig } from '../../../types/platform';

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const CONTROL_LABELS: Record<string, string> = {
  play: 'زر التشغيل والإيقاف',
  mute: 'زر كتم الصوت',
  volume: 'شريط الصوت ومستواه',
  progress: 'شريط التقدم الرئيسي',
  buffered: 'مؤشر التحميل المسبق',
  time: 'الوقت الحالي',
  duration: 'المدة الكلية',
  subtitles: 'قائمة الترجمات',
  speed: 'سرعة التشغيل',
  quality: 'اختيار الجودة',
  pip: 'صورة داخل صورة (PiP)',
  download: 'زر التحميل',
  share: 'زر المشاركة',
  fullscreen: 'ملء الشاشة',
};

const DEFAULT_CONTROL_ITEM: PlayerControlItemConfig = {
  enabled: true,
  size: 18,
  color: '#FFFFFF',
  background: 'transparent',
  shape: 'rounded',
  borderColor: 'transparent',
  borderWidth: 0,
  shadow: 'none',
  hoverColor: '#D4AF65',
  hoverBg: 'rgba(255,255,255,0.1)',
  activeColor: '#B08D45',
  spacing: 6,
  showOnDesktop: true,
  showOnMobile: true,
  order: 1,
};

export function AdminPlayer() {
  const { settings, previousSettings, mediaFiles, saveCategory, resetCategory, notify } = useAdmin();
  const [player, setPlayer] = useState<AllSettings['player'] | null>(null);
  const [saving, setSaving] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<'desktop' | 'mobile'>('desktop');
  const [previewStarted, setPreviewStarted] = useState(true);
  const [selectedControlKey, setSelectedControlKey] = useState<string>('play');
  const [subTab, setSubTab] = useState<'external' | 'container' | 'bar' | 'controls'>('controls');

  useEffect(() => {
    if (settings?.player) setPlayer(structuredClone(settings.player));
  }, [settings?.player]);

  if (!player || !settings) return null;

  const sampleVideo = mediaFiles.find((m) => m.media_kind === 'video');
  const sampleThumbs = (() => {
    try {
      return sampleVideo?.thumbnails_json ? JSON.parse(sampleVideo.thumbnails_json) : [];
    } catch {
      return [];
    }
  })();

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveCategory('player', player, 'تحديث إعدادات مشغل الفيديو وزر التشغيل الخارجي');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setPlayer(structuredClone(settings.player));
    notify('تم إلغاء التعديلات غير المحفوظة', 'info');
  };

  const handleRevertPrevious = () => {
    const prev = previousSettings.player as AllSettings['player'] | undefined;
    if (!prev) return;
    setPlayer(structuredClone(prev));
    notify('تمت استعادة إعدادات المشغل السابقة في المعاينة؛ اضغط «حفظ وتطبيق التغييرات» لتثبيتها', 'info');
  };

  const hasUnsavedChanges = JSON.stringify(player) !== JSON.stringify(settings.player);
  const hasPreviousSnapshot = Boolean(previousSettings.player);

  const moveBtn = (idx: number, delta: number) => {
    const arr = [...player.buttonOrder];
    const t = idx + delta;
    if (t < 0 || t >= arr.length) return;
    const tmp = arr[idx];
    arr[idx] = arr[t];
    arr[t] = tmp;
    setPlayer({ ...player, buttonOrder: arr });
  };

  const ext = player.externalPlayButton;
  const ctrlMap = player.controlsConfig || {};
  const activeCtrl: PlayerControlItemConfig = {
    ...DEFAULT_CONTROL_ITEM,
    ...(ctrlMap[selectedControlKey] || {}),
  };

  const updateControlItem = (key: string, patch: Partial<PlayerControlItemConfig>) => {
    const existing = { ...DEFAULT_CONTROL_ITEM, ...(player.controlsConfig?.[key] || {}) };
    setPlayer({
      ...player,
      controlsConfig: {
        ...(player.controlsConfig || {}),
        [key]: { ...existing, ...patch },
      },
      ...(patch.enabled !== undefined
        ? { buttonVisibility: { ...player.buttonVisibility, [key]: patch.enabled } }
        : {}),
    });
  };

  const renderExtPreviewIcon = () => {
    const sz = ext.iconSize || 24;
    const cl = ext.iconColor || '#FFFFFF';
    if (ext.customIconUrl) {
      if (ext.customIconUrl.trim().startsWith('<svg')) {
        return (
          <span
            className="inline-flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
            style={{ width: sz, height: sz, color: cl }}
            dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup(ext.customIconUrl) }}
          />
        );
      }
      return <img src={ext.customIconUrl} alt="" style={{ width: sz, height: sz, objectFit: 'contain' }} />;
    }
    if (ext.icon === 'film') return <Film size={sz} style={{ color: cl }} />;
    if (ext.icon === 'play-circle') return <PlayCircle size={sz} style={{ color: cl }} />;
    if (ext.icon === 'triangle') return <Triangle size={sz} fill={cl} className="rotate-90" style={{ color: cl }} />;
    return <Play size={sz} fill={cl} style={{ color: cl }} />;
  };

  return (
    <div>
      <AdminPanelHeader
        title="إدارة مشغل الفيديو وزر التشغيل الخارجي"
        subtitle="معاينة تفاعلية حية للمشغل والتحكم الدقيق بكل عنصر وأيقونة وشريط التقدم وحاوية المشغل وزر التشغيل الخارجي."
        onSave={handleSave}
        onCancel={handleCancel}
        onRevertPrevious={handleRevertPrevious}
        onReset={() => resetCategory('player')}
        saving={saving}
        hasUnsavedChanges={hasUnsavedChanges}
        hasPreviousSnapshot={hasPreviousSnapshot}
      />

      <div className="space-y-6">
        {/* LIVE INTERACTIVE VIDEO PLAYER PREVIEW */}
        <AdminCard
          title="معاينة تفاعلية حية للمشغل الحقيقي"
          subtitle="كل تغيير تجريه أدناه ينعكس مباشرة داخل هذه المعاينة تماماً كما يراه الزائر على الموقع."
        >
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewViewport('desktop')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                  previewViewport === 'desktop'
                    ? 'bg-[#B08D45] text-white border-[#B08D45]'
                    : 'bg-white text-neutral-700 border-neutral-300'
                }`}
              >
                <Monitor size={13} /> سطح المكتب
              </button>
              <button
                type="button"
                onClick={() => setPreviewViewport('mobile')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                  previewViewport === 'mobile'
                    ? 'bg-[#B08D45] text-white border-[#B08D45]'
                    : 'bg-white text-neutral-700 border-neutral-300'
                }`}
              >
                <Smartphone size={13} /> الجوال
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPreviewStarted((v) => !v)}
              className="px-3 py-1.5 rounded-lg border border-neutral-300 bg-white text-xs font-semibold cursor-pointer"
            >
              {previewStarted ? 'إظهار حالة البوستر وزر التشغيل' : 'إظهار شريط التحكم الداخلي'}
            </button>
          </div>

          <div className={previewViewport === 'mobile' ? 'max-w-[380px] mx-auto' : 'max-w-3xl mx-auto'}>
            <VideoPlayer
              src={sampleVideo?.public_url || ''}
              poster={sampleThumbs[0]?.url || ''}
              title={sampleVideo?.original_name || (settings?.identity?.siteName ? `معاينة مشغل ${settings.identity.siteName}` : 'معاينة المشغل')}
              playerConfig={player}
              subtitleStyle={settings.subtitles}
              bufferLoader={settings.loading.videoBuffer}
              allowDownload={player.downloadEnabled}
              allowShare={player.shareEnabled}
              previewStarted={previewStarted}
              viewportOverride={previewViewport}
            />
          </div>
        </AdminCard>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'controls', label: 'التحكم بكل زر وعنصر' },
            { id: 'bar', label: 'شريط التحكم والتقدم' },
            { id: 'container', label: 'حاوية وإطار المشغل' },
            { id: 'external', label: 'زر التشغيل الخارجي' },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id as any)}
              className={`px-3.5 py-2 rounded-lg text-xs font-bold border cursor-pointer ${
                subTab === t.id
                  ? 'bg-[#B08D45] text-white border-[#B08D45]'
                  : 'bg-white text-neutral-700 border-neutral-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: Per-control editor + Speeds + Features */}
        {subTab === 'controls' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <AdminCard title="ترتيب وظهور الأزرار" className="xl:col-span-5">
              <div className="space-y-1.5">
                {player.buttonOrder.map((key, idx) => {
                  const isEnabled =
                    player.controlsConfig?.[key]?.enabled !== false &&
                    player.buttonVisibility[key] !== false;
                  return (
                    <div
                      key={key}
                      onClick={() => setSelectedControlKey(key)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border text-xs cursor-pointer ${
                        selectedControlKey === key
                          ? 'border-[#B08D45] bg-[#F7F4EC]/70'
                          : 'border-neutral-200 bg-neutral-50'
                      }`}
                    >
                      <label className="inline-flex items-center gap-2 font-semibold cursor-pointer" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          onChange={(e) => updateControlItem(key, { enabled: e.target.checked })}
                          className="accent-[#B08D45]"
                        />
                        <span>{CONTROL_LABELS[key] || key}</span>
                      </label>
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => moveBtn(idx, -1)} className="p-1 cursor-pointer">
                          <ArrowUp size={13} />
                        </button>
                        <button type="button" onClick={() => moveBtn(idx, 1)} className="p-1 cursor-pointer">
                          <ArrowDown size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </AdminCard>

            <div className="xl:col-span-7 space-y-5">
              <AdminCard
                title={`تخصيص العنصر: ${CONTROL_LABELS[selectedControlKey] || selectedControlKey}`}
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-5">
                    <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeCtrl.enabled}
                        onChange={(e) => updateControlItem(selectedControlKey, { enabled: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>تفعيل هذا العنصر</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeCtrl.showOnDesktop}
                        onChange={(e) =>
                          updateControlItem(selectedControlKey, { showOnDesktop: e.target.checked })
                        }
                        className="accent-[#B08D45]"
                      />
                      <span>ظهور على سطح المكتب</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={activeCtrl.showOnMobile}
                        onChange={(e) =>
                          updateControlItem(selectedControlKey, { showOnMobile: e.target.checked })
                        }
                        className="accent-[#B08D45]"
                      />
                      <span>ظهور على الجوال</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <ColorField
                      label="لون الأيقونة / العنصر"
                      value={activeCtrl.color}
                      onChange={(v) => updateControlItem(selectedControlKey, { color: v })}
                    />
                    <ColorField
                      label="خلفية العنصر"
                      value={activeCtrl.background}
                      onChange={(v) => updateControlItem(selectedControlKey, { background: v })}
                    />
                    <ColorField
                      label="لون الإطار"
                      value={activeCtrl.borderColor}
                      onChange={(v) => updateControlItem(selectedControlKey, { borderColor: v })}
                    />
                    <ColorField
                      label="لون الأيقونة عند التمرير (Hover)"
                      value={activeCtrl.hoverColor || '#D4AF65'}
                      onChange={(v) => updateControlItem(selectedControlKey, { hoverColor: v })}
                    />
                    <ColorField
                      label="خلفية العنصر عند التمرير (Hover)"
                      value={activeCtrl.hoverBg || 'rgba(255,255,255,0.1)'}
                      onChange={(v) => updateControlItem(selectedControlKey, { hoverBg: v })}
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-xs font-semibold mb-1">حجم الأيقونة (px)</label>
                      <input
                        type="number"
                        min={12}
                        max={36}
                        value={activeCtrl.size}
                        onChange={(e) =>
                          updateControlItem(selectedControlKey, { size: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">الشكل</label>
                      <select
                        value={activeCtrl.shape}
                        onChange={(e) =>
                          updateControlItem(selectedControlKey, { shape: e.target.value as any })
                        }
                        className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                      >
                        <option value="rounded">مستدير</option>
                        <option value="circle">دائري</option>
                        <option value="square">مربع</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">سماكة الإطار (px)</label>
                      <input
                        type="number"
                        min={0}
                        max={6}
                        value={activeCtrl.borderWidth}
                        onChange={(e) =>
                          updateControlItem(selectedControlKey, { borderWidth: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">التباعد (px)</label>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={activeCtrl.spacing}
                        onChange={(e) =>
                          updateControlItem(selectedControlKey, { spacing: Number(e.target.value) })
                        }
                        className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-neutral-700">
                        أيقونة مخصصة لهذا الزر (رابط صورة أو كود SVG)
                      </label>
                      {(settings.iconLibrary || []).length > 0 && (
                        <select
                          value=""
                          onChange={(e) => {
                            const ic = (settings.iconLibrary || []).find((x) => x.id === e.target.value);
                            if (ic) updateControlItem(selectedControlKey, { customIconUrl: ic.content });
                          }}
                          className="rounded border border-neutral-300 bg-white px-2 py-1 text-[11px]"
                        >
                          <option value="">اختيار من مكتبة الأيقونات...</option>
                          {(settings.iconLibrary || []).map((ic) => (
                            <option key={ic.id} value={ic.id}>
                              {ic.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                    <input
                      type="text"
                      dir="ltr"
                      value={activeCtrl.customIconUrl || ''}
                      onChange={(e) => updateControlItem(selectedControlKey, { customIconUrl: e.target.value })}
                      placeholder="/uploads/... أو <svg ...>...</svg>"
                      className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                </div>
              </AdminCard>

              <AdminCard title="خيارات السرعة، الجودات، القوائم، والميزات">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {SPEED_OPTIONS.map((sp) => {
                      const active = player.enabledSpeeds.includes(sp);
                      return (
                        <button
                          key={sp}
                          type="button"
                          onClick={() =>
                            setPlayer({
                              ...player,
                              enabledSpeeds: active
                                ? player.enabledSpeeds.filter((x) => x !== sp)
                                : [...player.enabledSpeeds, sp].sort((a, b) => a - b),
                            })
                          }
                          className={`px-3 py-1.5 rounded-lg border text-xs font-bold tabular-nums cursor-pointer ${
                            active
                              ? 'bg-[#B08D45] text-white border-[#B08D45]'
                              : 'bg-white text-neutral-700 border-neutral-300'
                          }`}
                        >
                          {sp}x
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap gap-5 pt-2 border-t border-neutral-100">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={player.downloadEnabled}
                        onChange={(e) => setPlayer({ ...player, downloadEnabled: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>زر التحميل</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={player.shareEnabled}
                        onChange={(e) => setPlayer({ ...player, shareEnabled: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>زر المشاركة</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={player.pipEnabled}
                        onChange={(e) => setPlayer({ ...player, pipEnabled: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>صورة داخل صورة</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={player.keyboardControls !== false}
                        onChange={(e) => setPlayer({ ...player, keyboardControls: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>اختصارات لوحة المفاتيح</span>
                    </label>
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={player.touchControls !== false}
                        onChange={(e) => setPlayer({ ...player, touchControls: e.target.checked })}
                        className="accent-[#B08D45]"
                      />
                      <span>تحكم اللمس على الجوال</span>
                    </label>
                  </div>

                  {/* Quality settings */}
                  <div className="pt-3 border-t border-neutral-100 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-neutral-800">إعدادات الجودات والتحميل</span>
                      <div className="flex items-center gap-3">
                        <label className="inline-flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                          <input
                            type="checkbox"
                            checked={player.autoQuality !== false}
                            onChange={(e) => setPlayer({ ...player, autoQuality: e.target.checked })}
                            className="accent-[#B08D45]"
                          />
                          <span>جودة تلقائية</span>
                        </label>
                        <select
                          value={player.defaultQuality || 'auto'}
                          onChange={(e) => setPlayer({ ...player, defaultQuality: e.target.value })}
                          className="rounded border border-neutral-300 bg-white px-2 py-1 text-xs"
                        >
                          <option value="auto">الافتراضي: تلقائي</option>
                          {['1080p', '720p', '480p', '360p', '240p', '144p'].map((q) => (
                            <option key={q} value={q}>
                              الافتراضي: {q}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                      <div>
                        <div className="font-semibold text-neutral-600 mb-1">إخفاء جودات من قائمة المشغل:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {['1080p', '720p', '480p', '360p', '240p', '144p'].map((q) => {
                            const disabled = (player.disabledQualities || []).includes(q);
                            return (
                              <button
                                key={q}
                                type="button"
                                onClick={() =>
                                  setPlayer({
                                    ...player,
                                    disabledQualities: disabled
                                      ? (player.disabledQualities || []).filter((x) => x !== q)
                                      : [...(player.disabledQualities || []), q],
                                  })
                                }
                                className={`px-2 py-1 rounded border font-mono cursor-pointer ${
                                  disabled
                                    ? 'bg-red-50 border-red-300 text-red-700'
                                    : 'bg-white border-neutral-300 text-neutral-700'
                                }`}
                              >
                                {disabled ? `معطلة: ${q}` : q}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                      <div>
                        <div className="font-semibold text-neutral-600 mb-1">الجودات المتاحة للتحميل (اتركه فارغاً لإتاحة الكل):</div>
                        <div className="flex flex-wrap gap-1.5">
                          {['1080p', '720p', '480p', '360p', '240p', '144p'].map((q) => {
                            const allowed = (player.downloadableQualities || []).includes(q);
                            return (
                              <button
                                key={q}
                                type="button"
                                onClick={() =>
                                  setPlayer({
                                    ...player,
                                    downloadableQualities: allowed
                                      ? (player.downloadableQualities || []).filter((x) => x !== q)
                                      : [...(player.downloadableQualities || []), q],
                                  })
                                }
                                className={`px-2 py-1 rounded border font-mono cursor-pointer ${
                                  allowed
                                    ? 'bg-[#B08D45] border-[#B08D45] text-white'
                                    : 'bg-white border-neutral-300 text-neutral-700'
                                }`}
                              >
                                {q}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Popup Menu Colors */}
                  <div className="pt-3 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <ColorField
                      label="خلفية قوائم المشغل (السرعة/الجودة/الترجمة)"
                      value={player.menuBg || 'rgba(18,18,18,0.96)'}
                      onChange={(v) => setPlayer({ ...player, menuBg: v })}
                    />
                    <ColorField
                      label="لون نص قوائم المشغل"
                      value={player.menuText || '#FFFFFF'}
                      onChange={(v) => setPlayer({ ...player, menuText: v })}
                    />
                    <ColorField
                      label="لون أيقونة الخيار النشط بالقوائم"
                      value={player.menuIconColor || '#D4AF65'}
                      onChange={(v) => setPlayer({ ...player, menuIconColor: v })}
                    />
                  </div>
                </div>
              </AdminCard>
            </div>
          </div>
        )}

        {/* Tab 2: Control Bar & Progress SeekBar */}
        {subTab === 'bar' && (
          <AdminCard title="شريط التحكم وشريط التقدم التفصيلي">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ColorField
                label="خلفية شريط التحكم"
                value={player.controlBarBackground}
                onChange={(v) => setPlayer({ ...player, controlBarBackground: v })}
              />
              <ColorField
                label="لون الأيقونات الافتراضي"
                value={player.iconColor}
                onChange={(v) => setPlayer({ ...player, iconColor: v })}
              />
              <ColorField
                label="لون التمرير على الأيقونة"
                value={player.hoverColor}
                onChange={(v) => setPlayer({ ...player, hoverColor: v })}
              />
              <ColorField
                label="لون نص الوقت"
                value={player.timeTextColor}
                onChange={(v) => setPlayer({ ...player, timeTextColor: v })}
              />
              <ColorField
                label="لون الجزء المُشغّل (Played)"
                value={player.playedColor}
                onChange={(v) => setPlayer({ ...player, playedColor: v })}
              />
              <ColorField
                label="لون خلفية شريط التمرير"
                value={player.seekBarColor}
                onChange={(v) => setPlayer({ ...player, seekBarColor: v })}
              />
              <ColorField
                label="لون التحميل المسبق (Buffered)"
                value={player.bufferedColor}
                onChange={(v) => setPlayer({ ...player, bufferedColor: v })}
              />
              <ColorField
                label="لون مقبض التمرير"
                value={player.seekBarHoverColor || '#9c932b'}
                onChange={(v) => setPlayer({ ...player, seekBarHoverColor: v })}
              />
              <div>
                <label className="block text-xs font-semibold mb-1">سماكة شريط التمرير (px)</label>
                <input
                  type="number"
                  min={2}
                  max={16}
                  value={player.seekBarThickness}
                  onChange={(e) => setPlayer({ ...player, seekBarThickness: Number(e.target.value) })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">استدارة شريط التمرير (px)</label>
                <input
                  type="number"
                  min={0}
                  max={20}
                  value={player.seekBarRadius ?? 999}
                  onChange={(e) => setPlayer({ ...player, seekBarRadius: Number(e.target.value) })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">ارتفاع شريط التحكم (px)</label>
                <input
                  type="number"
                  min={32}
                  max={90}
                  value={player.controlBarHeight}
                  onChange={(e) => setPlayer({ ...player, controlBarHeight: Number(e.target.value) })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">موضع شريط التحكم</label>
                <select
                  value={player.controlBarPosition}
                  onChange={(e) => setPlayer({ ...player, controlBarPosition: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="bottom">الأسفل</option>
                  <option value="top">الأعلى</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">حركة شريط التحكم</label>
                <select
                  value={player.controlBarAnimation || 'fade'}
                  onChange={(e) => setPlayer({ ...player, controlBarAnimation: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="fade">تلاشي سلس</option>
                  <option value="slide">انزلاق</option>
                  <option value="none">ثابت بدون حركة</option>
                </select>
              </div>
              <div className="flex flex-col justify-center gap-1.5">
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={player.showSeekThumb !== false}
                    onChange={(e) => setPlayer({ ...player, showSeekThumb: e.target.checked })}
                    className="accent-[#B08D45]"
                  />
                  <span>إظهار مؤشر الدائرة على الشريط</span>
                </label>
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={player.hoverPreviewEnabled !== false}
                    onChange={(e) => setPlayer({ ...player, hoverPreviewEnabled: e.target.checked })}
                    className="accent-[#B08D45]"
                  />
                  <span>معاينة التوقيت عند التمرير</span>
                </label>
              </div>
            </div>
          </AdminCard>
        )}

        {/* Tab 3: Container Design */}
        {subTab === 'container' && (
          <AdminCard title="تصميم حاوية المشغل وإطاره وخلفيته">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <ColorField
                label="خلفية حاوية المشغل"
                value={player.background}
                onChange={(v) => setPlayer({ ...player, background: v })}
              />
              <ColorField
                label="لون إطار المشغل"
                value={player.borderColor}
                onChange={(v) => setPlayer({ ...player, borderColor: v })}
              />
              <div>
                <label className="block text-xs font-semibold mb-1">سماكة الإطار (px)</label>
                <input
                  type="number"
                  min={0}
                  max={16}
                  value={player.borderWidth}
                  onChange={(e) => setPlayer({ ...player, borderWidth: Number(e.target.value) })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">استدارة الحواف (px)</label>
                <input
                  type="number"
                  min={0}
                  max={40}
                  value={player.borderRadius}
                  onChange={(e) => setPlayer({ ...player, borderRadius: Number(e.target.value) })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">نسبة العرض</label>
                <select
                  value={player.aspectRatio}
                  onChange={(e) => setPlayer({ ...player, aspectRatio: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="16/9">16:9</option>
                  <option value="4/3">4:3</option>
                  <option value="21/9">21:9</option>
                  <option value="auto">تلقائي</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">الحشوة الداخلية (Padding px)</label>
                <input
                  type="number"
                  min={0}
                  max={48}
                  value={player.padding || 0}
                  onChange={(e) => setPlayer({ ...player, padding: Number(e.target.value) })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">زخرفة خلفية الحاوية</label>
                <select
                  value={player.backgroundPattern || 'none'}
                  onChange={(e) => setPlayer({ ...player, backgroundPattern: e.target.value as any })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="none">بدون زخرفة</option>
                  <option value="islamic-star">نجمة هندسية</option>
                  <option value="geometric-grid">شبكة هندسية</option>
                  <option value="arabesque-mesh">أرابيسك</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">رابط صورة خلفية الحاوية</label>
                <input
                  type="text"
                  dir="ltr"
                  value={player.backgroundImage || ''}
                  onChange={(e) => setPlayer({ ...player, backgroundImage: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
            </div>
          </AdminCard>
        )}

        {/* Tab 4: External Play Button Full Editor */}
        {subTab === 'external' && (
          <AdminCard title="التحكم الكامل بزر التشغيل الخارجي على البطاقات والبوستر">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              <div className="lg:col-span-5">
                <div
                  className={`relative aspect-video rounded-xl overflow-hidden bg-neutral-900 flex p-4 ${
                    ext.position === 'bottom-right'
                      ? 'items-end justify-start'
                      : ext.position === 'bottom-left'
                        ? 'items-end justify-end'
                        : 'items-center justify-center'
                  }`}
                >
                  {sampleThumbs[0]?.url && (
                    <img
                      src={sampleThumbs[0].url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover opacity-80"
                    />
                  )}
                  {ext.visible !== false && (
                    <div
                      className="relative z-10 flex items-center justify-center transition-all"
                      style={{
                        width: `${ext.circleSize}px`,
                        height: `${ext.circleSize}px`,
                        backgroundColor: ext.circleBackground,
                        opacity: ext.circleOpacity,
                        borderRadius:
                          ext.shape === 'square' ? '0px' : ext.shape === 'rounded' ? '12px' : '9999px',
                        border: `${ext.borderWidth}px solid ${ext.borderColor}`,
                        boxShadow: ext.glow ? `0 0 22px ${ext.glowColor}` : ext.shadow,
                      }}
                    >
                      {renderExtPreviewIcon()}
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-7 space-y-4">
                <div className="flex flex-wrap gap-5">
                  <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ext.visible !== false}
                      onChange={(e) =>
                        setPlayer({
                          ...player,
                          externalPlayButton: { ...ext, visible: e.target.checked },
                        })
                      }
                      className="accent-[#B08D45]"
                    />
                    <span>إظهار زر التشغيل الخارجي (قم بإلغائه لإخفاء الزر تماماً)</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ext.showOnDesktop !== false}
                      onChange={(e) =>
                        setPlayer({
                          ...player,
                          externalPlayButton: { ...ext, showOnDesktop: e.target.checked },
                        })
                      }
                      className="accent-[#B08D45]"
                    />
                    <span>سطح المكتب</span>
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={ext.showOnMobile !== false}
                      onChange={(e) =>
                        setPlayer({
                          ...player,
                          externalPlayButton: { ...ext, showOnMobile: e.target.checked },
                        })
                      }
                      className="accent-[#B08D45]"
                    />
                    <span>الجوال</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <ColorField
                    label="لون أيقونة التشغيل"
                    value={ext.iconColor}
                    onChange={(v) =>
                      setPlayer({ ...player, externalPlayButton: { ...ext, iconColor: v } })
                    }
                  />
                  <ColorField
                    label="خلفية الزر"
                    value={ext.circleBackground}
                    onChange={(v) =>
                      setPlayer({ ...player, externalPlayButton: { ...ext, circleBackground: v } })
                    }
                  />
                  <ColorField
                    label="لون الإطار"
                    value={ext.borderColor}
                    onChange={(v) =>
                      setPlayer({ ...player, externalPlayButton: { ...ext, borderColor: v } })
                    }
                  />
                  <div>
                    <label className="block text-xs font-semibold mb-1">نمط الأيقونة</label>
                    <select
                      value={ext.icon}
                      onChange={(e) =>
                        setPlayer({
                          ...player,
                          externalPlayButton: { ...ext, icon: e.target.value as any },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="play">تشغيل كلاسيكي</option>
                      <option value="play-circle">دائرة</option>
                      <option value="triangle">مثلث</option>
                      <option value="film">أيقونة فيلم</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">حجم الدائرة (px)</label>
                    <input
                      type="number"
                      min={32}
                      max={110}
                      value={ext.circleSize}
                      onChange={(e) =>
                        setPlayer({
                          ...player,
                          externalPlayButton: { ...ext, circleSize: Number(e.target.value) },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">حجم الأيقونة (px)</label>
                    <input
                      type="number"
                      min={14}
                      max={54}
                      value={ext.iconSize}
                      onChange={(e) =>
                        setPlayer({
                          ...player,
                          externalPlayButton: { ...ext, iconSize: Number(e.target.value) },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">الشكل</label>
                    <select
                      value={ext.shape}
                      onChange={(e) =>
                        setPlayer({
                          ...player,
                          externalPlayButton: { ...ext, shape: e.target.value as any },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="circle">دائري</option>
                      <option value="rounded">مستدير</option>
                      <option value="square">مربع</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">الموضع</label>
                    <select
                      value={ext.position}
                      onChange={(e) =>
                        setPlayer({
                          ...player,
                          externalPlayButton: { ...ext, position: e.target.value as any },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="center">المنتصف</option>
                      <option value="bottom-right">أسفل اليمين</option>
                      <option value="bottom-left">أسفل اليسار</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">معاينة التمرير بالماوس</label>
                    <select
                      value={ext.hoverPreviewMode}
                      onChange={(e) =>
                        setPlayer({
                          ...player,
                          externalPlayButton: { ...ext, hoverPreviewMode: e.target.value as any },
                        })
                      }
                      className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="muted">تشغيل معاينة صامتة (Muted)</option>
                      <option value="none">بدون معاينة</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-1">الظل (Shadow CSS)</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={ext.shadow || ''}
                      onChange={(e) =>
                        setPlayer({
                          ...player,
                          externalPlayButton: { ...ext, shadow: e.target.value },
                        })
                      }
                      placeholder="0 10px 30px rgba(0,0,0,0.45)"
                      className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
                    />
                  </div>
                  <div className="flex items-end pb-1.5">
                    <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(ext.glow)}
                        onChange={(e) =>
                          setPlayer({
                            ...player,
                            externalPlayButton: { ...ext, glow: e.target.checked },
                          })
                        }
                        className="accent-[#B08D45]"
                      />
                      <span>توهج مضيء للزر (Glow)</span>
                    </label>
                  </div>
                  <ColorField
                    label="لون التوهج (Glow Color)"
                    value={ext.glowColor || '#B08D45'}
                    onChange={(v) =>
                      setPlayer({ ...player, externalPlayButton: { ...ext, glowColor: v } })
                    }
                  />
                </div>

                <div className="p-3 rounded-xl border border-neutral-200 bg-neutral-50 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="text-xs font-semibold text-neutral-700">
                      أيقونة تشغيل خارجي مخصصة (SVG أو رابط صورة — يتجاوز النمط المختار)
                    </label>
                    {(settings.iconLibrary || []).length > 0 && (
                      <select
                        value=""
                        onChange={(e) => {
                          const ic = (settings.iconLibrary || []).find((x) => x.id === e.target.value);
                          if (ic) {
                            setPlayer({
                              ...player,
                              externalPlayButton: { ...ext, customIconUrl: ic.content },
                            });
                          }
                        }}
                        className="rounded border border-neutral-300 bg-white px-2 py-1 text-[11px]"
                      >
                        <option value="">اختيار من مكتبة الأيقونات...</option>
                        {(settings.iconLibrary || []).map((ic) => (
                          <option key={ic.id} value={ic.id}>
                            {ic.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <input
                    type="text"
                    dir="ltr"
                    value={ext.customIconUrl || ''}
                    onChange={(e) =>
                      setPlayer({
                        ...player,
                        externalPlayButton: { ...ext, customIconUrl: e.target.value },
                      })
                    }
                    placeholder="/uploads/... أو <svg ...>...</svg>"
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-mono"
                  />
                </div>
              </div>
            </div>
          </AdminCard>
        )}
      </div>
    </div>
  );
}
