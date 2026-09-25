// Hand-written to match supabase/migrations/. Keep it in sync by hand when a
// migration changes, or regenerate it from a linked project with
// `npm run db:types` (which overwrites this file).
//
// Every table needs `Relationships: []` (we don't use embedded-resource
// foreign-key syntax that depends on it) and the schema needs empty
// `Views`/`Functions` maps — supabase-js's generic constraints require the
// full GenericSchema shape or type inference silently collapses to `never`.

export type LessonStatus = "not_started" | "in_progress" | "completed";
export type MemberRole = "Member" | "Worker" | "Cell Leader" | "Pastor";
export type LessonVideoStatus = "uploading" | "processing" | "ready" | "errored";
export type ProfileRole = "super_admin" | "admin" | "member";
export type ActivityType = "new_member" | "training_complete" | "giving" | "baptism" | "event";
export type CalendarEventType = "meeting" | "training" | "service" | "outreach" | "flagship";
export type EventMediaKind = "image" | "video" | "file";
export type LedgerEntryType = "income" | "expense";
export type ProfileScope = "zone" | "sub_zone" | "chapter" | "self";
export type GivingCategory = "pco" | "dues" | "special_project" | "meta";
export type ChapterRecordKind = "minutes" | "correspondence" | "bank_advice";
export type ChequeStatus = "issued" | "cleared" | "cancelled" | "void";
export type LiveStreamStatus = "scheduled" | "live" | "ended";
export type LiveStreamAudience = "zone" | "chapters" | "leaders";
export type RecordingStatus = "none" | "processing" | "ready" | "errored";
export type SupportCategory = "question" | "problem" | "account" | "records" | "other";
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      zones: {
        Row: {
          id: string;
          name: string;
          setup_complete: boolean;
          display_currency: string;
          default_programs_seeded: boolean;
          handbook_rules: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          setup_complete?: boolean;
          display_currency?: string;
          default_programs_seeded?: boolean;
          created_at?: string;
        };
        Update: Partial<{
          name: string;
          setup_complete: boolean;
          display_currency: string;
          default_programs_seeded: boolean;
          handbook_rules: Json | null;
        }>;
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
          position: string;
          portfolio: string | null;
          scope: ProfileScope;
          sub_zone_id: string | null;
          church_id: string | null;
          caps: string[];
          granted_caps: string[];
          revoked_caps: string[];
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
          position?: string;
          portfolio?: string | null;
          scope?: ProfileScope;
          sub_zone_id?: string | null;
          church_id?: string | null;
          caps?: string[];
          granted_caps?: string[];
          revoked_caps?: string[];
          created_at?: string;
        };
        Update: Partial<{
          full_name: string;
          email: string;
          phone: string | null;
          hidden_nav_items: string[];
          role: ProfileRole;
          position: string;
          portfolio: string | null;
          scope: ProfileScope;
          sub_zone_id: string | null;
          church_id: string | null;
          caps: string[];
          granted_caps: string[];
          revoked_caps: string[];
        }>;
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
      sub_zones: {
        Row: { id: string; zone_id: string; name: string };
        Insert: { id?: string; zone_id: string; name: string };
        Update: Partial<{ name: string }>;
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
          sub_zone_id: string | null;
          is_office: boolean;
        };
        Insert: {
          id?: string;
          zone_id: string;
          country_id: string;
          name: string;
          city?: string | null;
          founded_year?: number | null;
          pastor?: string | null;
          sub_zone_id?: string | null;
          is_office?: boolean;
        };
        Update: Partial<{
          name: string;
          city: string | null;
          founded_year: number | null;
          pastor: string | null;
          sub_zone_id: string | null;
          is_office: boolean;
        }>;
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
          join_date: string | null;
          role: MemberRole;
          position: string;
          portfolio: string | null;
          avatar_color: string;
          profile_id: string | null;
          title: string | null;
          kc_handle: string | null;
          profession: string | null;
          spouse_name: string | null;
          birthday: string | null;
          wedding_anniversary: string | null;
          photo_url: string | null;
          photo_path: string | null;
          cell_id: string | null;
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
          join_date?: string | null;
          role?: MemberRole;
          position?: string;
          portfolio?: string | null;
          avatar_color?: string;
          profile_id?: string | null;
          title?: string | null;
          kc_handle?: string | null;
          profession?: string | null;
          spouse_name?: string | null;
          birthday?: string | null;
          wedding_anniversary?: string | null;
          photo_url?: string | null;
          photo_path?: string | null;
          cell_id?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          church_id: string;
          country_id: string;
          first_name: string;
          last_name: string;
          email: string | null;
          phone: string | null;
          join_date: string | null;
          role: MemberRole;
          position: string;
          portfolio: string | null;
          avatar_color: string;
          profile_id: string | null;
          title: string | null;
          kc_handle: string | null;
          profession: string | null;
          spouse_name: string | null;
          birthday: string | null;
          wedding_anniversary: string | null;
          photo_url: string | null;
          photo_path: string | null;
          cell_id: string | null;
        }>;
        Relationships: [];
      };
      giving_entries: {
        Row: { id: string; member_id: string; zone_id: string; month: string; amount: number; category: GivingCategory | null };
        Insert: { id?: string; member_id: string; zone_id: string; month: string; amount: number; category?: GivingCategory | null };
        // member_id is mutable only for the duplicate-member merge tool — never as part of a normal edit.
        Update: Partial<{ member_id: string; month: string; amount: number; category: GivingCategory | null }>;
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
        // member_id is mutable only for the duplicate-member merge tool — never as part of a normal edit.
        Update: Partial<{ member_id: string; status: LessonStatus; completed_at: string | null }>;
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
          assign_to_new_members: boolean;
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
          assign_to_new_members?: boolean;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          name: string;
          description: string | null;
          video_url: string | null;
          icon: string;
          points: number;
          assign_to_new_members: boolean;
        }>;
        Relationships: [];
      };
      training_lessons: {
        Row: {
          id: string;
          program_id: string;
          zone_id: string;
          kind: "video" | "quiz";
          title: string;
          description: string | null;
          video_url: string | null;
          duration_label: string | null;
          pass_threshold: number | null;
          sort_order: number;
          created_at: string;
          video_provider: "mux" | null;
          video_upload_id: string | null;
          video_asset_id: string | null;
          video_playback_id: string | null;
          video_status: LessonVideoStatus | null;
          duration_seconds: number | null;
        };
        Insert: {
          id?: string;
          program_id: string;
          zone_id: string;
          kind?: "video" | "quiz";
          title: string;
          description?: string | null;
          video_url?: string | null;
          duration_label?: string | null;
          pass_threshold?: number | null;
          sort_order?: number;
          created_at?: string;
          video_provider?: "mux" | null;
          video_upload_id?: string | null;
          video_asset_id?: string | null;
          video_playback_id?: string | null;
          video_status?: LessonVideoStatus | null;
          duration_seconds?: number | null;
        };
        Update: Partial<{
          title: string;
          description: string | null;
          video_url: string | null;
          duration_label: string | null;
          pass_threshold: number | null;
          sort_order: number;
          video_provider: "mux" | null;
          video_upload_id: string | null;
          video_asset_id: string | null;
          video_playback_id: string | null;
          video_status: LessonVideoStatus | null;
          duration_seconds: number | null;
        }>;
        Relationships: [];
      };
      training_quiz_questions: {
        Row: { id: string; lesson_id: string; zone_id: string; question: string; options: string[]; correct_index: number; sort_order: number };
        Insert: {
          id?: string;
          lesson_id: string;
          zone_id: string;
          question: string;
          options: string[];
          correct_index: number;
          sort_order?: number;
        };
        Update: Partial<{ question: string; options: string[]; correct_index: number; sort_order: number }>;
        Relationships: [];
      };
      training_lesson_progress: {
        Row: {
          id: string;
          member_id: string;
          lesson_id: string;
          zone_id: string;
          completed: boolean;
          completed_at: string | null;
          quiz_score: number | null;
          watched_seconds: number;
          last_watch_report_at: string | null;
        };
        Insert: {
          id?: string;
          member_id: string;
          lesson_id: string;
          zone_id: string;
          completed?: boolean;
          completed_at?: string | null;
          quiz_score?: number | null;
          watched_seconds?: number;
          last_watch_report_at?: string | null;
        };
        Update: Partial<{
          completed: boolean;
          completed_at: string | null;
          quiz_score: number | null;
          watched_seconds: number;
          last_watch_report_at: string | null;
        }>;
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
      event_series: {
        Row: { id: string; zone_id: string; slug: string; name: string; description: string | null; sort_order: number };
        Insert: { id?: string; zone_id: string; slug: string; name: string; description?: string | null; sort_order?: number };
        Update: Partial<{ name: string; description: string | null; sort_order: number }>;
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
          description: string | null;
          end_date: string | null;
          location: string | null;
          cover_url: string | null;
          cover_path: string | null;
          series_id: string | null;
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
          description?: string | null;
          end_date?: string | null;
          location?: string | null;
          cover_url?: string | null;
          cover_path?: string | null;
          series_id?: string | null;
        };
        Update: Partial<{
          title: string;
          date: string;
          time: string;
          type: CalendarEventType;
          church_id: string | null;
          country_id: string | null;
          description: string | null;
          end_date: string | null;
          location: string | null;
          cover_url: string | null;
          cover_path: string | null;
        }>;
        Relationships: [];
      };
      event_media: {
        Row: {
          id: string;
          event_id: string;
          zone_id: string;
          kind: EventMediaKind;
          url: string;
          storage_path: string | null;
          title: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          zone_id: string;
          kind: EventMediaKind;
          url: string;
          storage_path?: string | null;
          title?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: Partial<{ title: string | null; sort_order: number }>;
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
      cells: {
        Row: {
          id: string;
          zone_id: string;
          church_id: string;
          parent_id: string | null;
          name: string;
          leader_member_id: string | null;
          meeting_day: string | null;
          meeting_place: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          zone_id: string;
          church_id: string;
          parent_id?: string | null;
          name: string;
          leader_member_id?: string | null;
          meeting_day?: string | null;
          meeting_place?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          parent_id: string | null;
          name: string;
          leader_member_id: string | null;
          meeting_day: string | null;
          meeting_place: string | null;
        }>;
        Relationships: [];
      };
      chapter_records: {
        Row: {
          id: string;
          zone_id: string;
          church_id: string;
          kind: ChapterRecordKind;
          title: string;
          record_date: string;
          body: string | null;
          meeting_type: string | null;
          event_id: string | null;
          direction: "in" | "out" | null;
          counterparty: string | null;
          reference: string | null;
          account: string | null;
          amount: number | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          zone_id: string;
          church_id: string;
          kind: ChapterRecordKind;
          title: string;
          record_date: string;
          body?: string | null;
          meeting_type?: string | null;
          event_id?: string | null;
          direction?: "in" | "out" | null;
          counterparty?: string | null;
          reference?: string | null;
          account?: string | null;
          amount?: number | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<{
          title: string;
          record_date: string;
          body: string | null;
          meeting_type: string | null;
          event_id: string | null;
          direction: "in" | "out" | null;
          counterparty: string | null;
          reference: string | null;
          account: string | null;
          amount: number | null;
          updated_at: string;
        }>;
        Relationships: [];
      };
      chapter_record_files: {
        Row: {
          id: string;
          record_id: string;
          zone_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          record_id: string;
          zone_id: string;
          storage_path: string;
          file_name: string;
          mime_type: string;
          size_bytes: number;
          created_at?: string;
        };
        Update: Record<string, never>;
        Relationships: [
          {
            foreignKeyName: "chapter_record_files_record_id_fkey";
            columns: ["record_id"];
            isOneToOne: false;
            referencedRelation: "chapter_records";
            referencedColumns: ["id"];
          },
        ];
      };
      cheques: {
        Row: {
          id: string;
          zone_id: string;
          church_id: string;
          account: string;
          cheque_number: string;
          issue_date: string;
          payee: string;
          amount: number;
          purpose: string | null;
          status: ChequeStatus;
          ledger_entry_id: string | null;
          stub_path: string | null;
          stub_file_name: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          zone_id: string;
          church_id: string;
          account: string;
          cheque_number: string;
          issue_date: string;
          payee: string;
          amount: number;
          purpose?: string | null;
          status?: ChequeStatus;
          ledger_entry_id?: string | null;
          stub_path?: string | null;
          stub_file_name?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: Partial<{
          account: string;
          cheque_number: string;
          issue_date: string;
          payee: string;
          amount: number;
          purpose: string | null;
          status: ChequeStatus;
          ledger_entry_id: string | null;
          stub_path: string | null;
          stub_file_name: string | null;
        }>;
        Relationships: [];
      };
      live_streams: {
        Row: {
          id: string;
          zone_id: string;
          title: string;
          description: string | null;
          scheduled_at: string;
          audience: LiveStreamAudience;
          church_ids: string[];
          status: LiveStreamStatus;
          chat_enabled: boolean;
          provider: "mux";
          provider_stream_id: string | null;
          playback_id: string | null;
          recording_asset_id: string | null;
          recording_playback_id: string | null;
          recording_status: RecordingStatus;
          recording_duration_seconds: number | null;
          started_at: string | null;
          ended_at: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          zone_id: string;
          title: string;
          description?: string | null;
          scheduled_at: string;
          audience?: LiveStreamAudience;
          church_ids?: string[];
          status?: LiveStreamStatus;
          chat_enabled?: boolean;
          provider?: "mux";
          provider_stream_id?: string | null;
          playback_id?: string | null;
          created_by?: string | null;
        };
        Update: Partial<{
          title: string;
          description: string | null;
          scheduled_at: string;
          audience: LiveStreamAudience;
          church_ids: string[];
          status: LiveStreamStatus;
          chat_enabled: boolean;
          provider_stream_id: string | null;
          playback_id: string | null;
          recording_asset_id: string | null;
          recording_playback_id: string | null;
          recording_status: RecordingStatus;
          recording_duration_seconds: number | null;
          started_at: string | null;
          ended_at: string | null;
        }>;
        Relationships: [];
      };
      live_stream_keys: {
        Row: { stream_id: string; zone_id: string; stream_key: string };
        Insert: { stream_id: string; zone_id: string; stream_key: string };
        Update: Partial<{ stream_key: string }>;
        Relationships: [];
      };
      live_stream_messages: {
        Row: {
          id: string;
          stream_id: string;
          zone_id: string;
          profile_id: string;
          author_name: string;
          body: string;
          created_at: string;
          deleted_at: string | null;
          deleted_by: string | null;
        };
        Insert: {
          id?: string;
          stream_id: string;
          zone_id: string;
          profile_id: string;
          author_name: string;
          body: string;
        };
        Update: Partial<{ deleted_at: string | null; deleted_by: string | null }>;
        Relationships: [];
      };
      live_stream_mutes: {
        Row: { stream_id: string; profile_id: string; zone_id: string; created_by: string | null; created_at: string };
        Insert: { stream_id: string; profile_id: string; zone_id: string; created_by?: string | null };
        Update: Record<string, never>;
        Relationships: [];
      };
      support_requests: {
        Row: {
          id: string;
          zone_id: string;
          profile_id: string | null;
          requester_name: string;
          requester_email: string;
          category: SupportCategory;
          message: string;
          page_path: string | null;
          status: "open" | "resolved";
          email_status: "not_sent" | "sent" | "failed";
          created_at: string;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        Insert: {
          id?: string;
          zone_id: string;
          profile_id: string;
          requester_name: string;
          requester_email: string;
          category: SupportCategory;
          message: string;
          page_path?: string | null;
        };
        Update: Partial<{
          status: "open" | "resolved";
          email_status: "not_sent" | "sent" | "failed";
          resolved_at: string | null;
          resolved_by: string | null;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      quiz_questions_for_member: {
        Args: { p_lesson_id: string };
        Returns: { id: string; question: string; options: string[]; sort_order: number }[];
      };
      quiz_question_counts: {
        Args: { p_lesson_ids: string[] };
        Returns: { lesson_id: string; count: number }[];
      };
      can_edit_event: {
        Args: { e_series: string | null; e_church: string | null };
        Returns: boolean;
      };
      giving_totals_in_scope: {
        Args: Record<string, never>;
        Returns: { church_id: string; month: string; category: string | null; amount: number }[];
      };
    };
  };
};
