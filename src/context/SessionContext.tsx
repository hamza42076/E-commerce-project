"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { UserRole } from "@/types";

/**
 * The signed-in user, read on the server in the root layout and handed down so
 * client components can branch on it.
 *
 * This is for the interface only — deciding what to show, where to send
 * someone. It is never the thing that protects an action. Every server action
 * re-checks the session itself, because the browser can say anything.
 */

export type SessionUser = {
  name: string;
  email: string;
  role: UserRole;
};

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser | null;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

/** The signed-in user, or null. */
export function useSessionUser(): SessionUser | null {
  return useContext(SessionContext);
}

export function useIsSignedIn(): boolean {
  return useContext(SessionContext) !== null;
}
