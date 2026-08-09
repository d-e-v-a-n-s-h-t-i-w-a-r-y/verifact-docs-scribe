import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { TopBar } from "@/components/app-shell";
import { Users, ArrowRight, Activity, Calendar, FileText, Heart, ShieldAlert, Pill } from "lucide-react";

export const Route = createFileRoute("/patients")({
  head: () => ({
    meta: [
      { title: "Patient Timelines — Verifact" },
      { name: "description", content: "Longitudinal clinical patient history and visit comparison." },
    ],
  }),
  component: PatientTimelinesPage,
});

const MOCK_PATIENTS = [
  {
    id: "pat-sneha",
    name: "Sneha Sharma",
    mrn: "MRN-24337-723",
    age: 34,
    gender: "Female",
    conditions: ["Acute Severe Asthma Exacerbation", "Allergic Rhinitis"],
    allergies: ["Penicillin", "Dust Mites"],
    medications: ["Prednisolone 40mg (5 days)", "Albuterol MDI 2 puffs QID"],
    visits: [
      {
        date: "09 Aug 2026",
        type: "Discharge Summary",
        diagnosis: "Acute Severe Asthma Exacerbation (J45.901)",
        treatment: "Prednisolone 40mg daily x 5 days, Nebulized Salbutamol",
        vitals: "BP 128/82, HR 98, SpO2 91% on room air",
        status: "Finalized",
        risk: "HIGH"
      },
      {
        date: "12 Jul 2026",
        type: "OPD Consultation",
        diagnosis: "Viral Upper Respiratory Infection",
        treatment: "Albuterol MDI 2 puffs QID PRN",
        vitals: "BP 124/80, HR 82, SpO2 97% on room air",
        status: "Finalized",
        risk: "MEDIUM"
      },
      {
        date: "03 Jun 2026",
        type: "Initial Visit",
        diagnosis: "Mild Intermittent Asthma",
        treatment: "Salbutamol inhaler as needed",
        vitals: "BP 120/78, HR 76, SpO2 98% on room air",
        status: "Finalized",
        risk: "LOW"
      }
    ]
  },
  {
    id: "pat-rishi",
    name: "Rishi Mohan",
    mrn: "MRN-48213-901",
    age: 48,
    gender: "Male",
    conditions: ["Acute Coronary Syndrome", "Hypertension"],
    allergies: ["No Known Drug Allergies (NKDA)"],
    medications: ["Chewable Aspirin 325mg", "Sublingual Nitroglycerin 0.4mg"],
    visits: [
      {
        date: "08 Aug 2026",
        type: "Discharge Summary",
        diagnosis: "Acute Coronary Syndrome / Suspected MI (I21.9)",
        treatment: "Chewable Aspirin 325mg + Sublingual Nitroglycerin stat",
        vitals: "BP 154/92, HR 104, SpO2 95% on room air",
        status: "Finalized",
        risk: "HIGH"
      }
    ]
  }
];

function PatientTimelinesPage() {
  const [selectedPatient, setSelectedPatient] = useState(MOCK_PATIENTS[0]);

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#070B12]">
      <TopBar title="Patient Clinical Timelines" />

      {/* INDEPENDENT SCROLLABLE CONTAINER */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        <div className="mx-auto w-full max-w-6xl space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            
            {/* DIRECTORY SIDEBAR */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4 text-teal-400" /> Patient Directory
              </h3>
              <div className="space-y-2">
                {MOCK_PATIENTS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    className={`w-full rounded-xl border p-4 text-left transition ${
                      selectedPatient.id === p.id
                        ? "border-teal-500/50 bg-teal-600/10 font-semibold"
                        : "border-border bg-[#0D1520] hover:bg-muted/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-foreground text-sm font-bold">{p.name}</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{p.mrn}</span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {p.age} yrs • {p.gender} • {p.visits.length} visit(s)
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* TIMELINE & COMPARISON VIEW */}
            <div className="space-y-6 md:col-span-2">
              <div className="rounded-xl border border-border bg-[#0D1520] p-6 shadow-sm">
                
                {/* PATIENT HEADER */}
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">{selectedPatient.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">{selectedPatient.mrn} • {selectedPatient.age} yrs • {selectedPatient.gender}</p>
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-xs font-semibold text-teal-400">
                    <Activity className="h-3.5 w-3.5" /> Longitudinal Record Active
                  </div>
                </div>

                {/* PATIENT OVERVIEW CARDS */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="rounded-lg border border-border bg-[#070B12] p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Active Conditions</span>
                    <div className="mt-1 font-semibold text-foreground">{selectedPatient.conditions.join(", ")}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-[#070B12] p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Allergies</span>
                    <div className="mt-1 font-semibold text-amber-400">{selectedPatient.allergies.join(", ")}</div>
                  </div>
                  <div className="rounded-lg border border-border bg-[#070B12] p-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">Active Medications</span>
                    <div className="mt-1 font-semibold text-foreground">{selectedPatient.medications.join(", ")}</div>
                  </div>
                </div>

                {/* WHAT'S CHANGED COMPARISON CARD */}
                {selectedPatient.visits.length > 1 && (
                  <div className="my-6 rounded-xl border border-teal-500/30 bg-teal-500/5 p-4 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
                      <ArrowRight className="h-3.5 w-3.5" /> WHAT'S CHANGED SINCE PREVIOUS VISIT? (12 JUL 2026 vs 09 AUG 2026)
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="rounded-lg border border-border bg-[#070B12] p-3">
                        <span className="text-muted-foreground text-[10px] uppercase font-bold block">Oxygen Saturation (SpO2)</span>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-muted-foreground">97% (12 Jul)</span>
                          <ArrowRight className="h-3 w-3 text-amber-400" />
                          <span className="font-bold text-amber-400">91% Room Air (09 Aug)</span>
                        </div>
                      </div>
                      <div className="rounded-lg border border-border bg-[#070B12] p-3">
                        <span className="text-muted-foreground text-[10px] uppercase font-bold block">Medication Escalation</span>
                        <div className="mt-1 flex items-center gap-2">
                          <span className="text-muted-foreground">Albuterol MDI</span>
                          <ArrowRight className="h-3 w-3 text-teal-400" />
                          <span className="font-bold text-teal-400">Added Systemic Prednisolone 40mg</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* VERTICAL CLINICAL TIMELINE */}
                <div className="mt-6 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Clinical Consultation Timeline
                  </h3>
                  <div className="relative border-l-2 border-teal-500/30 pl-6 space-y-6">
                    {selectedPatient.visits.map((visit, idx) => (
                      <div key={idx} className="relative">
                        <div className="absolute -left-[31px] top-1 h-3.5 w-3.5 rounded-full border-2 border-[#0D1520] bg-teal-400" />
                        <div className="rounded-lg border border-border bg-[#070B12] p-4 text-xs space-y-2">
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span className="font-bold text-foreground text-sm">{visit.date}</span>
                            <span className="rounded bg-teal-500/10 px-2 py-0.5 font-bold text-teal-400">{visit.type}</span>
                          </div>
                          <div className="font-semibold text-foreground text-xs">{visit.diagnosis}</div>
                          <div className="text-muted-foreground"><strong>Vitals:</strong> {visit.vitals}</div>
                          <div className="text-muted-foreground"><strong>Management:</strong> {visit.treatment}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
