import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getBootstrap, getFixtures, getManagerPicks, getLiveGW } from '../lib/fpl-api';
import { buildFixtureMap, computeXPts, computeFixtureBreakdown, computePositionAvgPpg, FDR_BG, FDR_TEXT } from '../lib/ml';
import { Pitch, PlayerToken, POS_COLOR } from '../components/Pitch';

const POSITION_MAP = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const LONG_TERM_WINDOW = 5;

function buildSuggestions({ picks, playerMap, squadIds, bank, scoreFn }) {
  const candidates = Object.values(playerMap).map((p) => ({
    player: p,
    score: scoreFn(p),
    cost: p.now_cost / 10,
  }));

  return picks
    .map((pick) => {
      const player = playerMap[pick.element];
      if (!player) return null;
      // no minutes yet this season means no real signal to judge them on -
      // don't suggest transferring someone out before they've even played
      if (player.minutes === 0) return null;
      const outScore = scoreFn(player);
      const budget   = player.now_cost / 10 + bank;

      const best = candidates
        .filter((c) => c.player.element_type === player.element_type)
        .filter((c) => !squadIds.has(c.player.id))
        .filter((c) => c.cost <= budget)
        .sort((a, b) => b.score - a.score)[0];

      if (!best || best.score <= outScore + 0.5) return null;
      return { out: player, outScore, in: best.player, inScore: best.score, delta: best.score - outScore };
    })
    .filter(Boolean)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 2);
}

