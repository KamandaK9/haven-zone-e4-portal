import { Crown, Flame, Footprints, GraduationCap, Rocket, Star, Trophy, Zap, type LucideIcon } from "lucide-react";
import { TRAINING_LEVELS } from "./training-icons";
import type { MemberAchievementStats } from "./data/achievements";

export type Badge = {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  earned: boolean;
};

// A fixed set, computed live from data that already exists — nothing for
// staff to configure, and always correct since there's no separate "earned"
// state to fall out of sync.
export function getEarnedBadges(input: {
  lessonsCompleted: number;
  coursesCompleted: number;
  trainingPoints: number;
  achievements: MemberAchievementStats;
}): Badge[] {
  const maxLevelMin = TRAINING_LEVELS[TRAINING_LEVELS.length - 1].min;

  return [
    {
      id: "first-steps",
      name: "First Steps",
      description: "Complete your first lesson",
      icon: Footprints,
      earned: input.lessonsCompleted >= 1,
    },
    {
      id: "course-complete",
      name: "Course Complete",
      description: "Finish a full course",
      icon: GraduationCap,
      earned: input.coursesCompleted >= 1,
    },
    {
      id: "on-a-roll",
      name: "On a Roll",
      description: "Finish 3 courses",
      icon: Rocket,
      earned: input.coursesCompleted >= 3,
    },
    {
      id: "zone-scholar",
      name: "Zone Scholar",
      description: "Finish 5 courses",
      icon: Trophy,
      earned: input.coursesCompleted >= 5,
    },
    {
      id: "perfect-score",
      name: "Perfect Score",
      description: "Get every question right on a quiz",
      icon: Star,
      earned: input.achievements.hasPerfectQuizScore,
    },
    {
      id: "streak-7",
      name: "7-Day Streak",
      description: "Complete something 7 days in a row",
      icon: Flame,
      earned: input.achievements.streak.longest >= 7,
    },
    {
      id: "streak-30",
      name: "30-Day Streak",
      description: "Complete something 30 days in a row",
      icon: Zap,
      earned: input.achievements.streak.longest >= 30,
    },
    {
      id: "top-of-the-class",
      name: "Top of the Class",
      description: "Reach the highest level",
      icon: Crown,
      earned: input.trainingPoints >= maxLevelMin,
    },
  ];
}
