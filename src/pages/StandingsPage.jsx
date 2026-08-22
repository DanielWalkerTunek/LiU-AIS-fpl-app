import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getLeagueMembers, getManagerHistory } from '../lib/fpl-api';

export default function StandingsPage() {
  const { leagueId } = useOutletContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [league, setLeague] = useState(null);
  const [standings, setStandings] = useState([]);
  const [histories, setHistories] = useState({});

  useEffect(() => {
    if (!leagueId) { setLoading(false); return; }
    async function load() {
      try {
        setLoading(true);
        const data = await getLeagueMembers(leagueId);
        setLeague(data.league);
        const results = data.members;
        setStandings(results);
        const settled = await Promise.allSettled(
          results.map((m) =>
            getManagerHistory(m.entry).then((h) => ({ id: m.entry, history: h.current || [] }))
          )
        );
        const hist = {};
        for (const r of settled) {
          if (r.status === 'fulfilled') hist[r.value.id] = r.value.history;
        }
        setHistories(hist);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [leagueId]);

  if (!leagueId) return <Empty text="Enter your league ID in settings to see standings." />;
  if (loading) return <Skeleton />;
  if (error) return <ErrorCard error={error} />;

  const top = standings[0]?.total || 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{league?.name || 'League'}</h1>
        <p className="text-liu-muted text-sm font-mono mt-0.5">
          Classic League | {standings.length} managers
        </p>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(255,255,255,0.08)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr
              className="text-xs font-mono uppercase tracking-widest text-liu-muted"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}
            >
              <th className="py-3 pl-5 text-left w-10">#</th>
              <th className="py-3 text-left">Manager</th>
              <th className="py-3 pr-4 text-right">GW</th>
              <th className="py-3 pr-4 text-right">Total</th>
              <th className="py-3 pr-4 text-right hidden sm:table-cell">Gap</th>
              <th className="py-3 pr-5 text-right hidden md:table-cell">Form</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((m, idx) => {
              const delta = m.last_rank - m.rank;
              const hist = (histories[m.entry] || []).slice(-5).map((h) => h.points);
              const isFirst = idx === 0;

              return (
                <tr
                  key={m.entry}
                  style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                  className="transition-colors"
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.025)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="py-3 pl-5">
                    <div className="flex items-center gap-1.5">
                      <span className={`font-bold font-mono w-4 ${isFirst ? '' : ''}`}
                        style={isFirst ? { color: '#40c4ff' } : {}}
                      >
                        {m.rank}
                      </span>
                      <RankBadge delta={delta} />
                    </div>
                  </td>
                  <td className="py-3">
                    <div className="font-medium text-white">{m.player_name}</div>
                    <div className="text-xs text-liu-muted font-mono">{m.entry_name}</div>
                  </td>
                  <td className="py-3 pr-4 text-right font-bold font-mono" style={{ color: '#40c4ff' }}>
                    {m.event_total}
                  </td>
                  <td className="py-3 pr-4 text-right font-bold font-mono text-white">
                    {m.total}
                  </td>
                  <td className="py-3 pr-4 text-right text-liu-muted font-mono hidden sm:table-cell">
                    {m.rank === 1 ? '—' : `−${top - m.total}`}
                  </td>
                  <td className="py-3 pr-5 hidden md:table-cell">
                    <Sparkline data={hist} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RankBadge({ delta }) {
  if (delta > 0) return <span className="text-xs" style={{ color: '#40c4ff' }}>▲</span>;
  if (delta < 0) return <span className="text-xs text-red-400">▼</span>;
  return <span className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>;
}

function Sparkline({ data }) {
  if (!data.length) return <span className="text-xs text-liu-muted">—</span>;
  const max = Math.max(...data, 1);
  return (
    <div className="flex items-end gap-px h-5 justify-end">
      {data.map((v, i) => (
        <div
          key={i}
          title={`${v} pts`}
          className="w-3.5 rounded-t"
          style={{
            height: `${Math.max((v / max) * 100, 8)}%`,
            background: 'linear-gradient(180deg, #40c4ff 0%, rgba(0,136,204,0.5) 100%)',
          }}
        />
      ))}
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
      <div className="h-8 rounded-xl w-56" style={{ background: 'rgba(255,255,255,0.05)' }} />
      <div className="card h-72" />
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
