import {
  BookOpen,
  GraduationCap,
  Video,
  Award,
  Trophy,
  Medal,
  Star,
  Target,
  Heart,
  Flame,
  Droplet,
  Users,
  Mic,
  Compass,
  Map,
  Rocket,
  CheckCircle2,
  Church,
  type LucideIcon,
} from "lucide-react";

// Curated, deliberately not emoji — every training program picks one of
// these to render as a real icon in the UI.
export const TRAINING_ICONS: Record<string, LucideIcon> = {
  BookOpen,
  GraduationCap,
  Video,
  Award,
  Trophy,
  Medal,
  Star,
  Target,
  Heart,
  Flame,
  Droplet,
  Users,
  Mic,
  Compass,
  Map,
  Rocket,
  CheckCircle2,
  Church,
};

export const TRAINING_ICON_OPTIONS = Object.keys(TRAINING_ICONS);

export function getTrainingIcon(name: string): LucideIcon {
  return TRAINING_ICONS[name] ?? BookOpen;
}

// Gamification tiers, derived from a member's total points across
// completed trainings — no emojis, just an icon + label per tier.
export const TRAINING_LEVELS = [
  { min: 0, name: "Level 1", icon: Award },
  { min: 30, name: "Level 2", icon: Medal },
  { min: 75, name: "Level 3", icon: Trophy },
  { min: 150, name: "Level 4", icon: Star },
] as const;

export function getTrainingLevel(points: number): (typeof TRAINING_LEVELS)[number] {
  let level: (typeof TRAINING_LEVELS)[number] = TRAINING_LEVELS[0];
  for (const l of TRAINING_LEVELS) {
    if (points >= l.min) level = l;
  }
  return level;
}

// How far into the current level a member is, for a progress ring/bar —
// null `next`/`pointsToNext` once they've hit the top tier.
export function getLevelProgress(points: number) {
  const level = getTrainingLevel(points);
  const index = TRAINING_LEVELS.indexOf(level);
  const next = TRAINING_LEVELS[index + 1] as (typeof TRAINING_LEVELS)[number] | undefined;
  if (!next) return { level, next: null, pointsToNext: null, progressPct: 100 };
  const span = next.min - level.min;
  const progressPct = span > 0 ? Math.min(100, Math.round(((points - level.min) / span) * 100)) : 100;
  return { level, next, pointsToNext: next.min - points, progressPct };
}
