import Link from "next/link";
import { Plus } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import SessionCard from "@/components/sessions/SessionCard";
import { createClient } from "@/lib/supabase/server";
import { getCoachContext } from "@/lib/club";

export const dynamic = "force-dynamic";

export default async function SessionsListPage() {
  const { clubId } = await getCoachContext();
  const supabase = createClient();
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("club_id", clubId)
    .order("session_date", { ascending: false });

  const action = (
    <Link href="/sessions/new" className="btn-primary h-9 min-h-0 px-3 text-sm">
      <Plus className="w-4 h-4" /> New
    </Link>
  );

  return (
    <AppShell title="Sessions" action={action}>
      {sessions && sessions.length > 0 ? (
        <div className="space-y-2">
          {sessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </div>
      ) : (
        <div className="card text-center py-10">
          <p className="text-slate-400 mb-3">No sessions yet.</p>
          <Link href="/sessions/new" className="btn-primary">
            <Plus className="w-5 h-5" /> Create first session
          </Link>
        </div>
      )}
    </AppShell>
  );
}
