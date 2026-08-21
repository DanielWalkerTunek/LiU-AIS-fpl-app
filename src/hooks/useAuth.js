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

    supabase.auth.getSession().then(({ data: { session } }) => {
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
