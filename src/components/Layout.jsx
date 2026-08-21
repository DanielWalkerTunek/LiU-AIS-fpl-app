import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import AuthModal from './AuthModal';
import { LEAGUE_ID } from '../lib/constants';

const NAV = [
  { to: '/', label: 'Gameweek' },
  { to: '/standings', label: 'Standings' },
  { to: '/players', label: 'Players' },
  { to: '/my-team', label: 'My Team' },
  { to: '/transfers', label: 'Transfers' },
];

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

export default function Layout() {
  const { user, profile, setProfile, loading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* ── Desktop sidebar ── */}
      <aside
        className="hidden md:flex flex-col w-60 fixed h-screen z-20"
        style={{
          background: 'linear-gradient(180deg, rgba(4,13,28,0.98) 0%, rgba(6,16,34,0.98) 100%)',
          borderRight: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* Brand */}
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-3 mb-1">
            <LiULogo className="h-8 w-8 shrink-0" />
            <div>
              <div className="text-white font-bold text-sm leading-tight">LiU AI Society</div>
              <div
                className="text-xs font-mono uppercase tracking-widest"
                style={{
                  background: 'linear-gradient(90deg,#40c4ff,#09ddff)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                FPL
              </div>
            </div>
          </div>
        </div>

        <div className="liu-divider mx-4 mb-4" />

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 px-3 flex-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 text-xs font-mono uppercase tracking-widest ${
                  isActive ? 'text-white' : 'text-liu-muted hover:text-white'
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? {
                      background:
                        'linear-gradient(135deg, rgba(0,112,187,0.25) 0%, rgba(9,221,255,0.12) 100%)',
                      borderLeft: '2px solid #40c4ff',
                      paddingLeft: '10px',
                    }
                  : {}
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="liu-divider mx-4 mt-4" />

        {/* User section */}
        <div className="px-4 py-4">
          {loading ? null : user ? (
            <button
              onClick={() => setShowAuth(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all"
              style={{ border: '1px solid rgba(64,196,255,0.15)', background: 'rgba(64,196,255,0.05)' }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(64,196,255,0.35)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(64,196,255,0.15)')}
            >
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono shrink-0"
                style={{ background: 'linear-gradient(135deg,#0070bb,#09ddff)', color: '#fff' }}
              >
                {(profile?.display_name || user.email)?.[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 text-left">
                <div className="text-xs font-semibold text-white truncate">
                  {profile?.display_name || 'My Account'}
                </div>
                {profile?.fpl_manager_id && (
                  <div className="text-[10px] font-mono text-liu-muted">
                    FPL #{profile.fpl_manager_id}
                  </div>
                )}
              </div>
            </button>
          ) : (
            <button
              onClick={() => setShowAuth(true)}
              className="w-full text-xs font-mono uppercase tracking-widest py-2.5 rounded-xl transition-all"
              style={{
                background: 'rgba(64,196,255,0.07)',
                border: '1px solid rgba(64,196,255,0.2)',
                color: '#9bdfff',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(64,196,255,0.13)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(64,196,255,0.07)')}
            >
              Sign in
            </button>
          )}
        </div>
      </aside>

      {/* ── Mobile header ── */}
      <div
        className="md:hidden fixed top-0 inset-x-0 z-20 px-4 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(4,13,28,0.92)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <LiULogo className="h-7 w-7" />
          <span className="font-bold text-sm text-white">LiU AI Society</span>
          <span
            className="text-xs font-mono"
            style={{
              background: 'linear-gradient(90deg,#40c4ff,#09ddff)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            FPL
          </span>
        </div>
        <button
          onClick={() => setShowAuth(true)}
          className="text-xs font-mono px-3 py-1.5 rounded-lg transition-colors"
          style={{ color: user ? '#40c4ff' : '#7a94b0', border: '1px solid rgba(255,255,255,0.08)' }}
        >
          {user ? (profile?.display_name || user.email)?.[0]?.toUpperCase() + '  ▾' : 'Sign in'}
        </button>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 md:ml-60 pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto p-4 md:p-6">
          <Outlet context={{ leagueId: LEAGUE_ID, user, profile }} />
        </div>
      </main>

      {/* ── Mobile bottom nav ── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-20 flex"
        style={{
          background: 'rgba(4,13,28,0.96)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors"
            style={({ isActive }) => ({
              color: isActive ? '#40c4ff' : 'rgba(122,148,176,0.7)',
            })}
          >
            <span className="text-[10px] font-mono uppercase tracking-widest">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Auth modal ── */}
      {showAuth && (
        <AuthModal
          user={user}
          profile={profile}
          setProfile={setProfile}
          onClose={() => setShowAuth(false)}
        />
      )}
    </div>
  );
}
