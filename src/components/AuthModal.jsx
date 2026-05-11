import { useState } from 'react';
import { signIn, signUp, signOut, upsertProfile } from '../lib/auth';
import { supabase } from '../lib/supabase';

function LiULogo({ className = '' }) {
  return (
    <img
      src="https://www.liuais.com/images/LiUAISlogo.svg"
      alt="LiU AI Society"
      className={className}
      style={{ filter: 'brightness(0) invert(1)' }}
    />
  );
}

const inputStyle = {
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(255,255,255,0.1)',
};
const inputFocus = {
  background: 'rgba(64,196,255,0.05)',
  borderColor: 'rgba(64,196,255,0.55)',
  boxShadow: '0 0 0 3px rgba(64,196,255,0.08)',
};

function Input({ label, ...props }) {
  return (
    <div className="mb-3">
      <label className="block text-xs font-mono uppercase tracking-widest text-liu-muted mb-1.5">
        {label}
      </label>
      <input
        {...props}
        className="w-full rounded-xl px-4 py-2.5 text-sm font-mono text-white focus:outline-none transition-all"
        style={inputStyle}
        onFocus={(e) => Object.assign(e.target.style, inputFocus)}
        onBlur={(e) =>  Object.assign(e.target.style, inputStyle)}
      />
    </div>
  );
}

/* ── Sign-in view ── */
function SignInView({ onSwitch, onSuccess }) {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(email, password);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {error && <p className="text-xs text-red-400 font-mono mb-3">{error}</p>}
      <button type="submit" className="btn-primary w-full mb-3" disabled={loading}>
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-center text-xs font-mono text-liu-muted">
        No account?{' '}
        <button type="button" onClick={onSwitch} style={{ color: '#40c4ff' }}>
          Sign up
        </button>
      </p>
    </form>
  );
}

/* ── Sign-up view ── */
function SignUpView({ onSwitch, onSuccess }) {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signUp(email, password, name);
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <Input label="Display name" type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Daniel" />
      <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
      {error && <p className="text-xs text-red-400 font-mono mb-3">{error}</p>}
      <button type="submit" className="btn-primary w-full mb-3" disabled={loading}>
        {loading ? 'Creating account…' : 'Create account'}
      </button>
      <p className="text-center text-xs font-mono text-liu-muted">
        Already have an account?{' '}
        <button type="button" onClick={onSwitch} style={{ color: '#40c4ff' }}>
          Sign in
        </button>
      </p>
    </form>
  );
}

/* ── Profile view (logged in) ── */
function ProfileView({ user, profile, setProfile, onClose }) {
  const [fplId,   setFplId]   = useState(profile?.fpl_manager_id?.toString() || '');
  const [name,    setName]    = useState(profile?.display_name || '');
  const [saving,  setSaving]  = useState(false);
  const [saved,   setSaved]   = useState(false);
  const [error,   setError]   = useState('');

  async function save(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const updated = await upsertProfile(user.id, {
        display_name:   name,
        fpl_manager_id: fplId ? parseInt(fplId) : null,
      });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    onClose();
  }

  return (
    <form onSubmit={save}>
      <div
        className="mb-4 px-3 py-2 rounded-xl text-xs font-mono"
        style={{ background: 'rgba(64,196,255,0.06)', border: '1px solid rgba(64,196,255,0.15)', color: '#9bdfff' }}
      >
        {user.email}
      </div>
      <Input label="Display name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
      <Input
        label="FPL Manager ID"
        type="number"
        value={fplId}
        onChange={(e) => setFplId(e.target.value)}
        placeholder="e.g. 123456"
      />
      <p className="text-xs font-mono text-liu-muted mb-4 -mt-1">
        FPL app → Points → your entry ID in the URL
      </p>
      {error && <p className="text-xs text-red-400 font-mono mb-3">{error}</p>}
      <button type="submit" className="btn-primary w-full mb-3" disabled={saving}>
        {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save profile'}
      </button>
      <button
        type="button"
        onClick={handleSignOut}
        className="w-full text-xs font-mono uppercase tracking-widest py-2 rounded-xl transition-colors"
        style={{ color: '#7a94b0', border: '1px solid rgba(255,255,255,0.06)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#7a94b0')}
      >
        Sign out
      </button>
    </form>
  );
}

/* ── Main modal ── */
export default function AuthModal({ user, profile, setProfile, onClose }) {
  const [view, setView] = useState(user ? 'profile' : 'signin');

  if (!supabase) {
    return (
      <ModalShell onClose={onClose} title="Auth unavailable">
        <p className="text-xs font-mono text-liu-muted">
          Add <code className="text-liu-accent">VITE_SUPABASE_URL</code> and{' '}
          <code className="text-liu-accent">VITE_SUPABASE_ANON_KEY</code> to enable accounts.
        </p>
      </ModalShell>
    );
  }

  return (
    <ModalShell
      onClose={onClose}
      title={user ? 'My Account' : view === 'signin' ? 'Sign in' : 'Create account'}
    >
      {user ? (
        <ProfileView user={user} profile={profile} setProfile={setProfile} onClose={onClose} />
      ) : view === 'signin' ? (
        <SignInView onSwitch={() => setView('signup')} onSuccess={onClose} />
      ) : (
        <SignUpView onSwitch={() => setView('signin')} onSuccess={onClose} />
      )}
    </ModalShell>
  );
}

function ModalShell({ onClose, title, children }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(2,6,18,0.82)', backdropFilter: 'blur(8px)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="max-w-sm w-full rounded-2xl p-8"
        style={{
          background: '#070f1d',
          border: '1px solid rgba(255,255,255,0.1)',
          borderTop: '1px solid rgba(64,196,255,0.22)',
          boxShadow: '0 0 0 1px rgba(64,196,255,0.06), 0 24px 64px rgba(0,0,0,0.5), 0 4px 24px rgba(0,136,204,0.12)',
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <LiULogo className="h-8 w-8" />
            <div>
              <div className="font-bold text-white text-sm">LiU AI Society</div>
              <div className="text-xs font-mono uppercase tracking-widest" style={{ color: '#40c4ff' }}>
                {title}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-liu-muted hover:text-white transition-colors text-lg">
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
