'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  User,
} from 'lucide-react';
import { marketingPlanLabel, type MarketingPlanId } from '@/lib/marketing-plans';

type AuthTab = 'login' | 'register';

export function StaffAuthPanel({ planId }: { planId: MarketingPlanId | null }) {
  const router = useRouter();
  const [tab, setTab] = useState<AuthTab>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotLogin, setForgotLogin] = useState('');
  const [forgotMessage, setForgotMessage] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [signupMessage, setSignupMessage] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  const planLabel = marketingPlanLabel(planId);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      router.push(data.redirect);
    } catch {
      setError('Network error. Please check your connection.');
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setForgotMessage('');
    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: forgotLogin, email: forgotLogin }),
      });
      const data = await res.json();
      setForgotMessage(data.message || data.error || 'If that account is registered, a reset link has been sent.');
    } catch {
      setForgotMessage('Network error. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleSignupNotice = async () => {
    setSignupMessage('');
    setSignupLoading(true);
    try {
      const res = await fetch('/api/auth/signup', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setSignupMessage(
        data.error || 'Public sign-up is disabled. Staff accounts are created by a gym owner or Super Admin.'
      );
    } catch {
      setSignupMessage('Public sign-up is disabled. Staff accounts are created by a gym owner or Super Admin.');
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-[#DAE1E7] bg-white p-6 shadow-[0_16px_40px_rgba(32,100,182,0.08)] sm:p-8">
      {planLabel && (
        <p className="mb-5 inline-flex rounded-full bg-[#6DCCC3]/20 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[#2064B6]">
          {planLabel}
        </p>
      )}

      <div className="mb-6 grid grid-cols-2 rounded-2xl border border-[#DAE1E7] bg-[#F4F7FA] p-1">
        <button
          type="button"
          onClick={() => setTab('login')}
          className={`rounded-xl py-2.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
            tab === 'login' ? 'bg-[#2064B6] text-white' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Login
        </button>
        <button
          type="button"
          onClick={() => setTab('register')}
          className={`rounded-xl py-2.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
            tab === 'register' ? 'bg-[#2064B6] text-white' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Create Account
        </button>
      </div>

      {tab === 'login' ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="home-username" className="mb-1.5 block text-sm font-medium text-slate-700">
              Email / Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="home-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-xl border border-[#DAE1E7] bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#2064B6] focus:ring-2 focus:ring-[#2064B6]/20"
                placeholder="Enter username"
                autoComplete="username"
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="home-password" className="mb-1.5 block text-sm font-medium text-slate-700">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="home-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-[#DAE1E7] bg-white py-2.5 pl-10 pr-10 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#2064B6] focus:ring-2 focus:ring-[#2064B6]/20"
                placeholder="Enter password"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute inset-y-0 right-0 flex items-center rounded-r-xl px-3 text-slate-400 hover:text-slate-700"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setForgotOpen((open) => !open);
              setForgotMessage('');
              setForgotLogin(username);
            }}
            className="text-xs font-medium text-[#2064B6] hover:text-[#18539a]"
          >
            Forgot password?
          </button>

          {forgotOpen && (
            <div className="space-y-2 rounded-xl border border-[#DAE1E7] bg-[#F4F7FA] p-3">
              <label htmlFor="forgot-login" className="block text-xs font-medium text-slate-600">
                Username or email
              </label>
              <input
                id="forgot-login"
                type="text"
                value={forgotLogin}
                onChange={(e) => setForgotLogin(e.target.value)}
                className="w-full rounded-lg border border-[#DAE1E7] bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-[#2064B6]"
                required
              />
              {forgotMessage && <p className="text-xs text-slate-500">{forgotMessage}</p>}
              <button
                type="button"
                onClick={() => void handleForgot()}
                disabled={forgotLoading || !forgotLogin.trim()}
                className="w-full rounded-lg border border-[#DAE1E7] bg-white py-2 text-xs font-medium text-slate-700 disabled:opacity-60"
              >
                {forgotLoading ? 'Sending...' : 'Send reset link'}
              </button>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#2064B6] py-2.5 text-sm font-semibold text-white transition hover:bg-[#18539a] disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              'Login'
            )}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-500">
            Public sign-up is disabled. Staff accounts are created by a gym owner or Super Admin.
          </p>
          {signupMessage && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span>{signupMessage}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => void handleSignupNotice()}
            disabled={signupLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#DAE1E7] bg-[#F4F7FA] py-2.5 text-sm font-medium text-slate-700 transition hover:border-[#6DCCC3] disabled:opacity-60"
          >
            {signupLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
