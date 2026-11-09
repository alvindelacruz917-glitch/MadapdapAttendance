import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { 
  School, 
  QrCode, 
  ShieldCheck, 
  Mail, 
  Lock, 
  User, 
  LogIn, 
  Sparkles, 
  CheckCircle2, 
  AlertCircle,
  ScanLine
} from 'lucide-react';

export const Login: React.FC = () => {
  const { 
    signInWithGoogle, 
    signInWithEmail, 
    signUpWithEmail, 
    loginAsDemoGuard, 
    loading 
  } = useAuth();
  const { settings } = useSettings();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setErrorMsg(err.message || 'Google sign-in was interrupted. Please try again.');
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSubmitting(true);

    try {
      if (isSignUp) {
        if (!fullName.trim()) throw new Error('Please enter your full name.');
        await signUpWithEmail(email.trim(), password, fullName.trim(), 'GUARD');
      } else {
        await signInWithEmail(email.trim(), password);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 selection:bg-blue-600 selection:text-white">
      {/* Background radial gradient accent */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(37,99,235,0.25),rgba(255,255,255,0))] pointer-events-none" />

      <div className="max-w-md w-full relative z-10 space-y-6">
        {/* School Branding */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center mx-auto shadow-xl shadow-blue-500/25 ring-8 ring-blue-500/10">
            <School className="w-8 h-8" />
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight">
            {settings.schoolName || 'Oakridge Academy'}
          </h1>
          <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
            QR Student Attendance Gateway &amp; Instant Parent Notification System
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-100">
          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Quick Google Sign-In */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-slate-300 rounded-2xl text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-xs active:scale-[0.99] disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Continue with Google Account</span>
          </button>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-400 bg-white px-3">
              or sign in with email
            </div>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3.5">
            {isSignUp && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Officer Marcus Reyes"
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@school.edu or guard@school.edu"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;"
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || loading}
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 transition-colors shadow-xs active:scale-[0.99] disabled:opacity-50"
            >
              {submitting ? 'Authenticating...' : isSignUp ? 'Create Staff Account' : 'Sign In'}
            </button>
          </form>

          <div className="text-center mt-3">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-xs text-blue-600 font-bold hover:underline"
            >
              {isSignUp ? 'Already registered? Sign In' : 'Need an account? Register here'}
            </button>
          </div>

          {/* Quick Demo Guard Login Button */}
          <div className="mt-5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={loginAsDemoGuard}
              className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2"
            >
              <ScanLine className="w-4 h-4 text-emerald-600" />
              <span>Instant Gate Guard Access (One-Click)</span>
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              Launch directly into the mobile QR Scanner interface to test camera scanning
            </p>
          </div>
        </div>

        {/* System Highlights */}
        <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-slate-400 font-medium">
          <div className="bg-slate-800/60 p-2 rounded-xl border border-slate-700/50">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-400 mx-auto mb-1" />
            <span>Cryptographic QR</span>
          </div>
          <div className="bg-slate-800/60 p-2 rounded-xl border border-slate-700/50">
            <Mail className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
            <span>Auto Email Alerts</span>
          </div>
          <div className="bg-slate-800/60 p-2 rounded-xl border border-slate-700/50">
            <School className="w-3.5 h-3.5 text-amber-400 mx-auto mb-1" />
            <span>Role-Based Access</span>
          </div>
        </div>
      </div>
    </div>
  );
};
