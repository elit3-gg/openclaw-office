/**
 * Role-based sprite assignment for agents.
 * Maps agent IDs to specific character sprites matching their function.
 */

const ROLE_SPRITE_MAP: Record<string, number> = {
  "ceo": 1, "chief": 1,
  "main": 2, "orchid": 2,
  "eng-lead": 5, "lead": 5,
  "product": 7, "pm": 7,
  "architect": 14, "arch": 14,
  "design": 3, "ux": 3,
  "coder": 8, "dev": 8,
  "qa": 4, "tester": 4,
  "release": 6, "ship": 6,
};

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function getSpriteIndexForAgent(agentId: string): number {
  const id = agentId.toLowerCase();
  if (ROLE_SPRITE_MAP[id]) return ROLE_SPRITE_MAP[id];
  for (const [role, sprite] of Object.entries(ROLE_SPRITE_MAP)) {
    if (id.includes(role)) return sprite;
  }
  return 9 + (hashString(agentId) % 12);
}

export function getSpritePathForAgent(agentId: string): string {
  const idx = getSpriteIndexForAgent(agentId);
  return `/sprites/characters/Character_${String(idx).padStart(3, "0")}.png`;
}
