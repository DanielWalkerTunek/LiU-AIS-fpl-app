// Expected-points model for FPL transfer suggestions.
//
// xPts = base × fixture_factor × availability_factor
//
// base            : 0.6 × form + 0.4 × PPG, or PPG alone when form is 0 (no
//                   minutes played yet this season — form is 0 for every
//                   player pre-season and early in the campaign, so letting
//                   it drag the blend down would understate everyone)
// fixture_factor  : 1.15 (FDR 1, easiest) … 0.75 (FDR 5, hardest) over the
//                   next 3 fixtures — fixtures nudge the projection, they
//                   shouldn't swamp a player's underlying quality
// availability    : 1.0 fit | chance/100 doubtful | 0.0 injured/suspended

function fixtureScore(upcoming, n = 3) {
  if (!upcoming.length) return 0.95;
  const slice = upcoming.slice(0, n);
  const avg = slice.reduce((s, f) => s + f.difficulty, 0) / slice.length;
  return 1.15 - (avg - 1) * 0.1;
}

function availabilityFactor(player) {
  if (player.status === 'a') return 1.0;
  if (player.status === 'd') return (player.chance_of_playing_next_round ?? 50) / 100;
  return 0.0;
}

export function computeXPts(player, fixturesByTeam) {
  const ppg = parseFloat(player.points_per_game) || 0;
  const form = parseFloat(player.form) || 0;
  const base = form > 0 ? form * 0.6 + ppg * 0.4 : ppg;
  const fScore = fixtureScore(fixturesByTeam[player.team] || []);
  const avail = availabilityFactor(player);
  return Math.round(base * fScore * avail * 10) / 10;
}

// Build team → upcoming-fixture array from raw fixtures endpoint data.
export function buildFixtureMap(fixtures, currentGw) {
  const map = {};
  const upcoming = fixtures.filter(
    (f) => f.event !== null && !f.finished_provisional && f.event >= currentGw
  );

  for (const fix of upcoming) {
    if (!map[fix.team_h]) map[fix.team_h] = [];
    if (!map[fix.team_a]) map[fix.team_a] = [];

    map[fix.team_h].push({
      difficulty: fix.team_h_difficulty,
      event: fix.event,
      opponent: fix.team_a,
      isHome: true,
    });
    map[fix.team_a].push({
      difficulty: fix.team_a_difficulty,
      event: fix.event,
      opponent: fix.team_h,
      isHome: false,
    });
  }

  for (const id in map) map[id].sort((a, b) => a.event - b.event);

  return map;
}
