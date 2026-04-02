export const MAX_HEARTS = 5;
export const DAILY_MISSION_TARGET = 5;

export const XP_BY_DIFFICULTY: Record<string, number> = {
  EASY: 12,
  MEDIUM: 18,
  HARD: 24,
};

export const getLevelFromXp = (xp: number) => Math.floor(xp / 60) + 1;
