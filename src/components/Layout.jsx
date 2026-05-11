import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Gameweek', icon: '⚽' },
  { to: '/standings', label: 'Standings', icon: '🏆' },
  { to: '/players', label: 'Players', icon: '👤' },
  { to: '/transfers', label: 'Transfers', icon: '🔄' },
];

export default function Layout() {
  const [leagueId, setLeagueId] = useState(
    () => localStorage.getItem('fpl_league_id') || ''
  );
  const [input, setInput] = useState(leagueId);
  const [showSettings, setShowSettings] = useState(!leagueId);

  function save() {
    localStorage.setItem('fpl_league_id', input);
    setLeagueId(input);
    setShowSettings(false);
  }

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-gray-900 border-r border-gray-800 p-4 fixed h-screen z-10">
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl font-bold text-emerald-400">LiU AI</span>
            <span className="text-xl font-bold text-white">FPL</span>
          </div>
          {leagueId && (
            <span className="text-xs text-gray-500">League #{leagueId}</span>
          )}
        </div>

        <nav className="flex flex-col gap-1 flex-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <button
          onClick={() => { setInput(leagueId); setShowSettings(true); }}
          className="text-xs text-gray-500 hover:text-gray-300 text-left mt-4 transition-colors"
        >
          ⚙ Settings
        </button>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 inset-x-0 z-10 bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <span className="font-bold">
          <span className="text-emerald-400">LiU AI</span>{' '}
          <span className="text-white">FPL</span>
        </span>
        <button
          onClick={() => { setInput(leagueId); setShowSettings(true); }}
          className="text-gray-400 hover:text-white"
        >
          ⚙
        </button>
      </div>

      {/* Main */}
      <main className="flex-1 md:ml-56 pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="max-w-5xl mx-auto p-4 md:p-6">
          {!leagueId && (
            <div className="mb-5 card border-yellow-500/30 bg-yellow-500/5 text-yellow-300 text-sm">
              ⚠ Open settings and enter your FPL classic league ID to get started.
            </div>
          )}
          <Outlet context={{ leagueId }} />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-gray-900 border-t border-gray-800 flex z-10">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
                isActive ? 'text-emerald-400' : 'text-gray-500'
              }`
            }
          >
            <span className="text-lg">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="card max-w-sm w-full">
            <h2 className="font-bold text-lg mb-4">Settings</h2>
            <label className="block text-sm text-gray-400 mb-1">
              FPL Classic League ID
            </label>
            <input
              type="number"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder="e.g. 123456"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white mb-3 focus:outline-none focus:border-emerald-500"
              autoFocus
            />
            <p className="text-xs text-gray-500 mb-4">
              FPL app → Leagues → select your classic league → copy the number
              from the URL.
            </p>
            <div className="flex gap-3">
              <button onClick={save} className="btn-primary flex-1">
                Save
              </button>
              {leagueId && (
                <button
                  onClick={() => setShowSettings(false)}
                  className="btn-secondary"
                >
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
