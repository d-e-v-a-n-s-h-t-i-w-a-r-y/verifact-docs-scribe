import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DoctorSession {
  user: User;
  session: Session;
  /** Display name: email prefix or full_name from user metadata */
  displayName: string;
  /** Initials for the avatar chip */
  initials: string;
}

interface AuthContextValue {
  doctor: DoctorSession | null;
  /** true while Supabase is resolving the initial session */
  loading: boolean;
  signOut: () => Promise<void>;
}

// ─── Context ─────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function deriveDisplayName(user: User): string {
  // Prefer full_name from user_metadata (set during sign-up)
  const meta = user.user_metadata as Record<string, string> | undefined;
  if (meta?.full_name) return meta.full_name;
  if (meta?.name) return meta.name;
  // Fall back to email prefix
  return user.email?.split("@")[0] ?? "Doctor";
}

function deriveInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
}

function buildDoctorSession(user: User, session: Session): DoctorSession {
  const displayName = deriveDisplayName(user);
  return {
    user,
    session,
    displayName,
    initials: deriveInitials(displayName),
  };
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [doctor, setDoctor] = useState<DoctorSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Resolve the initial session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setDoctor(buildDoctorSession(session.user, session));
      }
      setLoading(false);
    });

    // Subscribe to auth changes (login / logout / token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setDoctor(buildDoctorSession(session.user, session));
      } else {
        setDoctor(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setDoctor(null);
  }

  return (
    <AuthContext.Provider value={{ doctor, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
