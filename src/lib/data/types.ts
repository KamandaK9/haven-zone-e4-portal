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

export type Training = {
  name: string;
  status: LessonStatus;
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

export type Assistant = {
  id: string;
  name: string;
  email: string;
  role: "Admin";
};

export type SuperAdmin = {
  name: string;
  email: string;
  phone: string;
};

export type ZoneData = {
  zoneName: string;
  superAdmin: SuperAdmin | null;
  countries: Country[];
  churches: Church[];
  members: Member[];
  assistants: Assistant[];
  activity: ActivityItem[];
  events: CalendarEvent[];
  setupComplete: boolean;
};
