"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function DeleteSessionButton({
  sessionId,
  teamIds,
}: {
  sessionId: string;
  teamIds: string[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function performDelete() {
    setError(null);
    setBusy(true);

    // Defensive deletion order — works whether or not FK cascades are set up.
    // Every step is scoped to this session, so we never touch another session.
    if (teamIds.length > 0) {
      const tp = await supabase.from("team_players").delete().in("team_id", teamIds);
      if (tp.error) {
        setError(`Could not delete team players: ${tp.error.message}`);
        setBusy(false);
        return;
      }
    }

    const att = await supabase.from("attendance").delete().eq("session_id", sessionId);
    if (att.error) {
      setError(`Could not delete attendance: ${att.error.message}`);
      setBusy(false);
      return;
    }

    const m = await supabase.from("matches").delete().eq("session_id", sessionId);
    if (m.error) {
      setError(`Could not delete fixtures: ${m.error.message}`);
      setBusy(false);
      return;
    }

    const t = await supabase.from("teams").delete().eq("session_id", sessionId);
    if (t.error) {
      setError(`Could not delete teams: ${t.error.message}`);
      setBusy(false);
      return;
    }

    const s = await supabase.from("sessions").delete().eq("id", sessionId);
    if (s.error) {
      setError(`Could not delete session: ${s.error.message}`);
      setBusy(false);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <>
      <button
        onClick={() => setConfirming(true)}
        className="btn-danger w-full"
      >
        <Trash2 className="w-5 h-5" />
        Delete this session
      </button>

      {confirming && (
        <div className="fixed inset-0 z-40 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-md bg-bg-surface border border-border rounded-t-2xl sm:rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold">Delete this session?</h3>
              <button
                onClick={() => setConfirming(false)}
                className="btn-ghost w-tap h-tap p-0"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-400 mb-4">
              This permanently removes the teams, fixtures, attendance, and minute
              records for this session. Players themselves are kept.
            </p>
            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 mb-3">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={performDelete}
                disabled={busy}
                className="btn-danger flex-1"
              >
                {busy ? "Deleting…" : "Delete session"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
