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
      <div className="bg-pure-white border border-mist rounded-card p-8 sm:p-10 shadow-lg-elevated space-y-6">
        {/* Top Icon and Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-control bg-obsidian text-pure-white flex items-center justify-center text-xl mx-auto shadow-subtle border border-mist">
            <span className="text-soft-iris font-bold">⬡</span>
          </div>
          <h2 className="text-2xl font-bold text-studio-slate tracking-tight">
            Create an Account
          </h2>
          <p className="text-xs text-iron max-w-[280px] mx-auto leading-relaxed">
            Get started with AI-driven document intelligence and schedule extraction.
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-control text-xs text-red-700 flex items-center space-x-2">
            <span>⚠️</span>
            <span className="font-medium">{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-control text-xs text-emerald-800 flex items-center space-x-2">
            <span>✅</span>
            <span className="font-semibold">{success}</span>
          </div>
        )}

        {/* Signup Form */}
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
              Create Password
            </label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="w-full px-3.5 py-2.5 bg-pure-white border border-mist focus:border-iris rounded-control text-sm font-medium text-studio-slate focus:outline-none focus:ring-2 focus:ring-iris/20 transition shadow-subtle-2"
              placeholder="Minimum 6 characters"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full btn-pill-dark !py-3 !text-sm disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Get started now →'}
            </button>
          </div>
        </form>

        {/* Switch to Sign In */}
        <div className="pt-4 border-t border-mist text-center">
          <p className="text-xs text-iron">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToLogin}
              className="text-iris font-semibold hover:underline cursor-pointer transition"
            >
              Sign in here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
