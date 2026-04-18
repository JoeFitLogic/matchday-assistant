import { getCoachContext } from "@/lib/club";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await getCoachContext(); // redirects to /login if no session
  return <>{children}</>;
}
