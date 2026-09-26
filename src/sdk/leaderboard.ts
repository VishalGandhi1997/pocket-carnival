// Leaderboard — weekly per-game ranking. Interface is cloud-ready: today it
// returns your best score woven into a believable local ladder so the feature
// works offline and pre-launch. Swap `fetchTop` for a Firestore query when the
// backend is live (see FIREBASE-SETUP.md → "Leaderboards").

export interface LeaderRow {
  rank: number;
  name: string;
  avatar: string;
  score: number;
  you: boolean;
}

// Seeded rival names so the ladder feels alive and is stable within a session.
const RIVALS = [
  { name: "Mia", avatar: "🦊" },
  { name: "Leo", avatar: "🐯" },
  { name: "Sofia", avatar: "🦄" },
  { name: "Lucas", avatar: "🦁" },
  { name: "Emma", avatar: "🐼" },
  { name: "Noah", avatar: "🐵" },
  { name: "Yuki", avatar: "🦉" },
  { name: "Mateo", avatar: "🐸" },
  { name: "Zara", avatar: "🐧" },
  { name: "Oliver", avatar: "🐙" },
];

// Deterministic pseudo-random from a string seed (stable per game+week).
function seeded(seed: string): () => number {
  let h = 1779033703;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

function weekKey(): string {
  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week}`;
}

/**
 * Return the weekly top rows for a game, with the player woven in by score.
 * `bestScore` scales the ladder so it always feels within reach.
 */
export function fetchTop(
  gameId: string,
  you: { name: string; avatar: string; score: number },
): LeaderRow[] {
  const rand = seeded(`${gameId}-${weekKey()}`);
  const base = Math.max(you.score, 40);
  const rivals = RIVALS.map((r) => ({
    name: r.name,
    avatar: r.avatar,
    // rivals cluster around a spread above/below the player's best
    score: Math.round(base * (0.5 + rand() * 1.6)),
    you: false as const,
  }));
  const all = [
    ...rivals,
    { name: you.name || "You", avatar: you.avatar, score: you.score, you: true as const },
  ];
  all.sort((a, b) => b.score - a.score);
  return all.slice(0, 10).map((r, i) => ({ ...r, rank: i + 1 }));
}

export function myRank(gameId: string, you: { name: string; avatar: string; score: number }): number {
  const rand = seeded(`${gameId}-${weekKey()}`);
  const base = Math.max(you.score, 40);
  let higher = 0;
  for (let i = 0; i < RIVALS.length; i++) {
    const s = Math.round(base * (0.5 + rand() * 1.6));
    if (s > you.score) higher++;
  }
  return higher + 1;
}
