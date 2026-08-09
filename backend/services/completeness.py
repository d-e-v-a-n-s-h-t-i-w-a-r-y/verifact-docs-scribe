import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

def check_clinical_completeness(sections: Dict[str, str], transcript: str) -> Dict[str, Any]:
    """
    Evaluates clinical documentation completeness for SOAP and Discharge templates.
    Flags missing clinical domains (allergies, medication history, vitals, follow-up)
    without fabricating values ("Not documented").
    """
    t_lower = transcript.lower()
    warnings: List[Dict[str, str]] = []
    missing_fields: List[str] = []
    
    # 1. Section Presence Validation (SOAP / Discharge)
    expected_sections = {
        "chiefComplaint": "Chief Complaint",
        "hpi": "History of Present Illness",
        "examination": "Examination Findings / Vitals",
        "diagnosis": "Diagnosis",
        "treatment": "Treatment / Management Plan",
        "followUp": "Follow-up Instructions"
    }

    present_sections = 0
    for key, label in expected_sections.items():
        val = sections.get(key, "").strip()
        if not val or "No specific details" in val:
            missing_fields.append(label)
            warnings.append({
                "category": "Missing Section",
                "field": label,
                "severity": "WARNING",
                "message": f"Section '{label}' is empty or incomplete."
            })
        else:
            present_sections += 1

    # 2. Vital Signs Check
    vitals_found = any(k in t_lower for k in ["bp", "blood pressure", "hr", "heart rate", "spo2", "pulse", "temp", "temperature", "154/", "158/", "91%"])
    if not vitals_found:
        warnings.append({
            "category": "Missing Vitals",
            "field": "Vital Signs",
            "severity": "WARNING",
            "message": "Vital signs (BP, HR, SpO2, Temp) were not documented in consultation."
        })

    # 3. Allergy History Check
    allergies_found = any(k in t_lower for k in ["allergy", "allergies", "allergic", "penicillin allergy", "no known allergies", "nka"])
    if not allergies_found:
        warnings.append({
            "category": "Missing Information",
            "field": "Allergies",
            "severity": "WARNING",
            "message": "Allergy history not explicitly documented in transcript."
        })

    # 4. Prior Medication History Check
    med_history_found = any(k in t_lower for k in ["taking", "medication", "prescribed", "dose", "aspirin", "albuterol", "insulin", "home meds"])
    if not med_history_found:
        warnings.append({
            "category": "Missing Information",
            "field": "Prior Medications",
            "severity": "WARNING",
            "message": "Home medication history not documented."
        })

    # 5. Follow-up Information Check
    followup_val = sections.get("followUp", "").strip()
    if not followup_val or "No specific details" in followup_val:
        warnings.append({
            "category": "Missing Information",
            "field": "Follow-up Plan",
            "severity": "WARNING",
            "message": "Follow-up timeline and ER return warnings missing."
        })

    # Calculate Completeness Score
    total_checks = len(expected_sections) + 4
    passed_checks = present_sections + (1 if vitals_found else 0) + (1 if allergies_found else 0) + (1 if med_history_found else 0) + (1 if followup_val else 0)
    score = int((passed_checks / total_checks) * 100)

    return {
        "completeness_score": score,
        "review_required_count": len(warnings),
        "status": "complete" if score >= 85 else "incomplete",
        "warnings": warnings,
        "missing_fields": missing_fields,
        "is_soap_compliant": present_sections >= 4
    }
