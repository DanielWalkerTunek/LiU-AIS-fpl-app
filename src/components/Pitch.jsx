import { useState } from 'react';

export const POS_COLOR = {
  1: { bg: 'rgba(234,179,8,0.85)',  color: '#0a1120' },
  2: { bg: 'rgba(59,130,246,0.85)', color: '#0a1120' },
  3: { bg: 'rgba(64,196,255,0.85)', color: '#0a1120' },
  4: { bg: 'rgba(239,68,68,0.85)',  color: '#0a1120' },
};

// Club crest with a graceful fallback to the short code text if a badge is
// missing for a team (promoted/relegated clubs, etc.) rather than a broken
// image icon.
export function TeamBadge({ team, className, style }) {
  const [failed, setFailed] = useState(false);

  if (failed || !team?.short_name) {
    return (
      <div
        className={className}
        style={{ ...style, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
      >
        {team?.short_name || '—'}
      </div>
    );
  }

  return (
    <img
      src={`/badges/${team.short_name}.png`}
      alt={team.short_name}
      className={className}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}

export function Pitch({ picks, playerMap, teamMap, livePoints }) {
  const rows = [1, 2, 3, 4].map((type) =>
    picks.filter((p) => playerMap[p.element]?.element_type === type)
  );

  return (
    <div
      className="relative rounded-2xl overflow-hidden p-4 md:p-6 space-y-4 md:space-y-8"
      style={{
        background:
          'repeating-linear-gradient(90deg, rgba(255,255,255,0.05) 0px, rgba(255,255,255,0.05) 40px, rgba(0,0,0,0.05) 40px, rgba(0,0,0,0.05) 80px), radial-gradient(ellipse at center, #1c7a44 0%, #15642f 65%, #0f4a24 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {/* Pitch markings */}
      <div
        className="absolute inset-4 md:inset-6 rounded-lg pointer-events-none"
        style={{ border: '1px solid rgba(255,255,255,0.18)' }}
      />
      <div
        className="absolute left-1/2 top-1/2 w-20 h-20 md:w-28 md:h-28 rounded-full pointer-events-none"
        style={{ border: '1px solid rgba(255,255,255,0.18)', transform: 'translate(-50%, -50%)' }}
      />
      <div
        className="absolute left-4 right-4 md:left-6 md:right-6 top-1/2 pointer-events-none"
        style={{ borderTop: '1px solid rgba(255,255,255,0.18)' }}
      />

      {rows.map((row, i) => (
        <div key={i} className="relative z-10 flex justify-center gap-3 md:gap-8 flex-wrap">
          {row.map((pick) => (
            <PlayerToken
              key={pick.element}
              pick={pick}
              player={playerMap[pick.element]}
              team={teamMap[playerMap[pick.element]?.team]}
              livePoints={livePoints}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function PlayerToken({ pick, player, team, livePoints }) {
  const pts = livePoints[pick.element] ?? 0;
  const displayPts = pick.multiplier > 1 ? pts * pick.multiplier : pts;
  const priceDropping = player?.cost_change_event < 0;
  const inForm = parseFloat(player?.form) > 5;

  return (
    <div className="flex flex-col items-center gap-1 w-16 md:w-20">
      <div className="relative">
        <div
          className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center shrink-0"
          style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}
        >
          <TeamBadge team={team} className="w-full h-full object-contain" style={{ color: '#fff', fontSize: '10px' }} />
        </div>
        {(pick.is_captain || pick.is_vice_captain) && (
          <span
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold font-mono"
            style={{
              background: pick.is_captain ? '#fbbf24' : '#7a94b0',
              color: '#0a1120',
              border: '1px solid rgba(10,17,32,0.4)',
            }}
          >
            {pick.is_captain ? 'C' : 'V'}
          </span>
        )}
        {priceDropping && (
          <span
            title="Price dropping"
            className="absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold font-mono"
            style={{ background: '#f87171', color: '#0a1120', border: '1px solid rgba(10,17,32,0.4)' }}
          >
            !
          </span>
        )}
        {!priceDropping && inForm && (
          <span
            title="In form"
            className="absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold"
            style={{ background: '#22c55e', color: '#0a1120', border: '1px solid rgba(10,17,32,0.4)' }}
          >
            ↑
          </span>
        )}
      </div>
      <div
        className="text-[10px] md:text-xs font-semibold text-white text-center truncate w-full px-1 py-0.5 rounded"
        style={{ background: 'rgba(0,0,0,0.35)' }}
      >
        {player?.web_name || '—'}
      </div>
      <div
        className="text-[10px] font-bold font-mono px-1.5 rounded"
        style={{ color: displayPts > 0 ? '#40c4ff' : 'rgba(255,255,255,0.4)' }}
      >
        {displayPts} pts
      </div>
    </div>
  );
}
