import { jsPDF } from "jspdf";
import type { Note, NoteSections } from "./store";

const SECTION_ORDER: { key: keyof NoteSections; label: string }[] = [
  { key: "chiefComplaint", label: "Chief Complaint" },
  { key: "hpi", label: "History of Present Illness" },
  { key: "examination", label: "Examination Findings" },
  { key: "diagnosis", label: "Diagnosis" },
  { key: "treatment", label: "Treatment / Plan" },
  { key: "followUp", label: "Follow-up" },
];

function safeFile(name: string) {
  return name.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "");
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export function exportMarkdown(note: Note, signedByName?: string) {
  const date = new Date(note.signedAt ?? note.consultTime).toLocaleString();
  const signerLabel = signedByName ?? "Unknown";
  const lines: string[] = [];
  lines.push(`# ${note.type} — ${note.patientName}`);
  lines.push("");
  lines.push(`**MRN:** ${note.mrn}  `);
  lines.push(`**Consultation:** ${date}  `);
  lines.push(`**Status:** ${note.status}${note.status === "signed" ? ` (signed by ${signerLabel})` : ""}`);
  lines.push("");
  lines.push("---");
  lines.push("");
  for (const { key, label } of SECTION_ORDER) {
    lines.push(`## ${label}`);
    lines.push("");
    lines.push(note.sections[key]);
    lines.push("");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
  triggerDownload(blob, `${safeFile(note.patientName)}_${safeFile(note.type)}.md`);
}

export function exportPdf(note: Note, signedByName?: string) {
  const signerLabel = signedByName ?? "Unknown";
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 56;
  const contentW = pageW - margin * 2;
  let y = margin;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Header block
  doc.setFont("times", "bold");
  doc.setFontSize(20);
  doc.text(note.patientName, margin, y);
  y += 24;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  const date = new Date(note.signedAt ?? note.consultTime).toLocaleString();
  doc.text(`MRN ${note.mrn}    ·    ${note.type}    ·    ${date}`, margin, y);
  y += 14;
  if (note.status === "signed") {
    doc.text(`Signed by ${signerLabel}`, margin, y);
    y += 14;
  }

  y += 6;
  doc.setDrawColor(210);
  doc.line(margin, y, pageW - margin, y);
  y += 20;

  doc.setTextColor(20);

  for (const { key, label } of SECTION_ORDER) {
    ensureSpace(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(label.toUpperCase(), margin, y);
    y += 14;

    doc.setFont("times", "normal");
    doc.setFontSize(12);
    doc.setTextColor(20);
    const paragraphs = note.sections[key].split("\n");
    for (const para of paragraphs) {
      const wrapped = doc.splitTextToSize(para || " ", contentW);
      for (const line of wrapped) {
        ensureSpace(16);
        doc.text(line, margin, y);
        y += 16;
      }
    }
    y += 12;
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      `Verifact · Generated ${new Date().toLocaleString()} · Page ${i} of ${pageCount}`,
      margin,
      pageH - 24,
    );
  }

  doc.save(`${safeFile(note.patientName)}_${safeFile(note.type)}.pdf`);
}
