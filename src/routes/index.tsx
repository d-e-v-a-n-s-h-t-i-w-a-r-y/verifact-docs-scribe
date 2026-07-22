import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { TopBar } from "@/components/app-shell";
import { ensureSeeded } from "@/lib/mock-data";
import { useStore, type Note } from "@/lib/store";
import { Plus, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — Verifact" },
      { name: "description", content: "Your consultation queue: pending notes, review times, and recent sign-offs." },
      { property: "og:title", content: "Dashboard — Verifact" },
      { property: "og:description", content: "Pending clinical notes, review times, and recent sign-offs." },
    ],
  }),
  component: Dashboard,
});

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-2 font-serif text-3xl text-foreground">{value}</div>
      {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: Note["status"] }) {
  const map = {
    draft: "bg-muted text-muted-foreground border-border",
    pending: "bg-accent/10 text-accent border-accent/30",
    signed: "bg-primary/5 text-primary border-primary/20",
  } as const;
  const label = { draft: "Draft", pending: "Pending Review", signed: "Signed" }[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${map[status]}`}>
      {label}
    </span>
  );
}

function Dashboard() {
  useEffect(() => { ensureSeeded(); }, []);
  const notes = useStore((s) => s.notes);
  const pending = notes.filter((n) => n.status === "pending" || n.status === "draft");
  const signed = notes.filter((n) => n.status === "signed");
  const reviewedToday = signed.length;
  const avgTime = signed.length
    ? Math.round(signed.reduce((a, n) => a + (n.reviewSeconds ?? 0), 0) / signed.length)
    : 0;

  return (
    <>
      <TopBar title="Dashboard" />
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Good morning, Dr. Raman.</p>
            <p className="mt-1 font-serif text-2xl text-foreground">You have {pending.length} notes to review.</p>
          </div>
          <Link
            to="/consultations/new"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> New Consultation
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard label="Notes reviewed today" value={String(reviewedToday)} sub="Signed off" />
          <StatCard
            label="Average review time"
            value={avgTime ? `${Math.floor(avgTime / 60)}m ${avgTime % 60}s` : "—"}
            sub="Per note, this week"
          />
          <StatCard label="Notes pending review" value={String(pending.length)} sub="Drafts & pending" />
        </div>

        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-serif text-xl text-foreground">Pending Review</h2>
            <span className="text-xs text-muted-foreground">Click a row to review</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Patient</th>
                  <th className="px-4 py-3 font-medium">MRN</th>
                  <th className="px-4 py-3 font-medium">Consult</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {pending.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Nothing pending. You're clear.
                    </td>
                  </tr>
                )}
                {pending.map((n) => (
                  <tr key={n.id} className="group border-b border-border/60 last:border-0 hover:bg-muted/40">
                    <td className="px-4 py-3.5">
                      <Link to="/notes/$noteId" params={{ noteId: n.id }} className="font-medium text-foreground">
                        {n.patientName}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-muted-foreground">{n.mrn}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">{fmtTime(n.consultTime)}</td>
                    <td className="px-4 py-3.5 text-muted-foreground">{n.type}</td>
                    <td className="px-4 py-3.5"><StatusPill status={n.status} /></td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        to="/notes/$noteId"
                        params={{ noteId: n.id }}
                        className="inline-flex items-center gap-1 text-sm text-accent opacity-0 transition group-hover:opacity-100"
                      >
                        Review <ChevronRight className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Recently signed</h2>
            <Link to="/notes" className="text-xs text-muted-foreground hover:text-foreground">View all</Link>
          </div>
          <div className="divide-y divide-border rounded-xl border border-border bg-card/60">
            {signed.slice(0, 4).map((n) => (
              <Link
                key={n.id}
                to="/notes/$noteId"
                params={{ noteId: n.id }}
                className="flex items-center justify-between px-4 py-3 text-sm hover:bg-muted/40"
              >
                <div className="flex items-center gap-3">
                  <span className="text-foreground">{n.patientName}</span>
                  <span className="text-xs text-muted-foreground">{n.mrn}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span>{n.type}</span>
                  <span>{fmtDate(n.signedAt ?? n.consultTime)}</span>
                  <StatusPill status="signed" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
