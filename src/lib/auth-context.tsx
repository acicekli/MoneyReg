import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // "Beni hatırla" işaretsizse → oturumu kapat
        const remember = await AsyncStorage.getItem('remember_me');
        if (remember === 'false') {
          await supabase.auth.signOut();
          await AsyncStorage.removeItem('remember_me');
        }

        const { data } = await supabase.auth.getSession();
        setSession(data.session);
      } catch {
        // Oturum okunamazsa giriş ekranına düşsün, sonsuz yükleme olmasın
        setSession(null);
      } finally {
        setLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, fullName: string) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    // "Beni hatırla" bayrağını temizle
    try {
      await AsyncStorage.removeItem('remember_me');
    } catch {
      // sessiz
    }
    // Planlı bildirimler bilerek iptal edilmez: oturum kapalıyken de hatırlatma gelsin.
    // Offline kuyruk SİLİNMEZ: öğeler kullanıcıya bağlı (userId), o hesap
    // tekrar girince senkronize edilir; başka hesaba yazılmaz.
    await supabase.auth.signOut();
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
