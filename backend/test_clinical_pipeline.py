import pytest
from services.workflow import run_clinical_workflow
from services.evidence import extract_grounded_evidence
from services.completeness import check_clinical_completeness
from services.medication_verification import extract_and_verify_medications
from services.evaluation import run_pipeline_evaluation

def test_langgraph_workflow_execution():
    transcript = "Patient presents with severe chest pain behind breastbone radiating to left arm. SpO2 91% on room air."
    speakers = [
        {"speaker": "PATIENT", "text": transcript, "start": 0.0, "end": 10.0, "time": "00:00"}
    ]
    state = run_clinical_workflow("test-session-123", transcript, speakers, "Test Patient", "MRN-999")
    
    assert state["session_id"] == "test-session-123"
    assert state["redacted_transcript"] != ""
    assert len(state["risk_flags"]) > 0
    assert state["risk_level"] in ["HIGH", "MEDIUM", "CRITICAL"]
    assert state["completeness_score"] > 0
    assert len(state["evidence"]) > 0
    assert len(state["audit_events"]) >= 8


def test_evidence_grounding():
    speakers = [
        {"speaker": "PATIENT", "text": "I have been wheezing for 3 days and Albuterol isn't helping.", "start": 5.0, "end": 12.0, "time": "00:05"}
    ]
    sections = {
        "hpi": "3-day history of wheezing non-responsive to Albuterol",
        "diagnosis": "Acute Severe Asthma Exacerbation"
    }
    evidence = extract_grounded_evidence(speakers, sections)
    assert len(evidence) > 0
    assert any(e["grounded"] for e in evidence)


def test_completeness_checker():
    sections = {
        "chiefComplaint": "Shortness of breath",
        "hpi": "3-day history",
        "examination": "Widespread wheezing",
        "diagnosis": "Asthma Exacerbation",
        "treatment": "Prednisolone 40mg",
        "followUp": "Return in 7 days"
    }
    transcript = "Wheezing, taking Albuterol, no known allergies."
    res = check_clinical_completeness(sections, transcript)
    assert res["completeness_score"] >= 80
    assert res["is_soap_compliant"] is True


def test_medication_verification():
    speakers = [
        {"speaker": "DOCTOR", "text": "We will prescribe Prednisolone 40 mg daily for 5 days.", "start": 20.0, "end": 25.0, "time": "00:20"}
    ]
    treatment_text = "Prednisolone 40 mg daily for 5 days"
    meds = extract_and_verify_medications(speakers, treatment_text)
    assert len(meds) > 0
    assert meds[0]["medication"] == "Prednisolone"
    assert meds[0]["dose"] == "40 mg"


def test_icd10_dataset_search():
    from services.medical_knowledge import load_icd10_dataset
    dataset = load_icd10_dataset()
    assert len(dataset) >= 10

    # Test "headache" & partial "he"
    matches_headache = [item for item in dataset if "headache" in item["code"].lower() or "headache" in item["title"].lower() or any("headache" in kw for kw in item.get("keywords", []))]
    assert len(matches_headache) > 0
    assert any(m["code"] == "R51.9" for m in matches_headache)

    matches_he = [item for item in dataset if "he" in item["code"].lower() or "he" in item["title"].lower() or any("he" in kw for kw in item.get("keywords", []))]
    assert len(matches_he) > 0

    # Test "asthma"
    matches_asthma = [item for item in dataset if "asthma" in item["title"].lower() or any("asthma" in kw for kw in item.get("keywords", []))]
    assert any(m["code"] == "J45.901" for m in matches_asthma)

    assert meds[0]["discrepancy_flag"] is False


def test_pipeline_evaluation_suite():
    report = run_pipeline_evaluation()
    assert report["total_test_cases"] == 3
    assert "section_completeness" in report["metrics"]
    assert report["metrics"]["phi_redaction_accuracy"] == "100.0%"
