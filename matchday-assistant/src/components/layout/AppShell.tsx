import Link from "next/link";
import { LayoutDashboard, Users, CalendarDays, LogOut, UserCog } from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ReactNode };

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: <LayoutDashboard className="w-5 h-5" /> },
  { href: "/sessions", label: "Sessions", icon: <CalendarDays className="w-5 h-5" /> },
  { href: "/players", label: "Squad", icon: <Users className="w-5 h-5" /> },
  { href: "/coaches", label: "Coaches", icon: <UserCog className="w-5 h-5" /> },
];

export default function AppShell({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen pb-20">
      <header className="sticky top-0 z-30 backdrop-blur bg-bg-base/80 border-b border-border">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <h1 className="text-lg font-bold truncate">{title}</h1>
          <div className="flex items-center gap-2">
            {action}
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                aria-label="Sign out"
                className="btn-ghost w-tap h-tap p-0"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-4">{children}</main>
      <nav className="fixed bottom-0 inset-x-0 z-30 bg-bg-surface border-t border-border">
        <div className="max-w-3xl mx-auto grid grid-cols-4">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 py-2.5 text-xs text-slate-400 hover:text-slate-100"
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}
