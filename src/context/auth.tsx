import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email: string;
  display_name: string;
  role: 'student' | 'faculty' | 'staff' | 'super_admin';
  state: 'active' | 'archived_read_only';
}

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

// ── Context ──────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Provider ─────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ── Supabase profile helpers ──────────────────────────────

  async function fetchProfile(userId: string): Promise<void> {
    const { data } = await supabase
      .from('users_account_registry')
      .select('id, email, display_name, role, state')
      .eq('id', userId)
      .single();

    if (data) setProfile(data as UserProfile);
  }

  // Called once after sign-up to create the registry row.
  async function createProfile(
    userId: string,
    email: string,
    displayName: string,
  ): Promise<void> {
    const { data, error } = await supabase
      .from('users_account_registry')
      .upsert(
        { id: userId, email, display_name: displayName, role: 'student', state: 'active' },
        { onConflict: 'id', ignoreDuplicates: false },
      )
      .select('id, email, display_name, role, state')
      .single();

    if (!error && data) setProfile(data as UserProfile);
  }

  // ── Bootstrap: restore session on app launch ──────────────

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (!session) setProfile(null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Auth actions ─────────────────────────────────────────

  async function signIn(email: string, password: string): Promise<{ error: string | null }> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.session) await fetchProfile(data.session.user.id);
    return { error: null };
  }

  async function signUp(
    email: string,
    password: string,
    displayName: string,
  ): Promise<{ error: string | null; needsConfirmation: boolean }> {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message, needsConfirmation: false };

    const needsConfirmation = !data.session;

    if (data.session && data.user) {
      await createProfile(data.user.id, email, displayName);
    }

    return { error: null, needsConfirmation };
  }

  async function signOut(): Promise<void> {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch {
      // ignore — we still clear state below
    }
    setSession(null);
    setProfile(null);

    // On web the Expo Router navigator holds stale render state after
    // session is cleared, so the overlay never surfaces. A full reload
    // is the reliable fix: localStorage token is already gone, so the
    // app boots straight to the login screen.
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  return (
    <AuthContext.Provider value={{ session, profile, isLoading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
