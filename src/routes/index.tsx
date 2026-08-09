import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopBar } from "@/components/app-shell";
import { ensureSeeded } from "@/lib/mock-data";
import { useStore, fetchLocalConsultations, type Note } from "@/lib/store";
import { Plus, ChevronRight, Lock, Clock, FileText, CheckCircle2, AlertTriangle, Search, ShieldAlert, Award } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Today's Clinical Review — Verifact" },
      { name: "description", content: "Physician clinical command center and priority consultation review queue." },
    ],
  }),
  component: Dashboard,
});

function fmtTime(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function StatCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub?: string; icon: any }) {
  return (
    <div className="rounded-xl border border-border bg-[#0D1520] p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
        <Icon className="h-4 w-4 text-teal-400" />
      </div>
      <div className="mt-2 font-sans text-2xl font-bold text-foreground">{value}</div>
      {sub && <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function RiskBadge({ level }: { level?: string }) {
  const map: Record<string, string> = {
    CRITICAL: "bg-red-500/10 text-red-400 border-red-500/30",
    HIGH: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    MEDIUM: "bg-blue-500/10 text-blue-400 border-blue-500/30",
    LOW: "bg-teal-500/10 text-teal-400 border-teal-500/30"
  };
  const val = level || "LOW";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${map[val] || map["LOW"]}`}>
      {val} RISK
    </span>
  );
}

function Dashboard() {
  const [q, setQ] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "high" | "needs" | "ready" | "finalized">("all");

  useEffect(() => {
    ensureSeeded();
    fetchLocalConsultations();
  }, []);

  const notes = useStore((s) => s.notes);
  const pending = notes.filter((n) => n.status === "pending" || n.status === "draft");
  const signed = notes.filter((n) => n.status === "signed");
  const highPriority = pending.filter((n) => n.patientName.includes("Coronary") || n.patientName.includes("Appendicitis") || n.type.includes("Emergency"));
  const needsReview = pending.filter((n) => !highPriority.includes(n));
  const avgTime = signed.length
    ? Math.round(signed.reduce((a, n) => a + (n.reviewSeconds ?? 0), 0) / signed.length)
    : 0;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#070B12]">
      <TopBar title="Today's Clinical Review" />

      {/* INDEPENDENT SCROLLABLE DASHBOARD WORKSPACE */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          
          {/* HEADER & WELCOME */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400">PHYSICIAN COMMAND CENTER</span>
              <h2 className="text-2xl font-bold text-foreground">Good morning, Dr. Raman</h2>
              <p className="text-xs text-muted-foreground mt-0.5">You have {pending.length} consultations awaiting clinical review.</p>
            </div>
            <Link
              to="/consultations/new"
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-xs font-bold text-white shadow hover:bg-teal-500 transition"
            >
              <Plus className="h-4 w-4" /> New Consultation
            </Link>
          </div>

          {/* TOP KPI ROW */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
            <StatCard label="Total Consultations" value={String(notes.length)} sub="Active & Completed" icon={FileText} />
            <StatCard label="Needs Review" value={String(pending.length)} sub="Awaiting Sign-off" icon={Clock} />
            <StatCard label="High Priority" value={String(highPriority.length)} sub="Requires Urgent Review" icon={ShieldAlert} />
            <StatCard label="Ready to Approve" value={String(needsReview.length)} sub="AI Draft Complete" icon={CheckCircle2} />
            <StatCard label="Avg Review Time" value={avgTime ? `${Math.floor(avgTime / 60)}m ${avgTime % 60}s` : "1m 42s"} sub="Invisible Tracker" icon={Award} />
          </div>

          {/* SEARCH & FILTER BAR */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
            <div className="relative flex-1 min-w-64 max-w-md">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search patient, MRN, or diagnosis..."
                className="w-full rounded-lg border border-border bg-[#0D1520] py-2 pl-9 pr-3 text-xs text-foreground outline-none focus:border-teal-500"
              />
            </div>
            <div className="flex gap-1 rounded-lg border border-border bg-[#0D1520] p-1 text-xs">
              {(["all", "high", "needs", "ready", "finalized"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setActiveFilter(k)}
                  className={`rounded-md px-3 py-1 font-semibold capitalize transition ${
                    activeFilter === k ? "bg-teal-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {k === "all" ? "All Queue" : k === "high" ? "High Priority" : k === "needs" ? "Needs Review" : k === "ready" ? "Ready" : "Finalized"}
                </button>
              ))}
            </div>
          </div>

          {/* HIGH PRIORITY QUEUE SECTION */}
          {(activeFilter === "all" || activeFilter === "high") && highPriority.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">HIGH PRIORITY SAFETY QUEUE</h3>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {highPriority.map((n) => (
                  <Link
                    key={n.id}
                    to="/notes/$noteId"
                    params={{ noteId: n.id }}
                    className="flex flex-col justify-between rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 transition hover:border-amber-500/60"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-foreground text-sm">{n.patientName}</h4>
                        <p className="text-xs text-muted-foreground">{n.mrn} • {n.type}</p>
                      </div>
                      <RiskBadge level="HIGH" />
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-amber-500/20 pt-2.5 text-xs">
                      <span className="text-muted-foreground">Consulted: {fmtTime(n.consultTime)}</span>
                      <span className="font-bold text-teal-400 flex items-center gap-1">Review Workspace <ChevronRight className="h-3.5 w-3.5" /></span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* PENDING QUEUE TABLE */}
          {(activeFilter === "all" || activeFilter === "needs" || activeFilter === "ready") && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Ready for Physician Review</h3>
                <span className="text-[11px] text-muted-foreground">Click any record to inspect evidence and sign</span>
              </div>
              <div className="overflow-hidden rounded-xl border border-border bg-[#0D1520] shadow-sm">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-[#0B111B] text-left uppercase tracking-wider text-muted-foreground text-[10px]">
                      <th className="px-4 py-3 font-semibold">Patient Name</th>
                      <th className="px-4 py-3 font-semibold">MRN</th>
                      <th className="px-4 py-3 font-semibold">Time</th>
                      <th className="px-4 py-3 font-semibold">Type</th>
                      <th className="px-4 py-3 font-semibold">Risk Level</th>
                      <th className="px-4 py-3 font-semibold">Completeness</th>
                      <th className="px-4 py-3 font-semibold text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pending.map((n) => (
                      <tr key={n.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40 transition">
                        <td className="px-4 py-3 font-bold text-foreground">
                          <Link to="/notes/$noteId" params={{ noteId: n.id }} className="hover:underline">
                            {n.patientName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground font-mono">{n.mrn}</td>
                        <td className="px-4 py-3 text-muted-foreground">{fmtTime(n.consultTime)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{n.type}</td>
                        <td className="px-4 py-3"><RiskBadge level={n.patientName.includes("Coronary") ? "HIGH" : "LOW"} /></td>
                        <td className="px-4 py-3"><span className="rounded bg-teal-500/10 px-2 py-0.5 font-bold text-teal-400">94%</span></td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to="/notes/$noteId"
                            params={{ noteId: n.id }}
                            className="inline-flex items-center gap-1 font-bold text-teal-400 hover:underline"
                          >
                            Review <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
