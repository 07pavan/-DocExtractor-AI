import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Signup({ onSwitchToLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data?.session) {
        setSuccess('Account created successfully! Logging you in...');
      } else {
        setSuccess('Account created successfully! You can now sign in below.');
      }
    } catch (err) {
      setError(err.message || 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white/90 backdrop-blur-xl border border-gray-200/80 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6">
        {/* Top Icon and Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-lg shadow-indigo-500/30 text-white">
            ✨
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Create Account
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            Get started with AI-driven document and schedule extraction.
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-3.5 bg-red-50/90 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2.5 animate-fadeIn">
            <span className="text-base flex-shrink-0">⚠️</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center space-x-2.5 animate-fadeIn">
            <span className="text-base flex-shrink-0">✅</span>
            <span className="font-semibold">{success}</span>
          </div>
        )}

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 bg-gray-50/80 hover:bg-gray-50 focus:bg-white border border-gray-300 focus:border-indigo-600 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition shadow-2xs"
                placeholder="name@company.com"
              />
              <span className="absolute left-3.5 top-3.5 text-gray-400 text-sm">✉️</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
              Create Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 bg-gray-50/80 hover:bg-gray-50 focus:bg-white border border-gray-300 focus:border-indigo-600 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 transition shadow-2xs"
                placeholder="Minimum 6 characters"
              />
              <span className="absolute left-3.5 top-3.5 text-gray-400 text-sm">🔒</span>
            </div>
            <p className="text-[11px] text-gray-400 pl-1">Must be at least 6 characters</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-indigo-500/25 flex items-center justify-center space-x-2 cursor-pointer mt-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Get Started Now</span>
                <span>→</span>
              </>
            )}
          </button>
        </form>

        {/* Switch to Sign In */}
        <div className="pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer transition"
            >
              Sign In here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
