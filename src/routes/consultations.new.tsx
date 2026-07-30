import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/app-shell";
import { Mic, Square, Loader2 } from "lucide-react";
import { ensureSeeded } from "@/lib/mock-data";
import { type NoteType } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";

export const Route = createFileRoute("/consultations/new")({
  head: () => ({
    meta: [
      { title: "New Consultation — Verifact" },
      { name: "description", content: "Record a consultation. Verifact transcribes and drafts a structured note." },
      { property: "og:title", content: "New Consultation — Verifact" },
      { property: "og:description", content: "Record. Transcribe. Draft a structured note for review." },
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

  // Audio recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

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

  async function start() {
    if (!canRecord) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.start(200); // chunk every 200ms
      setSeconds(0);
      setPhase("recording");
    } catch (error) {
      console.error("Error accessing microphone:", error);
      toast.error("Could not access microphone.");
    }
  }

  async function stop() {
    setPhase("processing");

    // 1. Stop recording and get the final blob
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      const stoppedPromise = new Promise((resolve) => {
        mediaRecorderRef.current!.onstop = resolve;
      });
      mediaRecorderRef.current.stop();
      await stoppedPromise;
      // Stop all microphone tracks
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
    }

    try {
      const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });

      // Check auth status
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("You must be logged in to upload audio. (RLS is enabled)");
      }

      const fileName = `${Date.now()}.webm`;
      const filePath = `${user.id}/${fileName}`;

      // 2. Upload audio to 'consult-audio'
      const { error: uploadError } = await supabase.storage
        .from('consult-audio')
        .upload(filePath, audioBlob);

      if (uploadError) throw uploadError;

      // Insert or get patient
      const { data: patient, error: patientError } = await supabase
        .from('patients')
        .insert({ name: name.trim(), mrn: mrn.trim(), doctor_id: user.id })
        .select()
        .single();

      if (patientError) throw patientError;

      // 3. Create consultation row with status='processing'
      const { data: consultation, error: consultError } = await supabase
        .from('consultations')
        .insert({
          patient_id: patient.id,
          doctor_id: user.id,
          audio_url: filePath,
          status: 'processing',
          consult_type: type
        })
        .select()
        .single();

      if (consultError) throw consultError;

      // 4. Set up realtime subscription to wait for status changes
      const channel = supabase.channel(`consultation_${consultation.id}`)
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'consultations',
            filter: `id=eq.${consultation.id}`
          },
          async (payload) => {
            if (payload.new.status === 'draft') {
              channel.unsubscribe();
              toast.success("Transcription complete!");
              
              // 5. Fetch the actual generated note from Supabase and put it in local state
              const { fetchAndUpsertConsultation } = await import("@/lib/store");
              await fetchAndUpsertConsultation(consultation.id);

              // 6. Navigate to the Review screen for that ID
              navigate({ to: "/notes/$noteId", params: { noteId: consultation.id } });
            } else if (payload.new.status === 'failed') {
              channel.unsubscribe();
              toast.error("Transcription failed.");
              setPhase("idle");
            }
          }
        )
        .subscribe();

      // Invoke Edge Function
      const { error: invokeError } = await supabase.functions.invoke('transcribe-consult', {
        body: { consultation_id: consultation.id }
      });

      if (invokeError) {
        channel.unsubscribe();
        throw invokeError;
      }

    } catch (error: any) {
      console.error("Error processing consultation:", error);
      toast.error(error.message || "An error occurred during processing.");
      setPhase("idle");
    }
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
              <p className="mt-1 text-xs text-muted-foreground">Waiting for Edge Function.</p>
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
