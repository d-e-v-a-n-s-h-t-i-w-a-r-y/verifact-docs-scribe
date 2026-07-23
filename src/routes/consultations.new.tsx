import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/app-shell";
import { Mic, Square, Loader2 } from "lucide-react";
import { ensureSeeded, } from "@/lib/mock-data";
import { pickCase } from "@/lib/mock-cases";
import { upsertNote, type Note, type NoteType } from "@/lib/store";

export const Route = createFileRoute("/consultations/new")({
  head: () => ({
    meta: [
      { title: "New Consultation — Verifact" },
      { name: "description", content: "Record a consultation. Verifact transcribes and drafts a structured note locally." },
      { property: "og:title", content: "New Consultation — Verifact" },
      { property: "og:description", content: "Record. Transcribe locally. Draft a structured note for review." },
    ],
  }),
  component: NewConsultation,
});

type Phase = "idle" | "recording" | "processing";

function NewConsultation() {
  useEffect(() => { ensureSeeded(); }, []);
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [name, setName] = useState("");
  const [mrn, setMrn] = useState("");
  const [type, setType] = useState<NoteType>("OPD Note");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (phase === "recording") {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const canRecord = name.trim() && mrn.trim();

  function start() {
    if (!canRecord) return;
    setSeconds(0);
    setPhase("recording");
  }

  function stop() {
    setPhase("processing");
    setTimeout(() => {
      const id = `n-${Date.now().toString(36)}`;
      const mock = pickCase(type);
      const note: Note = {
        id,
        patientName: name.trim(),
        mrn: mrn.trim(),
        consultTime: new Date().toISOString(),
        type,
        status: "pending",
        editedFields: {},
        editsCount: 0,
        sections: mock.sections,
        transcript: mock.transcript,
      };
      upsertNote(note);
      navigate({ to: "/notes/$noteId", params: { noteId: id } });
    }, 1800);
  }

  return (
    <>
      <TopBar title="New Consultation" />
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-6 py-14">
        <div className="w-full space-y-4">
          <Field label="Patient name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={phase !== "idle"}
              placeholder="Full name"
              className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-accent"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="MRN">
              <input
                value={mrn}
                onChange={(e) => setMrn(e.target.value)}
                disabled={phase !== "idle"}
                placeholder="MRN-00000"
                className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </Field>
            <Field label="Consult type">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as NoteType)}
                disabled={phase !== "idle"}
                className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-accent"
              >
                <option>OPD Note</option>
                <option>Discharge Summary</option>
              </select>
            </Field>
          </div>
        </div>

        <div className="mt-14 flex flex-col items-center">
          {phase === "idle" && (
            <>
              <button
                onClick={start}
                disabled={!canRecord}
                className="grid h-32 w-32 place-items-center rounded-full bg-accent text-accent-foreground shadow-lg transition hover:scale-[1.02] disabled:opacity-40 disabled:hover:scale-100"
              >
                <Mic className="h-12 w-12" />
              </button>
              <p className="mt-6 text-sm text-muted-foreground">
                {canRecord ? "Tap to begin recording" : "Enter patient details to begin"}
              </p>
            </>
          )}

          {phase === "recording" && (
            <>
              <button
                onClick={stop}
                className="relative grid h-32 w-32 place-items-center rounded-full bg-destructive text-destructive-foreground shadow-lg"
              >
                <span className="absolute inset-0 animate-ping rounded-full bg-destructive/30" />
                <Square className="h-10 w-10 fill-current" />
              </button>
              <div className="mt-8 flex h-12 items-center gap-1">
                {Array.from({ length: 32 }).map((_, i) => (
                  <span
                    key={i}
                    className="wf-bar w-1 rounded-full bg-accent"
                    style={{
                      height: `${20 + ((i * 7) % 24)}px`,
                      animationDelay: `${(i * 0.06).toFixed(2)}s`,
                    }}
                  />
                ))}
              </div>
              <p className="mt-4 font-serif text-3xl tabular-nums text-foreground">{fmt(seconds)}</p>
              <p className="text-xs uppercase tracking-widest text-destructive">Recording</p>
            </>
          )}

          {phase === "processing" && (
            <>
              <div className="grid h-32 w-32 place-items-center rounded-full border-2 border-dashed border-accent/40">
                <Loader2 className="h-12 w-12 animate-spin text-accent" />
              </div>
              <p className="mt-6 text-sm text-foreground">Transcribing and generating note…</p>
              <p className="mt-1 text-xs text-muted-foreground">Running locally on this device.</p>
            </>
          )}
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m.toString().padStart(2, "0")}:${r.toString().padStart(2, "0")}`;
}
