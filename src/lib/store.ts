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
