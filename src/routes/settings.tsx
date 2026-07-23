import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { TopBar } from "@/components/app-shell";
import { Lock, ShieldCheck, Cpu, WifiOff, Check } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Verifact" },
      { name: "description", content: "Note templates, profile and on-device compliance information." },
      { property: "og:title", content: "Settings — Verifact" },
      { property: "og:description", content: "Templates, profile and on-device compliance information." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [template, setTemplate] = useState<"Discharge Summary" | "OPD Note">("OPD Note");
  const [name, setName] = useState("Dr. Aisha Raman");
  const [department, setDepartment] = useState("Internal Medicine");

  return (
    <>
      <TopBar title="Settings" />
      <div className="mx-auto w-full max-w-3xl px-6 py-10 space-y-10">
        <Card
          title="Note template"
          description="Default template used when starting a new consultation. This mirrors the consult-type dropdown on the recording screen."
        >
          <div className="grid grid-cols-2 gap-3">
            {(["OPD Note", "Discharge Summary"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTemplate(t)}
                className={`rounded-lg border p-4 text-left transition ${
                  template === t
                    ? "border-accent bg-accent/5"
                    : "border-border bg-card hover:border-muted-foreground/40"
                }`}
              >
                <div className="font-medium text-foreground">{t}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {t === "OPD Note"
                    ? "Focused presenting-complaint format for outpatient reviews."
                    : "Structured six-section discharge summary for inpatient episodes."}
                </div>
              </button>
            ))}
          </div>
        </Card>

        <Card
          title="Compliance"
          description="Status of on-device processing for this workstation."
        >
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-accent">
              <Lock className="h-4 w-4" /> Local processing — active
            </div>
            <p className="mt-2 text-sm text-foreground/80">
              Audio capture, transcription and note generation all run on this device. No consultation audio,
              transcript or draft note leaves your workstation.
            </p>
          </div>

          <ul className="mt-4 divide-y divide-border rounded-lg border border-border bg-card text-sm">
            <Row icon={<Cpu className="h-4 w-4 text-accent" />} label="Model runtime" value="On-device (Verifact-Local v3.2)" />
            <Row icon={<WifiOff className="h-4 w-4 text-accent" />} label="Cloud calls" value="None" />
            <Row icon={<ShieldCheck className="h-4 w-4 text-accent" />} label="Audit log" value="Stored locally, encrypted at rest" />
            <Row icon={<Lock className="h-4 w-4 text-accent" />} label="Data retention" value="Audio deleted after sign-off" />
          </ul>
        </Card>

        <Card title="Profile" description="How you appear on signed notes.">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </Field>
            <Field label="Department">
              <input
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:border-accent"
              />
            </Field>
          </div>
        </Card>
      </div>
    </>
  );
}

function Card({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-xl text-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <li className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-2.5">
        {icon}
        <span className="text-foreground">{label}</span>
      </div>
      <span className="text-muted-foreground">{value}</span>
    </li>
  );
}
