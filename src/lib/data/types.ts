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
};

export type LessonStatus = "not_started" | "in_progress" | "completed";

export type TrainingProgram = {
  id: string;
  name: string;
  description?: string;
  videoUrl?: string;
  icon: string;
  points: number;
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
  joinDate: string; // ISO date
  role: MemberRole;
  avatarColor: string;
  giving: GivingPoint[];
  trainings: Training[];
  hasPortalAccess: boolean;
  // Populated for members imported from a leadership-roster workbook —
  // free text, verbatim from source (see parse-leadership-roster.ts).
  title?: string;
  kcHandle?: string;
  profession?: string;
  spouseName?: string;
  birthday?: string;
  weddingAnniversary?: string;
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

export type CalendarEventType = "meeting" | "training" | "service" | "outreach";

export type CalendarEvent = {
  id: string;
  title: string;
  date: string; // ISO date
  time: string;
  type: CalendarEventType;
  churchId?: string;
  countryId?: string;
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
