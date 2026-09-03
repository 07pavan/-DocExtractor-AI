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

      // If user session is created immediately (email confirmation disabled)
      if (data?.session) {
        setSuccess('Account created successfully! Logging you in...');
      } else {
        setSuccess('Account created successfully! You can now sign in.');
      }
    } catch (err) {
      setError(err.message || 'Failed to sign up.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 bg-white border border-gray-200 rounded shadow-sm">
      <h2 className="text-xl font-bold mb-4">Create Account</h2>

      {error && (
        <div className="p-3 mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded">
          {error}
        </div>
      )}

      {success && (
        <div className="p-3 mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded">
          {success}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Minimum 6 characters"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded disabled:opacity-50 transition"
        >
          {loading ? 'Creating Account...' : 'Sign Up'}
        </button>
      </form>

      <div className="mt-4 pt-4 border-t text-center text-sm text-gray-600">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-blue-600 hover:underline font-medium"
        >
          Sign In
        </button>
      </div>
    </div>
  );
}
