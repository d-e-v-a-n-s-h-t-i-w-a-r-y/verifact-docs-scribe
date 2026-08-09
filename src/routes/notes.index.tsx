import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TopBar } from "@/components/app-shell";
import { ensureSeeded } from "@/lib/mock-data";
import { useStore, type Note } from "@/lib/store";
import { exportMarkdown, exportPdf } from "@/lib/export";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, FileType, FileText, MoreHorizontal } from "lucide-react";

export const Route = createFileRoute("/notes/")({
  head: () => ({
    meta: [
      { title: "Note History — Verifact" },
      { name: "description", content: "Search and reopen every consultation note — drafts and signed sign-offs." },
      { property: "og:title", content: "Note History — Verifact" },
      { property: "og:description", content: "Every consultation note, searchable by patient, MRN or type." },
    ],
  }),
  component: NoteHistory,
});

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}
function fmtReview(s?: number) {
  if (!s) return "—";
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function StatusPill({ status }: { status: Note["status"] }) {
  const map = {
    draft: "bg-slate-800 text-slate-300 border-slate-700",
    pending: "bg-teal-500/10 text-teal-400 border-teal-500/30",
    signed: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
  } as const;
  const label = { draft: "Draft", pending: "Needs Review", signed: "Finalized & Locked" }[status];
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${map[status]}`}>
      {label}
    </span>
  );
}

function NoteHistory() {
  useEffect(() => { ensureSeeded(); }, []);
  const notes = useStore((s) => s.notes);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "draft" | "signed">("all");

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return notes.filter((n) => {
      if (filter === "draft" && n.status === "signed") return false;
      if (filter === "signed" && n.status !== "signed") return false;
      if (!ql) return true;
      return (
        n.patientName.toLowerCase().includes(ql) ||
        n.mrn.toLowerCase().includes(ql) ||
        n.type.toLowerCase().includes(ql)
      );
    });
  }, [notes, q, filter]);

  return (
    <>
      <TopBar title="Consultation Note History" />
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="relative flex-1 min-w-64 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by patient name, MRN, or clinical note type..."
              className="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-xs outline-none focus:border-teal-500"
            />
          </div>
          <div className="flex gap-1 rounded-lg border border-border bg-card p-1 text-xs">
            {(["all", "draft", "signed"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-md px-3.5 py-1.5 font-semibold capitalize transition ${
                  filter === k ? "bg-teal-600 text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {k === "all" ? "All Notes" : k === "draft" ? "Drafts / Pending" : "Finalized Records"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-semibold">Patient Name</th>
                <th className="px-4 py-3 font-semibold">MRN</th>
                <th className="px-4 py-3 font-semibold">Date</th>
                <th className="px-4 py-3 font-semibold">Note Type</th>
                <th className="px-4 py-3 font-semibold">Review Duration</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No consultation notes found matching search query.
                  </td>
                </tr>
              )}
              {rows.map((n) => (
                <tr key={n.id} className="border-b border-border/60 last:border-0 hover:bg-muted/40 transition">
                  <td className="px-4 py-3.5 font-semibold text-foreground">
                    <Link to="/notes/$noteId" params={{ noteId: n.id }} className="hover:underline">
                      {n.patientName}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground font-mono text-xs">{n.mrn}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{fmtDate(n.signedAt ?? n.consultTime)}</td>
                  <td className="px-4 py-3.5 text-muted-foreground">{n.type}</td>
                  <td className="px-4 py-3.5 text-muted-foreground tabular-nums">{fmtReview(n.reviewSeconds)}</td>
                  <td className="px-4 py-3.5"><StatusPill status={n.status} /></td>
                  <td className="px-4 py-3.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Export ${n.patientName}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onSelect={() => { exportPdf(n); toast.success("Clinical PDF downloaded"); }}>
                          <FileType className="mr-2 h-4 w-4" /> Export Clinical PDF
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => { exportMarkdown(n); toast.success("Markdown downloaded"); }}>
                          <FileText className="mr-2 h-4 w-4" /> Export Markdown
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

