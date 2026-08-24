import { useState, useEffect, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getBootstrap, getFixtures, getManagerPicks, getLiveGW } from '../lib/fpl-api';
import { buildFixtureMap, computeXPts, computeFixtureBreakdown, computePositionAvgPpg, computePlayingLikelihood, FDR_BG, FDR_TEXT } from '../lib/ml';
import { Pitch, PlayerToken, POS_COLOR } from '../components/Pitch';

const POSITION_MAP = { 1: 'GKP', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const LONG_TERM_WINDOW = 5;

// Best affordable same-position replacement for `player`, using
// `budget` (sale value + whatever's left in the bank) as the cap. `minGain`
// is how much better the replacement's score must be to be worth
// suggesting — xPts and playing-likelihood live on very different scales
// (a couple of points vs. 0-100), so callers pick a threshold that fits.
function bestReplacement({ player, candidates, squadIds, excludeIds, budget, outScore, minGain }) {
  const best = candidates
    .filter((c) => c.player.element_type === player.element_type)
    .filter((c) => !squadIds.has(c.player.id))
    .filter((c) => !excludeIds.has(c.player.id))
    .filter((c) => c.cost <= budget)
    .sort((a, b) => b.score - a.score)[0];

  if (!best || best.score <= outScore + minGain) return null;
  return best;
}

// Suggests up to `maxTransfers` transfers meant to be read as a package: each
// one's budget is what's left of the bank after paying for the ones before
// it, not a fresh independent budget — so if they were all made together,
// their combined cost genuinely fits the sale value of every outgoing
// player + the bank, same as FPL actually charges for multiple transfers in
// one go. Capped at maxTransfers so it never suggests more transfers than
// the user has free — an extra transfer costs -4pts, and the point is to
// avoid a hit, not spend one recommending it.
function buildSuggestions({ picks, playerMap, squadIds, bank, scoreFn, maxTransfers, minGain = 0.5, gwSoFar = 0 }) {
  const candidates = Object.values(playerMap).map((p) => ({
    player: p,
    score: scoreFn(p),
    cost: p.now_cost / 10,
  }));

  const outCandidates = picks
    .map((pick) => {
      const player = playerMap[pick.element];
      if (!player) return null;
      // Before any gameweek has been played there's genuinely no signal yet
      // (everyone's on 0 minutes), so don't flag the whole squad. Once at
      // least one gameweek has happened, 0 minutes is real information — an
      // unused sub or a hidden injury — and is exactly who should surface,
      // especially for Bench Boost.
      if (player.minutes === 0 && gwSoFar === 0) return null;
      return { player, outScore: scoreFn(player), sellPrice: player.now_cost / 10 };
    })
    .filter(Boolean);

  // Priority order: which outgoing player has the biggest available upgrade,
  // judged as if it were the only transfer (bank alone as budget).
  const priority = outCandidates
    .map((o) => {
      const best = bestReplacement({
        player: o.player, candidates, squadIds, excludeIds: new Set(),
        budget: o.sellPrice + bank, outScore: o.outScore, minGain,
      });
      return best ? { ...o, delta: best.score - o.outScore } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.delta - a.delta);

  const result = [];
  const usedIn = new Set();
  let remainingBank = bank;

  for (const o of priority) {
    if (result.length === maxTransfers) break;
    // Re-pick with what's actually left, since an earlier pick in this same
    // package may have already spent some of the shared budget.
    const best = bestReplacement({
      player: o.player, candidates, squadIds, excludeIds: usedIn,
      budget: o.sellPrice + remainingBank, outScore: o.outScore, minGain,
    });
    if (!best) continue;

    usedIn.add(best.player.id);
    remainingBank -= (best.cost - o.sellPrice);
    result.push({
      out: o.player, outScore: o.outScore, sellPrice: o.sellPrice,
      in: best.player, inScore: best.score, cost: best.cost,
      delta: best.score - o.outScore,
    });
  }

  return result;
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
  const [transferMode, setTransferMode] = useState(1); // 1 | 2 | 3 | 4 | 'wildcard' | 'freehit' | 'bboost'
  const [showExplainer, setShowExplainer] = useState(false);

  const isBboost = transferMode === 'bboost';
  const isChip = transferMode === 'wildcard' || transferMode === 'freehit' || isBboost;
  // Wildcard/Free Hit grant unlimited transfers, so the suggestion cap
  // effectively comes off. Bench Boost grants none - it's a scoring chip,
  // not a transfer chip - so it's capped like a normal 2 free transfers.
  const maxTransfers = isBboost ? 2 : isChip ? 15 : transferMode;
  const pointsHit = !isChip && transferMode > 2 ? (transferMode - 2) * 4 : 0;

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

  const { starting, bench, teamMap, playerMap, hotSuggestions, longTermSuggestions, bboostSuggestions } = useMemo(() => {
    if (!bootstrap || !picks)
      return { starting: [], bench: [], teamMap: {}, playerMap: {}, hotSuggestions: [], longTermSuggestions: [], bboostSuggestions: [] };

    const teamMap   = Object.fromEntries(bootstrap.teams.map((t) => [t.id, t]));
    const playerMap = Object.fromEntries(bootstrap.elements.map((p) => [p.id, p]));

    const currentGw =
      bootstrap.events.find((e) => e.is_current)?.id ||
      [...bootstrap.events].reverse().find((e) => e.finished)?.id ||
      bootstrap.events.find((e) => e.is_next)?.id || 1;
    const fixturesByTeam = fixtures.length ? buildFixtureMap(fixtures, currentGw) : {};
    const positionAvgPpg = computePositionAvgPpg(bootstrap.elements);
    // `finished` stays false for days after a gameweek's matches are
    // actually played (FPL doesn't flip it until bonus points are
    // finalised), so use "deadline has passed" as the real signal for
    // whether a gameweek's minutes/starts data means anything yet.
    const gwSoFar = bootstrap.events.filter((e) => new Date(e.deadline_time) < new Date()).length;

    const squadIds = new Set(picks.picks.map((p) => p.element));
    const bank = (picks.entry_history?.bank || 0) / 10;
    const starting = picks.picks.filter((p) => p.position <= 11);
    const bench    = picks.picks.filter((p) => p.position > 11).sort((a, b) => a.position - b.position);

    const args = { playerMap, squadIds, bank, maxTransfers, gwSoFar };

    // Hot/Long Term only care about points, and only your starting 11 score
    // points (bench players' scores don't count unless auto-subbed in) — so
    // only they're worth suggesting a transfer for here.
    const hotSuggestions = buildSuggestions({
      ...args,
      picks: starting,
      scoreFn: (p) => computeXPts(p, fixturesByTeam, positionAvgPpg, 1),
    });

    const longTermSuggestions = buildSuggestions({
      ...args,
      picks: starting,
      scoreFn: (p) => computeFixtureBreakdown(p, fixturesByTeam, positionAvgPpg, LONG_TERM_WINDOW).total,
    }).map((s) => ({
      ...s,
      outBreakdown: computeFixtureBreakdown(s.out, fixturesByTeam, positionAvgPpg, LONG_TERM_WINDOW),
      inBreakdown:  computeFixtureBreakdown(s.in,  fixturesByTeam, positionAvgPpg, LONG_TERM_WINDOW),
    }));

    // Bench Boost isn't about who scores most, it's about making sure all 15
    // shirts are actually on the pitch — rank by playing likelihood instead
    // of xPts, use a much larger minGain since the score is 0-100, and
    // consider the full 15 since bench points count too under this chip.
    const bboostSuggestions = buildSuggestions({
      ...args,
      picks: picks.picks,
      scoreFn: (p) => computePlayingLikelihood(p, gwSoFar),
      minGain: 10,
    });

    return { starting, bench, teamMap, playerMap, hotSuggestions, longTermSuggestions, bboostSuggestions };
  }, [bootstrap, fixtures, picks, maxTransfers]);

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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold tracking-tight">Transfers</h1>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2].map((n) => (
                <button
                  key={n}
                  onClick={() => setTransferMode(n)}
                  className="w-7 h-7 text-xs font-mono font-bold transition-all"
                  style={
                    transferMode === n
                      ? { background: 'linear-gradient(135deg,#0070bb,#09ddff)', color: '#fff' }
                      : { background: 'rgba(255,255,255,0.05)', color: '#7a94b0', border: '1px solid rgba(255,255,255,0.06)' }
                  }
                >
                  {n}
                </button>
              ))}
              {[[3, -4], [4, -8]].map(([n, hit]) => (
                <button
                  key={n}
                  onClick={() => setTransferMode(n)}
                  title={`${n} transfers — ${hit}pt hit`}
                  className="px-2 h-7 text-[11px] font-mono font-bold transition-all"
                  style={
                    transferMode === n
                      ? { background: 'linear-gradient(135deg,#0070bb,#09ddff)', color: '#fff' }
                      : { background: 'rgba(239,68,68,0.06)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }
                  }
                >
                  {n} <span style={{ opacity: 0.8 }}>{hit}</span>
                </button>
              ))}
              <div className="w-px h-5 mx-1" style={{ background: 'rgba(255,255,255,0.1)' }} />
              {[['wildcard', 'WC'], ['freehit', 'FH']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setTransferMode(key)}
                  title={key === 'wildcard' ? 'Wildcard — unlimited free transfers' : 'Free Hit — unlimited transfers for one gameweek only'}
                  className="px-2 h-7 text-[11px] font-mono font-bold uppercase tracking-widest transition-all"
                  style={
                    transferMode === key
                      ? { background: 'linear-gradient(135deg,#fbbf24,#f59e0b)', color: '#0a1120' }
                      : { background: 'rgba(251,191,36,0.06)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }
                  }
                >
                  {label}
                </button>
              ))}
              <button
                onClick={() => setTransferMode('bboost')}
                title="Bench Boost — no extra transfers, just makes sure your 15 are actually playing"
                className="px-2 h-7 text-[11px] font-mono font-bold uppercase tracking-widest transition-all"
                style={
                  isBboost
                    ? { background: 'linear-gradient(135deg,#a78bfa,#8b5cf6)', color: '#0a1120' }
                    : { background: 'rgba(167,139,250,0.06)', color: '#c4b5fd', border: '1px solid rgba(167,139,250,0.2)' }
                }
              >
                BB
              </button>
            </div>
            <button
              onClick={() => setShowExplainer((v) => !v)}
              title="How these suggestions work"
              className="w-7 h-7 rounded-full text-xs font-bold font-mono transition-all shrink-0"
              style={
                showExplainer
                  ? { background: 'rgba(64,196,255,0.18)', color: '#40c4ff', border: '1px solid rgba(64,196,255,0.4)' }
                  : { background: 'rgba(255,255,255,0.05)', color: '#7a94b0', border: '1px solid rgba(255,255,255,0.08)' }
              }
            >
              ?
            </button>
          </div>
        </div>

        {showExplainer && (
          <div
            className="mt-3 px-5 py-4 rounded-lg text-xs font-mono leading-relaxed space-y-1.5"
            style={{ background: 'rgba(64,196,255,0.06)', border: '1px solid rgba(64,196,255,0.15)', color: '#9bdfff' }}
          >
            <p>Suggestions are based on the xPts model.</p>
            <p>Red ! = price dropping | Green up arrow = in form</p>
            <p>1 / 2 = free transfers, priced as a package so making them together costs nothing extra. 3 / 4 include the points hit for going beyond 2. WC / FH (Wildcard / Free Hit) assume unlimited free transfers. BB (Bench Boost) grants none of those — it ranks by playing likelihood instead of points, since the goal is a full 15 who are actually on the pitch.</p>
          </div>
        )}

        {pointsHit > 0 && (
          <p className="mt-2 text-xs font-mono" style={{ color: '#f87171' }}>
            Includes a {pointsHit}pt hit for going beyond 2 free transfers.
          </p>
        )}
      </div>

      {picksError && (
        <div className="card text-center py-10 text-liu-muted text-sm font-mono">{picksError}</div>
      )}

      {!picksError && picks && (
        <div className="grid lg:grid-cols-[1fr_360px] gap-4 items-start">
          <div>
            <Pitch picks={starting} playerMap={playerMap} teamMap={teamMap} livePoints={livePoints} />

            <div className="mt-4">
              <h2 className="text-xs font-mono uppercase tracking-widest text-liu-muted mb-2 flex items-center gap-2">
                <span>Bench | {picks.entry_history?.points_on_bench} pts</span>
                {picks.active_chip === 'bboost' && (
                  <span
                    title="Bench Boost active — these points already count toward your total"
                    className="px-1.5 py-0.5 text-[10px] font-bold tracking-widest normal-case"
                    style={{ background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' }}
                  >
                    BBOOST
                  </span>
                )}
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
            {isBboost && (
              <div className="card">
                <h2 className="text-xs font-mono uppercase tracking-widest text-liu-muted mb-0.5">
                  Bench Boost Prep
                </h2>
                <p className="text-[11px] text-liu-muted font-mono mb-3">Ranked by playing likelihood, not points</p>
                {bboostSuggestions.length === 0 ? (
                  <p className="text-sm text-liu-muted font-mono py-4 text-center">
                    Your 15 all look nailed-on to play right now.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {bboostSuggestions.map((s, i) => (
                      <HotSuggestionCard key={i} suggestion={s} teamMap={teamMap} mode="playing" />
                    ))}
                  </div>
                )}
              </div>
            )}

            {transferMode !== 'wildcard' && !isBboost && (
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
            )}

            {transferMode !== 'freehit' && !isBboost && (
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NetCost({ sellPrice, cost }) {
  const net = Math.round((cost - sellPrice) * 10) / 10;
  if (net === 0) return <span className="text-xs font-mono text-liu-muted">£0.0m</span>;
  return (
    <span className="text-xs font-mono font-semibold" style={{ color: net > 0 ? '#f87171' : '#22c55e' }}>
      {net > 0 ? `-£${net.toFixed(1)}m` : `+£${Math.abs(net).toFixed(1)}m`}
    </span>
  );
}

function HotSuggestionCard({ suggestion, teamMap, mode = 'xpts' }) {
  const { out, in: inPlayer, outScore, inScore, delta, sellPrice, cost } = suggestion;
  const pos = POSITION_MAP[out.element_type];
  const pc = POS_COLOR[out.element_type];
  const isPlaying = mode === 'playing';
  const fmtScore = (v) => (isPlaying ? `${v}%` : `${v} xPts`);
  const deltaLabel = isPlaying ? `+${delta.toFixed(0)}%` : `+${delta.toFixed(1)} xPts`;

  return (
    <div className="rounded-lg p-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] px-1.5 py-0.5 font-mono font-semibold"
          style={{ background: pc?.bg, color: pc?.color }}
        >
          {pos}
        </span>
        <div className="flex items-center gap-2">
          <NetCost sellPrice={sellPrice} cost={cost} />
          <span className="text-xs font-mono font-bold" style={{ color: isPlaying ? '#a78bfa' : '#40c4ff' }}>{deltaLabel}</span>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <div className="min-w-0">
          <div className="text-liu-muted text-xs font-mono uppercase tracking-widest">Out</div>
          <div className="font-medium text-white truncate">{out.web_name}</div>
          <div className="text-xs text-liu-muted font-mono">{teamMap[out.team]?.short_name} | £{sellPrice}m | {fmtScore(outScore)}</div>
        </div>
        <div className="text-liu-muted px-2">→</div>
        <div className="min-w-0 text-right">
          <div className="text-liu-muted text-xs font-mono uppercase tracking-widest">In</div>
          <div className="font-medium text-white truncate">{inPlayer.web_name}</div>
          <div className="text-xs text-liu-muted font-mono">{teamMap[inPlayer.team]?.short_name} | £{cost}m | {fmtScore(inScore)}</div>
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
  const { out, in: inPlayer, outBreakdown, inBreakdown, delta, sellPrice, cost } = suggestion;
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
        <div className="flex items-center gap-2">
          <NetCost sellPrice={sellPrice} cost={cost} />
          <span className="text-xs font-mono font-bold" style={{ color: '#40c4ff' }}>+{delta.toFixed(1)} total xPts</span>
        </div>
      </div>

      <div className="mb-2">
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-liu-muted text-xs font-mono uppercase tracking-widest">Out</span>
          <span className="font-medium text-white text-sm truncate">{out.web_name}</span>
          <span className="text-liu-muted text-xs font-mono">£{sellPrice}m | {outBreakdown.total} total</span>
        </div>
        <FixtureRow breakdown={outBreakdown} teamMap={teamMap} />
      </div>

      <div>
        <div className="flex items-baseline justify-between mb-1">
          <span className="text-liu-muted text-xs font-mono uppercase tracking-widest">In</span>
          <span className="font-medium text-white text-sm truncate">{inPlayer.web_name}</span>
          <span className="text-liu-muted text-xs font-mono">£{cost}m | {inBreakdown.total} total</span>
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
