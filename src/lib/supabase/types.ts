// Hand-written to match supabase/migration.sql. No Supabase CLI is available
// in this environment to auto-generate this from the live schema, so keep it
// in sync by hand whenever the migration changes.
//
// Every table needs `Relationships: []` (we don't use embedded-resource
// foreign-key syntax that depends on it) and the schema needs empty
// `Views`/`Functions` maps — supabase-js's generic constraints require the
// full GenericSchema shape or type inference silently collapses to `never`.

export type LessonStatus = "not_started" | "in_progress" | "completed";
export type MemberRole = "Member" | "Worker" | "Cell Leader" | "Pastor";
export type ProfileRole = "super_admin" | "admin" | "member";
export type ActivityType = "new_member" | "training_complete" | "giving" | "baptism" | "event";
export type CalendarEventType = "meeting" | "training" | "service" | "outreach";
export type LedgerEntryType = "income" | "expense";

export type Database = {
  public: {
    Tables: {
      zones: {
        Row: { id: string; name: string; setup_complete: boolean; display_currency: string; created_at: string };
        Insert: { id?: string; name: string; setup_complete?: boolean; display_currency?: string; created_at?: string };
        Update: Partial<{ name: string; setup_complete: boolean; display_currency: string }>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          zone_id: string;
          role: ProfileRole;
          full_name: string;
          email: string;
          phone: string | null;
          hidden_nav_items: string[];
          created_at: string;
        };
        Insert: {
          id: string;
          zone_id: string;
          role: ProfileRole;
          full_name: string;
          email: string;
          phone?: string | null;
          hidden_nav_items?: string[];
          created_at?: string;
        };
        Update: Partial<{ full_name: string; email: string; phone: string | null; hidden_nav_items: string[] }>;
        Relationships: [
          {
            foreignKeyName: "profiles_zone_id_fkey";
            columns: ["zone_id"];
            isOneToOne: false;
            referencedRelation: "zones";
            referencedColumns: ["id"];
          },
        ];
      };
      countries: {
        Row: { id: string; zone_id: string; name: string; flag: string };
        Insert: { id?: string; zone_id: string; name: string; flag: string };
        Update: Partial<{ name: string; flag: string }>;
        Relationships: [];
      };
      churches: {
        Row: {
          id: string;
          zone_id: string;
          country_id: string;
          name: string;
          city: string | null;
          founded_year: number | null;
          pastor: string | null;
        };
        Insert: {
          id?: string;
          zone_id: string;
          country_id: string;
          name: string;
          city?: string | null;
          founded_year?: number | null;
          pastor?: string | null;
        };
        Update: Partial<{ name: string; city: string | null; founded_year: number | null; pastor: string | null }>;
        Relationships: [];
      };
      members: {
        Row: {
          id: string;
          zone_id: string;
          church_id: string;
          country_id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          join_date: string;
          role: MemberRole;
          avatar_color: string;
          profile_id: string | null;
          title: string | null;
          kc_handle: string | null;
          profession: string | null;
          spouse_name: string | null;
          birthday: string | null;
          wedding_anniversary: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          zone_id: string;
          church_id: string;
          country_id: string;
          first_name: string;
          last_name: string;
          email?: string | null;
          phone?: string | null;
          join_date?: string;
          role?: MemberRole;
          avatar_color?: string;
          profile_id?: string | null;
          title?: string | null;
          kc_handle?: string | null;
          profession?: string | null;
          spouse_name?: string | null;
          birthday?: string | null;
          wedding_anniversary?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          church_id: string;
          country_id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          join_date: string;
          role: MemberRole;
          avatar_color: string;
          profile_id: string | null;
          title: string | null;
          kc_handle: string | null;
          profession: string | null;
          spouse_name: string | null;
          birthday: string | null;
          wedding_anniversary: string | null;
        }>;
        Relationships: [];
      };
      giving_entries: {
        Row: { id: string; member_id: string; zone_id: string; month: string; amount: number };
        Insert: { id?: string; member_id: string; zone_id: string; month: string; amount: number };
        Update: Partial<{ month: string; amount: number }>;
        Relationships: [
          {
            foreignKeyName: "giving_entries_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
        ];
      };
      trainings: {
        Row: {
          id: string;
          member_id: string;
          zone_id: string;
          name: string | null;
          status: LessonStatus;
          program_id: string | null;
          assigned_by: string | null;
          assigned_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          member_id: string;
          zone_id: string;
          name?: string | null;
          status?: LessonStatus;
          program_id?: string | null;
          assigned_by?: string | null;
          assigned_at?: string;
          completed_at?: string | null;
        };
        Update: Partial<{ status: LessonStatus; completed_at: string | null }>;
        Relationships: [
          {
            foreignKeyName: "trainings_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trainings_program_id_fkey";
            columns: ["program_id"];
            isOneToOne: false;
            referencedRelation: "training_programs";
            referencedColumns: ["id"];
          },
        ];
      };
      training_programs: {
        Row: {
          id: string;
          zone_id: string;
          name: string;
          description: string | null;
          video_url: string | null;
          icon: string;
          points: number;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          zone_id: string;
          name: string;
          description?: string | null;
          video_url?: string | null;
          icon?: string;
          points?: number;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<{ name: string; description: string | null; video_url: string | null; icon: string; points: number }>;
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          zone_id: string;
          actor_id: string | null;
          actor_name: string;
          action: string;
          summary: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          zone_id: string;
          actor_id?: string | null;
          actor_name: string;
          action: string;
          summary: string;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [];
      };
      activity: {
        Row: {
          id: string;
          zone_id: string;
          type: ActivityType;
          message: string;
          church_id: string | null;
          timestamp: string;
        };
        Insert: {
          id?: string;
          zone_id: string;
          type: ActivityType;
          message: string;
          church_id?: string | null;
          timestamp?: string;
        };
        Update: Partial<{ type: ActivityType; message: string; church_id: string | null; timestamp: string }>;
        Relationships: [];
      };
      events: {
        Row: {
          id: string;
          zone_id: string;
          title: string;
          date: string;
          time: string;
          type: CalendarEventType;
          church_id: string | null;
          country_id: string | null;
        };
        Insert: {
          id?: string;
          zone_id: string;
          title: string;
          date: string;
          time: string;
          type: CalendarEventType;
          church_id?: string | null;
          country_id?: string | null;
        };
        Update: Partial<{
          title: string;
          date: string;
          time: string;
          type: CalendarEventType;
          church_id: string | null;
          country_id: string | null;
        }>;
        Relationships: [];
      };
      ledger_entries: {
        Row: {
          id: string;
          zone_id: string;
          church_id: string;
          type: LedgerEntryType;
          category: string;
          description: string | null;
          amount: number;
          entry_date: string;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          zone_id: string;
          church_id: string;
          type: LedgerEntryType;
          category: string;
          description?: string | null;
          amount: number;
          entry_date?: string;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          church_id: string;
          type: LedgerEntryType;
          category: string;
          description: string | null;
          amount: number;
          entry_date: string;
        }>;
        Relationships: [];
      };
      reconciliations: {
        Row: {
          id: string;
          zone_id: string;
          church_id: string;
          period_end: string;
          actual_balance: number;
          calculated_balance: number;
          variance: number;
          notes: string | null;
          reconciled_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          zone_id: string;
          church_id: string;
          period_end: string;
          actual_balance: number;
          calculated_balance: number;
          variance: number;
          notes?: string | null;
          reconciled_by?: string | null;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "reconciliations_reconciled_by_fkey";
            columns: ["reconciled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
};
