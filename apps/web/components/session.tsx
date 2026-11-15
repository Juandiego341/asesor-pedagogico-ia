'use client';
import { createContext, useContext } from 'react';
import type { User } from '@/lib/api';

export const SessionCtx = createContext<{ user: User; isStaff: boolean } | null>(null);
export function useSession() {
  const s = useContext(SessionCtx);
  if (!s) throw new Error('Sin sesión');
  return s;
}
