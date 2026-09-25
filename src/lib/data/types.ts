import type { GivingCategory } from "@/lib/giving";
import type { Portfolio, Position } from "@/lib/access";
import type { LessonVideoStatus } from "@/lib/supabase/types";

export type Country = {
  id: string;
  name: string;
  flag: string;
};

export type Church = {
  id: string;
  name: string;
  countryId: string;
  city?: string;
  foundedYear?: number;
  pastor?: string;
  subZoneId?: string;
  // The Zonal Office — a home row for zone-level leaders, not a real chapter.
  isOffice?: boolean;
};

export type SubZone = {
  id: string;
  name: string;
};

export type LessonStatus = "not_started" | "in_progress" | "completed";

export type TrainingProgram = {
  id: string;
  name: string;
  description?: string;
  videoUrl?: string;
  icon: string;
  points: number;
  // Whether new members are enrolled in this program automatically.
  assignToNewMembers: boolean;
};

// A member's assignment/progress on one program — flattens the program's
// own fields in so existing `t.name`/`t.status` reads keep working.
export type Training = {
  id: string;
  programId: string;
  name: string;
  description?: string;
  videoUrl?: string;
  icon: string;
  points: number;
  status: LessonStatus;
  assignedAt: string;
  completedAt?: string;
};

export type GivingPoint = {
  month: string; // "2025-10"
  amount: number;
  category?: GivingCategory; // absent on entries recorded before categories existed
};

// Giving totalled per chapter/month/category. Leaders who may see totals but
// not individuals get exactly this — never a person's amounts.
export type GivingAggregate = {
  churchId: string;
  month: string;
  category?: GivingCategory;
  amount: number;
};

export type MemberRole = "Member" | "Worker" | "Cell Leader" | "Pastor";

export type Member = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  churchId: string;
  countryId: string;
  joinDate?: string; // ISO date; unknown for members imported from a roster
  role: MemberRole;
  position: Position;
  portfolio?: Portfolio;
  avatarColor: string;
  giving: GivingPoint[];
  trainings: Training[];
  hasPortalAccess: boolean;
  profileId?: string; // the login this member is linked to, if any
  // Populated for members imported from a leadership-roster workbook —
  // free text, verbatim from source (see parse-leadership-roster.ts).
  title?: string;
  kcHandle?: string;
  profession?: string;
  spouseName?: string;
  birthday?: string;
  weddingAnniversary?: string;
  photoUrl?: string;
  cellId?: string;
};

// A group below a chapter; parentId unset = the upper level (e.g. a senior
// cell), otherwise a cell within that group.
export type Cell = {
  id: string;
  churchId: string;
  parentId?: string;
  name: string;
  leaderMemberId?: string;
  meetingDay?: string;
  meetingPlace?: string;
};

// A course's content — a video to watch or a graded quiz — in order.
export type CourseLesson = {
  id: string;
  programId: string;
  kind: "video" | "quiz";
  title: string;
  description?: string;
  videoUrl?: string;
  durationLabel?: string;
  passThreshold?: number; // kind: "quiz"
  sortOrder: number;
  questionCount?: number; // kind: "quiz"
  // An uploaded, privately-streamed video (kind: "video"). Takes precedence
  // over videoUrl once present.
  hostedVideo?: {
    provider: string;
    status: LessonVideoStatus;
    playbackId?: string;
    durationSeconds?: number;
  };
};

export type LessonProgress = {
  lessonId: string;
  completed: boolean;
  completedAt?: string;
  quizScore?: number;
  watchedSeconds: number; // hosted video lessons
};

// A quiz question as a learner sees it — no answer key.
export type QuizQuestionForLearner = {
  id: string;
  question: string;
  options: string[];
  sortOrder: number;
};

export type ActivityType =
  | "new_member"
  | "training_complete"
  | "giving"
  | "baptism"
  | "event";

export type ActivityItem = {
  id: string;
  type: ActivityType;
  message: string;
  churchId: string;
  timestamp: string; // ISO datetime
};

export type CalendarEventType = "meeting" | "training" | "service" | "outreach" | "flagship";

export type CalendarEvent = {
  id: string;
  title: string;
  date: string; // ISO date
  time: string;
  type: CalendarEventType;
  churchId?: string;
  countryId?: string;
  // The event's own page (see /event/[id]).
  description?: string;
  endDate?: string; // ISO date
  location?: string;
  coverUrl?: string;
  seriesId?: string; // set when this is an edition of an annual flagship event
};

export type EventSeries = {
  id: string;
  slug: string;
  name: string;
  description?: string;
};

export type EventMediaKind = "image" | "video" | "file";

export type EventMedia = {
  id: string;
  eventId: string;
  kind: EventMediaKind;
  url: string;
  title?: string;
};

export type LedgerEntryType = "income" | "expense";

export type LedgerEntry = {
  id: string;
  churchId: string;
  type: LedgerEntryType;
  category: string;
  description?: string;
  amount: number;
  entryDate: string; // ISO date
};

// A "balancing the books" snapshot — comparing what the ledger says a
// church's balance should be against what's actually in the bank/cash box.
export type Reconciliation = {
  id: string;
  churchId: string;
  periodEnd: string; // ISO date
  actualBalance: number;
  calculatedBalance: number;
  variance: number; // actual - calculated; 0 = balanced
  notes?: string;
  reconciledByName?: string;
  createdAt: string;
};
