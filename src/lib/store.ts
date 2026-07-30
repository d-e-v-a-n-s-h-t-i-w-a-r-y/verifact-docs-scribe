import { useSyncExternalStore } from "react";

export type NoteStatus = "draft" | "pending" | "signed";
export type NoteType = "Discharge Summary" | "OPD Note";

export interface TranscriptLine {
  speaker: "DOCTOR" | "PATIENT";
  time: string; // mm:ss
  text: string;
}

export interface NoteSections {
  chiefComplaint: string;
  hpi: string;
  examination: string;
  diagnosis: string;
  treatment: string;
  followUp: string;
}

export interface Note {
  id: string;
  patientName: string;
  mrn: string;
  consultTime: string; // ISO
  type: NoteType;
  status: NoteStatus;
  sections: NoteSections;
  editedFields: Partial<Record<keyof NoteSections, boolean>>;
  editsCount: number;
  transcript: TranscriptLine[];
  reviewSeconds?: number;
  signedAt?: string;
}

type State = { notes: Note[] };

const listeners = new Set<() => void>();
let state: State = { notes: [] };

function emit() {
  listeners.forEach((l) => l());
}

export function setState(fn: (s: State) => State) {
  state = fn(state);
  emit();
}

export function getState() {
  return state;
}

export function useStore<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => selector(state),
    () => selector(state),
  );
}

export function upsertNote(note: Note) {
  setState((s) => {
    const idx = s.notes.findIndex((n) => n.id === note.id);
    const next = [...s.notes];
    if (idx >= 0) next[idx] = note;
    else next.unshift(note);
    return { notes: next };
  });
}

export function updateNote(id: string, patch: (n: Note) => Note) {
  setState((s) => ({
    notes: s.notes.map((n) => (n.id === id ? patch(n) : n)),
  }));
}

export function editSection(id: string, key: keyof NoteSections, value: string) {
  updateNote(id, (n) => {
    if (n.sections[key] === value) return n;
    const wasEdited = n.editedFields[key];
    return {
      ...n,
      sections: { ...n.sections, [key]: value },
      editedFields: { ...n.editedFields, [key]: true },
      editsCount: wasEdited ? n.editsCount : n.editsCount + 1,
    };
  });
}

export function signNote(id: string, reviewSeconds: number) {
  updateNote(id, (n) => ({
    ...n,
    status: "signed",
    reviewSeconds,
    signedAt: new Date().toISOString(),
  }));
}

// ─── Sync with Supabase ──────────────────────────────────────────────────────

import { supabase } from "./supabase";

export async function fetchAndUpsertConsultation(consultationId: string) {
  const { data, error } = await supabase
    .from("consultations")
    .select(`
      id,
      consult_type,
      status,
      created_at,
      transcript_json,
      patients (name, mrn),
      notes (sections_json, edit_count, review_seconds, signed_at)
    `)
    .eq("id", consultationId)
    .single();

  if (error || !data) {
    console.error("Failed to fetch consultation from Supabase:", error);
    return;
  }

  // Handle case where notes array might be returned (one-to-many relationship in Supabase)
  const noteRow = Array.isArray(data.notes) ? data.notes[0] : data.notes;
  const patientRow = Array.isArray(data.patients) ? data.patients[0] : data.patients;

  const noteData: Note = {
    id: data.id,
    patientName: patientRow?.name ?? "Unknown Patient",
    mrn: patientRow?.mrn ?? "UNKNOWN",
    consultTime: data.created_at,
    type: (data.consult_type as NoteType) ?? "OPD Note",
    status: (data.status as NoteStatus) ?? "pending",
    sections: noteRow?.sections_json ?? {
      chiefComplaint: "", hpi: "", examination: "", diagnosis: "", treatment: "", followUp: ""
    },
    editedFields: {},
    editsCount: noteRow?.edit_count ?? 0,
    transcript: data.transcript_json ?? [],
    reviewSeconds: noteRow?.review_seconds,
    signedAt: noteRow?.signed_at,
  };

  upsertNote(noteData);
}
