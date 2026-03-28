import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';

const STATUS_STYLES: Record<string, string> = {
  draft:     'bg-slate-700 text-slate-300',
  active:    'bg-green-700 text-green-100',
  completed: 'bg-blue-900 text-blue-200',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function SessionsPage() {
  const supabase = createClient();

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, session_date, format, status, attendance(id, status)')
    .order('session_date', { ascending: false });

  const today = new Date().toISOString().split('T')[0];

  const upcoming = (sessions ?? []).filter(s => s.session_date >= today);
  const past     = (sessions ?? []).filter(s => s.session_date <  today);

  return (
    <div className="min-h-screen bg-slate-900 pb-10">
      {/* Header */}
      <div className="px-6 pt-8 pb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Sessions</h1>
        <Link
          href="/sessions/new"
          className="px-5 py-2.5 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl text-sm transition-colors"
        >
          + New Session
        </Link>
      </div>

      {sessions?.length === 0 && (
        <div className="px-6 py-16 text-center">
          <p className="text-slate-400 text-lg mb-6">No sessions yet.</p>
          <Link
            href="/sessions/new"
            className="inline-block px-8 py-4 bg-green-600 text-white font-bold rounded-2xl text-base"
          >
            Create your first session
          </Link>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="px-6 mt-2">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Upcoming
          </h2>
          <div className="space-y-3">
            {upcoming.map(s => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="px-6 mt-8">
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
            Past
          </h2>
          <div className="space-y-3">
            {past.map(s => (
              <SessionCard key={s.id} session={s} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

type AttendanceRow = { id: string; status: string };

type SessionRow = {
  id: string;
  session_date: string;
  format: number;
  status: string;
  attendance: AttendanceRow[];
};

function SessionCard({ session }: { session: SessionRow }) {
  const presentCount = session.attendance.filter(a => a.status === 'present').length;
  const totalCount   = session.attendance.length;

  return (
    <Link
      href={`/sessions/${session.id}`}
      className="block bg-slate-800 border border-slate-700 rounded-2xl p-4 active:bg-slate-700 transition-colors"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white font-semibold text-base leading-snug">
            {formatDate(session.session_date)}
          </p>
          <p className="text-slate-400 text-sm mt-1">
            {session.format}-a-side
            {totalCount > 0 && (
              <> · {presentCount} / {totalCount} players</>
            )}
          </p>
        </div>
        <span
          className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_STYLES[session.status] ?? STATUS_STYLES.draft}`}
        >
          {session.status}
        </span>
      </div>
    </Link>
  );
}
