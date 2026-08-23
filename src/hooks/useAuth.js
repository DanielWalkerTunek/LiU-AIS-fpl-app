import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getProfile } from '../lib/auth';

export function useAuth() {
  const [user,           setUser]           = useState(null);
  const [profile,        setProfile]        = useState(null);
  const [loading,        setLoading]        = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    // getSession() can hang indefinitely after a page reload (a known
    // supabase-js issue around its cross-tab session lock) - fall back to
    // "signed out" rather than leaving the sidebar stuck with no sign-in
    // state forever.
    const timedOut = new Promise((resolve) => setTimeout(() => resolve({ data: { session: null } }), 8000));

    Promise.race([supabase.auth.getSession(), timedOut]).then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        setProfileLoading(true);
        getProfile(session.user.id).then((p) => { setProfile(p); setProfileLoading(false); });
      }
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        if (u) {
          setProfileLoading(true);
          const p = await getProfile(u.id);
          setProfile(p);
          setProfileLoading(false);
        } else {
          setProfile(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, profile, setProfile, loading, profileLoading };
}
