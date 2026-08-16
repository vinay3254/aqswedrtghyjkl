import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import supabase from '../services/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [assignedAmbulance, setAssignedAmbulance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // ── Hydrate Profile and Assigned Ambulance from Supabase ──
  const fetchUserData = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      setAssignedAmbulance(null);
      setLoading(false);
      return;
    }

    try {
      // 1. Fetch user profile
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profErr) {
        console.warn('[AuthContext] Error fetching profile:', profErr.message);
      }

      setProfile(prof || {
        id: userId,
        role: 'DISPATCHER', // Default role fallback
        full_name: 'CAD Operator',
      });

      // 2. Fetch assigned ambulance (if driver)
      const { data: amb, error: ambErr } = await supabase
        .from('ambulances')
        .select('*')
        .eq('assigned_driver_id', userId)
        .maybeSingle();

      if (!ambErr && amb) {
        setAssignedAmbulance(amb);
      } else {
        setAssignedAmbulance(null);
      }
    } catch (err) {
      console.error('[AuthContext] Unexpected error hydrating user data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Initial Session Hydration & Real-time Auth Listener ──
  useEffect(() => {
    let mounted = true;

    // Get current active session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!mounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        fetchUserData(currentSession.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;
        console.log('[AuthContext] Auth state changed:', event);
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await fetchUserData(newSession.user.id);
        } else {
          setProfile(null);
          setAssignedAmbulance(null);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [fetchUserData]);

  // ── Sign In with Email/Password ──
  const signInWithEmail = async (email, password) => {
    setAuthError(null);
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // If demo user doesn't exist yet, attempt automatic signup for seamless testing
        if (error.message.includes('Invalid login credentials') && email.includes('@cad.emergency.in')) {
          console.log('[AuthContext] Demo account not found. Creating demo account automatically...');
          const role = email.includes('driver') ? 'DRIVER' : 'DISPATCHER';
          const name = email.includes('alpha1') ? 'Rajesh Kumar (Alpha-1)' :
                       email.includes('charlie3') ? 'Priya Singh (Charlie-3)' :
                       email.includes('echo5') ? 'Neha Verma (Echo-5)' : 'Command Dispatcher';

          const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: { full_name: name, role: role }
            }
          });

          if (signUpErr) throw signUpErr;

          // Insert profile record
          if (signUpData.user) {
            await supabase.from('profiles').upsert({
              id: signUpData.user.id,
              email: email,
              full_name: name,
              role: role,
            });

            // Bind driver to ambulance if driver demo
            if (role === 'DRIVER') {
              const ambId = email.includes('alpha1') ? 'AMB-001' :
                            email.includes('charlie3') ? 'AMB-003' : 'AMB-005';
              await supabase.from('ambulances').update({ assigned_driver_id: signUpData.user.id }).eq('id', ambId);
            }

            setSession(signUpData.session);
            setUser(signUpData.user);
            await fetchUserData(signUpData.user.id);
            return { user: signUpData.user, session: signUpData.session };
          }
        }
        throw error;
      }

      setSession(data.session);
      setUser(data.user);
      await fetchUserData(data.user.id);
      return data;
    } catch (err) {
      console.error('[AuthContext] Sign in error:', err);
      setAuthError(err.message || 'Failed to authenticate');
      setLoading(false);
      throw err;
    }
  };

  // ── Sign Out ──
  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      setAssignedAmbulance(null);
    } catch (err) {
      console.error('[AuthContext] Sign out error:', err);
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    profile,
    assignedAmbulance,
    loading,
    authError,
    isAuthenticated: !!user,
    isDispatcher: profile?.role === 'DISPATCHER' || profile?.role === 'ADMIN',
    isDriver: profile?.role === 'DRIVER',
    signInWithEmail,
    signOut,
    refetchUser: () => user && fetchUserData(user.id),
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
