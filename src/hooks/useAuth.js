import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getProfile } from '../lib/auth';

export function useAuth() {
  const [user,    setUser]    = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) getProfile(session.user.id).then(setProfile);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const u = session?.user ?? null;
        setUser(u);
        setProfile(u ? await getProfile(u.id) : null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, profile, setProfile, loading };
}
