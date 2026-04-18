import { Shield } from "lucide-react";

export default function GoalkeeperBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className="chip border bg-sky-500/15 text-sky-300 border-sky-500/30"
      title="Goalkeeper"
    >
      <Shield className="w-3 h-3" />
      {compact ? "GK" : "Goalkeeper"}
    </span>
  );
}
