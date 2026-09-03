import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import Login from './Login';
import Signup from './Signup';

export const AuthContext = createContext({
  session: null,
  user: null,
  token: null,
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

  const logout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-gray-500 text-sm">Checking authentication...</div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="py-12">
        {authMode === 'login' ? (
          <Login onSwitchToSignup={() => setAuthMode('signup')} />
        ) : (
          <Signup onSwitchToLogin={() => setAuthMode('login')} />
        )}
      </div>
    );
  }

  const contextValue = {
    session,
    user: session.user,
    token: session.access_token,
    logout,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}
