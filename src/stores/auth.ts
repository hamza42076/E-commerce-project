"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UserRole } from "@/types";

/**
 * Who is signed in, kept in localStorage so it survives a reload and stays
 * until sign-out.
 *
 * This store does not authorise anything. Every page guard and every server
 * action reads the httpOnly session cookie instead — a server component cannot
 * see localStorage, and a value the browser can write is not evidence of
 * anything. Editing `role` here by hand changes what the menu shows and
 * nothing else; `/admin` still refuses you.
 *
 * That cookie is also where the security actually lives: JavaScript cannot read
 * an httpOnly cookie, so script injected into the page cannot lift the session
 * out of it. It *can* read localStorage, which is why the token below is a
 * convenience for calling the JSON API from the browser rather than the thing
 * protecting the account.
 */

export type AuthUser = {
  name: string;
  email: string;
  role: UserRole;
};

type AuthState = {
  user: AuthUser | null;
  /** Bearer token for the JSON API. Null for a session restored from a cookie. */
  token: string | null;
  /** False until localStorage has been read, so the UI can avoid a flash. */
  hydrated: boolean;

  signIn: (user: AuthUser, token: string | null) => void;
  signOut: () => void;
  /** Reconciles the store with what the server rendered. */
  syncFromServer: (user: AuthUser | null) => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      hydrated: false,

      signIn: (user, token) => set({ user, token }),

      signOut: () => set({ user: null, token: null }),

      syncFromServer: (user) => {
        const current = get().user;

        // The cookie is the authority. If the server says nobody is signed in,
        // anything left here is stale — the cookie expired, or another tab
        // signed out.
        if (!user) {
          if (current) set({ user: null, token: null });
          return;
        }

        if (current?.email !== user.email || current?.role !== user.role) {
          // The token we hold belongs to this same account and a page load
          // gives us no new one, so it is left alone.
          set({ user });
        }
      },
    }),
    {
      name: "smartshop-auth",
      storage: createJSONStorage(() => localStorage),
      // `hydrated` describes this tab; there is nothing to store about it.
      partialize: (state) => ({ user: state.user, token: state.token }),
    },
  ),
);

// Set out here, not in `onRehydrateStorage`: that callback runs during
// create(), while `useAuthStore` is still in its temporal dead zone, so a
// setState from inside it quietly does nothing. localStorage is synchronous, so
// the restore has already happened by this line.
if (typeof window !== "undefined") {
  useAuthStore.setState({ hydrated: true });
}

export const useAuthUser = () => useAuthStore((state) => state.user);
export const useIsSignedIn = () => useAuthStore((state) => state.user !== null);
/** Bearer token for API calls made from the browser. */
export const useAuthToken = () => useAuthStore((state) => state.token);
