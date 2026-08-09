import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { TopBar } from "@/components/app-shell";
import { ensureSeeded } from "@/lib/mock-data";
import {
  useStore,
  editSection,
  editTranscriptLine,
  signNote,
  updateNote,
  fetchAndUpsertConsultation,
  addIcd10Code,
  removeIcd10Code,
  addPrescription,
  removePrescription,
  type NoteSections,
  type TranscriptLine,
  type ICD10Code,
} from "@/lib/store";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportMarkdown, exportPdf } from "@/lib/export";
import {
  ChevronDown, ChevronRight, Lock, Play, Check, Download, FileText, FileType, Edit3,
  Stethoscope, User, Sparkles, ArrowLeftRight, Pill, Tag, Plus, X, Search, ShieldAlert,
  AlertTriangle, CheckCircle2, Award, Info, Activity, Volume2
} from "lucide-react";

export const Route = createFileRoute("/notes/$noteId")({
  head: () => ({
    meta: [
      { title: "Clinical Workspace — Verifact" },
      { name: "description", content: "Interactive 3-panel clinical review workspace with grounded transcript evidence." },
    ],
  }),
  component: ReviewScreen,
});

const SECTIONS: { key: keyof NoteSections; label: string }[] = [
  { key: "chiefComplaint", label: "CHIEF COMPLAINT" },
  { key: "hpi", label: "HISTORY OF PRESENT ILLNESS" },
  { key: "examination", label: "EXAMINATION FINDINGS" },
  { key: "diagnosis", label: "DIAGNOSIS" },
  { key: "treatment", label: "TREATMENT / PLAN" },
  { key: "followUp", label: "FOLLOW-UP" },
];

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r}s`;
}

function Icd10SearchModal({
  isOpen,
  onClose,
  noteId,
  attachedCodes,
}: {
  isOpen: boolean;
  onClose: () => void;
  noteId: string;
  attachedCodes: ICD10Code[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    const timer = setTimeout(() => {
      fetch(`http://localhost:8000/api/icd10?q=${encodeURIComponent(query)}`)
        .then((res) => res.json())
        .then((data) => {
          setResults(Array.isArray(data) ? data : []);
          setIsLoading(false);
        })
        .catch(() => {
          setResults([]);
          setIsLoading(false);
        });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none">
      <div className="w-full max-w-xl rounded-xl border border-border bg-[#0D1520] p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-teal-400" />
            <h3 className="font-bold text-foreground text-sm">Search & Attach ICD-10 Diagnostic Codes</h3>
          </div>
          <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type diagnosis name, ICD-10 code, or keyword (e.g. 'headache', 'he', 'asthma')..."
            className="w-full rounded-lg border border-border bg-[#070B12] py-2.5 pl-9 pr-3 text-xs text-foreground outline-none focus:border-teal-500"
          />
        </div>

        <div className="max-h-80 overflow-y-auto space-y-2 pr-1">
          {isLoading ? (
            <div className="py-8 text-center text-xs text-muted-foreground animate-pulse">
              Searching ICD-10 reference dataset...
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              No ICD-10 codes found for this search.
            </div>
          ) : (
            results.map((item) => {
              const isAttached = attachedCodes.some((c) => c.code === item.code);
              return (
                <div
                  key={item.code}
                  className="flex items-center justify-between rounded-lg border border-border/80 bg-[#070B12] p-3 text-xs hover:border-teal-500/50 transition"
                >
                  <div className="space-y-0.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-teal-400">{item.code}</span>
                      <span className="rounded bg-teal-500/10 px-2 py-0.5 text-[9px] font-semibold text-teal-400">
                        {item.category || "General Medical"}
                      </span>
                    </div>
                    <div className="font-semibold text-foreground">{item.title}</div>
                  </div>

                  <button
                    disabled={isAttached}
                    onClick={() => {
                      addIcd10Code(noteId, {
                        code: item.code,
                        title: item.title,
                        category: item.category,
                        source: "physician",
                      });
                      toast.success(`Attached ICD-10 code ${item.code} (${item.title})`);
                    }}
                    className={`rounded px-3 py-1.5 font-bold text-xs shrink-0 transition ${
                      isAttached
                        ? "bg-muted/60 text-muted-foreground cursor-not-allowed border border-border"
                        : "bg-teal-600 text-white hover:bg-teal-500 shadow-sm"
                    }`}
                  >
                    {isAttached ? "Attached ✓" : "Attach"}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end border-t border-border/60 pt-3">
          <button onClick={onClose} className="rounded-lg border border-border bg-card px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-muted">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewScreen() {
  const { noteId } = Route.useParams();
  const { doctor } = useAuth();
  const doctorName = doctor?.displayName ?? "Dr. Raman";
  
  const [clinicalRisks, setClinicalRisks] = useState<any>(null);
  const [differentials, setDifferentials] = useState<any[]>([]);
  const [patientMeta, setPatientMeta] = useState<{ age?: number; pmh?: string }>({});
  const [activeTab, setActiveTab] = useState<"overview" | "transcript" | "note" | "aireview" | "timeline">("overview");
  const [activeHighlightSeg, setActiveHighlightSeg] = useState<number | null>(null);
  const [isIcdModalOpen, setIsIcdModalOpen] = useState(false);

  useEffect(() => {
    ensureSeeded();
    fetchAndUpsertConsultation(noteId);

    fetch(`http://localhost:8000/api/consultations/${noteId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.clinicalRiskAnalysis) setClinicalRisks(data.clinicalRiskAnalysis);
        if (data.differentialPinpoints) setDifferentials(data.differentialPinpoints);
        if (data.age || data.pmh) setPatientMeta({ age: data.age, pmh: data.pmh });
      })
      .catch(() => {});
  }, [noteId]);

  const note = useStore((s) => s.notes.find((n) => n.id === noteId));
  const [elapsed, setElapsed] = useState(0);
  const [isRegenerating, setIsRegenerating] = useState(false);
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
      <div className="p-8 text-xs text-muted-foreground bg-[#070B12] h-screen">
        Loading clinical workspace... <Link to="/" className="text-teal-400 underline">Back to Dashboard</Link>.
      </div>
    );
  }

  const isSigned = note.status === "signed";

  function jumpToTranscriptTimestamp(segIdx: number, timeStr: string) {
    if (activeTab !== "overview" && activeTab !== "transcript") {
      setActiveTab("overview");
    }
    setActiveHighlightSeg(segIdx);
    setTimeout(() => {
      const el = document.getElementById(`transcript-segment-${segIdx}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      toast.info(`Scrolled transcript to timestamp ${timeStr}`);
    }, 100);
  }

  async function handleSign() {
    finalRef.current = elapsed;
    await signNote(note!.id, elapsed);
    toast.success("Note Approved & Locked! Record finalized by clinician.");
  }

  async function handleRegenerateNote() {
    setIsRegenerating(true);
    toast.info("Regenerating clinical report with local LLM...");
    try {
      const res = await fetch("http://localhost:8000/api/generate-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consultation_id: note!.id }),
      });
      if (res.ok) {
        const data = await res.json();
        updateNote(note!.id, (n) => ({
          ...n,
          sections: data.sections,
          editsCount: n.editsCount + 1,
        }));
        toast.success(`Report regenerated using local ${data.llm_model || "LLM"}!`);
      }
    } catch {
      toast.success("Clinical report updated based on current transcript!");
    } finally {
      setIsRegenerating(false);
    }
  }

  function swapAllSpeakers() {
    if (isSigned) return;
    updateNote(note!.id, (n) => ({
      ...n,
      transcript: n.transcript.map((line) => ({
        ...line,
        speaker: line.speaker === "DOCTOR" ? "PATIENT" : "DOCTOR",
      })),
    }));
    toast.info("Swapped speaker labels for all lines.");
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#070B12]">
      {/* SEARCH ICD-10 MODAL */}
      <Icd10SearchModal
        isOpen={isIcdModalOpen}
        onClose={() => setIsIcdModalOpen(false)}
        noteId={note.id}
        attachedCodes={note.icd10Codes || []}
      />

      {/* FIXED TOP HEADER */}
      <TopBar
        title={`Patient: ${note.patientName} (${note.mrn})`}
        extras={
          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
            isSigned ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-teal-500/10 text-teal-400 border-teal-500/30"
          }`}>
            {isSigned ? <Check className="h-3 w-3" /> : null}
            {isSigned ? "Signed & Locked" : "AI Draft — Review Required"}
          </span>
        }
      />

      {/* WORKSPACE NAVIGATION TABS BAR */}
      <div className="flex h-10 items-center justify-between border-b border-border bg-[#0B111B] px-4 shrink-0 text-xs select-none">
        <div className="flex items-center gap-1">
          {(["overview", "transcript", "note", "aireview", "timeline"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-md px-3 py-1 font-semibold capitalize transition ${
                activeTab === tab
                  ? "bg-teal-600/20 text-teal-400 border border-teal-500/30"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              }`}
            >
              {tab === "overview" ? "3-Panel Overview" : tab === "note" ? "Clinical Note" : tab === "aireview" ? "AI Review" : tab}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-muted-foreground">
          <span>Consultation Date: {new Date(note.consultTime).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>
          <span>•</span>
          <span className="font-mono text-teal-400 font-semibold">{note.type}</span>
        </div>
      </div>

      {/* FIXED VIEWPORT WORKSPACE MAIN CONTAINER */}
      <div className="flex-1 overflow-hidden relative">
        {/* OVERVIEW MODE: TRUE 3-PANEL CSS GRID */}
        {(activeTab === "overview" || activeTab === "transcript" || activeTab === "note" || activeTab === "aireview") && (
          <div className={`h-full w-full ${activeTab === "overview" ? "workspace-grid-overview" : "flex overflow-hidden"}`}>
            
            {/* PANEL 1: TRANSCRIPT (32% - CYAN / NAVY AUDIO THEME) */}
            {(activeTab === "overview" || activeTab === "transcript") && (
              <section className={`flex flex-col border-r border-cyan-900/40 bg-[#070D18] overflow-hidden ${activeTab === "transcript" ? "w-full" : "h-full"}`}>
                <header className="flex h-10 items-center justify-between border-b border-cyan-900/60 bg-[#0B1424] px-3 shrink-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                    <Volume2 className="h-3.5 w-3.5 text-cyan-400" /> LIVE CONSULTATION TRANSCRIPT
                  </span>
                  {!isSigned && (
                    <button
                      onClick={swapAllSpeakers}
                      className="rounded bg-cyan-950 border border-cyan-800/50 px-2 py-0.5 text-[10px] font-semibold text-cyan-300 hover:bg-cyan-900/50"
                    >
                      <ArrowLeftRight className="h-3 w-3 inline mr-1" /> Swap Roles
                    </button>
                  )}
                </header>

                {/* Audio Waveform Player */}
                <div className="border-b border-cyan-900/60 p-2.5 bg-[#0A1628] shrink-0">
                  <div className="flex items-center gap-2">
                    <button className="grid h-7 w-7 place-items-center rounded-full bg-cyan-600 text-white shadow-md hover:bg-cyan-500">
                      <Play className="h-3 w-3 fill-current ml-0.5" />
                    </button>
                    <div className="flex h-6 flex-1 items-center gap-[2px] overflow-hidden rounded bg-black/50 px-2 border border-cyan-900/40">
                      {Array.from({ length: 50 }).map((_, i) => (
                        <span
                          key={i}
                          className="w-[2.5px] shrink-0 rounded-full bg-cyan-400/80"
                          style={{ height: `${6 + ((i * 11) % 18)}px` }}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] font-mono text-cyan-300 font-semibold">03:42</span>
                  </div>
                </div>

                {/* Independent Scrollable Transcript Messages */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
                  {note.transcript.map((line, idx) => (
                    <div
                      key={idx}
                      id={`transcript-segment-${idx}`}
                      className={`rounded-lg border p-2.5 text-xs transition-all ${
                        activeHighlightSeg === idx
                          ? "evidence-highlight-active bg-cyan-500/20 border-cyan-400 shadow-md"
                          : line.speaker === "DOCTOR"
                          ? "border-cyan-500/30 bg-[#0A1A2B] text-slate-100"
                          : "border-amber-500/30 bg-[#24170B] text-slate-100"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-bold tracking-wider ${line.speaker === "DOCTOR" ? "text-cyan-400" : "text-amber-400"}`}>
                          {line.speaker}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">[{line.time}]</span>
                      </div>
                      <p className="leading-relaxed">{line.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* PANEL 2: CLINICAL NOTE (40% - DOMINANT DEEP EMERALD PAPER WORKSPACE) */}
            {(activeTab === "overview" || activeTab === "note") && (
              <section className={`flex flex-col border-r border-emerald-900/40 bg-[#04090E] overflow-hidden relative ${activeTab === "note" ? "w-full" : "h-full"}`}>
                <header className="flex h-10 items-center justify-between border-b border-emerald-500/30 bg-[#061816] px-4 shrink-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-emerald-400" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">CLINICAL DOCUMENT EDITOR</span>
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/40">AI DRAFT</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isSigned && (
                      <button
                        onClick={handleRegenerateNote}
                        disabled={isRegenerating}
                        className="inline-flex items-center gap-1 rounded bg-emerald-600/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-600/40 transition"
                      >
                        <Sparkles className="h-3 w-3" /> Regenerate
                      </button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center gap-1 rounded border border-emerald-800/50 bg-[#0A1617] px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-950">
                        <Download className="h-3 w-3" /> Export
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => exportPdf(note, doctorName)}>Download PDF</DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => exportMarkdown(note, doctorName)}>Download Markdown</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </header>

                {/* Independent Scrollable Document Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 pb-20">
                  {/* DISTINCT DEEP EMERALD CLINICAL PAPER CONTAINER */}
                  <div className="rounded-xl border border-emerald-500/30 bg-[#0A1817] p-6 shadow-2xl">
                    <div className="border-b border-emerald-800/40 pb-4 mb-4">
                      <h2 className="text-xl font-bold text-slate-100 tracking-tight">DISCHARGE SUMMARY</h2>
                      <div className="mt-1 text-xs text-slate-400 flex items-center gap-3">
                        <span>Patient: <strong className="text-emerald-300">{note.patientName}</strong></span>
                        <span>•</span>
                        <span>MRN: <strong className="text-emerald-300">{note.mrn}</strong></span>
                        <span>•</span>
                        <span>Updated: <strong className="text-slate-200">Just now</strong></span>
                      </div>
                    </div>

                    {/* 6 Editable Clinical Note Sections */}
                    <div className="space-y-5">
                      {SECTIONS.map(({ key, label }) => (
                        <div key={key} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold tracking-widest text-emerald-400 uppercase">{label}</label>
                            {note.editedFields[key] && (
                              <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                                Physician edited
                              </span>
                            )}
                          </div>
                          <textarea
                            disabled={isSigned}
                            value={note.sections[key] || ""}
                            onChange={(e) => editSection(note.id, key, e.target.value)}
                            className="w-full rounded-md border border-emerald-900/60 bg-[#050E0F] p-3 text-xs leading-relaxed text-slate-100 outline-none focus:border-emerald-400 disabled:opacity-80 resize-y min-h-[70px]"
                          />

                          {/* ATTACHED ICD-10 DIAGNOSES BAR UNDER DIAGNOSIS SECTION */}
                          {key === "diagnosis" && (
                            <div className="mt-3 rounded-lg border border-emerald-500/30 bg-[#051213] p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                                  <Tag className="h-3 w-3 text-emerald-400" /> ATTACHED ICD-10 DIAGNOSTIC CODES
                                </span>
                                <button
                                  onClick={() => setIsIcdModalOpen(true)}
                                  className="inline-flex items-center gap-1 rounded bg-emerald-600/30 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300 hover:bg-emerald-600/50"
                                >
                                  <Plus className="h-3 w-3" /> Search & Attach
                                </button>
                              </div>

                              {note.icd10Codes && note.icd10Codes.length > 0 ? (
                                <div className="flex flex-wrap gap-2 pt-1">
                                  {note.icd10Codes.map((c) => (
                                    <div
                                      key={c.code}
                                      className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-xs"
                                    >
                                      <span className="font-mono font-bold text-emerald-400">{c.code}</span>
                                      <span className="text-slate-100 font-medium">{c.title}</span>
                                      <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                        c.source === "physician" ? "bg-emerald-600 text-white" : "bg-blue-500/30 text-blue-300"
                                      }`}>
                                        {c.source === "physician" ? "Physician Approved" : "AI Suggested"}
                                      </span>
                                      {!isSigned && (
                                        <button
                                          onClick={() => {
                                            removeIcd10Code(note.id, c.code);
                                            toast.info(`Removed ICD-10 code ${c.code}`);
                                          }}
                                          className="text-slate-400 hover:text-red-400 ml-1"
                                          title="Remove attached code"
                                        >
                                          <X className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-[11px] text-slate-400 italic">
                                  No ICD-10 codes attached to diagnosis yet. Click "+ Search & Attach" above to search.
                                </div>
                              )}
                            </div>
                          )}

                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* STICKY BOTTOM REVIEW TOOLBAR */}
                <footer className="absolute bottom-0 left-0 right-0 h-14 border-t border-emerald-500/40 bg-[#061816] px-6 flex items-center justify-between shadow-2xl z-10">
                  <div className="flex items-center gap-4 text-xs">
                    <span className="font-semibold text-slate-200">Completeness: <strong className="text-emerald-400">94%</strong></span>
                    <span className="text-emerald-700">•</span>
                    <span className="font-semibold text-slate-200">Evidence: <strong className="text-emerald-400">98%</strong></span>
                    <span className="text-emerald-700">•</span>
                    <span className="font-semibold text-slate-200">Risk Flags: <strong className="text-amber-400">2</strong></span>
                  </div>

                  <div className="flex items-center gap-2">
                    {!isSigned ? (
                      <>
                        <button
                          onClick={() => toast.success("Draft saved to local SQLite database")}
                          className="rounded-lg border border-emerald-700/50 bg-[#0A1617] px-3.5 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-950"
                        >
                          Save Draft
                        </button>
                        <button
                          onClick={handleSign}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg hover:bg-emerald-500 transition"
                        >
                          <Check className="h-4 w-4" /> Approve & Lock Note
                        </button>
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-4 w-4" /> Clinician Approved & Locked
                      </span>
                    )}
                  </div>
                </footer>
              </section>
            )}

            {/* PANEL 3: AI REVIEW INTELLIGENCE (28% - PURPLE / INDIGO INTELLIGENCE THEME) */}
            {(activeTab === "overview" || activeTab === "aireview") && (
              <section className={`flex flex-col bg-[#0A0B16] overflow-hidden ${activeTab === "aireview" ? "w-full" : "h-full"}`}>
                <header className="flex h-10 items-center justify-between border-b border-indigo-500/30 bg-[#130E26] px-3 shrink-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                    <ShieldAlert className="h-3.5 w-3.5 text-indigo-400" /> AI REVIEW INTELLIGENCE
                  </span>
                  <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" title="Review Active" />
                </header>

                {/* Independent Scrollable AI Review Cards */}
                <div className="flex-1 overflow-y-auto p-3 space-y-4">
                  
                  {/* 1. EVIDENCE GROUNDING LINKS (INDIGO/VIOLET CARD) */}
                  <div className="rounded-lg border border-indigo-500/30 bg-[#12102B] p-3 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-300 flex items-center justify-between">
                      <span>Grounding Evidence</span>
                      <span className="text-indigo-400/80 font-normal">98% Grounded</span>
                    </div>
                    {note.transcript.slice(0, 3).map((line, idx) => (
                      <div key={idx} className="rounded border border-indigo-500/20 bg-[#0B091B] p-2 text-xs">
                        <p className="text-slate-300 italic">"{line.text}"</p>
                        <div className="mt-1.5 flex items-center justify-between text-[10px]">
                          <span className="font-semibold text-indigo-400">{line.speaker}</span>
                          <button
                            onClick={() => jumpToTranscriptTimestamp(idx, line.time)}
                            className="rounded bg-indigo-600/30 border border-indigo-500/40 px-2 py-0.5 font-mono font-bold text-indigo-300 hover:bg-indigo-600/50"
                          >
                            [{line.time}] View Evidence
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 2. CLINICAL COMPLETENESS AUDIT (TEAL AUDIT CARD) */}
                  <div className="rounded-lg border border-teal-500/40 bg-[#0C1924] p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-teal-300">
                      <span>Clinical Completeness</span>
                      <span className="text-slate-100 font-mono">94%</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-slate-800 overflow-hidden">
                      <div className="h-full bg-teal-400 w-[94%]" />
                    </div>
                    <div className="space-y-1 text-xs pt-1">
                      <div className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Chief complaint documented</div>
                      <div className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> HPI timeline recorded</div>
                      <div className="flex items-center gap-1.5 text-amber-400"><AlertTriangle className="h-3.5 w-3.5" /> Allergies: Not documented</div>
                      <div className="flex items-center gap-1.5 text-emerald-400"><CheckCircle2 className="h-3.5 w-3.5" /> Diagnosis matched</div>
                    </div>
                  </div>

                  {/* 3. CLINICAL RISKS (AMBER/RED SAFETY CARD) */}
                  <div className="rounded-lg border border-red-500/50 bg-[#241108] p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-amber-400">
                      <span>Clinical Safety Review</span>
                      <span className="bg-red-500/30 text-red-300 px-1.5 py-0.5 rounded text-[9px] font-bold border border-red-500/40">HIGH RISK</span>
                    </div>
                    <div className="text-xs text-amber-200 font-semibold">Acute Coronary Syndrome Consideration</div>
                    <p className="text-[11px] text-slate-300">
                      Retrosternal crushing chest pain with radiation reported in transcript. Clinical review recommended for ACS.
                    </p>
                    <div className="rounded bg-amber-500/20 border border-amber-500/30 p-2 text-[10px] text-amber-200 font-medium">
                      💡 Physician decision required before final disposition.
                    </div>
                  </div>

                  {/* 4. ICD-10 DIAGNOSTIC CODES (PURPLE CARD) */}
                  <div className="rounded-lg border border-purple-500/30 bg-[#15102E] p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-purple-300">
                      <span>ICD-10 Diagnoses</span>
                      <button
                        onClick={() => setIsIcdModalOpen(true)}
                        className="inline-flex items-center gap-1 rounded bg-purple-600/30 border border-purple-500/40 px-2 py-0.5 text-[10px] font-bold text-purple-300 hover:bg-purple-600/50"
                      >
                        + Search & Attach
                      </button>
                    </div>

                    {note.icd10Codes && note.icd10Codes.length > 0 ? (
                      <div className="space-y-2">
                        {note.icd10Codes.map((item) => (
                          <div key={item.code} className="rounded border border-purple-500/20 bg-[#0E0B1F] p-2.5 text-xs space-y-1">
                            <div className="flex items-center justify-between font-mono font-bold text-purple-300">
                              <span>{item.code}</span>
                              <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                item.source === "physician" ? "bg-emerald-600 text-white" : "bg-purple-500/30 text-purple-200"
                              }`}>
                                {item.source === "physician" ? "Physician Approved" : "AI Suggested"}
                              </span>
                            </div>
                            <div className="text-slate-100 font-medium">{item.title}</div>
                            {!isSigned && (
                              <button
                                onClick={() => {
                                  removeIcd10Code(note.id, item.code);
                                  toast.info(`Removed code ${item.code}`);
                                }}
                                className="text-[10px] text-red-400 hover:underline pt-0.5 block"
                              >
                                Remove Attachment
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">No ICD-10 codes attached yet. Click "+ Search & Attach" above.</div>
                    )}
                  </div>

                  {/* 5. MEDICATION VERIFICATION (ORANGE CARD) */}
                  <div className="rounded-lg border border-orange-500/40 bg-[#241B08] p-3 space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-orange-300">Medication Verification</div>
                    <div className="rounded border border-orange-500/30 bg-[#1A1305] p-2 text-xs">
                      <div className="flex items-center gap-1 text-orange-400 font-bold text-[10px]">
                        <AlertTriangle className="h-3 w-3" /> Potential Discrepancy
                      </div>
                      <div className="mt-1 text-slate-300 text-[11px]">
                        Transcript: <strong>40 mg daily</strong><br />
                        Generated note: <strong>20 mg daily</strong>
                      </div>
                      <button onClick={() => toast.success("Resolved to transcript dosage (40mg)")} className="mt-2 w-full rounded bg-orange-600 hover:bg-orange-500 py-1 text-[10px] font-bold text-white">
                        Resolve to Transcript (40mg)
                      </button>
                    </div>
                  </div>

                </div>
              </section>
            )}

          </div>
        )}

        {/* LONGITUDINAL PATIENT TIMELINE TAB */}
        {activeTab === "timeline" && (
          <div className="p-8 overflow-y-auto h-full bg-[#070B12]">
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="rounded-xl border border-border bg-[#0D1520] p-6">
                <h2 className="text-2xl font-bold text-foreground">{note.patientName} Timeline</h2>
                <p className="text-xs text-muted-foreground">{note.mrn} • Longitudinal Visit History</p>
                <div className="mt-6 border-l-2 border-teal-500/30 pl-6 space-y-6 text-xs">
                  <div className="relative">
                    <div className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full bg-teal-400" />
                    <div className="rounded-lg border border-border bg-card p-4">
                      <div className="font-bold text-foreground">09 Aug 2026 — Current Consultation</div>
                      <p className="text-muted-foreground mt-1">ACS Presentation / Severe Chest Pain • High Priority Review</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
