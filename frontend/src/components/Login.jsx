import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Login({ onSwitchToSignup }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="bg-white/90 backdrop-blur-xl border border-gray-200/80 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6">
        {/* Top Icon and Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-lg shadow-blue-500/30 text-white">
            🔐
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">
            Welcome Back
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            Sign in to access your document extraction intelligence vault.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3.5 bg-red-50/90 border border-red-200 rounded-xl text-xs text-red-700 flex items-center space-x-2.5 animate-fadeIn">
            <span className="text-base flex-shrink-0">⚠️</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Login Form */}
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
                className="w-full pl-10 pr-4 py-3 bg-gray-50/80 hover:bg-gray-50 focus:bg-white border border-gray-300 focus:border-blue-600 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition shadow-2xs"
                placeholder="name@company.com"
              />
              <span className="absolute left-3.5 top-3.5 text-gray-400 text-sm">✉️</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                Password
              </label>
            </div>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="w-full pl-10 pr-4 py-3 bg-gray-50/80 hover:bg-gray-50 focus:bg-white border border-gray-300 focus:border-blue-600 rounded-xl text-sm font-medium text-gray-900 focus:outline-none focus:ring-4 focus:ring-blue-500/10 transition shadow-2xs"
                placeholder="••••••••"
              />
              <span className="absolute left-3.5 top-3.5 text-gray-400 text-sm">🔒</span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-black text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-blue-500/25 flex items-center justify-center space-x-2 cursor-pointer mt-2"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                <span>Authenticating...</span>
              </>
            ) : (
              <>
                <span>Sign In to Engine</span>
                <span>→</span>
              </>
            )}
          </button>
        </form>

        {/* Switch to Sign Up */}
        <div className="pt-4 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="text-blue-600 hover:text-blue-800 font-bold hover:underline cursor-pointer transition"
            >
              Create free account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
