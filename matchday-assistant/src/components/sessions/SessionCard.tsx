import Link from "next/link";
import { formatUKDate } from "@/lib/utils";
import type { Session } from "@/lib/types/database";
import { CalendarDays, ChevronRight } from "lucide-react";

const STATUS_STYLE: Record<string, string> = {
  draft: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  ready: "bg-sky-500/15 text-sky-400 border-sky-500/30",
  live: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  completed: "bg-slate-600/15 text-slate-400 border-slate-600/30",
};

export default function SessionCard({ session }: { session: Session }) {
  const status = (session.status ?? "draft").toLowerCase();
  return (
    <Link
      href={`/session/${session.id}`}
      className="card flex items-center justify-between gap-3 hover:border-border-strong active:scale-[0.99]"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-11 h-11 rounded-lg bg-bg-elevated flex items-center justify-center text-slate-300">
          <CalendarDays className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="font-semibold truncate">
            {formatUKDate(session.session_date)}
          </div>
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="uppercase">{session.format}</span>
            <span>·</span>
            <span>{session.num_teams} teams</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span
          className={`chip border capitalize ${
            STATUS_STYLE[status] ?? STATUS_STYLE.draft
          }`}
        >
          {status}
        </span>
        <ChevronRight className="w-5 h-5 text-slate-500" />
      </div>
    </Link>
  );
}
