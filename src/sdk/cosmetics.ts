// Cosmetic skins — the aspirational coin sink. Each skin belongs to a game
// "category" and carries the colour data that game reads when rendering.
// cost 0 = owned by default (the classic look).

export type SkinCategory = "naagin" | "blockbazi";

export interface Skin {
  id: string;
  category: SkinCategory;
  name: string;
  emoji: string;
  cost: number; // coins
  colors: Record<string, string>;
}

// Price ladder (vs a ~350-coin/day engaged budget): entry ≈ 1 day, mid ≈ a
// few days, premium ≈ a week of saving OR a coin pack — that gap is what
// converts patient players into ad-watchers and impatient ones into buyers.
export const SKINS: Skin[] = [
  // ── Naagin (snake) skins: head, body, alt(body stripe) ──
  { id: "snake_classic", category: "naagin", name: "Classic", emoji: "🐍", cost: 0,
    colors: { head: "#b6ff5a", body: "#06d6a0", alt: "#05b384" } },
  { id: "snake_blaze", category: "naagin", name: "Blaze", emoji: "🔥", cost: 250,
    colors: { head: "#ffe066", body: "#ff9f1c", alt: "#ef476f" } },
  { id: "snake_ocean", category: "naagin", name: "Ocean", emoji: "🌊", cost: 250,
    colors: { head: "#a0f0ff", body: "#4cc9f0", alt: "#2a7fd4" } },
  { id: "snake_galaxy", category: "naagin", name: "Galaxy", emoji: "🌌", cost: 750,
    colors: { head: "#f0a6ff", body: "#c77dff", alt: "#7b2ff0" } },
  { id: "snake_gold", category: "naagin", name: "Golden", emoji: "👑", cost: 1500,
    colors: { head: "#fff3c4", body: "#ffd23f", alt: "#f5a623" } },
  { id: "snake_rainbow", category: "naagin", name: "Rainbow", emoji: "🌈", cost: 2500,
    colors: { head: "#ff5c8a", body: "#4cc9f0", alt: "#2ee6a8" } },

  // ── BlockBazi board themes: two 3×3-zone shades ──
  { id: "board_indigo", category: "blockbazi", name: "Indigo", emoji: "🟣", cost: 0,
    colors: { zoneA: "#4e3c9c", zoneB: "#45348c" } },
  { id: "board_sunset", category: "blockbazi", name: "Sunset", emoji: "🌇", cost: 350,
    colors: { zoneA: "#7a3b6e", zoneB: "#5e2e63" } },
  { id: "board_forest", category: "blockbazi", name: "Forest", emoji: "🌲", cost: 350,
    colors: { zoneA: "#1f5c4d", zoneB: "#17493f" } },
  { id: "board_mid", category: "blockbazi", name: "Midnight", emoji: "🌙", cost: 800,
    colors: { zoneA: "#2b3157", zoneB: "#232748" } },
  { id: "board_rose", category: "blockbazi", name: "Rose Gold", emoji: "🌹", cost: 1800,
    colors: { zoneA: "#8a3d54", zoneB: "#6e2f43" } },
];

export const DEFAULT_SKIN: Record<SkinCategory, string> = {
  naagin: "snake_classic",
  blockbazi: "board_indigo",
};

export function getSkin(id: string): Skin | undefined {
  return SKINS.find((s) => s.id === id);
}

export function skinsFor(category: SkinCategory): Skin[] {
  return SKINS.filter((s) => s.category === category);
}
