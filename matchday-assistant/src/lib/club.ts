import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type CoachContext = {
  userId: string;
  clubId: string;
  activeSeasonId: string | null;
};

/**
 * Load the coach's club + active season. Redirects to /login if no user.
 * Throws if the user's profile is missing a club — admin must provision clubs.
 */
export async function getCoachContext(): Promise<CoachContext> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("club_id")
    .eq("id", user.id)
    .single();

  if (!profile?.club_id) {
    throw new Error("No club assigned to this user. Contact admin.");
  }

  const { data: season } = await supabase
    .from("seasons")
    .select("id")
    .eq("club_id", profile.club_id)
    .eq("is_active", true)
    .maybeSingle();

  return { userId: user.id, clubId: profile.club_id, activeSeasonId: season?.id ?? null };
}