export default function TransfersPage() {
  const { user, profile } = useOutletContext();
  const fplId = profile?.fpl_manager_id;

  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [bootstrap,  setBootstrap]  = useState(null);
  const [fixtures,   setFixtures]   = useState([]);
  const [picks,      setPicks]      = useState(null);
  const [picksError, setPicksError] = useState(null);
  const [liveData,   setLiveData]   = useState(null);

  useEffect(() => {
    if (!fplId) { setLoading(false); return; }
    async function load() {
      try {
        setLoading(true);
        setPicksError(null);
        const [bs, fx] = await Promise.all([getBootstrap(), getFixtures()]);
        setBootstrap(bs);
        setFixtures(fx);

        const gw =
          bs.events.find((e) => e.is_current)?.id ||
          [...bs.events].reverse().find((e) => e.finished)?.id ||
          bs.events.find((e) => e.is_next)?.id || 1;

        try {
          const [pk, live] = await Promise.all([getManagerPicks(fplId, gw), getLiveGW(gw)]);
          setPicks(pk);
          setLiveData(live);
        } catch {
          setPicksError('Picks aren’t public until the gameweek deadline passes — check back after kickoff.');
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [fplId]);

  const { starting, bench, teamMap, playerMap, hotSuggestions, longTermSuggestions } = useMemo(() => {
    if (!bootstrap || !picks)
      return { starting: [], bench: [], teamMap: {}, playerMap: {}, hotSuggestions: [], longTermSuggestions: [] };

    const teamMap   = Object.fromEntries(bootstrap.teams.map((t) => [t.id, t]));
    const playerMap = Object.fromEntries(bootstrap.elements.map((p) => [p.id, p]));

    const currentGw =
      bootstrap.events.find((e) => e.is_current)?.id ||
      [...bootstrap.events].reverse().find((e) => e.finished)?.id ||
      bootstrap.events.find((e) => e.is_next)?.id || 1;
    const fixturesByTeam = fixtures.length ? buildFixtureMap(fixtures, currentGw) : {};
    const positionAvgPpg = computePositionAvgPpg(bootstrap.elements);

    const squadIds = new Set(picks.picks.map((p) => p.element));
    const bank = (picks.entry_history?.bank || 0) / 10;
    const starting = picks.picks.filter((p) => p.position <= 11);
    const bench    = picks.picks.filter((p) => p.position > 11).sort((a, b) => a.position - b.position);

    const args = { picks: picks.picks, playerMap, squadIds, bank };

    const hotSuggestions = buildSuggestions({
      ...args,
      scoreFn: (p) => computeXPts(p, fixturesByTeam, positionAvgPpg, 1),
    });

    const longTermSuggestions = buildSuggestions({
      ...args,
      scoreFn: (p) => computeFixtureBreakdown(p, fixturesByTeam, positionAvgPpg, LONG_TERM_WINDOW).total,
    }).map((s) => ({
      ...s,
      outBreakdown: computeFixtureBreakdown(s.out, fixturesByTeam, positionAvgPpg, LONG_TERM_WINDOW),
      inBreakdown:  computeFixtureBreakdown(s.in,  fixturesByTeam, positionAvgPpg, LONG_TERM_WINDOW),
    }));

    return { starting, bench, teamMap, playerMap, hotSuggestions, longTermSuggestions };
  }, [bootstrap, fixtures, picks]);

  const livePoints = Object.fromEntries(
    (liveData?.elements || []).map((el) => [el.id, el.stats.total_points])
  );

  if (!user) return <Empty text="Sign in to see transfer suggestions for your team." />;
  if (!fplId) return <Empty text="Add your FPL Manager ID in your profile (account button) to see transfer suggestions." />;
  if (loading) return <Skeleton />;
  if (error) return <ErrorCard error={error} />;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Transfers</h1>
        <p className="text-liu-muted text-sm font-mono mt-0.5">
          Suggestions based on the xPts model | red ! = price dropping | green up arrow = in form
        </p>
      </div>

      {picksError && (
        <div className="card text-center py-10 text-liu-muted text-sm font-mono">{picksError}</div>
      )}

      {!picksError && picks && (
        <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
          <div>
            <Pitch picks={starting} playerMap={playerMap} teamMap={teamMap} livePoints={livePoints} />

            <div className="mt-4">
              <h2 className="text-xs font-mono uppercase tracking-widest text-liu-muted mb-2">
                Bench | {picks.entry_history?.points_on_bench} pts
              </h2>
              <div className="card flex justify-center gap-4 md:gap-8 flex-wrap py-5">
                {bench.map((pick) => (
                  <PlayerToken
                    key={pick.element}
                    pick={pick}
                    player={playerMap[pick.element]}
                    team={teamMap[playerMap[pick.element]?.team]}
                    livePoints={livePoints}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card">
              <h2 className="text-xs font-mono uppercase tracking-widest text-liu-muted mb-0.5">
                Hot Transfers
              </h2>
              <p className="text-[11px] text-liu-muted font-mono mb-3">Next gameweek only</p>
              {hotSuggestions.length === 0 ? (
                <p className="text-sm text-liu-muted font-mono py-4 text-center">
                  No clear upgrades within budget right now.
                </p>
              ) : (
                <div className="space-y-3">
                  {hotSuggestions.map((s, i) => (
                    <HotSuggestionCard key={i} suggestion={s} teamMap={teamMap} />
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="text-xs font-mono uppercase tracking-widest text-liu-muted mb-0.5">
                Long Term Transfers
              </h2>
              <p className="text-[11px] text-liu-muted font-mono mb-3">Next {LONG_TERM_WINDOW} fixtures</p>
              {longTermSuggestions.length === 0 ? (
                <p className="text-sm text-liu-muted font-mono py-4 text-center">
                  No clear upgrades within budget right now.
                </p>
              ) : (
                <div className="space-y-4">
                  {longTermSuggestions.map((s, i) => (
                    <LongTermSuggestionCard key={i} suggestion={s} teamMap={teamMap} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HotSuggestionCard({ suggestion, teamMap }) {
  const { out, in: inPlayer, outScore, inScore, delta } = suggestion;
  const pos = POSITION_MAP[out.element_type];
  const pc = POS_COLOR[out.element_type];

  return (
    <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] px-1.5 py-0.5 font-mono font-semibold"
          style={{ background: pc?.bg, color: pc?.color }}
        >
          {pos}
        </span>
        <span className="text-xs font-mono font-bold" style={{ color: '#40c4ff' }}>+{delta.toFixed(1)} xPts</span>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="min-w-0">
          <div className="text-liu-muted text-xs font-mono uppercase tracking-widest">Out</div>
          <div className="font-medium text-white truncate">{out.web_name}</div>
          <div className="text-xs text-liu-muted font-mono">{teamMap[out.team]?.short_name} | {outScore} xPts</div>
        </div>
        <div className="text-liu-muted px-2">→</div>
        <div className="min-w-0 text-right">
          <div className="text-liu-muted text-xs font-mono uppercase tracking-widest">In</div>
          <div className="font-medium text-white truncate">{inPlayer.web_name}</div>
          <div className="text-xs text-liu-muted font-mono">{teamMap[inPlayer.team]?.short_name} | {inScore} xPts</div>
        </div>
      </div>
    </div>
  );
}

function FixtureRow({ breakdown, teamMap }) {
  return (
    <div className="flex items-center gap-1">
      {breakdown.fixtures.map((f, i) => {
        const opp = teamMap[f.opponent];
        return (
          <div
            key={i}
            title={`${f.isHome ? 'H' : 'A'} | FDR ${f.difficulty} | ${f.xpts} xPts`}
            className="flex-1 text-center text-[9px] font-mono font-bold py-1"
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
  );
}

function LongTermSuggestionCard({ suggestion, teamMap }) {
  const { out, in: inPlayer, outBreakdown, inBreakdown, delta } = suggestion;
  const pos = POSITION_MAP[out.element_type];
  const pc = POS_COLOR[out.element_type];

  return (
    <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-3">
        <span
          className="text-[10px] px-1.5 py-0.5 font-mono font-semibold"
          style={{ background: pc?.bg, color: pc?.color }}
        >
          {pos}
        </span>
        <span className="text-xs font-mono font-bold" style={{ color: '#40c4ff' }}>+{delta.toFixed(1)} total xPts</span>
      </div>

      <div className="mb-2">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-liu-muted text-xs font-mono uppercase tracking-widest">Out</span>
          <span className="font-medium text-white text-sm truncate">{out.web_name}</span>
          <span className="text-liu-muted text-xs font-mono">{outBreakdown.total} total</span>
        </div>
        <FixtureRow breakdown={outBreakdown} teamMap={teamMap} />
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-liu-muted text-xs font-mono uppercase tracking-widest">In</span>
          <span className="font-medium text-white text-sm truncate">{inPlayer.web_name}</span>
          <span className="text-liu-muted text-xs font-mono">{inBreakdown.total} total</span>
        </div>
        <FixtureRow breakdown={inBreakdown} teamMap={teamMap} />
      </div>
    </div>
  );
}

function Empty({ text }) {
  return (
    <div className="text-center py-24 text-liu-muted">
      <p className="font-mono text-sm">{text}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 w-48" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        <div className="card h-96" />
        <div className="card h-64" />
      </div>
    </div>
  );
}

function ErrorCard({ error }) {
  return (
    <div
      className="card text-sm"
      style={{ borderColor: 'rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.05)', color: '#f87171' }}
    >
      <p className="font-semibold mb-1">Failed to load</p>
      <p className="opacity-80">{error}</p>
    </div>
  );
}
