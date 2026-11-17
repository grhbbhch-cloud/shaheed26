import React from 'react';
import { History, RotateCcw, Save, X } from 'lucide-react';
import type { GradientConfig, TextStyleConfig } from '../../types/platform';

export function AdminPanelHeader({
  title,
  subtitle,
  onSave,
  onCancel,
  onRevertPrevious,
  onReset,
  hasUnsavedChanges = false,
  hasPreviousSnapshot = false,
  saving = false,
  actions,
}: {
  title: string;
  subtitle?: string;
  onSave?: () => void;
  onCancel?: () => void;
  onRevertPrevious?: () => void;
  onReset?: () => void;
  hasUnsavedChanges?: boolean;
  hasPreviousSnapshot?: boolean;
  saving?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-neutral-200 mb-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-extrabold text-neutral-900">{title}</h2>
          {hasUnsavedChanges && (
            <span className="px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold">
              تغييرات غير محفوظة (معاينة فقط)
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {actions}
        {onCancel && (
          <button
            type="button"
            disabled={!hasUnsavedChanges && saving}
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 cursor-pointer"
          >
            <X size={14} />
            <span>إلغاء التعديلات</span>
          </button>
        )}
        {onRevertPrevious && hasPreviousSnapshot && (
          <button
            type="button"
            onClick={onRevertPrevious}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-xs font-semibold text-amber-900 hover:bg-amber-100 cursor-pointer"
          >
            <History size={14} />
            <span>استعادة القيمة السابقة</span>
          </button>
        )}
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-neutral-300 bg-white text-xs font-semibold text-neutral-700 hover:bg-neutral-50 cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>استعادة الافتراضي</span>
          </button>
        )}
        {onSave && (
          <button
            type="button"
            disabled={saving}
            onClick={onSave}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#B08D45] text-white text-xs font-bold hover:bg-[#8C6A2F] disabled:opacity-60 cursor-pointer"
          >
            <Save size={14} />
            <span>{saving ? 'جاري الحفظ...' : 'حفظ وتطبيق التغييرات'}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function AdminCard({
  title,
  subtitle,
  children,
  className = '',
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border border-neutral-200 p-5 ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4 pb-3 border-b border-neutral-100">
          {title && <h3 className="text-sm font-bold text-neutral-900">{title}</h3>}
          {subtitle && <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
}) {
  const pickerVal = /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#B08D45';
  return (
    <div>
      <label className="block text-xs font-semibold text-neutral-700 mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerVal}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 rounded border border-neutral-300 p-0.5 bg-white cursor-pointer shrink-0"
        />
        <input
          type="text"
          dir="ltr"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#B08D45 أو rgba(...)"
          className="flex-1 rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono bg-white text-neutral-800"
        />
      </div>
    </div>
  );
}

const PRESET_COLOR_STOPS: Array<{ label: string; stops: string[] }> = [
  { label: 'ذهبي أرشيف الشهيد', stops: ['#B08D45', '#D4AF65', '#8C6A2F', '#F7F4EC'] },
  { label: 'طيف ذهبي ملكي', stops: ['#8C6A2F', '#D4AF65', '#FDE047', '#B08D45'] },
  { label: 'وهج ذهبي وعاجي', stops: ['#F7F4EC', '#D4AF65', '#B08D45', '#9c932b'] },
  { label: 'تباين داكن وذهبي', stops: ['#D4AF65', '#FFFFFF', '#B08D45', '#8C6A2F'] },
];

const EXTRA_STOP_COLORS = ['#B08D45', '#D4AF65', '#8C6A2F', '#9c932b', '#F59E0B', '#F7F4EC'];

export function GradientEditor({
  value,
  onChange,
  title = 'إعدادات التدرج اللوني والحركة',
  previewText,
}: {
  value: GradientConfig;
  onChange: (next: GradientConfig) => void;
  title?: string;
  previewText?: string;
}) {
  const stops = value.stops && value.stops.length > 0 ? value.stops : ['#B08D45', '#D4AF65'];
  const updateStop = (idx: number, col: string) => {
    const next = [...stops];
    next[idx] = col;
    onChange({ ...value, stops: next });
  };
  const removeStop = (idx: number) => {
    if (stops.length <= 2) return;
    onChange({ ...value, stops: stops.filter((_, i) => i !== idx) });
  };

  const previewStops = stops.length === 1 ? [stops[0], stops[0]] : stops;
  const previewCss = !value.enabled
    ? ''
    : value.type === 'conic'
      ? `conic-gradient(from var(--alharbi-angle, ${value.angle ?? 0}deg) at ${value.position || 'center'}, ${
          value.animated ? [...previewStops, previewStops[0]].join(', ') : previewStops.join(', ')
        })`
      : value.type === 'radial'
        ? `radial-gradient(circle at ${value.position || 'center'}, ${previewStops.join(', ')})`
        : `linear-gradient(${value.angle ?? 135}deg, ${previewStops.join(', ')})`;

  const previewSpeed = Math.max(0.5, Number(value.animationSpeed || 5));
  const previewTiming = value.timingFunction || 'ease-in-out';
  const previewDir = value.animationDirection || 'normal';
  const previewIter = value.loop === false ? '1' : 'infinite';
  const previewScale = Math.max(150, Math.min(500, Number(value.spreadPercent || 260)));
  const previewAnimName =
    value.type === 'conic'
      ? 'alharbiConicSpin'
      : previewDir === 'alternate' || previewDir === 'alternate-reverse'
        ? 'alharbiGradientPingPong'
        : 'alharbiGradientShift';

  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-neutral-800">{title}</span>
        <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value.enabled)}
            onChange={(e) => onChange({ ...value, enabled: e.target.checked })}
            className="accent-[#B08D45]"
          />
          <span>تفعيل التدرج والألوان المتعددة</span>
        </label>
      </div>

      {value.enabled && (
        <div className="space-y-4 pt-2 border-t border-neutral-200">
          {/* Live animated text & gradient strip preview */}
          <div className="rounded-lg bg-neutral-900 p-3 text-center overflow-hidden">
            <div
              className="text-base font-extrabold tracking-wide"
              style={{
                backgroundImage: previewCss,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                WebkitTextFillColor: 'transparent',
                opacity: value.opacity ?? 1,
                filter:
                  value.intensity !== undefined && Number(value.intensity) !== 1
                    ? `saturate(${Math.max(0.5, Math.min(2, Number(value.intensity)))})`
                    : undefined,
                backgroundSize: value.animated
                  ? value.type === 'conic'
                    ? '180% 180%'
                    : `${previewScale}% ${previewScale}%`
                  : undefined,
                animation: value.animated
                  ? `${previewAnimName} ${previewSpeed}s ${previewTiming} ${previewIter} ${previewDir}`
                  : undefined,
                animationPlayState: value.animationPaused ? 'paused' : 'running',
                transition: `background-position ${value.transitionSpeedMs ?? 450}ms ease, opacity ${value.transitionSpeedMs ?? 450}ms ease`,
              }}
            >
              {previewText?.trim() || 'أرشيف الشهيد — معاينة تدرج وحركة الألوان على العنوان'}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 mb-1">نمط التدرج</label>
              <select
                value={value.type || 'linear'}
                onChange={(e) => onChange({ ...value, type: e.target.value as any })}
                className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs"
              >
                <option value="linear">خطي (Linear)</option>
                <option value="radial">دائري (Radial)</option>
                <option value="conic">مخروطي دوّار (Conic)</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 mb-1">الزاوية (درجة)</label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={value.angle ?? 135}
                  onChange={(e) => onChange({ ...value, angle: Number(e.target.value) })}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs tabular-nums"
                />
                <select
                  aria-label="زوايا سريعة"
                  value={[0, 45, 90, 135, 180, 270].includes(Number(value.angle)) ? String(value.angle) : ''}
                  onChange={(e) => {
                    if (e.target.value !== '') onChange({ ...value, angle: Number(e.target.value) });
                  }}
                  className="rounded-lg border border-neutral-300 bg-white px-1.5 py-1.5 text-[11px]"
                >
                  <option value="">سريع</option>
                  <option value="90">أفقي 90°</option>
                  <option value="180">عمودي 180°</option>
                  <option value="135">قطري 135°</option>
                  <option value="45">مائل 45°</option>
                  <option value="270">معكوس 270°</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 mb-1">الشفافية</label>
              <input
                type="number"
                min={0.1}
                max={1}
                step={0.05}
                value={value.opacity ?? 1}
                onChange={(e) => onChange({ ...value, opacity: Number(e.target.value) })}
                className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                حدة اللون ({Math.round((value.intensity ?? 1) * 100)}%)
              </label>
              <input
                type="range"
                min={0.6}
                max={2}
                step={0.05}
                value={value.intensity ?? 1}
                onChange={(e) => onChange({ ...value, intensity: Number(e.target.value) })}
                className="w-full accent-[#B08D45] mt-2"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-neutral-600 mb-1">الموضع</label>
              <select
                value={value.position || 'center'}
                onChange={(e) => onChange({ ...value, position: e.target.value })}
                className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs"
              >
                <option value="center">الوسط (center)</option>
                <option value="top">الأعلى (top)</option>
                <option value="bottom">الأسفل (bottom)</option>
                <option value="right">اليمين (right)</option>
                <option value="left">اليسار (left)</option>
                <option value="top right">أعلى اليمين</option>
                <option value="bottom left">أسفل اليسار</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-neutral-600">
                ألوان التدرج المتعددة ({stops.length} ألوان)
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_COLOR_STOPS.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => onChange({ ...value, stops: [...preset.stops] })}
                    className="px-2 py-0.5 rounded border border-neutral-300 bg-white text-[10px] font-semibold text-neutral-700 hover:border-[#B08D45] cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...value,
                      stops: [...stops, EXTRA_STOP_COLORS[stops.length % EXTRA_STOP_COLORS.length]],
                    })
                  }
                  className="px-2 py-0.5 rounded bg-[#B08D45] text-white text-[11px] font-bold hover:bg-[#8C6A2F] cursor-pointer"
                >
                  + إضافة لون
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {stops.map((st, idx) => (
                <div key={idx} className="relative rounded-lg border border-neutral-200 bg-white p-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-neutral-700">لون {idx + 1}</span>
                    {stops.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeStop(idx)}
                        className="text-[10px] font-bold text-red-600 hover:underline cursor-pointer"
                      >
                        حذف
                      </button>
                    )}
                  </div>
                  <ColorField
                    label=""
                    value={st}
                    onChange={(c) => updateStop(idx, c)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-3 border-t border-neutral-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer text-neutral-800">
                <input
                  type="checkbox"
                  checked={Boolean(value.animated)}
                  onChange={(e) => onChange({ ...value, animated: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>تحريك ألوان العنوان تلقائياً</span>
              </label>

              <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer text-neutral-700">
                <input
                  type="checkbox"
                  checked={value.loop !== false}
                  onChange={(e) => onChange({ ...value, loop: e.target.checked })}
                  className="accent-[#B08D45]"
                />
                <span>تكرار لا نهائي (Loop)</span>
              </label>

              {value.animated && (
                <label className="inline-flex items-center gap-2 text-xs font-semibold cursor-pointer text-neutral-700">
                  <input
                    type="checkbox"
                    checked={Boolean(value.animationPaused)}
                    onChange={(e) => onChange({ ...value, animationPaused: e.target.checked })}
                    className="accent-[#B08D45]"
                  />
                  <span>إيقاف الحركة مؤقتاً (Pause)</span>
                </label>
              )}
            </div>

            {value.animated && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-neutral-200">
                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    اتجاه الحركة
                  </label>
                  <select
                    value={value.animationDirection || 'normal'}
                    onChange={(e) => onChange({ ...value, animationDirection: e.target.value as any })}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs"
                  >
                    <option value="normal">للأمام (Normal)</option>
                    <option value="reverse">عكسي (Reverse)</option>
                    <option value="alternate">متناوب ذهاب وعودة (Alternate)</option>
                    <option value="alternate-reverse">متناوب معكوس (Alternate Reverse)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    سرعة الحركة: {value.animationSpeed ?? 6} ثانية
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min={0.5}
                      max={20}
                      step={0.5}
                      value={value.animationSpeed ?? 6}
                      onChange={(e) => onChange({ ...value, animationSpeed: Number(e.target.value) })}
                      className="flex-1 accent-[#B08D45]"
                    />
                    <input
                      type="number"
                      min={0.5}
                      max={60}
                      step={0.5}
                      value={value.animationSpeed ?? 6}
                      onChange={(e) => onChange({ ...value, animationSpeed: Math.max(0.5, Number(e.target.value)) })}
                      className="w-16 rounded border border-neutral-300 bg-white px-1.5 py-1 text-xs tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    نعومة الانتقال (Transition)
                  </label>
                  <select
                    value={value.timingFunction || 'ease-in-out'}
                    onChange={(e) => onChange({ ...value, timingFunction: e.target.value as any })}
                    className="w-full rounded-lg border border-neutral-300 bg-white px-2 py-1.5 text-xs"
                  >
                    <option value="ease-in-out">انسيابي ناعم جداً (Ease In-Out)</option>
                    <option value="ease">ناعم طبيعي (Ease)</option>
                    <option value="linear">متواصل بسرعة ثابتة (Linear)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-neutral-600 mb-1">
                    امتداد التدرج ({value.spreadPercent ?? 260}%)
                  </label>
                  <input
                    type="range"
                    min={160}
                    max={450}
                    step={10}
                    value={value.spreadPercent ?? 260}
                    onChange={(e) => onChange({ ...value, spreadPercent: Number(e.target.value) })}
                    className="w-full accent-[#B08D45] mt-1.5"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function TextStyleEditor({
  value,
  onChange,
  availableFonts,
}: {
  value: TextStyleConfig;
  onChange: (next: TextStyleConfig) => void;
  availableFonts: string[];
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">نوع الخط</label>
          <select
            value={value.fontFamily}
            onChange={(e) => onChange({ ...value, fontFamily: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
          >
            {availableFonts.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">السماكة (Weight)</label>
          <select
            value={value.fontWeight}
            onChange={(e) => onChange({ ...value, fontWeight: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
          >
            <option value="300">خفيف (300)</option>
            <option value="400">عادي (400)</option>
            <option value="500">متوسط (500)</option>
            <option value="600">شبه عريض (600)</option>
            <option value="700">عريض (700)</option>
            <option value="800">عريض جداً (800)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">المحاذاة</label>
          <select
            value={value.textAlign}
            onChange={(e) => onChange({ ...value, textAlign: e.target.value as any })}
            className="w-full rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs"
          >
            <option value="right">يمين</option>
            <option value="center">وسط</option>
            <option value="left">يسار</option>
            <option value="justify">ضبط</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">حجم سطح المكتب</label>
          <input
            type="text"
            dir="ltr"
            value={value.fontSizeDesktop}
            onChange={(e) => onChange({ ...value, fontSizeDesktop: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">حجم اللوحي</label>
          <input
            type="text"
            dir="ltr"
            value={value.fontSizeTablet}
            onChange={(e) => onChange({ ...value, fontSizeTablet: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">حجم الجوال</label>
          <input
            type="text"
            dir="ltr"
            value={value.fontSizeMobile}
            onChange={(e) => onChange({ ...value, fontSizeMobile: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">ارتفاع السطر</label>
          <input
            type="text"
            dir="ltr"
            value={value.lineHeight}
            onChange={(e) => onChange({ ...value, lineHeight: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">تباعد الأحرف</label>
          <input
            type="text"
            dir="ltr"
            value={value.letterSpacing}
            onChange={(e) => onChange({ ...value, letterSpacing: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <ColorField
          label="لون النص"
          value={value.color}
          onChange={(c) => onChange({ ...value, color: c })}
        />
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">ظل النص (Shadow)</label>
          <input
            type="text"
            dir="ltr"
            value={value.textShadow}
            onChange={(e) => onChange({ ...value, textShadow: e.target.value })}
            placeholder="none أو 0 2px 6px rgba(0,0,0,0.4)"
            className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">الشفافية</label>
          <input
            type="number"
            min={0.1}
            max={1}
            step={0.05}
            value={value.opacity ?? 1}
            onChange={(e) => onChange({ ...value, opacity: Number(e.target.value) })}
            className="w-full rounded-lg border border-neutral-300 px-2.5 py-1.5 text-xs tabular-nums"
          />
        </div>
      </div>

      <GradientEditor
        value={value.gradient}
        onChange={(g) => onChange({ ...value, gradient: g })}
        title="تدرج وألوان النص المتحركة"
      />
    </div>
  );
}
