import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Gameweek', icon: '⚽' },
  { to: '/standings', label: 'Standings', icon: '🏆' },
  { to: '/players', label: 'Players', icon: '👤' },
  { to: '/transfers', label: 'Transfers', icon: '🔄' },
];

/* LiU AI Society logo — pulled from liuais.com */
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
  const [leagueId, setLeagueId] = useState(
    () => localStorage.getItem('fpl_league_id') || ''
  );
  const [input, setInput] = useState(leagueId);
  const [showSettings, setShowSettings] = useState(!leagueId);

  function save() {
    localStorage.setItem('fpl_league_id', input.trim());
    setLeagueId(input.trim());
    setShowSettings(false);
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-60 fixed h-screen z-20"
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
                style={{ background: 'linear-gradient(90deg,#40c4ff,#09ddff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
              >
                FPL
              </div>
            </div>
          </div>
          {leagueId && (
            <div className="mt-2 text-xs font-mono" style={{ color: 'rgba(64,196,255,0.5)' }}>
              League #{leagueId}
            </div>
          )}
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
                  isActive
                    ? 'text-white'
                    : 'text-liu-muted hover:text-white'
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
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="liu-divider mx-4 mt-4" />

        <div className="px-5 py-4">
          <button
            onClick={() => { setInput(leagueId); setShowSettings(true); }}
            className="text-xs font-mono uppercase tracking-widest transition-colors"
            style={{ color: 'rgba(64,196,255,0.5)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#40c4ff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'rgba(64,196,255,0.5)')}
          >
            ⚙ Settings
          </button>
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
          <div>
            <span className="font-bold text-sm text-white">LiU AI Society</span>
            <span
              className="ml-1.5 text-xs font-mono"
              style={{ background: 'linear-gradient(90deg,#40c4ff,#09ddff)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
            >
              FPL
            </span>
          </div>
        </div>
        <button
          onClick={() => { setInput(leagueId); setShowSettings(true); }}
          className="text-liu-muted hover:text-white transition-colors text-sm"
        >
          ⚙
        </button>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 md:ml-60 pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto p-4 md:p-6">
          {!leagueId && (
            <div
              className="mb-5 rounded-xl px-4 py-3 text-sm font-mono"
              style={{
                background: 'rgba(64,196,255,0.06)',
                border: '1px solid rgba(64,196,255,0.2)',
                color: '#9bdfff',
              }}
            >
              ⚠ Open settings and enter your FPL classic league ID to get started.
            </div>
          )}
          <Outlet context={{ leagueId }} />
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
            <span className="text-lg">{item.icon}</span>
            <span className="text-[10px] font-mono uppercase tracking-widest">
              {item.label}
            </span>
          </NavLink>
        ))}
      </nav>

      {/* ── Settings modal ── */}
      {showSettings && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(2,6,18,0.82)', backdropFilter: 'blur(8px)' }}
        >
          <div
            className="max-w-sm w-full rounded-2xl p-8"
            style={{
              background: '#070f1d',
              border: '1px solid rgba(255,255,255,0.1)',
              borderTop: '1px solid rgba(64,196,255,0.22)',
              boxShadow:
                '0 0 0 1px rgba(64,196,255,0.06), 0 24px 64px rgba(0,0,0,0.5), 0 4px 24px rgba(0,136,204,0.12)',
            }}
          >
            <div className="flex items-center gap-3 mb-6">
              <LiULogo className="h-8 w-8" />
              <div>
                <div className="font-bold text-white">LiU AI Society FPL</div>
                <div
                  className="text-xs font-mono uppercase tracking-widest"
                  style={{ color: '#40c4ff' }}
                >
                  Settings
                </div>
              </div>
            </div>

            <label
              className="block text-xs font-mono uppercase tracking-widest mb-2"
              style={{ color: '#7a94b0' }}
            >
              FPL Classic League ID
            </label>
            <input
              type="number"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="e.g. 123456"
              autoFocus
              className="w-full mb-2 px-4 py-3 rounded-xl text-white text-sm font-mono focus:outline-none transition-all"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
              }}
              onFocus={(e) => {
                e.target.style.background = 'rgba(64,196,255,0.05)';
                e.target.style.borderColor = 'rgba(64,196,255,0.55)';
                e.target.style.boxShadow = '0 0 0 3px rgba(64,196,255,0.08)';
              }}
              onBlur={(e) => {
                e.target.style.background = 'rgba(255,255,255,0.05)';
                e.target.style.borderColor = 'rgba(255,255,255,0.1)';
                e.target.style.boxShadow = 'none';
              }}
            />
            <p className="text-xs mb-6" style={{ color: 'rgba(122,148,176,0.6)' }}>
              FPL app → Leagues → your classic league → number in the URL.
            </p>

            <div className="flex gap-3">
              <button onClick={save} className="btn-primary flex-1">
                Save
              </button>
              {leagueId && (
                <button onClick={() => setShowSettings(false)} className="btn-secondary">
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
