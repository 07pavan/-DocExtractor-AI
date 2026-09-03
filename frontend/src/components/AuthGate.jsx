import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Login from './Login';
import Signup from './Signup';

export const AuthContext = createContext({
  session: null,
  user: null,
  token: null,
  signOut: async () => {},
  logout: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'signup'

  useEffect(() => {
    // 1. Fetch initial session
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setLoading(false);
    });

    // 2. Subscribe to auth state updates
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Sign out error:', err);
    } finally {
      setSession(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="flex flex-col items-center space-y-3 text-white">
          <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold tracking-wide text-blue-200">Loading DocExtractor AI...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Background glow effects */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>

        {/* Brand header above auth modal */}
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-6 relative z-10 space-y-2">
          <div className="inline-flex items-center space-x-2.5 bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-lg">
            <span className="text-2xl">📑</span>
            <span className="text-lg font-black text-white tracking-tight">DocExtractor AI</span>
          </div>
        </div>

        {/* Auth form container */}
        <div className="relative z-10">
          {authMode === 'login' ? (
            <Login onSwitchToSignup={() => setAuthMode('signup')} />
          ) : (
            <Signup onSwitchToLogin={() => setAuthMode('login')} />
          )}
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-xs text-slate-500 relative z-10">
          <span>Protected with Enterprise JWT & Postgres Persistence</span>
        </div>
      </div>
    );
  }

  const contextValue = {
    session,
    user: session.user,
    token: session.access_token,
    signOut: handleSignOut,
    logout: handleSignOut,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
