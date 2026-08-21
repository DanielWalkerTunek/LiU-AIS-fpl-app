import { supabase } from './supabase';

export async function signUp(email, password, displayName) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  let profile = null;
  if (data.user) {
    const { data: inserted, error: insertError } = await supabase
      .from('profiles')
      .insert({ id: data.user.id, display_name: displayName })
      .select()
      .single();
    if (insertError) throw insertError;
    profile = inserted;
  }
  return { ...data, profile };
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error && error.code !== 'PGRST116') throw error;
  return data ?? null;
}

export async function upsertProfile(userId, updates) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  try {
    const { data, error } = await supabase
      .from('profiles')
      .upsert({ id: userId, ...updates })
      .select()
      .single()
      .abortSignal(controller.signal);
    if (error) throw error;
    return data;
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Request timed out — please try again.');
    if (err.code === '23505') throw new Error('That FPL Manager ID is already linked to another account.');
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getAllProfiles() {
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) throw error;
  return data ?? [];
}
