import Link from "next/link";
import { Plus, Users, CalendarDays } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import SessionCard from "@/components/sessions/SessionCard";
import { createClient } from "@/lib/supabase/server";
import { getCoachContext } from "@/lib/club";
import { formatUKDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { clubId } = await getCoachContext();
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [playersRes, upcomingRes, recentRes] = await Promise.all([
    supabase
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("club_id", clubId)
      .eq("is_active", true),
    supabase
      .from("sessions")
      .select("*")
      .eq("club_id", clubId)
      .gte("session_date", today)
      .order("session_date", { ascending: true })
      .limit(3),
    supabase
      .from("sessions")
      .select("*")
      .eq("club_id", clubId)
      .lt("session_date", today)
      .order("session_date", { ascending: false })
      .limit(3),
  ]);

  const squadCount = playersRes.count ?? 0;
  const upcoming = upcomingRes.data ?? [];
  const recent = recentRes.data ?? [];
  const nextSession = upcoming[0];

  return (
    <AppShell title="Matchday OS">
      <section className="grid grid-cols-2 gap-3 mb-5">
        <div className="card">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <Users className="w-4 h-4" /> Squad
          </div>
          <div className="text-3xl font-bold mt-1">{squadCount}</div>
          <div className="text-xs text-slate-500">active players</div>
        </div>
        <div className="card">
          <div className="flex items-center gap-2 text-slate-400 text-xs">
            <CalendarDays className="w-4 h-4" /> Next session
          </div>
          <div className="text-lg font-bold mt-1 truncate">
            {nextSession ? formatUKDate(nextSession.session_date) : "None"}
          </div>
          <div className="text-xs text-slate-500">
            {nextSession ? nextSession.format.toUpperCase() : "Create one below"}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 mb-6">
        <Link href="/sessions/new" className="btn-primary">
          <Plus className="w-5 h-5" /> New session
        </Link>
        <Link href="/players" className="btn-secondary">
          <Users className="w-5 h-5" /> Manage squad
        </Link>
      </section>

      <section className="mb-6">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <div className="card text-sm text-slate-400">No upcoming sessions.</div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-2">
          Recent
        </h2>
        {recent.length === 0 ? (
          <div className="card text-sm text-slate-400">No past sessions yet.</div>
        ) : (
          <div className="space-y-2">
            {recent.map((s) => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
