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
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setLoading(false);
    });

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
      <div className="flex items-center justify-center min-h-screen bg-obsidian">
        <div className="flex flex-col items-center space-y-3 text-pure-white">
          <div className="w-8 h-8 border-2 border-iris border-t-transparent rounded-full animate-spin"></div>
          <span className="text-xs font-semibold tracking-wide text-graphite">Initializing workspace...</span>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        {/* Subtle iris accent glow in the dark hero */}
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-iris/10 rounded-full blur-[120px] pointer-events-none"></div>

        {/* Brand Header */}
        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center mb-8 relative z-10 space-y-3">
          <div className="pill-badge !bg-obsidian/80 !border-white/10 !text-pure-white mx-auto !text-xs !py-1 !px-3">
            <span className="w-2 h-2 rounded-full bg-iris"></span>
            <span>Document Token Engine</span>
          </div>

          <h1 className="text-3xl font-black text-pure-white tracking-tight">
            DocExtractor <span className="gradient-headline">AI</span>
          </h1>
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
        <div className="mt-8 text-center text-xs text-graphite relative z-10">
          <span>Protected with Enterprise JWT & PostgreSQL Persistence</span>
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
