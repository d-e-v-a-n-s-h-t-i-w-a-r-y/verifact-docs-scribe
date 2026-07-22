import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Lock, Stethoscope, Sparkles, Info } from "lucide-react";

export const Route = createFileRoute("/demo")({
  head: () => ({
    meta: [
      { title: "Verifact — Live Demo" },
      { name: "description", content: "See a raw consultation transcript become a signed discharge summary. Local, DPDP-aligned, doctor-signed." },
      { property: "og:title", content: "Verifact — Live Demo" },
      { property: "og:description", content: "Raw transcript to signed discharge summary in minutes. 100% local processing." },
    ],
  }),
  component: DemoScreen,
});

// Same case as Screen 3: Ananya Krishnan (n-001)
const messyTranscript = `[00:00:02] DOCTOR: good morning mrs krishnan uh how have things been since we last uh spoke
[00:00:07] PATIENT: not not great doctor the breathlessness is uh worse i cant sleep flat anymore i i've been using three pillows
[00:00:18] DOCTOR: mm and the swelling in your feet has that has that changed at all
[00:00:22] PATIENT: much worse my shoes dont fit and ive put on almost four kilos in maybe a week week and a half
[00:00:31] DOCTOR: okay any any chest pain palpitations dizzy spells anything like that
[00:00:35] PATIENT: no no chest pain just very tired and short of breath even walking to the bathroom
[00:00:44] DOCTOR: right have you have you been taking your medications regularly
[00:00:48] PATIENT: honestly no since since my sister passed ive missed a lot of doses sometimes days at a time
[00:01:02] DOCTOR: okay that that's likely a big part of whats going on we'll admit you get the fluid off with iv diuretics and restart your heart failure medications properly
[00:01:14] PATIENT: uh how how long will i be in
[00:01:17] DOCTOR: usually three to five days once we see good diuresis and your weight stabilises
[00:01:24] PATIENT: okay okay
[00:01:26] DOCTOR: were also going to check your kidney function and electrolytes today and get a repeat echo before you go home
[00:01:34] PATIENT: alright doctor whatever you think`;

const cleanNote = {
  chiefComplaint:
    "Progressive shortness of breath and bilateral pedal edema over the past 10 days.",
  hpi:
    "62-year-old female with known hypertension and type 2 diabetes mellitus presented with a 10-day history of exertional dyspnea, orthopnea, and paroxysmal nocturnal dyspnea. Patient reports 4 kg weight gain over the same period and worsening bilateral lower-limb swelling. No chest pain, syncope or palpitations. Medication compliance has been inconsistent over the last month due to family bereavement.",
  examination:
    "Alert, oriented, in mild respiratory distress. BP 158/94 mmHg, HR 102 bpm regular, RR 22, SpO2 93% on room air. JVP elevated to 8 cm. Bilateral basal crepitations on auscultation. S3 gallop present. Pitting edema to mid-shin bilaterally.",
  diagnosis:
    "1. Acute decompensated heart failure (HFrEF, EF 32% on TTE)\n2. Hypertension — poorly controlled\n3. Type 2 diabetes mellitus\n4. Medication non-adherence",
  treatment:
    "IV furosemide 40 mg BD, oral ramipril 5 mg OD, bisoprolol 2.5 mg OD, spironolactone 25 mg OD, empagliflozin 10 mg OD. Fluid restriction 1.5 L/day. Adherence counselling completed.",
  followUp:
    "Cardiology OPD in 2 weeks. Repeat echocardiogram in 3 months. Return immediately if worsening dyspnea, chest pain or weight gain >2 kg in 3 days.",
};

const SECTIONS: [string, keyof typeof cleanNote][] = [
  ["Chief Complaint", "chiefComplaint"],
  ["History of Present Illness", "hpi"],
  ["Examination Findings", "examination"],
  ["Diagnosis", "diagnosis"],
  ["Treatment / Plan", "treatment"],
  ["Follow-up", "followUp"],
];

type Phase = "before" | "generating" | "after";

