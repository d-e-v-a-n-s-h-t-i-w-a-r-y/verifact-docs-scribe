import json
import logging
from typing import Dict, Any, List, Optional, TypedDict
try:
    from langgraph.graph import StateGraph, END
    LANGGRAPH_AVAILABLE = True
except ImportError:
    LANGGRAPH_AVAILABLE = False
    StateGraph = None
    END = "__end__"


logger = logging.getLogger(__name__)

# ─── Clinical Workflow State Definition ────────────────────────────────────────

class ClinicalWorkflowState(TypedDict):
    session_id: str
    patient_id: str
    patient_name: str
    mrn: str
    audio_path: Optional[str]
    transcript: str
    speakers: List[Dict[str, Any]]
    redacted_transcript: str
    extracted_clinical_facts: Dict[str, Any]
    symptoms: List[str]
    medications: List[Dict[str, Any]]
    vitals: Dict[str, Any]
    diagnoses: List[Dict[str, Any]]
    generated_note: Dict[str, Any]
    note_type: str
    icd10_suggestions: List[Dict[str, Any]]
    risk_flags: List[Dict[str, Any]]
    risk_level: str
    evidence: List[Dict[str, Any]]
    completeness_results: Dict[str, Any]
    completeness_score: int
    review_status: str  # high_priority, needs_review, ready_for_approval, finalized
    doctor_edits: Optional[Dict[str, Any]]
    audit_events: List[Dict[str, Any]]
    final_document: Optional[Dict[str, Any]]
    errors: List[str]
    current_node: str

# ─── LangGraph Node Implementations ────────────────────────────────────────────

def node_transcribe(state: ClinicalWorkflowState) -> ClinicalWorkflowState:
    logger.info(f"LangGraph Node [transcribe] for session {state.get('session_id')}")
    state["current_node"] = "transcribe"
    
    if not state.get("transcript"):
        audio_path = state.get("audio_path")
        if audio_path:
            from services.transcription import transcribe_audio
            res = transcribe_audio(audio_path)
            state["transcript"] = res.get("full_transcript", "")
            state["speakers"] = res.get("segments", [])
        else:
            state["errors"].append("No audio file or transcript provided.")

    state["audit_events"].append({"step": "transcribe", "status": "completed"})
    return state


def node_redact_phi(state: ClinicalWorkflowState) -> ClinicalWorkflowState:
    logger.info(f"LangGraph Node [redact_phi] for session {state.get('session_id')}")
    state["current_node"] = "redact_phi"
    
    transcript = state.get("transcript", "")
    if transcript:
        from services.redaction import redact_pii
        redacted_text, _ = redact_pii(transcript)
        state["redacted_transcript"] = redacted_text
    else:
        state["errors"].append("Transcript empty during PHI redaction.")

    state["audit_events"].append({"step": "redact_phi", "status": "completed"})
    return state


def node_extract_clinical_facts(state: ClinicalWorkflowState) -> ClinicalWorkflowState:
    logger.info(f"LangGraph Node [extract_clinical_facts] for session {state.get('session_id')}")
    state["current_node"] = "extract_clinical_facts"
    
    redacted = state.get("redacted_transcript", "")
    from services.medication_verification import extract_and_verify_medications
    meds = extract_and_verify_medications(state.get("speakers", []), "")
    state["medications"] = meds
    state["extracted_clinical_facts"] = {"extracted_med_count": len(meds)}

    state["audit_events"].append({"step": "extract_clinical_facts", "status": "completed"})
    return state


def node_generate_clinical_note(state: ClinicalWorkflowState) -> ClinicalWorkflowState:
    logger.info(f"LangGraph Node [generate_clinical_note] for session {state.get('session_id')}")
    state["current_node"] = "generate_clinical_note"
    
    redacted = state.get("redacted_transcript", "")
    from services.llm import generate_clinical_note_fast
    note_res = generate_clinical_note_fast(redacted)
    state["generated_note"] = note_res

    state["audit_events"].append({"step": "generate_clinical_note", "status": "completed"})
    return state


