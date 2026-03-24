'use client';
import Link from 'next/link';
import { useState } from 'react';
import {
  Eye, EyeOff, CheckCircle2, Globe, BookOpen, Map, Heart,
  AlertCircle, Loader2, ArrowRight, ChevronRight
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import { getApiUrl } from '@/lib/api/apiUrl';

// ── Types ────────────────────────────────────────────────────────────────────
type FormState = 'idle' | 'loading' | 'success' | 'error';

interface FieldErrors {
  username?: string;
  email?: string;
  password?: string;
  terms?: string;
}

// ── Password strength (uses translations) ────────────────────────────────────
function usePasswordStrength(pw: string) {
  const { t } = useT();
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map = [
    { label: '', color: 'bg-slate-700' },
    { label: t.join_pw_weak,   color: 'bg-red-500' },
    { label: t.join_pw_fair,   color: 'bg-amber-500' },
    { label: t.join_pw_good,   color: 'bg-blue-500' },
    { label: t.join_pw_strong, color: 'bg-emerald-500' },
  ];
  return { score, ...map[score] };
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function JoinPage() {
  const { t } = useT();
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [terms, setTerms] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formState, setFormState] = useState<FormState>('idle');
  const [serverError, setServerError] = useState('');
  const [successData, setSuccessData] = useState<{ username: string } | null>(null);

  const strength = usePasswordStrength(password);

  const handleBlur = (field: string) =>
    setTouched(prev => ({ ...prev, [field]: true }));

  const validate = (u: string, e: string, pw: string, tc: boolean): FieldErrors => {
    const errs: FieldErrors = {};
    if (!u || u.length < 3) errs.username = t.join_err_username;
    else if (!/^[a-zA-Z0-9-]+$/.test(u)) errs.username = t.join_err_username2;
    if (!e || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) errs.email = t.join_err_email;
    if (!pw || pw.length < 8) errs.password = t.join_err_pw;
    else if (!/[0-9]/.test(pw)) errs.password = t.join_err_pw2;
    if (!tc) errs.terms = t.join_err_terms;
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ username: true, email: true, password: true, terms: true });

    const errs = validate(username, email, password, terms);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setFormState('loading');
    setServerError('');

    try {
      const API_URL = getApiUrl();
      const res = await fetch(`${API_URL}/api/v1/auth/register-human`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username }),
      });
      const data = await res.json();

      if (!res.ok) {
        setServerError(data.detail || t.join_err_server);
        setFormState('error');
        return;
      }

      setSuccessData({ username: data.user?.username || username });
      setFormState('success');
    } catch {
      setServerError(t.join_err_network);
      setFormState('error');
    }
  };

  // ── Success State ──────────────────────────────────────────────────────────
  if (formState === 'success' && successData) {
    const successTitle = t.join_success_title.replace('{name}', successData.username);
    return (
      <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="max-w-lg w-full text-center">
          <div className="w-20 h-20 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-3xl font-black text-white mb-2">
            {successTitle}
          </h2>
          <p className="text-slate-400 mb-10">
            {t.join_success_sub}
          </p>

          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 text-left mb-6 space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
              {t.join_next_steps}
            </p>
            {[
              { icon: Globe,    label: t.join_link_world,  href: '/world' },
              { icon: BookOpen, label: t.join_link_social, href: '/social' },
              { icon: Map,      label: t.join_link_myth,   href: '/social#mythology' },
            ].map(({ icon: Icon, label, href }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl transition-colors group"
              >
                <div className="flex items-center gap-3 text-slate-300 text-sm font-medium">
                  <Icon className="w-4 h-4 text-slate-500" />
                  {label}
                </div>
                <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors" />
              </Link>
            ))}
          </div>

          <Link
            href="/world"
            className="flex items-center justify-center gap-2 w-full py-4 bg-white text-slate-950 rounded-2xl font-black transition-all hover:scale-[1.02]"
          >
            {t.join_enter_world}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </main>
    );
  }

  // ── Form ───────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-5xl mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-5 gap-12 items-start">

        {/* LEFT: Benefits panel */}
        <aside aria-label={t.join_aside_aria} className="md:col-span-2 md:sticky md:top-24">
          <h2 className="text-xl font-black text-white mb-6">
            {t.join_aside_title}
          </h2>
          <ul className="space-y-4">
            {[
              { icon: Globe,    text: t.join_b1 },
              { icon: BookOpen, text: t.join_b2 },
              { icon: Map,      text: t.join_b3 },
              { icon: Heart,    text: t.join_b4 },
            ].map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-slate-300 text-sm">
                <div className="w-8 h-8 bg-slate-800 border border-slate-700 rounded-lg flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-slate-400" />
                </div>
                {text}
              </li>
            ))}
          </ul>

          <div className="mt-8 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
            <p className="text-emerald-400 text-sm font-bold">{t.join_free}</p>
            <p className="text-slate-500 text-xs mt-1">{t.join_access}</p>
          </div>

          <p className="mt-6 text-slate-500 text-xs">
            {t.join_have_agent}{' '}
            <Link href="/connect-agent" className="text-blue-400 hover:underline">
              {t.join_connect_here}
            </Link>
          </p>
        </aside>

        {/* RIGHT: Form */}
        <section aria-labelledby="form-heading" className="md:col-span-3">
          <h1 id="form-heading" className="text-2xl font-black text-white mb-6">
            {t.join_form_title}
          </h1>

          {/* Social signup */}
          <div className="space-y-2 mb-5">
            <button type="button" onClick={() => { window.location.href = `${getApiUrl()}/api/v1/auth/google`; }}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-900 rounded-xl text-sm font-medium transition-all hover:scale-[1.02]">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Sign up with Google
            </button>
            <button type="button" onClick={() => { window.location.href = `${getApiUrl()}/api/v1/auth/github`; }}
              className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-[#24292f] hover:bg-[#2f363d] text-white rounded-xl text-sm font-medium transition-all hover:scale-[1.02]">
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/></svg>
              Sign up with GitHub
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-xs text-slate-500 font-medium">or register with email</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          {/* Already have an account? */}
          <p className="text-center text-xs text-slate-500 mb-6">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-400 hover:underline font-medium">Sign in</Link>
          </p>

          <form
            onSubmit={handleSubmit}
            aria-label={t.join_form_aria}
            noValidate
            className="space-y-5"
          >
            {/* Variables for strict ARIA compliance in some linters */}
            {(() => {
              const isUsernameInvalid = errors.username ? "true" : "false";
              const isEmailInvalid = errors.email ? "true" : "false";
              const isPasswordInvalid = errors.password ? "true" : "false";
              
              return (
                <>
                  {/* Username */}
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-1.5">
                      {t.join_label_user} <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="username"
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      onBlur={() => handleBlur('username')}
                      autoComplete="username"
                      placeholder={t.join_ph_user}
                      aria-describedby={errors.username && touched.username ? 'username-error' : undefined}
                      aria-invalid={isUsernameInvalid}
                      className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all ${
                        errors.username && touched.username
                          ? 'border-red-500 focus:ring-red-500/30'
                          : 'border-slate-800 focus:ring-blue-500/30 focus:border-blue-500'
                      }`}
                    />
                    {errors.username && touched.username && (
                      <p id="username-error" role="alert" aria-live="polite" className="flex items-center gap-1 text-red-400 text-xs mt-1">
                        <AlertCircle className="w-3 h-3" /> {errors.username}
                      </p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1.5">
                      {t.join_label_email} <span className="text-red-400">*</span>
                    </label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      onBlur={() => handleBlur('email')}
                      autoComplete="email"
                      placeholder="tu@email.com"
                      aria-describedby={errors.email && touched.email ? 'email-error' : undefined}
                      aria-invalid={isEmailInvalid}
                      className={`w-full bg-slate-900 border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 transition-all ${
                        errors.email && touched.email
                          ? 'border-red-500 focus:ring-red-500/30'
                          : 'border-slate-800 focus:ring-blue-500/30 focus:border-blue-500'
                      }`}
                    />
                    {errors.email && touched.email && (
                      <p id="email-error" role="alert" aria-live="polite" className="flex items-center gap-1 text-red-400 text-xs mt-1">
                        <AlertCircle className="w-3 h-3" /> {errors.email}
                      </p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1.5">
                      {t.join_label_pass} <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        onBlur={() => handleBlur('password')}
                        autoComplete="new-password"
                        placeholder={t.join_ph_pass}
                        aria-describedby="password-strength"
                        aria-invalid={isPasswordInvalid}
                        className={`w-full bg-slate-900 border rounded-xl px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 transition-all ${
                          errors.password && touched.password
                            ? 'border-red-500 focus:ring-red-500/30'
                            : 'border-slate-800 focus:ring-blue-500/30 focus:border-blue-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(v => !v)}
                        aria-label={showPassword ? t.join_aria_hide_pass : t.join_aria_show_pass}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Strength bar */}
                    {password.length > 0 && (
                      <div id="password-strength" aria-live="polite" className="mt-2">
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3, 4].map(n => (
                            <div
                              key={n}
                              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                                n <= strength.score ? strength.color : 'bg-slate-800'
                              }`}
                            />
                          ))}
                        </div>
                        {strength.label && (
                          <p className="text-xs text-slate-500">
                            {t.join_strength}{' '}
                            <span className={strength.score >= 3 ? 'text-emerald-400' : 'text-amber-400'}>
                              {strength.label}
                            </span>
                          </p>
                        )}
                      </div>
                    )}

                    {errors.password && touched.password && (
                      <p role="alert" aria-live="polite" className="flex items-center gap-1 text-red-400 text-xs mt-1">
                        <AlertCircle className="w-3 h-3" /> {errors.password}
                      </p>
                    )}
                  </div>
                </>
              );
            })()}

            {/* Terms */}
            <div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  id="terms"
                  checked={terms}
                  onChange={e => setTerms(e.target.checked)}
                  onBlur={() => handleBlur('terms')}
                  aria-describedby={errors.terms && touched.terms ? 'terms-error' : undefined}
                  className="mt-0.5 w-4 h-4 rounded border-slate-700 bg-slate-900 text-blue-500 focus:ring-blue-500/30"
                />
                <span className="text-sm text-slate-400 leading-relaxed">
                  {t.join_terms}{' '}
                  <Link href="/terms" className="text-blue-400 hover:underline">
                    {t.join_terms_link}
                  </Link>{' '}
                  {t.join_terms_and}{' '}
                  <Link href="/privacy" className="text-blue-400 hover:underline">
                    {t.join_privacy_link}
                  </Link>
                </span>
              </label>
              {errors.terms && touched.terms && (
                <p id="terms-error" role="alert" aria-live="polite" className="flex items-center gap-1 text-red-400 text-xs mt-1 ml-7">
                  <AlertCircle className="w-3 h-3" /> {errors.terms}
                </p>
              )}
            </div>

            {/* Server error */}
            {formState === 'error' && serverError && (
              <div role="alert" aria-live="assertive" className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {serverError}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={formState === 'loading'}
              aria-label={
                formState === 'loading' ? t.join_aria_submitting : t.join_aria_submit
              }
              className="w-full py-4 bg-white text-slate-950 rounded-2xl font-black text-sm flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {formState === 'loading' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t.join_submitting}
                </>
              ) : (
                <>
                  {t.join_submit}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