function DemoScreen() {
  const [phase, setPhase] = useState<Phase>("before");
  const [reviewSecs, setReviewSecs] = useState(94); // canonical demo review time
  const [notesPerDay, setNotesPerDay] = useState(40);
  const [showTrust, setShowTrust] = useState(true);

  // Manual-review baseline: 8 minutes per note typed by hand
  const manualSecondsPerNote = 8 * 60;
  const hoursSaved = useMemo(() => {
    const saved = (manualSecondsPerNote - reviewSecs) * notesPerDay;
    return Math.max(0, saved / 3600);
  }, [reviewSecs, notesPerDay]);

  function generate() {
    if (phase !== "before") return;
    setPhase("generating");
    setTimeout(() => setPhase("after"), 1400);
  }

  function reset() {
    setPhase("before");
  }

  return (
    <div className="min-h-screen bg-[oklch(0.98_0.005_95)] text-foreground">
      {/* HEADER */}
      <header className="border-b border-border bg-background/70 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-6 px-8 py-5">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-accent text-accent-foreground">
              <Stethoscope className="h-4.5 w-4.5" />
            </div>
            <span className="font-serif text-2xl tracking-tight">Verifact</span>
          </div>
          <p className="min-w-0 flex-1 font-serif text-lg text-muted-foreground">
            From consultation to discharge summary — drafted in minutes, signed by the doctor.
          </p>
          <div className="inline-flex items-center gap-2 rounded-full border-2 border-accent bg-accent/10 px-4 py-2 text-sm font-semibold text-accent shadow-sm">
            <Lock className="h-4 w-4" />
            100% local — no cloud, DPDP-aligned
          </div>
        </div>
      </header>

      {/* MAIN STAGE */}
      <main className="mx-auto max-w-[1400px] px-8 py-10">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Same encounter · Ananya Krishnan · MRN-48213
            </p>
            <h2 className="mt-1 font-serif text-3xl text-foreground">
              What the doctor said &nbsp;→&nbsp; what the doctor signs
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {phase === "after" && (
              <button
                onClick={reset}
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Replay
              </button>
            )}
            <button
              onClick={generate}
              disabled={phase !== "before"}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-foreground shadow-md transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Sparkles className="h-4 w-4" />
              {phase === "generating" ? "Generating…" : "Generate"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* LEFT: THE MESS */}
          <div
            className={`relative overflow-hidden rounded-2xl border border-border bg-[oklch(0.96_0.004_95)] transition-all duration-700 ${
              phase === "generating" ? "translate-x-2 opacity-40 blur-[1px]" : ""
            } ${phase === "after" ? "opacity-50" : ""}`}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                The mess — raw transcript
              </span>
              <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-destructive">
                Unusable as-is
              </span>
            </div>
            <pre className="h-[520px] overflow-y-auto whitespace-pre-wrap p-5 font-mono text-[11.5px] leading-[1.35] text-muted-foreground">
              {messyTranscript}
            </pre>
            {/* subtle noise/uneven overlay */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 mix-blend-multiply"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(0deg, transparent 0 22px, oklch(0.9 0.01 95 / 0.35) 22px 23px)",
              }}
            />
          </div>

          {/* RIGHT: THE CLEAN NOTE */}
          <div
            className={`relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-all duration-700 ${
              phase === "before" ? "opacity-30" : "opacity-100"
            } ${phase === "generating" ? "translate-x-2" : ""}`}
          >
            <div className="flex items-center justify-between border-b border-border px-5 py-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                The clean note — discharge summary
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                <Lock className="h-2.5 w-2.5" /> Ready to sign
              </span>
            </div>

            <div className="h-[520px] overflow-y-auto px-8 py-6 font-serif">
              <div className="mb-5 border-b border-border pb-4">
                <h3 className="text-2xl leading-tight text-foreground">Ananya Krishnan</h3>
                <p className="mt-1 font-sans text-xs text-muted-foreground">
                  MRN-48213 · Discharge Summary
                </p>
              </div>

              {SECTIONS.map(([label, key], i) => (
                <section
                  key={key}
                  className={`mb-5 ${phase === "after" ? "animate-fade-in" : ""}`}
                  style={{
                    animationDelay: phase === "after" ? `${i * 90}ms` : undefined,
                    animationFillMode: "both",
                  }}
                >
                  <h4 className="mb-1.5 font-sans text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                    {label}
                  </h4>
                  <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
                    {cleanNote[key]}
                  </p>
                </section>
              ))}
            </div>

            {phase === "generating" && (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-accent/25 to-transparent animate-[demo-sweep_1.2s_ease-out_forwards]" />
              </div>
            )}
          </div>
        </div>

        {/* ROI STRIP */}
        <section className="mt-10 rounded-2xl border border-border bg-card px-6 py-5">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                Live ROI
              </p>
              <p className="mt-1 font-serif text-lg text-foreground">
                This note took{" "}
                <span className="font-semibold text-accent tabular-nums">{reviewSecs}s</span>{" "}
                to review. At{" "}
                <span className="font-semibold text-accent tabular-nums">{notesPerDay}</span>{" "}
                notes a day, that's{" "}
                <span className="font-semibold text-accent tabular-nums">
                  {hoursSaved.toFixed(1)}
                </span>{" "}
                hours saved daily.
              </p>
            </div>

            <div className="ml-auto flex min-w-[280px] flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Notes per doctor per day</span>
                <span className="tabular-nums text-foreground">{notesPerDay}</span>
              </div>
              <input
                type="range"
                min={10}
                max={80}
                step={1}
                value={notesPerDay}
                onChange={(e) => setNotesPerDay(Number(e.target.value))}
                className="w-full accent-[oklch(0.55_0.07_180)]"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>10</span><span>40</span><span>80</span>
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Baseline review
              <input
                type="number"
                min={30}
                max={300}
                value={reviewSecs}
                onChange={(e) => setReviewSecs(Math.max(30, Math.min(300, Number(e.target.value) || 0)))}
                className="w-16 rounded border border-input bg-background px-2 py-1 text-center tabular-nums text-foreground"
              />
              <span>sec / note</span>
            </label>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Compared against an 8-minute manual write-up baseline.
          </p>
        </section>

        {/* TRUST STRIP */}
        <section className="mt-6">
          {showTrust ? (
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p className="max-w-3xl">
                Speaker diarization needs roughly 3 seconds of clean audio per speaker to lock on.
                In noisy rooms the first exchange may need a manual speaker tag before the model
                settles — after that it holds throughout the consultation.
                <button
                  onClick={() => setShowTrust(false)}
                  className="ml-2 underline underline-offset-2 hover:text-foreground"
                >
                  hide
                </button>
              </p>
            </div>
          ) : (
            <button
              onClick={() => setShowTrust(true)}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Show honest limitations
            </button>
          )}
        </section>
      </main>

      <style>{`
        @keyframes demo-sweep {
          from { transform: translateX(0); }
          to { transform: translateX(600%); }
        }
      `}</style>
    </div>
  );
}

// keep the eslint import graph honest
void useEffect;
