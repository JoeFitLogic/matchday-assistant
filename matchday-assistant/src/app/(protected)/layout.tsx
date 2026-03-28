import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ClubProvider, type UserRole } from '@/context/ClubProvider';
import OfflineBanner from '@/components/OfflineBanner';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('club_id, role, clubs(name)')
    .eq('id', user.id)
    .single();

  // Profile missing means the account exists but hasn't been linked to a club yet
  if (!profile || !profile.clubs) {
    redirect('/login?error=no_profile');
  }

  const club = (Array.isArray(profile.clubs) ? profile.clubs[0] : profile.clubs) as { name: string };

  return (
    <ClubProvider
      value={{
        userId: user.id,
        clubId: profile.club_id,
        clubName: club.name,
        role: profile.role as UserRole,
      }}
    >
      <OfflineBanner />
      {children}
    </ClubProvider>
  );
}
