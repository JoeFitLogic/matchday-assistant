'use client';

import { createContext, useContext } from 'react';

export type UserRole = 'head_coach' | 'coach' | 'assistant';

export type ClubContextValue = {
  clubId: string;
  clubName: string;
  role: UserRole;
  userId: string;
};

const ClubContext = createContext<ClubContextValue | null>(null);

export function ClubProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: ClubContextValue;
}) {
  return <ClubContext.Provider value={value}>{children}</ClubContext.Provider>;
}

export function useClub(): ClubContextValue {
  const ctx = useContext(ClubContext);
  if (!ctx) throw new Error('useClub must be used inside a ClubProvider');
  return ctx;
}
