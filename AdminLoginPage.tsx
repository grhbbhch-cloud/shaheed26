import React, { useState } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck, User } from 'lucide-react';
import { GeometricPattern } from '../../components/GeometricPattern';
import { useAdmin } from '../../context/AdminContext';
import { usePlatform } from '../../context/PlatformContext';
import { buildGradientBoxStyle } from '../../lib/styleEngine';

export function AdminLoginPage() {
  const { settings } = usePlatform();
  const { checkAuth } = useAdmin();
  const [loginMode, setLoginMode] = useState<'owner' | 'subadmin'>('owner');
  const [code1, setCode1] = useState('');
  const [code2, setCode2] = useState('');
  const [username, setUsername] = useState('');
  const [passcode, setPasscode] = useState('');
  const [show1, setShow1] = useState(false);
  const [show2, setShow2] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loginTheme = settings?.loginTheme;
  const gradStyle = loginTheme?.gradient?.enabled ? buildGradientBoxStyle(loginTheme.gradient) : {};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (loginMode === 'owner') {
      if (!code1.trim() || !code2.trim()) {
        setError('يرجى إدخال رمزي الدخول معاً.');
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ code1, code2 }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.authenticated) {
          setError(data.error || 'فشل التحقق من رمزي الدخول.');
          return;
        }
        await checkAuth();
      } catch {
        setError('تعذر الاتصال بخادم التحقق.');
      } finally {
        setSubmitting(false);
      }
    } else {
      if (!username.trim() || !passcode) {
        setError('يرجى إدخال اسم المستخدم ورمز الدخول.');
        return;
      }
      setSubmitting(true);
      try {
        const res = await fetch('/api/auth/subadmin-login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ username: username.trim(), passcode }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.authenticated) {
          setError(data.error || 'بيانات الدخول غير صحيحة.');
          return;
        }
        await checkAuth();
      } catch {
        setError('تعذر الاتصال بخادم التحقق.');
      } finally {
        setSubmitting(false);
      }
    }
  };

  const posClass =
    loginTheme?.cardPosition === 'right'
      ? 'justify-start'
      : loginTheme?.cardPosition === 'left'
        ? 'justify-end'
        : 'justify-center';

  return (
    <div
      className={`relative min-h-screen flex items-center ${posClass} p-4 sm:p-8 overflow-hidden`}
      style={{
        backgroundColor: loginTheme?.bgColor || '#080808',
        fontFamily: loginTheme?.fontFamily ? `'${loginTheme.fontFamily}', 'Cairo', sans-serif` : undefined,
        ...gradStyle,
      }}
    >
      {loginTheme?.bgImageUrl && (
        <img
          src={loginTheme.bgImageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover opacity-30"
        />
      )}
      <GeometricPattern config={settings?.decorations?.hero} />

      <div
        className="relative z-10 w-full p-6 sm:p-8 transition-all"
        style={{
          maxWidth: `${loginTheme?.cardWidth || 440}px`,
          backgroundColor: loginTheme?.cardBg || '#FFFFFF',
          border: `1px solid ${loginTheme?.cardBorder || '#D8D8D8'}`,
          borderRadius: `${loginTheme?.cardRadius ?? 16}px`,
          boxShadow: loginTheme?.cardShadow || '0 24px 64px rgba(0,0,0,0.45)',
        }}
      >
        <div className="flex flex-col items-center text-center mb-5">
          {loginTheme?.showLogo !== false &&
            (loginTheme?.logoUrl ? (
              <img src={loginTheme.logoUrl} alt="" className="h-12 w-12 object-contain mb-3" />
            ) : (
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center mb-3 text-white"
                style={{ backgroundColor: loginTheme?.buttonBg || '#B08D45' }}
              >
                <ShieldCheck size={24} />
              </div>
            ))}
          <h1 className="text-xl font-extrabold text-neutral-900">
            {loginTheme?.title || (settings?.identity?.siteName ? `${settings.identity.siteName} — بوابة الإدارة` : 'بوابة الإدارة')}
          </h1>
          <p className="text-xs text-neutral-500 mt-1">
            {loginTheme?.subtitle || 'تسجيل الدخول المزدوج للمالك الرئيسي'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-neutral-100 mb-5 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setLoginMode('owner');
              setError('');
            }}
            className={`py-1.5 rounded-lg cursor-pointer transition-colors ${
              loginMode === 'owner'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            دخول المالك الرئيسي
          </button>
          <button
            type="button"
            onClick={() => {
              setLoginMode('subadmin');
              setError('');
            }}
            className={`py-1.5 rounded-lg cursor-pointer transition-colors ${
              loginMode === 'subadmin'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-500 hover:text-neutral-800'
            }`}
          >
            حساب محرر / مشرف فرعي
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {loginMode === 'owner' ? (
            <>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  رمز الدخول الأول
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
                  />
                  <input
                    type={show1 ? 'text' : 'password'}
                    value={code1}
                    onChange={(e) => setCode1(e.target.value)}
                    autoComplete="off"
                    placeholder="أدخل الرمز الأول"
                    className="w-full pr-9 pl-10 py-2.5 rounded-lg border text-sm outline-hidden focus:ring-2 focus:ring-[#B08D45]/30"
                    style={{
                      backgroundColor: loginTheme?.inputBg || '#F9FAFB',
                      color: loginTheme?.inputText || '#171717',
                      borderColor: loginTheme?.inputBorder || '#D8D8D8',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShow1((v) => !v)}
                    aria-label={show1 ? 'إخفاء الرمز الأول' : 'إظهار الرمز الأول'}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 p-1 cursor-pointer"
                  >
                    {show1 ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  رمز الدخول الثاني
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
                  />
                  <input
                    type={show2 ? 'text' : 'password'}
                    value={code2}
                    onChange={(e) => setCode2(e.target.value)}
                    autoComplete="off"
                    placeholder="أدخل الرمز الثاني"
                    className="w-full pr-9 pl-10 py-2.5 rounded-lg border text-sm outline-hidden focus:ring-2 focus:ring-[#B08D45]/30"
                    style={{
                      backgroundColor: loginTheme?.inputBg || '#F9FAFB',
                      color: loginTheme?.inputText || '#171717',
                      borderColor: loginTheme?.inputBorder || '#D8D8D8',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShow2((v) => !v)}
                    aria-label={show2 ? 'إخفاء الرمز الثاني' : 'إظهار الرمز الثاني'}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 p-1 cursor-pointer"
                  >
                    {show2 ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  اسم المستخدم
                </label>
                <div className="relative">
                  <User
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
                  />
                  <input
                    type="text"
                    dir="ltr"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    placeholder="username"
                    className="w-full pr-9 pl-3 py-2.5 rounded-lg border text-sm font-mono outline-hidden focus:ring-2 focus:ring-[#B08D45]/30"
                    style={{
                      backgroundColor: loginTheme?.inputBg || '#F9FAFB',
                      color: loginTheme?.inputText || '#171717',
                      borderColor: loginTheme?.inputBorder || '#D8D8D8',
                    }}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  رمز الدخول الخاص بالحساب
                </label>
                <div className="relative">
                  <Lock
                    size={16}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400"
                  />
                  <input
                    type={show1 ? 'text' : 'password'}
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    autoComplete="current-password"
                    placeholder="أدخل رمز الدخول"
                    className="w-full pr-9 pl-10 py-2.5 rounded-lg border text-sm outline-hidden focus:ring-2 focus:ring-[#B08D45]/30"
                    style={{
                      backgroundColor: loginTheme?.inputBg || '#F9FAFB',
                      color: loginTheme?.inputText || '#171717',
                      borderColor: loginTheme?.inputBorder || '#D8D8D8',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShow1((v) => !v)}
                    aria-label={show1 ? 'إخفاء رمز الدخول' : 'إظهار رمز الدخول'}
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-800 p-1 cursor-pointer"
                  >
                    {show1 ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}

          {error && (
            <div
              role="alert"
              className="rounded-lg px-3 py-2 text-xs font-semibold border"
              style={{
                color: loginTheme?.errorColor || '#DC2626',
                backgroundColor: '#FEF2F2',
                borderColor: '#FECACA',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className={`w-full py-2.5 px-4 text-sm font-bold transition-all cursor-pointer disabled:opacity-60 ${
              loginTheme?.hoverEffect === 'lift' ? 'hover:-translate-y-0.5' : ''
            }`}
            style={{
              backgroundColor: loginTheme?.buttonBg || '#B08D45',
              color: loginTheme?.buttonText || '#FFFFFF',
              borderRadius: `${loginTheme?.buttonRadius ?? 10}px`,
            }}
          >
            {submitting ? 'جاري التحقق والدخول...' : 'دخول إلى لوحة الإدارة'}
          </button>
        </form>
      </div>
    </div>
  );
}
