import type { AbilityCategory } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const STYLES: Record<AbilityCategory, string> = {
  Advanced: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  Intermediate: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  Developing: "bg-red-500/15 text-red-400 border-red-500/30",
};

const LABEL: Record<AbilityCategory, string> = {
  Advanced: "Adv",
  Intermediate: "Int",
  Developing: "Dev",
};

export default function AbilityBadge({
  category,
  full,
}: {
  category: AbilityCategory | null;
  full?: boolean;
}) {
  if (!category) {
    return (
      <span className="chip border border-slate-500/30 bg-slate-500/10 text-slate-400">
        —
      </span>
    );
  }
  return (
    <span className={cn("chip border", STYLES[category])}>
      {full ? category : LABEL[category]}
    </span>
  );
}