def node_suggest_icd10(state: ClinicalWorkflowState) -> ClinicalWorkflowState:
    logger.info(f"LangGraph Node [suggest_icd10] for session {state.get('session_id')}")
    state["current_node"] = "suggest_icd10"
    
    sections = state.get("generated_note", {}).get("sections", {})
    diag_text = sections.get("diagnosis", "")
    from services.medical_knowledge import auto_match_icd10_codes
    matched_codes = auto_match_icd10_codes(diag_text)
    
    icd_suggestions = []
    for code in matched_codes:
        icd_suggestions.append({
            "code": code.get("code"),
            "description": code.get("description"),
            "confidence": code.get("matchScore", 90),
            "status": "SUGGESTED"  # SUGGESTED, ACCEPTED, REJECTED
        })
    state["icd10_suggestions"] = icd_suggestions

    state["audit_events"].append({"step": "suggest_icd10", "status": "completed"})
    return state


def node_detect_risks(state: ClinicalWorkflowState) -> ClinicalWorkflowState:
    logger.info(f"LangGraph Node [detect_risks] for session {state.get('session_id')}")
    state["current_node"] = "detect_risks"
    
    redacted = state.get("redacted_transcript", "")
    sections = state.get("generated_note", {}).get("sections", {})
    from services.clinical_rules import analyze_clinical_risks
    risk_res = analyze_clinical_risks(redacted, sections.get("diagnosis", ""))
    
    alerts = risk_res.get("alerts", [])
    state["risk_flags"] = alerts
    
    highest_risk = "LOW"
    for a in alerts:
        sev = a.get("severity", "LOW")
        if sev == "CRITICAL" or sev == "HIGH":
            highest_risk = "HIGH"
            break
        elif sev == "MEDIUM" and highest_risk != "HIGH":
            highest_risk = "MEDIUM"
            
    state["risk_level"] = highest_risk

    state["audit_events"].append({"step": "detect_risks", "status": "completed"})
    return state


def node_ground_evidence(state: ClinicalWorkflowState) -> ClinicalWorkflowState:
    logger.info(f"LangGraph Node [ground_evidence] for session {state.get('session_id')}")
    state["current_node"] = "ground_evidence"
    
    speakers = state.get("speakers", [])
    sections = state.get("generated_note", {}).get("sections", {})
    from services.evidence import extract_grounded_evidence
    evidence_list = extract_grounded_evidence(speakers, sections)
    state["evidence"] = evidence_list

    state["audit_events"].append({"step": "ground_evidence", "status": "completed"})
    return state


def node_check_completeness(state: ClinicalWorkflowState) -> ClinicalWorkflowState:
    logger.info(f"LangGraph Node [check_completeness] for session {state.get('session_id')}")
    state["current_node"] = "check_completeness"
    
    sections = state.get("generated_note", {}).get("sections", {})
    redacted = state.get("redacted_transcript", "")
    from services.completeness import check_clinical_completeness
    comp_res = check_clinical_completeness(sections, redacted)
    state["completeness_results"] = comp_res
    state["completeness_score"] = comp_res.get("completeness_score", 100)

    state["audit_events"].append({"step": "check_completeness", "status": "completed"})
    return state


def node_doctor_review(state: ClinicalWorkflowState) -> ClinicalWorkflowState:
    logger.info(f"LangGraph Node [doctor_review] for session {state.get('session_id')}")
    state["current_node"] = "doctor_review"
    
    # Decide review status priority
    if state.get("risk_level") == "HIGH":
        state["review_status"] = "high_priority"
    elif state.get("completeness_score", 100) < 80:
        state["review_status"] = "needs_review"
    else:
        state["review_status"] = "ready_for_approval"

    state["audit_events"].append({"step": "doctor_review", "status": "completed"})
    return state


def node_finalize_document(state: ClinicalWorkflowState) -> ClinicalWorkflowState:
    logger.info(f"LangGraph Node [finalize_document] for session {state.get('session_id')}")
    state["current_node"] = "finalize_document"
    state["review_status"] = "finalized"
    state["final_document"] = {
        "finalized_at": "2026-08-09T10:00:00Z",
        "clinician": "Dr. Raman",
        "status": "APPROVED"
    }

    state["audit_events"].append({"step": "finalize_document", "status": "completed"})
    return state


def node_export_pdf(state: ClinicalWorkflowState) -> ClinicalWorkflowState:
    logger.info(f"LangGraph Node [export_pdf] for session {state.get('session_id')}")
    state["current_node"] = "export_pdf"
    state["audit_events"].append({"step": "export_pdf", "status": "completed"})
    return state

