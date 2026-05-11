import { useState, useEffect, useMemo } from 'react';
import { getBootstrap, getFixtures } from '../lib/fpl-api';
import { buildFixtureMap, getRecommendations } from '../lib/ml';

const POSITIONS  = ['GKP', 'DEF', 'MID', 'FWD'];
const SORT_MODES = [
  { value: 'xpts',         label: 'xPts',         desc: 'Highest expected points' },
  { value: 'value',        label: 'Value',         desc: 'Best xPts per £m' },
  { value: 'differential', label: 'Differential',  desc: '<10% ownership' },
];
// FDR 1-5: green → red
const FDR_BG   = ['', '#16a34a', '#65a30d', '#ca8a04', '#ea580c', '#dc2626'];
const FDR_TEXT = ['', '#fff',    '#fff',    '#fff',    '#fff',    '#fff'];
const POS_COLOR = { 1: '#fbbf24', 2: '#60a5fa', 3: '#40c4ff', 4: '#f87171' };
const POS_LABEL = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

export default function TransfersPage() {
  const [bootstrap, setBootstrap] = useState(null);
  const [fixtures,  setFixtures]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [position,  setPosition]  = useState('MID');
  const [sortMode,  setSortMode]  = useState('xpts');
  const [maxBudget, setMaxBudget] = useState('');

  useEffect(() => {
    Promise.all([getBootstrap(), getFixtures()])
      .then(([bs, fx]) => { setBootstrap(bs); setFixtures(fx); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const { players, fixturesByTeam, teamMap } = useMemo(() => {
    if (!bootstrap || !fixtures.length)
      return { players: [], fixturesByTeam: {}, teamMap: {} };

    const currentGw =
      bootstrap.events.find((e) => e.is_current)?.id ||
      [...bootstrap.events].reverse().find((e) => e.finished)?.id || 1;

    const teamMap        = Object.fromEntries(bootstrap.teams.map((t) => [t.id, t]));
    const fixturesByTeam = buildFixtureMap(fixtures, currentGw);
    const budget         = maxBudget ? parseFloat(maxBudget) : null;
    const recs           = getRecommendations(bootstrap.elements, fixturesByTeam, position, budget);

    const list =
      sortMode === 'xpts'        ? recs.topXpts :
      sortMode === 'value'       ? recs.topValue :
                                   recs.differentials;

    return { players: list, fixturesByTeam, teamMap };
  }, [bootstrap, fixtures, position, sortMode, maxBudget]);

  if (loading) return <Skeleton />;
  if (error)   return <ErrorCard error={error} />;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Transfer Suggestions</h1>
        <p className="text-liu-muted text-sm font-mono mt-0.5">
          ML model: form × fixture difficulty × availability
        </p>
      </div>

      {/* Controls */}
      <div className="card mb-4 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {POSITIONS.map((p) => (
            <button
              key={p}
              onClick={() => setPosition(p)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-widest transition-all"
              style={
                position === p
                  ? { background: 'linear-gradient(135deg,#0070bb,#09ddff)', color: '#fff' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#7a94b0', border: '1px solid rgba(255,255,255,0.06)' }
              }
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex gap-1">
          {SORT_MODES.map((m) => (
            <button
              key={m.value}
              title={m.desc}
              onClick={() => setSortMode(m.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-widest transition-all"
              style={
                sortMode === m.value
                  ? { background: 'rgba(64,196,255,0.12)', color: '#40c4ff', border: '1px solid rgba(64,196,255,0.25)' }
                  : { background: 'rgba(255,255,255,0.04)', color: '#7a94b0', border: '1px solid rgba(255,255,255,0.06)' }
              }
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-sm font-mono">
          <span className="text-liu-muted">Max £</span>
          <input
            type="number"
            step="0.1"
            min="4"
            max="15"
            value={maxBudget}
            onChange={(e) => setMaxBudget(e.target.value)}
            placeholder="any"
            className="w-20 rounded-xl px-3 py-1.5 text-sm font-mono text-white focus:outline-none transition-all"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
            onFocus={(e) => { e.target.style.borderColor = 'rgba(64,196,255,0.45)'; }}
            onBlur={(e)  => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; }}
          />
          <span className="text-liu-muted">m</span>
        </div>
      </div>

      {/* Model explainer */}
      <div
        className="mb-4 px-4 py-2.5 rounded-xl text-xs font-mono"
        style={{ background: 'rgba(64,196,255,0.06)', border: '1px solid rgba(64,196,255,0.15)', color: '#9bdfff' }}
      >
        <strong>xPts</strong> = (0.6 × form + 0.4 × PPG) × fixture factor × availability ·{' '}
        <strong>Value</strong> = xPts / cost · Fixture: green = easy, red = hard
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {players.length === 0 ? (
          <div className="card text-center text-liu-muted font-mono py-10">
            No players match the current filters.
          </div>
        ) : (
          players.map((p, i) => (
            <PlayerCard
              key={p.id}
              rank={i + 1}
              player={p}
              teamMap={teamMap}
              upcomingFixtures={(fixturesByTeam[p.team] || []).slice(0, 5)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function PlayerCard({ rank, player, teamMap, upcomingFixtures }) {
  const team = teamMap[player.team];

  return (
    <div
      className="card transition-all"
      style={{ cursor: 'default' }}
    >
      <div className="flex items-center gap-3">
        <span className="text-liu-muted w-5 text-xs text-right font-mono">{rank}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-xs font-mono font-semibold" style={{ color: POS_COLOR[player.element_type] }}>
              {POS_LABEL[player.element_type]}
            </span>
            <span className="font-semibold text-white">{player.web_name}</span>
            <span className="text-liu-muted text-xs font-mono">{team?.short_name}</span>
            {player.status !== 'a' && (
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(239,68,68,0.12)', color: '#f87171' }}
              >
                {player.status === 'd' ? `${player.chance_of_playing_next_round ?? '?'}% fit` : 'OUT'}
              </span>
            )}
            {player.ownership < 5 && (
              <span
                className="text-xs font-mono px-1.5 py-0.5 rounded uppercase tracking-widest"
                style={{ background: 'rgba(139,92,246,0.15)', color: '#c4b5fd' }}
              >
                DIFF
              </span>
            )}
          </div>
          <div className="flex gap-3 text-xs font-mono text-liu-muted">
            <span>Form <strong className="text-white">{player.form}</strong></span>
            <span>PPG <strong className="text-white">{player.points_per_game}</strong></span>
            <span>Owned <strong className="text-white">{player.ownership}%</strong></span>
          </div>
        </div>

        {/* Fixture chips */}
        <div className="hidden sm:flex items-center gap-1">
          {upcomingFixtures.map((f, i) => {
            const opp = teamMap[f.opponent];
            return (
              <div
                key={i}
                title={`${f.isHome ? 'H' : 'A'} · FDR ${f.difficulty}`}
                className="w-8 text-center text-[10px] font-mono font-bold rounded py-0.5"
                style={{
                  background: FDR_BG[f.difficulty] || '#334155',
                  color:      FDR_TEXT[f.difficulty] || '#fff',
                }}
              >
                {opp?.short_name || '?'}
              </div>
            );
          })}
        </div>

        {/* Scores */}
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-liu-muted">xPts</div>
            <div className="font-bold text-lg leading-none font-mono" style={{ color: '#40c4ff' }}>
              {player.xpts}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-liu-muted">Cost</div>
            <div className="font-bold font-mono text-white">£{player.cost}m</div>
          </div>
          <div className="hidden sm:block">
            <div className="text-[10px] font-mono uppercase tracking-widest text-liu-muted">Value</div>
            <div className="font-semibold font-mono" style={{ color: '#60a5fa' }}>{player.valueScore}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 rounded-xl w-56" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <div className="card h-14" />
      {[...Array(6)].map((_, i) => <div key={i} className="card h-16" />)}
    </div>
  );
}

function ErrorCard({ error }) {
  return (
    <div className="card text-sm" style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', color: '#f87171' }}>
      <p className="font-semibold mb-1">Failed to load</p>
      <p className="opacity-80">{error}</p>
    </div>
  );
}
