// Hand-written Supabase schema types for the existing project.
// Run `pnpm types:gen` (or the supabase CLI) to regenerate from the live DB when schema changes.

export type AbilityCategory = "Advanced" | "Intermediate" | "Developing";
export type SessionFormat = "5v5" | "7v7" | "9v9" | "11v11";
export type AttendanceStatus = "present" | "absent" | "late";
export type SessionStatus = "draft" | "ready" | "live" | "completed";
export type MatchStatus = "scheduled" | "in_progress" | "completed";

export type Database = {
  public: {
    Tables: {
      clubs: {
        Row: {
          id: string;
          name: string;
          slug: string | null;
          logo_url: string | null;
          primary_colour: string | null;
          secondary_colour: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["clubs"]["Row"]> & {
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["clubs"]["Row"]>;
      };
      seasons: {
        Row: {
          id: string;
          club_id: string;
          name: string;
          start_date: string | null;
          end_date: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["seasons"]["Row"]> & {
          club_id: string;
          name: string;
        };
        Update: Partial<Database["public"]["Tables"]["seasons"]["Row"]>;
      };
      user_profiles: {
        Row: {
          id: string;
          club_id: string | null;
          role: string;
          display_name: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["user_profiles"]["Row"]> & {
          id: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Row"]>;
      };
      players: {
        Row: {
          id: string;
          club_id: string;
          first_name: string;
          last_name: string;
          date_of_birth: string | null;
          ability_rating: number | null;
          preferred_position: string | null;
          photo_url: string | null;
          is_active: boolean;
          created_at: string;
          ability_category: AbilityCategory | null;
          pair_group: string | null;
          separation_group: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["players"]["Row"]> & {
          club_id: string;
          first_name: string;
          last_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["players"]["Row"]>;
      };
      sessions: {
        Row: {
          id: string;
          club_id: string;
          season_id: string;
          session_date: string;
          status: SessionStatus;
          notes: string | null;
          created_at: string;
          format: SessionFormat;
          match_length_minutes: number;
          sub_interval_minutes: number;
          num_teams: number;
        };
        Insert: Partial<Database["public"]["Tables"]["sessions"]["Row"]> & {
          club_id: string;
          season_id: string;
          session_date: string;
          format: SessionFormat;
        };
        Update: Partial<Database["public"]["Tables"]["sessions"]["Row"]>;
      };
      teams: {
        Row: {
          id: string;
          session_id: string;
          club_id: string;
          team_name: string;
          team_colour: string | null;
          coach_name: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["teams"]["Row"]> & {
          session_id: string;
          club_id: string;
          team_name: string;
        };
        Update: Partial<Database["public"]["Tables"]["teams"]["Row"]>;
      };
      team_players: {
        Row: {
          id: string;
          team_id: string;
          player_id: string;
          club_id: string;
        };
        Insert: Partial<Database["public"]["Tables"]["team_players"]["Row"]> & {
          team_id: string;
          player_id: string;
          club_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["team_players"]["Row"]>;
      };
      attendance: {
        Row: {
          id: string;
          session_id: string;
          player_id: string;
          club_id: string;
          status: AttendanceStatus;
          arrived_at: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["attendance"]["Row"]> & {
          session_id: string;
          player_id: string;
          club_id: string;
          status: AttendanceStatus;
        };
        Update: Partial<Database["public"]["Tables"]["attendance"]["Row"]>;
      };
      matches: {
        Row: {
          id: string;
          session_id: string;
          club_id: string;
          home_team_id: string | null;
          away_team_id: string | null;
          match_number: number;
          duration_minutes: number | null;
          home_score: number | null;
          away_score: number | null;
          status: MatchStatus;
          opponent_name: string | null;
          pitch_number: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["matches"]["Row"]> & {
          session_id: string;
          club_id: string;
          match_number: number;
        };
        Update: Partial<Database["public"]["Tables"]["matches"]["Row"]>;
      };
      player_match_minutes: {
        Row: {
          id: string;
          match_id: string;
          player_id: string;
          team_id: string;
          club_id: string;
          minutes_played: number;
          started: boolean;
          subbed_on_minute: number | null;
          subbed_off_minute: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["player_match_minutes"]["Row"]> & {
          match_id: string;
          player_id: string;
          team_id: string;
          club_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["player_match_minutes"]["Row"]>;
      };
      player_development: {
        Row: {
          id: string;
          player_id: string;
          season_id: string;
          club_id: string;
          assessment_date: string;
          passing: number | null;
          shooting: number | null;
          dribbling: number | null;
          positioning: number | null;
          teamwork: number | null;
          attitude: number | null;
          coach_notes: string | null;
          assessed_by: string | null;
        };
        Insert: Partial<Database["public"]["Tables"]["player_development"]["Row"]> & {
          player_id: string;
          season_id: string;
          club_id: string;
          assessment_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["player_development"]["Row"]>;
      };
      development_reports: {
        Row: {
          id: string;
          player_id: string;
          season_id: string;
          club_id: string;
          assessed_by: string | null;
          report_date: string;
          ai_draft: string | null;
          final_content: string | null;
          status: "draft" | "review" | "approved";
          pdf_url: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["development_reports"]["Row"]> & {
          player_id: string;
          season_id: string;
          club_id: string;
          report_date: string;
        };
        Update: Partial<Database["public"]["Tables"]["development_reports"]["Row"]>;
      };
      custom_attributes: {
        Row: {
          id: string;
          club_id: string;
          attribute_name: string;
          applies_to: "all" | "GK" | "outfield";
          sort_order: number;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["custom_attributes"]["Row"]> & {
          club_id: string;
          attribute_name: string;
          applies_to: "all" | "GK" | "outfield";
        };
        Update: Partial<Database["public"]["Tables"]["custom_attributes"]["Row"]>;
      };
      custom_attribute_scores: {
        Row: {
          id: string;
          development_id: string;
          attribute_id: string;
          score: number | null;
        };
        Insert: Partial<Database["public"]["Tables"]["custom_attribute_scores"]["Row"]> & {
          development_id: string;
          attribute_id: string;
        };
        Update: Partial<Database["public"]["Tables"]["custom_attribute_scores"]["Row"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

export type Player = Database["public"]["Tables"]["players"]["Row"];
export type Session = Database["public"]["Tables"]["sessions"]["Row"];
export type Team = Database["public"]["Tables"]["teams"]["Row"];
export type TeamPlayer = Database["public"]["Tables"]["team_players"]["Row"];
export type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
export type Match = Database["public"]["Tables"]["matches"]["Row"];
export type Club = Database["public"]["Tables"]["clubs"]["Row"];
export type Season = Database["public"]["Tables"]["seasons"]["Row"];
export type UserProfile = Database["public"]["Tables"]["user_profiles"]["Row"];
