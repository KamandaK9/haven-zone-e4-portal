import { Flame } from "lucide-react";
import { getLevelProgress, TRAINING_LEVELS } from "@/lib/training-icons";

// The level ring + XP banner at the top of a training page — a plain SVG
// circle (no chart library needed for one ring).
function LevelRing({ progressPct, levelIndex }: { progressPct: number; levelIndex: number }) {
  const size = 88;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progressPct / 100);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-white/15" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-white transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[9px] font-semibold uppercase tracking-wide text-white/70">Level</span>
        <span className="text-2xl font-semibold leading-none">{levelIndex + 1}</span>
      </div>
    </div>
  );
}

export function TrainingHero({
  points,
  completed,
  total,
  streak,
}: {
  points: number;
  completed: number;
  total: number;
  streak: number;
}) {
  const { level, next, pointsToNext, progressPct } = getLevelProgress(points);
  const levelIndex = TRAINING_LEVELS.indexOf(level);
  const LevelIcon = level.icon;

  return (
    <div className="rounded-2xl bg-primary text-primary-foreground p-5 sm:p-6 flex flex-wrap items-center gap-6">
      <LevelRing progressPct={progressPct} levelIndex={levelIndex} />

      <div className="min-w-[180px] flex-1 space-y-1.5">
        <div className="flex items-center gap-2">
          <LevelIcon className="h-4 w-4 text-white/80" />
          <p className="font-semibold">{level.name}</p>
        </div>
        <p className="text-xs text-white/70">
          {next ? `${pointsToNext} pts to ${next.name}` : "Highest level reached"}
        </p>
        <div className="h-1.5 w-full max-w-xs rounded-full bg-white/15 overflow-hidden">
          <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="flex items-center gap-6 sm:gap-8 ml-auto">
        {streak > 0 && (
          <div>
            <p className="flex items-center gap-1 text-xl font-semibold leading-none">
              <Flame className="h-4 w-4 text-amber-300" />
              {streak}
            </p>
            <p className="text-[11px] text-white/70 mt-1">Day streak</p>
          </div>
        )}
        <div>
          <p className="text-xl font-semibold leading-none">{points}</p>
          <p className="text-[11px] text-white/70 mt-1">Total points</p>
        </div>
        <div>
          <p className="text-xl font-semibold leading-none">
            {completed}/{total}
          </p>
          <p className="text-[11px] text-white/70 mt-1">Courses passed</p>
        </div>
      </div>
    </div>
  );
}
