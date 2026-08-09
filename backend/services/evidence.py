import re
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

def extract_grounded_evidence(transcript_segments: List[Dict[str, Any]], sections: Dict[str, str]) -> List[Dict[str, Any]]:
    """
    Grounds key clinical claims in generated note sections back to exact transcript segments.
    Creates structured evidence objects with speaker, timestamps, confidence, and quote.
    """
    evidence_list = []
    
    # Key clinical claims to look for across sections
    claims_to_check = []
    
    # Extract candidate claims from chief complaint, HPI, exam, and diagnosis
    for section_name, text in sections.items():
        if not text or "No specific details" in text:
            continue
        lines = [line.strip("- ").strip() for line in text.split("\n") if line.strip()]
        for line in lines:
            if len(line) > 8:
                claims_to_check.append({
                    "section": section_name,
                    "claim": line
                })

    for item in claims_to_check:
        claim_str = item["claim"]
        claim_words = set(re.findall(r'\b\w{4,}\b', claim_str.lower()))
        
        best_match = None
        best_overlap = 0.0

        for seg in transcript_segments:
            seg_text = seg.get("text", "")
            seg_words = set(re.findall(r'\b\w{4,}\b', seg_text.lower()))
            
            if not seg_words:
                continue

            common = claim_words.intersection(seg_words)
            overlap_score = len(common) / max(len(claim_words), 1)

            # Substring exact check bonus
            if any(w in seg_text.lower() for w in ["chest pain", "breastbone", "mcburney", "wheezing", "dka", "glucose", "flank", "droop"]):
                overlap_score += 0.3

            if overlap_score > best_overlap and overlap_score >= 0.25:
                best_overlap = overlap_score
                start_t = seg.get("start", 0.0)
                end_t = seg.get("end", 0.0)
                min_v = int(start_t) // 60
                sec_v = int(start_t) % 60
                time_str = f"{min_v:02d}:{sec_v:02d}"

                best_match = {
                    "claim": claim_str,
                    "section": item["section"],
                    "source_text": seg_text,
                    "speaker": seg.get("speaker", "PATIENT"),
                    "timestamp_start": start_t,
                    "timestamp_end": end_t,
                    "time_formatted": seg.get("time", time_str),
                    "confidence": round(min(overlap_score, 0.98), 2),
                    "grounded": True
                }

        if best_match:
            evidence_list.append(best_match)
        else:
            evidence_list.append({
                "claim": claim_str,
                "section": item["section"],
                "source_text": "No direct transcript evidence found for this claim.",
                "speaker": "UNKNOWN",
                "timestamp_start": 0.0,
                "timestamp_end": 0.0,
                "time_formatted": "00:00",
                "confidence": 0.30,
                "grounded": False
            })

    return evidence_list
