// Expected-points model for FPL transfer suggestions.
//
// xPts = stabilized_base × fixture_factor × availability_factor
//
// raw_base        : 0.6 × form + 0.4 × PPG, or PPG alone when form is 0 (no
//                   minutes played yet this season)
// stabilized_base : raw_base shrunk toward the position's current-season
//                   average PPG, weighted by games started — with only 1-2
//                   games played, a single big haul shouldn't produce a
//                   wildly inflated projection, so early on the position
//                   average dominates and raw_base earns more trust as
//                   appearances accumulate (5 starts ≈ 50/50 trust).
// fixture_factor  : 1.15 (FDR 1, easiest) … 0.75 (FDR 5, hardest) averaged
//                   over the next `fixtureWindow` fixtures (default 3) —
//                   fixtures nudge the projection, they shouldn't swamp a
//                   player's underlying quality
// availability    : 1.0 fit | chance/100 doubtful | 0.0 injured/suspended

// FDR 1-5: green → red — shared by any fixture-chip UI.
export const FDR_BG   = ['', '#16a34a', '#65a30d', '#ca8a04', '#ea580c', '#dc2626'];
export const FDR_TEXT = ['', '#fff',    '#fff',    '#fff',    '#fff',    '#fff'];

function fixtureFactorForDifficulty(difficulty) {
  return 1.15 - (difficulty - 1) * 0.1;
}

function fixtureScore(upcoming, n = 3) {
  if (!upcoming.length) return 0.95;
  const slice = upcoming.slice(0, n);
  const avg = slice.reduce((s, f) => s + f.difficulty, 0) / slice.length;
  return fixtureFactorForDifficulty(avg);
}

function availabilityFactor(player) {
  if (player.status === 'a') return 1.0;
  if (player.status === 'd') return (player.chance_of_playing_next_round ?? 50) / 100;
  return 0.0;
}

// Current-season average PPG per position (element_type), among players
// who've actually recorded a score — the shrinkage target for computeXPts.
export function computePositionAvgPpg(elements) {
  const sums = {};
  const counts = {};
  for (const p of elements) {
    const ppg = parseFloat(p.points_per_game) || 0;
    if (ppg <= 0) continue;
    sums[p.element_type]   = (sums[p.element_type] || 0) + ppg;
    counts[p.element_type] = (counts[p.element_type] || 0) + 1;
  }
  const avg = {};
  for (const type in sums) avg[type] = sums[type] / counts[type];
  return avg;
}

// Per-game expected points, shrunk toward the position average early in the
// season — the shared foundation both computeXPts and
// computeFixtureBreakdown scale by fixture difficulty.
function stabilizedBase(player, positionAvgPpg) {
  const ppg   = parseFloat(player.points_per_game) || 0;
  const form  = parseFloat(player.form) || 0;
  const games = player.starts || 0;

  const rawBase = form > 0 ? form * 0.6 + ppg * 0.4 : ppg;

  // Hasn't featured at all this season - there's no outlier to shrink, and
  // no data to shrink toward a real prediction either. Falling back to the
  // position average here would rank every unused squad player above proven
  // in-form starters, so leave them at 0 rather than inventing a score.
  if (!(player.minutes > 0)) return rawBase;

  const prior = positionAvgPpg[player.element_type] ?? rawBase;
  const trust = games / (games + 5);
  return trust * rawBase + (1 - trust) * prior;
}

export function computeXPts(player, fixturesByTeam, positionAvgPpg = {}, fixtureWindow = 3) {
  const base   = stabilizedBase(player, positionAvgPpg);
  const fScore = fixtureScore(fixturesByTeam[player.team] || [], fixtureWindow);
  const avail  = availabilityFactor(player);
  return Math.round(base * fScore * avail * 10) / 10;
}

// Per-fixture expected points over the next `n` fixtures, plus their total —
// for showing a full run of games (long-term transfer planning) rather than
// one fixture-averaged number.
export function computeFixtureBreakdown(player, fixturesByTeam, positionAvgPpg = {}, n = 5) {
  const base  = stabilizedBase(player, positionAvgPpg);
  const avail = availabilityFactor(player);
  const upcoming = (fixturesByTeam[player.team] || []).slice(0, n);

  const fixtures = upcoming.map((f) => ({
    ...f,
    xpts: Math.round(base * fixtureFactorForDifficulty(f.difficulty) * avail * 10) / 10,
  }));

  const total = Math.round(fixtures.reduce((s, f) => s + f.xpts, 0) * 10) / 10;
  return { fixtures, total };
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
