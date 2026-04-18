// Hand-written Supabase schema types for the existing project.
// Run `pnpm types:gen` (or the supabase CLI) to regenerate from the live DB.
//
// Row shapes are defined as standalone type aliases first, then referenced from
// the Database type — this keeps Insert/Update non-circular (an earlier version
// used Partial<Database["public"]["Tables"]["x"]["Row"]> which crashed tsc).

export type AbilityCategory = "Advanced" | "Intermediate" | "Developing";
export type SessionFormat = "5v5" | "7v7" | "9v9" | "11v11";
export type AttendanceStatus = "present" | "absent" | "late";
export type SessionStatus = "draft" | "ready" | "live" | "completed";
export type MatchStatus = "scheduled" | "in_progress" | "completed";
export type AppliesTo = "all" | "GK" | "outfield";
export type ReportStatus = "draft" | "review" | "approved";

// ---------- Row shapes ----------

export type ClubRow = {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  primary_colour: string | null;
  secondary_colour: string | null;
  created_at: string;
};

export type SeasonRow = {
  id: string;
  club_id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
};

export type UserProfileRow = {
  id: string;
  club_id: string | null;
  role: string;
  display_name: string | null;
  created_at: string;
};

export type PlayerRow = {
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

export type SessionRow = {
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

export type TeamRow = {
  id: string;
  session_id: string;
  club_id: string;
  team_name: string;
  team_colour: string | null;
  coach_name: string | null;
  slot_number: number;
  slot_label: string | null;
};

export type TeamPlayerRow = {
  id: string;
  team_id: string;
  player_id: string;
  club_id: string;
};

export type AttendanceRow = {
  id: string;
  session_id: string;
  player_id: string;
  club_id: string;
  status: AttendanceStatus;
  arrived_at: string | null;
};

export type MatchRow = {
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

export type PlayerMatchMinutesRow = {
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

export type PlayerDevelopmentRow = {
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

export type DevelopmentReportRow = {
  id: string;
  player_id: string;
  season_id: string;
  club_id: string;
  assessed_by: string | null;
  report_date: string;
  ai_draft: string | null;
  final_content: string | null;
  status: ReportStatus;
  pdf_url: string | null;
  created_at: string;
};

export type CustomAttributeRow = {
  id: string;
  club_id: string;
  attribute_name: string;
  applies_to: AppliesTo;
  sort_order: number;
  created_at: string;
};

export type CustomAttributeScoreRow = {
  id: string;
  development_id: string;
  attribute_id: string;
  score: number | null;
};

// ---------- Insert / Update helpers ----------

type OptionalId<T extends { id: string }> = Partial<T> & Omit<T, "id">;

// ---------- Database type for supabase-js ----------

export type Database = {
  public: {
    Tables: {
      clubs: {
        Row: ClubRow;
        Insert: Partial<ClubRow> & { name: string };
        Update: Partial<ClubRow>;
      };
      seasons: {
        Row: SeasonRow;
        Insert: Partial<SeasonRow> & { club_id: string; name: string };
        Update: Partial<SeasonRow>;
      };
      user_profiles: {
        Row: UserProfileRow;
        Insert: Partial<UserProfileRow> & { id: string };
        Update: Partial<UserProfileRow>;
      };
      players: {
        Row: PlayerRow;
        Insert: Partial<PlayerRow> & {
          club_id: string;
          first_name: string;
          last_name: string;
        };
        Update: Partial<PlayerRow>;
      };
      sessions: {
        Row: SessionRow;
        Insert: Partial<SessionRow> & {
          club_id: string;
          season_id: string;
          session_date: string;
          format: SessionFormat;
        };
        Update: Partial<SessionRow>;
      };
      teams: {
        Row: TeamRow;
        Insert: Partial<TeamRow> & {
          session_id: string;
          club_id: string;
          team_name: string;
        };
        Update: Partial<TeamRow>;
      };
      team_players: {
        Row: TeamPlayerRow;
        Insert: OptionalId<TeamPlayerRow>;
        Update: Partial<TeamPlayerRow>;
      };
      attendance: {
        Row: AttendanceRow;
        Insert: Partial<AttendanceRow> & {
          session_id: string;
          player_id: string;
          club_id: string;
          status: AttendanceStatus;
        };
        Update: Partial<AttendanceRow>;
      };
      matches: {
        Row: MatchRow;
        Insert: Partial<MatchRow> & {
          session_id: string;
          club_id: string;
          match_number: number;
        };
        Update: Partial<MatchRow>;
      };
      player_match_minutes: {
        Row: PlayerMatchMinutesRow;
        Insert: Partial<PlayerMatchMinutesRow> & {
          match_id: string;
          player_id: string;
          team_id: string;
          club_id: string;
        };
        Update: Partial<PlayerMatchMinutesRow>;
      };
      player_development: {
        Row: PlayerDevelopmentRow;
        Insert: Partial<PlayerDevelopmentRow> & {
          player_id: string;
          season_id: string;
          club_id: string;
          assessment_date: string;
        };
        Update: Partial<PlayerDevelopmentRow>;
      };
      development_reports: {
        Row: DevelopmentReportRow;
        Insert: Partial<DevelopmentReportRow> & {
          player_id: string;
          season_id: string;
          club_id: string;
          report_date: string;
        };
        Update: Partial<DevelopmentReportRow>;
      };
      custom_attributes: {
        Row: CustomAttributeRow;
        Insert: Partial<CustomAttributeRow> & {
          club_id: string;
          attribute_name: string;
          applies_to: AppliesTo;
        };
        Update: Partial<CustomAttributeRow>;
      };
      custom_attribute_scores: {
        Row: CustomAttributeScoreRow;
        Insert: Partial<CustomAttributeScoreRow> & {
          development_id: string;
          attribute_id: string;
        };
        Update: Partial<CustomAttributeScoreRow>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

// Convenience re-exports used by components.
export type Player = PlayerRow;
export type Session = SessionRow;
export type Team = TeamRow;
export type TeamPlayer = TeamPlayerRow;
export type Attendance = AttendanceRow;
export type Match = MatchRow;
export type Club = ClubRow;
export type Season = SeasonRow;
export type UserProfile = UserProfileRow;
