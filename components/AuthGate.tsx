'use client';

import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';

const PASSWORD = '100MDRTs';
const STORAGE_KEY = 'supernova_newbiz_dashboard_auth_v1';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState(false);
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const ok = sessionStorage.getItem(STORAGE_KEY) === '1';
      if (ok) setUnlocked(true);
    } catch {
      // ignore storage errors
    }
  }, []);

  const hint = useMemo(() => 'Enter password to view the dashboard.', []);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === PASSWORD) {
      try {
        sessionStorage.setItem(STORAGE_KEY, '1');
      } catch {
        // ignore
      }
      setUnlocked(true);
      setError('');
      return;
    }
    setError('Incorrect password. Please try again.');
  };

  if (unlocked) return <>{children}</>;

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Lock className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <div className="text-lg font-semibold text-slate-900">Protected view</div>
              <div className="text-sm text-slate-500">{hint}</div>
            </div>
          </div>

          <form onSubmit={onSubmit} className="mt-5">
            <label className="block text-sm font-medium text-slate-700">Password</label>
            <div className="mt-2 flex items-center gap-2">
              <input
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                autoFocus
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="Enter password"
              />
              <button
                type="button"
                onClick={() => setShow((v) => !v)}
                className="h-10 w-10 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-700 hover:bg-slate-50"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}

            <div className="mt-5 flex items-center justify-end">
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Unlock
              </button>
            </div>
          </form>
        </div>

        <div className="px-6 pb-5">
        </div>
      </div>
    </div>
  );
}
