import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Stethoscope, Loader2, Mail, Lock, Sparkles } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign In — Verifact" },
      { name: "description", content: "Sign in to Verifact, your ambient AI clinical documentation assistant." },
    ],
  }),
  component: LoginPage,
});

type Mode = "magic" | "password";
type Step = "form" | "check-email";

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("magic");
  const [step, setStep] = useState<Step>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setStep("check-email");
    }
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    setLoading(true);
    let error;
    if (isSignUp) {
      const res = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { full_name: fullName.trim() || undefined },
        },
      });
      error = res.error;
      if (!error) {
        toast.success("Account created! Check your email to confirm.");
        setStep("check-email");
        setLoading(false);
        return;
      }
    } else {
      const res = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      error = res.error;
      if (!error) {
        navigate({ to: "/" });
      }
    }
    setLoading(false);
    if (error) toast.error(error.message);
  }

  if (step === "check-email") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-accent/10 text-accent">
            <Mail className="h-8 w-8" />
          </div>
          <h1 className="font-serif text-2xl text-foreground">Check your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a {mode === "magic" ? "magic link" : "confirmation link"} to{" "}
            <span className="font-medium text-foreground">{email}</span>.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Click the link to sign in.</p>
          <button
            onClick={() => { setStep("form"); setEmail(""); }}
            className="mt-6 text-xs text-accent underline-offset-2 hover:underline"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left — branding panel */}
      <div className="hidden w-1/2 flex-col justify-between bg-sidebar border-r border-border p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Stethoscope className="h-5 w-5" />
          </div>
          <span className="font-serif text-xl tracking-tight text-foreground">Verifact</span>
        </div>

        <div>
          <blockquote className="font-serif text-3xl leading-snug text-foreground">
            "Let the consultation speak for itself."
          </blockquote>
          <p className="mt-4 text-sm text-muted-foreground">
            Ambient AI that records, transcribes, and drafts your clinical notes
            — so you can focus on the patient.
          </p>
        </div>

        <div className="space-y-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-accent" />
            <span>Structured SOAP / discharge summaries in seconds</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-accent" />
            <span>Row-level security — you only see your own patients</span>
          </div>
          <div className="flex items-center gap-2">
            <Mail className="h-3.5 w-3.5 text-accent" />
            <span>Sign off and export to PDF or Markdown instantly</span>
          </div>
        </div>
      </div>

      {/* Right — auth form */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        {/* Mobile logo */}
        <div className="mb-8 flex items-center gap-2 lg:hidden">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-accent text-accent-foreground">
            <Stethoscope className="h-4 w-4" />
          </div>
          <span className="font-serif text-lg tracking-tight text-foreground">Verifact</span>
        </div>

        <div className="w-full max-w-sm">
          <h1 className="font-serif text-2xl text-foreground">
            {isSignUp ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignUp
              ? "Create an account to start documenting consultations."
              : "Sign in to access your consultations and notes."}
          </p>

          {/* Mode tabs */}
          <div className="mt-6 flex rounded-lg border border-border bg-muted p-1 text-sm">
            <button
              type="button"
              onClick={() => setMode("magic")}
              className={`flex-1 rounded-md py-1.5 text-center font-medium transition-colors ${
                mode === "magic"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Magic Link
            </button>
            <button
              type="button"
              onClick={() => setMode("password")}
              className={`flex-1 rounded-md py-1.5 text-center font-medium transition-colors ${
                mode === "password"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Password
            </button>
          </div>

          {mode === "magic" ? (
            <form onSubmit={handleMagicLink} className="mt-5 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Email
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@hospital.org"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
              </label>
              <button
                type="submit"
                disabled={loading || !email.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {loading ? "Sending…" : "Send magic link"}
              </button>
            </form>
          ) : (
            <form onSubmit={handlePassword} className="mt-5 space-y-4">
              {isSignUp && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Full name
                  </span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Dr. Jane Smith"
                    className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-accent"
                  />
                </label>
              )}
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Email
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="doctor@hospital.org"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Password
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-accent"
                />
              </label>
              <button
                type="submit"
                disabled={loading || !email.trim() || !password.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Please wait…" : isSignUp ? "Create account" : "Sign in"}
              </button>

              <button
                type="button"
                onClick={() => setIsSignUp((v) => !v)}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                {isSignUp ? "Already have an account? Sign in" : "No account? Sign up"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
