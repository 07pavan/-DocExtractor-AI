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
      <div className="bg-pure-white border border-mist rounded-card p-8 sm:p-10 shadow-lg-elevated space-y-6">
        {/* Top Icon and Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-control bg-obsidian text-pure-white flex items-center justify-center text-xl mx-auto shadow-subtle border border-mist">
            <span className="text-iris font-bold">⬡</span>
          </div>
          <h2 className="text-2xl font-bold text-studio-slate tracking-tight">
            Sign in to DocExtractor
          </h2>
          <p className="text-xs text-iron max-w-[280px] mx-auto leading-relaxed">
            Enter your credentials to access the design token & document intelligence vault.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-control text-xs text-red-700 flex items-center space-x-2">
            <span>⚠️</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-studio-slate">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="w-full px-3.5 py-2.5 bg-pure-white border border-mist focus:border-iris rounded-control text-sm font-medium text-studio-slate focus:outline-none focus:ring-2 focus:ring-iris/20 transition shadow-subtle-2"
              placeholder="name@company.com"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-studio-slate">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-3.5 py-2.5 bg-pure-white border border-mist focus:border-iris rounded-control text-sm font-medium text-studio-slate focus:outline-none focus:ring-2 focus:ring-iris/20 transition shadow-subtle-2"
              placeholder="••••••••"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-pill-dark !py-3 !text-sm disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Sign in to workspace →'}
            </button>
          </div>
        </form>

        {/* Switch to Sign Up */}
        <div className="pt-4 border-t border-mist text-center">
          <p className="text-xs text-iron">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToSignup}
              className="text-iris font-semibold hover:underline cursor-pointer transition"
            >
              Create free account
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