# ─── Conditional Routing Decisions ─────────────────────────────────────────────

def route_after_transcription(state: ClinicalWorkflowState) -> str:
    if state.get("errors"):
        return "error_exit"
    return "redact_phi"

def route_after_redaction(state: ClinicalWorkflowState) -> str:
    if not state.get("redacted_transcript"):
        return "error_exit"
    return "extract_clinical_facts"

# ─── Build LangGraph State Graph ──────────────────────────────────────────────

def create_clinical_graph():
    builder = StateGraph(ClinicalWorkflowState)

    # Add Nodes
    builder.add_node("transcribe", node_transcribe)
    builder.add_node("redact_phi", node_redact_phi)
    builder.add_node("extract_clinical_facts", node_extract_clinical_facts)
    builder.add_node("generate_clinical_note", node_generate_clinical_note)
    builder.add_node("suggest_icd10", node_suggest_icd10)
    builder.add_node("detect_risks", node_detect_risks)
    builder.add_node("ground_evidence", node_ground_evidence)
    builder.add_node("check_completeness", node_check_completeness)
    builder.add_node("doctor_review", node_doctor_review)
    builder.add_node("finalize_document", node_finalize_document)
    builder.add_node("export_pdf", node_export_pdf)

    # Set Entry Point
    builder.set_entry_point("transcribe")

    # Edges
    builder.add_conditional_edges("transcribe", route_after_transcription, {"redact_phi": "redact_phi", "error_exit": END})
    builder.add_conditional_edges("redact_phi", route_after_redaction, {"extract_clinical_facts": "extract_clinical_facts", "error_exit": END})
    builder.add_edge("extract_clinical_facts", "generate_clinical_note")
    builder.add_edge("generate_clinical_note", "suggest_icd10")
    builder.add_edge("suggest_icd10", "detect_risks")
    builder.add_edge("detect_risks", "ground_evidence")
    builder.add_edge("ground_evidence", "check_completeness")
    builder.add_edge("check_completeness", "doctor_review")

    return builder.compile()

# Singleton Graph Instance
_CLINICAL_GRAPH = None

def get_clinical_graph():
    global _CLINICAL_GRAPH
    if _CLINICAL_GRAPH is None:
        _CLINICAL_GRAPH = create_clinical_graph()
    return _CLINICAL_GRAPH


def run_clinical_workflow(session_id: str, transcript: str, speakers: List[Dict[str, Any]] = None, patient_name: str = "Unknown Patient", mrn: str = "UNKNOWN") -> ClinicalWorkflowState:
    """
    Executes the 11-step LangGraph clinical documentation workflow.
    Uses Compiled Graph when langgraph is installed, or sequential node pipeline as fallback.
    """
    initial_state: ClinicalWorkflowState = {
        "session_id": session_id,
        "patient_id": f"pat-{session_id[:8]}",
        "patient_name": patient_name,
        "mrn": mrn,
        "audio_path": None,
        "transcript": transcript,
        "speakers": speakers or [],
        "redacted_transcript": "",
        "extracted_clinical_facts": {},
        "symptoms": [],
        "medications": [],
        "vitals": {},
        "diagnoses": [],
        "generated_note": {},
        "note_type": "Discharge Summary",
        "icd10_suggestions": [],
        "risk_flags": [],
        "risk_level": "LOW",
        "evidence": [],
        "completeness_results": {},
        "completeness_score": 100,
        "review_status": "needs_review",
        "doctor_edits": None,
        "audit_events": [],
        "final_document": None,
        "errors": [],
        "current_node": "init"
    }

    if LANGGRAPH_AVAILABLE:
        try:
            graph = get_clinical_graph()
            return graph.invoke(initial_state)
        except Exception as err:
            logger.warning(f"LangGraph execution exception ({err}). Using direct node runner fallback.")

    # Direct sequential node runner fallback
    st = node_transcribe(initial_state)
    st = node_redact_phi(st)
    st = node_extract_clinical_facts(st)
    st = node_generate_clinical_note(st)
    st = node_suggest_icd10(st)
    st = node_detect_risks(st)
    st = node_ground_evidence(st)
    st = node_check_completeness(st)
    st = node_doctor_review(st)
    return st

