import { createClient } from '@/lib/supabase/server';

export default async function HomePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen p-6">
      <h1 className="text-2xl font-bold text-green-500">Matchday Assistant</h1>
      <p className="text-slate-400 mt-1 text-sm">Signed in as {user?.email}</p>
    </main>
  );
}
