import { Link2 } from "lucide-react";

/**
 * Shows that a player is part of a pair_group (siblings, best friends, etc.).
 * The balancer keeps them on the same team — which is in the same slot — so
 * the same car trip covers them.
 */
export default function SiblingBadge({ group }: { group: string }) {
  return (
    <span
      title={`Paired: ${group}`}
      className="chip border bg-purple-500/15 text-purple-300 border-purple-500/30"
    >
      <Link2 className="w-3 h-3" />
      {group}
    </span>
  );
}
