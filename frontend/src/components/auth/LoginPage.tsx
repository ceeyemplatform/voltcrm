import React, { useState } from 'react';
import { Zap, Mail, Lock, ArrowRight, ArrowLeft, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const LoginPage: React.FC<{ initialSignUp?: boolean }> = ({ initialSignUp = false }) => {
  const { signIn, signUp, isConfigured } = useAuth();
  const [isSignUp, setIsSignUp] = useState(initialSignUp);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setLoading(true);

    if (!email || !password) {
      setError('Please provide both email and password.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      setLoading(false);
      return;
    }

    if (isSignUp) {
      const res = await signUp(email, password);
      if (res.error) {
        setError(res.error.message);
      } else {
        setSuccessMsg(
          'Registration successful! Check your email for verification link, or log in if email confirmation is disabled.'
        );
      }
    } else {
      const res = await signIn(email, password);
      if (res.error) {
        setError(res.error.message);
      }
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <a
          href="#/"
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-600"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </a>
        <br />
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20 mb-3">
          <Zap className="h-6 w-6 fill-white" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          VoltCRM
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Electrical Contracting & Operations Management
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-[0_4px_24px_rgba(0,0,0,0.04)] rounded-xl sm:px-10 border border-slate-300">
          {!isConfigured && (
            <div className="mb-6 rounded-xl bg-blue-50 p-4 border border-blue-200">
              <div className="flex items-start space-x-2">
                <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-blue-900 leading-relaxed">
                  <p className="font-semibold">Supabase Configuration Required</p>
                  <p className="mt-1">
                    Please provide <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_URL</code> and{' '}
                    <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">VITE_SUPABASE_ANON_KEY</code> in <code className="bg-blue-100 px-1 py-0.5 rounded font-mono">frontend/.env</code>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-xl bg-rose-50 p-3.5 border border-rose-200 flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700">{error}</p>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 rounded-xl bg-emerald-50 p-3.5 border border-emerald-200 text-xs text-emerald-800">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">
                Email Address
              </label>
              <div className="mt-1.5 relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="contractor@example.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 transition"
                />
              </div>
            </div>

            <div>
              <label className="form-label">
                Password
              </label>
              <div className="mt-1.5 relative rounded-xl shadow-2xs">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-slate-50/50 transition"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-3 justify-center"
            >
              {loading ? (
                <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span>{isSignUp ? 'Create Contractor Account' : 'Sign In to Workspace'}</span>
                  <ArrowRight className="ml-2 h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-300 pt-4 text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-xs font-semibold text-slate-600 hover:text-blue-600 transition"
            >
              {isSignUp
                ? 'Already have an account? Sign in here'
                : "Don't have an account? Register here"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
