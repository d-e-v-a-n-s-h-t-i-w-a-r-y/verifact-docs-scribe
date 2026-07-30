import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { TopBar } from "@/components/app-shell";
import { ensureSeeded } from "@/lib/mock-data";
import {
  useStore,
  editSection,
  signNote,
  updateNote,
  type NoteSections,
} from "@/lib/store";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportMarkdown, exportPdf } from "@/lib/export";
import { ChevronDown, ChevronRight, Lock, Play, Check, Download, FileText, FileType } from "lucide-react";

export const Route = createFileRoute("/notes/$noteId")({
  head: () => ({
    meta: [
      { title: "Review & Sign-Off — Verifact" },
      { name: "description", content: "Review the AI-drafted consultation note against the source transcript, then sign off." },
      { property: "og:title", content: "Review & Sign-Off — Verifact" },
      { property: "og:description", content: "Review the AI draft against the transcript and sign off." },
    ],
  }),
  component: ReviewScreen,
});

const SECTIONS: { key: keyof NoteSections; label: string }[] = [
  { key: "chiefComplaint", label: "Chief Complaint" },
  { key: "hpi", label: "History of Present Illness" },
  { key: "examination", label: "Examination Findings" },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "treatment", label: "Treatment / Plan" },
  { key: "followUp", label: "Follow-up" },
];

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function ReviewScreen() {
  useEffect(() => { ensureSeeded(); }, []);
  const { noteId } = Route.useParams();
  const { doctor } = useAuth();
  const doctorName = doctor?.displayName ?? "Doctor";
  const note = useStore((s) => s.notes.find((n) => n.id === noteId));
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());
  const finalRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = Date.now();
    finalRef.current = null;
    setElapsed(0);
    const t = setInterval(() => {
      if (finalRef.current !== null) return;
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [noteId]);

  if (!note) {
    return (
      <>
        <TopBar title="Note not found" />
        <div className="p-8 text-sm text-muted-foreground">
          This note doesn't exist. <Link to="/" className="text-accent underline">Back to Dashboard</Link>.
        </div>
      </>
    );
  }

  const isSigned = note.status === "signed";

  function statusPill() {
    const s = note!.status;
    const map = {
      draft: "bg-muted text-muted-foreground border-border",
      pending: "bg-accent/10 text-accent border-accent/30",
      signed: "bg-primary/5 text-primary border-primary/20",
    } as const;
    const label = { draft: "Draft", pending: "Pending Review", signed: "Signed" }[s];
    return (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${map[s]}`}>
        {s === "signed" && <Check className="h-3 w-3" />}
        {label}
      </span>
    );
  }

  function handleSign() {
    finalRef.current = elapsed;
    signNote(note!.id, elapsed);
  }

  return (
    <>
      <TopBar
        title={`${note.patientName} · ${note.mrn}`}
        extras={statusPill()}
      />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* LEFT: transcript */}
        <section
          className={`flex shrink-0 flex-col border-r border-border bg-card/50 transition-all ${
            transcriptOpen ? "w-[40%]" : "w-14"
          }`}
        >
          <header className="flex h-12 items-center gap-2 border-b border-border px-3">
            <button
              onClick={() => setTranscriptOpen((v) => !v)}
              className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              aria-label="Toggle transcript"
            >
              {transcriptOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
            {transcriptOpen && (
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Source transcript
              </span>
            )}
          </header>

          {transcriptOpen && (
            <>
              <div className="border-b border-border p-3">
                <div className="flex items-center gap-2">
                  <button className="grid h-7 w-7 place-items-center rounded-full bg-accent text-accent-foreground">
                    <Play className="h-3 w-3 fill-current" />
                  </button>
                  <div className="flex h-8 flex-1 items-center gap-[2px] overflow-hidden rounded bg-muted/60 px-1">
                    {Array.from({ length: 80 }).map((_, i) => (
                      <span
                        key={i}
                        className="w-[3px] shrink-0 rounded-full bg-accent/50"
                        style={{ height: `${8 + ((i * 13) % 22)}px` }}
                      />
                    ))}
                  </div>
                  <span className="text-xs tabular-nums text-muted-foreground">01:32</span>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <ul className="space-y-3">
                  {note.transcript.map((line, i) => (
                    <li
                      key={i}
                      className={`rounded-md border-l-2 pl-3 pr-2 py-2 ${
                        line.speaker === "DOCTOR"
                          ? "border-accent bg-accent/5"
                          : "border-border bg-muted/40"
                      }`}
                    >
                      <div className="mb-0.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        <span>{line.speaker}</span>
                        <span className="tabular-nums opacity-70">{line.time}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-foreground">{line.text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </section>

        {/* RIGHT: structured note */}
        <section className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-12 shrink-0 items-center justify-between border-b border-border px-6">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {note.type}
              </span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">
                Consultation {new Date(note.consultTime).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{note.editsCount}</span> edit{note.editsCount === 1 ? "" : "s"} made
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted">
                  <Download className="h-3.5 w-3.5" /> Export
                  <ChevronDown className="h-3 w-3" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onSelect={() => { exportPdf(note, doctorName); toast.success("PDF downloaded"); }}>
                    <FileType className="mr-2 h-4 w-4" /> Download as PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => { exportMarkdown(note, doctorName); toast.success("Markdown downloaded"); }}>
                    <FileText className="mr-2 h-4 w-4" /> Download as Markdown
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-3xl px-8 py-10 font-serif">
              <div className="mb-8">
                <h2 className="text-3xl leading-tight text-foreground">{note.patientName}</h2>
                <p className="mt-1 font-sans text-sm text-muted-foreground">
                  {note.mrn} · {note.type}
                </p>
              </div>

              {SECTIONS.map(({ key, label }) => (
                <SectionBlock
                  key={key}
                  label={label}
                  value={note.sections[key]}
                  edited={!!note.editedFields[key]}
                  locked={isSigned}
                  onChange={(v) => editSection(note.id, key, v)}
                />
              ))}
            </div>
          </div>

          {/* sticky action bar */}
          <footer className="shrink-0 border-t border-border bg-card px-6 py-3">
            {isSigned ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Lock className="h-4 w-4 text-accent" />
                  <span className="text-foreground">
                    Reviewed in <span className="tabular-nums font-medium">{fmt(note.reviewSeconds ?? 0)}</span>
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">Signed by {doctorName}</span>
                </div>
                <button
                  onClick={() => {
                    if (window.confirm("Request unlock for this signed note? An audit-log entry will be created and the note will re-open for editing.")) {
                      updateNote(note!.id, (n) => ({ ...n, status: "pending" }));
                      finalRef.current = null;
                      startRef.current = Date.now();
                      setElapsed(0);
                      toast.success("Note unlocked — audit entry recorded");
                    }
                  }}
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Request unlock
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-muted-foreground">
                  Review time <span className="tabular-nums font-medium text-foreground">{fmt(elapsed)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toast.success("Draft saved", { description: `${note!.editsCount} edit${note!.editsCount === 1 ? "" : "s"} preserved locally.` })}
                    className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Save Draft
                  </button>
                  <button
                    onClick={handleSign}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground shadow-sm hover:opacity-90"
                  >
                    <Check className="h-4 w-4" /> Confirm & Sign Off
                  </button>
                </div>
              </div>
            )}
          </footer>
        </section>
      </div>
    </>
  );
}

function SectionBlock({
  label,
  value,
  edited,
  locked,
  onChange,
}: {
  label: string;
  value: string;
  edited: boolean;
  locked: boolean;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  return (
    <section className="mb-8">
      <h3 className="mb-2 flex items-center gap-2 font-sans text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <span>{label}</span>
        {edited && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-accent"
            title="Edited by clinician"
          />
        )}
      </h3>
      {editing && !locked ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (draft !== value) onChange(draft);
          }}
          rows={Math.max(3, draft.split("\n").length + 1)}
          className="w-full resize-none rounded-md border border-accent bg-background p-3 font-serif text-[17px] leading-relaxed text-foreground outline-none"
        />
      ) : (
        <div
          onClick={() => !locked && setEditing(true)}
          className={`whitespace-pre-wrap rounded-md p-3 font-serif text-[17px] leading-relaxed text-foreground transition ${
            locked ? "cursor-default" : "cursor-text hover:bg-muted/40"
          } ${edited ? "border-l-2 border-accent pl-3" : ""}`}
        >
          {value}
        </div>
      )}
    </section>
  );
}
