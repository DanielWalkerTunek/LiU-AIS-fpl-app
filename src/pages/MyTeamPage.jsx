import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getBootstrap, getManagerEntry, getManagerPicks, getLiveGW } from '../lib/fpl-api';

const POS_LABEL = { 1: 'GK', 2: 'DEF', 3: 'MID', 4: 'FWD' };
const POS_COLOR = {
  1: { bg: 'rgba(234,179,8,0.15)',  color: '#fbbf24' },
  2: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  3: { bg: 'rgba(64,196,255,0.15)', color: '#40c4ff' },
  4: { bg: 'rgba(239,68,68,0.15)',  color: '#f87171' },
};

export default function MyTeamPage() {
  const { user, profile } = useOutletContext();
  const fplId = profile?.fpl_manager_id;

  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [bootstrap,  setBootstrap]  = useState(null);
  const [entry,      setEntry]      = useState(null);
  const [picks,      setPicks]      = useState(null);
  const [picksError, setPicksError] = useState(null);
  const [liveData,   setLiveData]   = useState(null);

  useEffect(() => {
    if (!fplId) { setLoading(false); return; }
    async function load() {
      try {
        setLoading(true);
        setPicksError(null);
        const [bs, ent] = await Promise.all([getBootstrap(), getManagerEntry(fplId)]);
        setBootstrap(bs);
        setEntry(ent);

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

  if (!user) return <Empty icon="👤" text="Sign in to see your team." />;
  if (!fplId) return <Empty icon="⚽" text="Add your FPL Manager ID in your profile (account button) to see your team." />;
  if (loading) return <Skeleton />;
  if (error) return <ErrorCard error={error} />;

  const playerMap = Object.fromEntries(bootstrap.elements.map((p) => [p.id, p]));
  const teamMap   = Object.fromEntries(bootstrap.teams.map((t) => [t.id, t]));
  const livePoints = Object.fromEntries(
    (liveData?.elements || []).map((el) => [el.id, el.stats.total_points])
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">{entry.name}</h1>
        <p className="text-liu-muted text-sm font-mono">
          {entry.player_first_name} {entry.player_last_name}
        </p>
      </div>

      {/* Summary meta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Overall Points', value: entry.summary_overall_points ?? '—' },
          { label: 'Overall Rank', value: entry.summary_overall_rank ? entry.summary_overall_rank.toLocaleString() : '—' },
          {
            label: 'Bank',
            value: picks?.entry_history?.bank != null ? `£${(picks.entry_history.bank / 10).toFixed(1)}m` : '—',
          },
          {
            label: 'Team Value',
            value: picks?.entry_history?.value != null ? `£${(picks.entry_history.value / 10).toFixed(1)}m` : '—',
          },
        ].map(({ label, value }) => (
          <div key={label} className="card">
            <div className="text-xs font-mono uppercase tracking-widest text-liu-muted mb-1">{label}</div>
            <div className="font-semibold text-sm">{value}</div>
          </div>
        ))}
      </div>

      {/* Squad */}
      <div className="card">
        <h2 className="text-xs font-mono uppercase tracking-widest text-liu-muted mb-3">Squad</h2>

        {picksError && (
          <div className="text-center py-10 text-liu-muted text-sm font-mono">{picksError}</div>
        )}

        {!picksError && picks && (
          <>
            <div className="flex flex-wrap gap-3 text-xs text-liu-muted mb-3 font-mono">
              <span>
                Transfers: {picks.entry_history?.event_transfers}
                {picks.entry_history?.event_transfers_cost > 0 &&
                  ` (−${picks.entry_history.event_transfers_cost}pts)`}
              </span>
              <span>GW Points: {picks.entry_history?.points}</span>
              {picks.active_chip && (
                <span style={{ color: '#fbbf24' }}>Chip: {picks.active_chip}</span>
              )}
            </div>

            <div className="space-y-0.5">
              {picks.picks?.map((pick, i) => {
                const player = playerMap[pick.element];
                const pts = livePoints[pick.element] ?? 0;
                const displayPts = pick.multiplier > 1 ? pts * pick.multiplier : pts;
                const onBench = pick.position > 11;
                const pc = POS_COLOR[player?.element_type];

                return (
                  <div
                    key={pick.element}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-opacity ${onBench ? 'opacity-40' : ''} ${i === 11 ? 'mt-2 border-t' : ''}`}
                    style={i === 11 ? { borderColor: 'rgba(255,255,255,0.06)' } : {}}
                  >
                    <span
                      className="text-xs w-4 font-bold font-mono"
                      style={{
                        color: pick.is_captain ? '#fbbf24' : pick.is_vice_captain ? '#7a94b0' : 'transparent',
                      }}
                    >
                      {pick.is_captain ? 'C' : pick.is_vice_captain ? 'V' : 'x'}
                    </span>
                    {pc && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold"
                        style={{ background: pc.bg, color: pc.color }}
                      >
                        {POS_LABEL[player?.element_type]}
                      </span>
                    )}
                    <span className="flex-1 truncate text-white">{player?.web_name || '—'}</span>
                    <span className="text-liu-muted text-xs font-mono">
                      {teamMap[player?.team]?.short_name}
                    </span>
                    <span
                      className="font-bold w-7 text-right text-sm font-mono"
                      style={{ color: displayPts > 0 ? '#40c4ff' : 'rgba(122,148,176,0.4)' }}
                    >
                      {displayPts}
                    </span>
                  </div>
                );
              })}
            </div>

            <div
              className="mt-3 pt-3 text-xs text-liu-muted font-mono"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              Bench pts: {picks.entry_history?.points_on_bench}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Empty({ icon, text }) {
  return (
    <div className="text-center py-24 text-liu-muted">
      <p className="text-5xl mb-4">{icon}</p>
      <p className="font-mono text-sm">{text}</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 rounded-xl w-48" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="card h-14" />
        ))}
      </div>
      <div className="card h-64" />
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
