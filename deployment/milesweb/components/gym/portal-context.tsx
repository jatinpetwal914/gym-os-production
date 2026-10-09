'use client';

import { createContext, useContext } from 'react';
import type { AppRole } from '@/lib/roles';

const GymPortalContext = createContext<{ role: AppRole }>({ role: 'staff' });

export function GymPortalProvider({
  role,
  children,
}: {
  role: AppRole;
  children: React.ReactNode;
}) {
  return <GymPortalContext.Provider value={{ role }}>{children}</GymPortalContext.Provider>;
}

export function useGymPortal() {
  return useContext(GymPortalContext);
}
