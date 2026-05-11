import { useState, useEffect, useMemo } from 'react';
import { getBootstrap, getFixtures } from '../lib/fpl-api';
import { buildFixtureMap, getRecommendations } from '../lib/ml';

const POSITIONS = ['GKP', 'DEF', 'MID', 'FWD'];
const SORT_MODES = [
  { value: 'xpts', label: 'xPts', desc: 'Highest expected points' },
  { value: 'value', label: 'Value', desc: 'Best xPts per £m' },
  { value: 'differential', label: 'Differential', desc: '<10% ownership' },
];
const FDR_BG = ['', 'bg-emerald-500', 'bg-lime-400', 'bg-yellow-400', 'bg-orange-500', 'bg-red-500'];
const FDR_TEXT = ['', 'text-black', 'text-black', 'text-black', 'text-white', 'text-white'];
const POSITION_COLOR = {
  1: 'text-yellow-400',
  2: 'text-blue-400',
  3: 'text-emerald-400',
  4: 'text-red-400',
};
const POSITION_LABEL = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };

export default function TransfersPage() {
  const [bootstrap, setBootstrap] = useState(null);
  const [fixtures, setFixtures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [position, setPosition] = useState('MID');
  const [sortMode, setSortMode] = useState('xpts');
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
      [...bootstrap.events].reverse().find((e) => e.finished)?.id ||
      1;

    const teamMap = Object.fromEntries(bootstrap.teams.map((t) => [t.id, t]));
    const fixturesByTeam = buildFixtureMap(fixtures, currentGw);
    const budget = maxBudget ? parseFloat(maxBudget) : null;
    const recs = getRecommendations(bootstrap.elements, fixturesByTeam, position, budget);

    const list =
      sortMode === 'xpts'
        ? recs.topXpts
        : sortMode === 'value'
        ? recs.topValue
        : recs.differentials;

    return { players: list, fixturesByTeam, teamMap };
  }, [bootstrap, fixtures, position, sortMode, maxBudget]);

  if (loading) return <Skeleton />;
  if (error) return <ErrorCard error={error} />;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">Transfer Suggestions</h1>
        <p className="text-gray-500 text-sm mt-0.5">
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
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                position === p
                  ? 'bg-emerald-500 text-black'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
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
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                sortMode === m.value
                  ? 'bg-gray-600 text-white font-medium'
                  : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-gray-500">Max</span>
          <span className="text-gray-500">£</span>
          <input
            type="number"
            step="0.1"
            min="4"
            max="15"
            value={maxBudget}
            onChange={(e) => setMaxBudget(e.target.value)}
            placeholder="any"
            className="w-20 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:border-emerald-500"
          />
          <span className="text-gray-500">m</span>
        </div>
      </div>

      {/* Model explanation */}
      <div className="mb-4 px-3 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-300">
        <strong>xPts</strong> = (0.6 × form + 0.4 × PPG) × fixture factor × availability ·{' '}
        <strong>Value</strong> = xPts / cost · Fixture colours: green = easy, red = hard
      </div>

      {/* Player cards */}
      <div className="space-y-2">
        {players.length === 0 ? (
          <div className="card text-center text-gray-500 py-10">
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
    <div className="card hover:border-gray-700 transition-colors">
      <div className="flex items-center gap-3">
        <span className="text-gray-600 w-5 text-xs text-right font-mono">{rank}</span>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`text-xs font-semibold ${POSITION_COLOR[player.element_type]}`}>
              {POSITION_LABEL[player.element_type]}
            </span>
            <span className="font-semibold">{player.web_name}</span>
            <span className="text-gray-500 text-xs">{team?.short_name}</span>
            {player.status !== 'a' && (
              <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                {player.status === 'd'
                  ? `${player.chance_of_playing_next_round ?? '?'}% fit`
                  : 'OUT'}
              </span>
            )}
            {player.ownership < 5 && (
              <span className="text-xs bg-purple-500/20 text-purple-400 px-1.5 py-0.5 rounded">
                DIFF
              </span>
            )}
          </div>
          <div className="flex gap-3 text-xs text-gray-500">
            <span>
              Form <strong className="text-white">{player.form}</strong>
            </span>
            <span>
              PPG <strong className="text-white">{player.points_per_game}</strong>
            </span>
            <span>
              Owned <strong className="text-white">{player.ownership}%</strong>
            </span>
          </div>
        </div>

        {/* Upcoming fixtures */}
        <div className="hidden sm:flex items-center gap-1">
          {upcomingFixtures.map((f, i) => {
            const opp = teamMap[f.opponent];
            return (
              <div
                key={i}
                title={`${f.isHome ? 'H' : 'A'} · FDR ${f.difficulty}`}
                className={`w-8 text-center text-[10px] font-bold rounded py-0.5 ${
                  FDR_BG[f.difficulty]
                } ${FDR_TEXT[f.difficulty]}`}
              >
                {opp?.short_name || '?'}
              </div>
            );
          })}
        </div>

        {/* Scores */}
        <div className="flex items-center gap-3 text-right">
          <div>
            <div className="text-[10px] text-gray-500 uppercase">xPts</div>
            <div className="font-bold text-emerald-400 text-lg leading-none">{player.xpts}</div>
          </div>
          <div>
            <div className="text-[10px] text-gray-500 uppercase">Cost</div>
            <div className="font-bold">£{player.cost}m</div>
          </div>
          <div className="hidden sm:block">
            <div className="text-[10px] text-gray-500 uppercase">Value</div>
            <div className="font-semibold text-blue-400">{player.valueScore}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-gray-800 rounded w-56" />
      <div className="card h-14" />
      {[...Array(6)].map((_, i) => (
        <div key={i} className="card h-16" />
      ))}
    </div>
  );
}

function ErrorCard({ error }) {
  return (
    <div className="card border-red-500/30 bg-red-500/5 text-red-400">
      <p className="font-semibold mb-1">Failed to load</p>
      <p className="text-sm opacity-80">{error}</p>
    </div>
  );
}
