import re
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

KNOWN_MEDS = [
    {"name": "Aspirin", "regex": r"\baspirin\b|\becasa\b", "default_dose": "325 mg", "default_freq": "Stat", "default_dur": "Single dose"},
    {"name": "Nitroglycerin", "regex": r"\bnitroglycerin\b|\bnitro\b", "default_dose": "0.4 mg", "default_freq": "Sublingual stat", "default_dur": "PRN pain"},
    {"name": "Salbutamol (Albuterol)", "regex": r"\bsalbutamol\b|\balbuterol\b|\binhaler\b", "default_dose": "2.5 mg", "default_freq": "Nebulized stat", "default_dur": "PRN dyspnea"},
    {"name": "Ipratropium", "regex": r"\bipratropium\b|\batrovent\b", "default_dose": "500 mcg", "default_freq": "Nebulized stat", "default_dur": "Stat"},
    {"name": "Prednisolone", "regex": r"\bprednisolone\b|\bprednisone\b", "default_dose": "40 mg", "default_freq": "Daily", "default_dur": "5 days"},
    {"name": "Ketorolac", "regex": r"\bketorolac\b|\btoradol\b", "default_dose": "30 mg", "default_freq": "IV Stat", "default_dur": "Single dose"},
    {"name": "Regular Insulin", "regex": r"\binsulin\b|\bactrapid\b", "default_dose": "10 units", "default_freq": "IV infusion", "default_dur": "Protocol"},
    {"name": "Amoxicillin", "regex": r"\bamoxicillin\b|\baugmentin\b", "default_dose": "500 mg", "default_freq": "TDS", "default_dur": "7 days"},
]

def extract_and_verify_medications(transcript_segments: List[Dict[str, Any]], note_treatment_text: str) -> List[Dict[str, Any]]:
    """
    Extracts medications mentioned in dialogue, parses dosage/frequency/duration,
    and cross-checks generated clinical note treatment section to detect discrepancies.
    """
    extracted_meds = []
    
    full_transcript = " ".join([seg.get("text", "") for seg in transcript_segments])

    for med in KNOWN_MEDS:
        pattern = med["regex"]
        if not re.search(pattern, full_transcript, re.IGNORECASE):
            continue

        # Locate segment where medication was mentioned
        matching_seg = None
        for seg in transcript_segments:
            if re.search(pattern, seg.get("text", ""), re.IGNORECASE):
                matching_seg = seg
                break

        start_t = matching_seg.get("start", 0.0) if matching_seg else 0.0
        min_v = int(start_t) // 60
        sec_v = int(start_t) % 60
        time_str = f"{min_v:02d}:{sec_v:02d}"

        # Check transcript text for explicitly stated dose
        seg_text = matching_seg.get("text", "") if matching_seg else full_transcript
        dose_match = re.search(r"(\d+\s*(?:mg|mcg|g|units|ml))", seg_text, re.IGNORECASE)
        found_dose = dose_match.group(1) if dose_match else med["default_dose"]

        freq_match = re.search(r"\b(daily|once daily|twice daily|tds|bd|stat|prn|every \d+ hours)\b", seg_text, re.IGNORECASE)
        found_freq = freq_match.group(1) if freq_match else med["default_freq"]

        dur_match = re.search(r"(\d+\s*days?)", seg_text, re.IGNORECASE)
        found_dur = dur_match.group(1) if dur_match else med["default_dur"]

        # Check for discrepancy in treatment text
        discrepancy_flag = False
        discrepancy_note = None

        if note_treatment_text:
            med_in_note = re.search(pattern, note_treatment_text, re.IGNORECASE)
            if med_in_note:
                note_dose_match = re.search(r"(\d+\s*(?:mg|mcg|g|units|ml))", note_treatment_text[med_in_note.start():med_in_note.start()+80], re.IGNORECASE)
                if note_dose_match and dose_match and note_dose_match.group(1).lower() != dose_match.group(1).lower():
                    discrepancy_flag = True
                    discrepancy_note = f"Transcript specified {found_dose}, but generated note contains {note_dose_match.group(1)}."

        extracted_meds.append({
            "medication": med["name"],
            "dose": found_dose,
            "frequency": found_freq,
            "duration": found_dur,
            "source_text": seg_text[:120] if seg_text else "Mentioned in consultation",
            "timestamp": start_t,
            "time_formatted": matching_seg.get("time", time_str) if matching_seg else "00:00",
            "discrepancy_flag": discrepancy_flag,
            "discrepancy_note": discrepancy_note
        })

    return extracted_meds
