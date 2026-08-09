import os
import json
import uuid
from datetime import datetime
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import engine, Base, get_db, ensure_schema_current, STORAGE_DIR
from models import Consultation, Transcript, ClinicalNote, AuditLog, Patient
from services.transcription import transcribe_audio
from services.redaction import redact_pii
from services.llm import generate_clinical_note, generate_clinical_note_fast
from services.medical_knowledge import (
    load_icd10_dataset,
    load_medications_dataset,
    auto_match_icd10_codes,
    auto_suggest_prescriptions
)
from services.clinical_rules import analyze_clinical_risks
from services.differential import generate_differential_details
from services.random_case import generate_random_case_payload
from services.evidence import extract_grounded_evidence
from services.completeness import check_clinical_completeness
from services.medication_verification import extract_and_verify_medications
from services.evaluation import run_pipeline_evaluation
from services.workflow import run_clinical_workflow


# Initialize SQLite tables, then backfill columns added to models since the DB was created
Base.metadata.create_all(bind=engine)
ensure_schema_current()

app = FastAPI(
    title="Verifact Local Clinical AI Pipeline",
    description="100% Local DPDP-compliant STT, PII Redaction, ICD-10, Rx & Audit Trail API",
    version="1.6.0"
)

# Configure CORS for local Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static/audio", StaticFiles(directory=STORAGE_DIR), name="audio")

# ─── Pydantic Schemas ─────────────────────────────────────────────────────────

class NoteGenerationRequest(BaseModel):
    consultation_id: str
    template_id: Optional[str] = "cura-discharge.json"

class UpdateConsultationRequest(BaseModel):
    sections: Optional[Dict[str, str]] = None
    transcript: Optional[List[Dict[str, Any]]] = None
    status: Optional[str] = None
    icd10_codes: Optional[List[Dict[str, Any]]] = None
    prescriptions: Optional[List[Dict[str, Any]]] = None

class SignNoteRequest(BaseModel):
    review_seconds: int

class MergeSegmentsRequest(BaseModel):
    segment_index_1: int
    segment_index_2: int

class SplitSegmentRequest(BaseModel):
    segment_index: int
    split_character_index: int

# ─── API Endpoints ────────────────────────────────────────────────────────────

@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    """Health check verifying database and local ML services."""
    try:
        consultation_count = db.query(Consultation).count()
        db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {e}"

    return {
        "status": "online",
        "privacy": "100% Local (DPDP Compliant)",
        "database": db_status,
        "consultations_count": consultation_count,
        "timestamp": datetime.utcnow().isoformat()
    }


@app.get("/api/icd10")
def get_icd10_codes(q: Optional[str] = None):
    dataset = load_icd10_dataset()
    if not q:
        return dataset
    q_lower = q.lower().strip()
    return [
        item for item in dataset
        if q_lower in item["code"].lower()
        or q_lower in item["title"].lower()
        or any(q_lower in kw for kw in item.get("keywords", []))
    ]


@app.get("/api/medications")
def get_medications(q: Optional[str] = None):
    dataset = load_medications_dataset()
    if not q:
        return dataset
    q_lower = q.lower().strip()
    return [
        item for item in dataset
        if q_lower in item["name"].lower()
        or q_lower in item["brand"].lower()
        or q_lower in item["indication"].lower()
    ]


@app.post("/api/generate-random-case")
def generate_random_case_endpoint(db: Session = Depends(get_db)):
    """
    Dynamically generates a synchronized clinical scenario with explicit state machine transitions.
    """
    random_payload = generate_random_case_payload()
    full_transcript = random_payload["full_transcript"]
    segments = random_payload["segments"]

    redacted_transcript, redactions = redact_pii(full_transcript)

    consultation = Consultation(
        patient_name=random_payload["patient_name"],
        mrn=random_payload["mrn"],
        consult_type=random_payload["consult_type"],
        status="processing",
        audio_path="RANDOM_DYNAMIC_AUDIO",
        duration=segments[-1]["end"] if segments else 0.0
    )
    db.add(consultation)
    db.commit()
    db.refresh(consultation)

    transcript_record = Transcript(
        consultation_id=consultation.id,
        raw_text=full_transcript,
        speaker_json=json.dumps(segments)
    )
    db.add(transcript_record)
    db.commit()

    template_path = os.path.join(os.path.dirname(__file__), "templates", "cura-discharge.json")
    template_config = {}
    if os.path.exists(template_path):
        with open(template_path, "r") as tf:
            template_config = json.load(tf)

    note_result = generate_clinical_note_fast(redacted_transcript, template_config)

    matched_icd10 = auto_match_icd10_codes(full_transcript, note_result["sections"].get("diagnosis", ""))
    suggested_prescriptions = auto_suggest_prescriptions(full_transcript, note_result["sections"].get("diagnosis", ""))
    clinical_risk_analysis = analyze_clinical_risks(full_transcript, note_result["sections"].get("diagnosis", ""))
    differentials = generate_differential_details(full_transcript, note_result["sections"].get("diagnosis", ""))

    clinical_note = ClinicalNote(
        consultation_id=consultation.id,
        template_used="cura-discharge.json",
        prompt_version=note_result.get("prompt_version", "v1.0.0"),
        generated_text=note_result["structured_note"],
        sections_json=json.dumps(note_result["sections"]),
        raw_generated_sections_json=json.dumps(note_result["sections"]),
        status="review"
    )
    db.add(clinical_note)

    # Log initial state creation audit log
    audit_entry = AuditLog(
        consultation_id=consultation.id,
        user_id="dr_raman",
        field_name="session_status",
        old_value="recording",
        new_value="review",
        action_type="CREATE"
    )
    db.add(audit_entry)

    consultation.status = "review"
    db.commit()

    return {
        "consultation_id": consultation.id,
        "patient_name": consultation.patient_name,
        "mrn": consultation.mrn,
        "age": random_payload["age"],
        "pmh": random_payload["pmh"],
        "consult_type": consultation.consult_type,
        "scenario_title": random_payload["scenario_title"],
        "status": consultation.status,
        "full_transcript": full_transcript,
        "redacted_transcript": redacted_transcript,
        "segments": segments,
        "icd10_codes": matched_icd10,
        "prescriptions": suggested_prescriptions,
        "clinical_risk_analysis": clinical_risk_analysis,
        "differential_pinpoints": differentials,
        "note": {
            "id": clinical_note.id,
            "sections": note_result["sections"],
            "structured_note": note_result["structured_note"],
            "llm_model": note_result.get("llm_model"),
            "prompt_version": note_result.get("prompt_version")
        }
    }


@app.post("/api/transcribe")
async def transcribe_endpoint(
    file: Optional[UploadFile] = File(None),
    patient_name: str = Form("Rishi Mohan"),
    mrn: str = Form("MRN-48213"),
    consult_type: str = Form("Discharge Summary"),
    first_speaker: str = Form("PATIENT"),
    whisper_model: str = Form("base"),
    db: Session = Depends(get_db)
):
    ext = "webm"
    if file and file.filename:
        _, orig_ext = os.path.splitext(file.filename)
        if orig_ext:
            ext = orig_ext.lstrip(".")

    saved_filename = f"{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}.{ext}"
    audio_path = os.path.join(STORAGE_DIR, saved_filename)

    if file:
        contents = await file.read()
        with open(audio_path, "wb") as f:
            f.write(contents)
    else:
        with open(audio_path, "wb") as f:
            f.write(b"MOCK_AUDIO_DATA")

    # Use RAM-cached Whisper model (default 'base' for ultra-fast processing)
    transcribe_result = transcribe_audio(audio_path, first_speaker=first_speaker, model_name=whisper_model)
    full_transcript = transcribe_result["full_transcript"]
    segments = transcribe_result["segments"]

    redacted_transcript, redactions = redact_pii(full_transcript)

    consultation = Consultation(
        patient_name=patient_name.strip(),
        mrn=mrn.strip(),
        consult_type=consult_type.strip(),
        status="processing",
        audio_path=audio_path,
        duration=segments[-1]["end"] if segments else 0.0
    )
    db.add(consultation)
    db.commit()
    db.refresh(consultation)

    transcript_record = Transcript(
        consultation_id=consultation.id,
        raw_text=full_transcript,
        speaker_json=json.dumps(segments)
    )
    db.add(transcript_record)
    db.commit()

    template_path = os.path.join(os.path.dirname(__file__), "templates", "cura-discharge.json")
    template_config = {}
    if os.path.exists(template_path):
        with open(template_path, "r") as tf:
            template_config = json.load(tf)

    note_result = generate_clinical_note(redacted_transcript, template_config)

    matched_icd10 = auto_match_icd10_codes(full_transcript, note_result["sections"].get("diagnosis", ""))
    suggested_prescriptions = auto_suggest_prescriptions(full_transcript, note_result["sections"].get("diagnosis", ""))
    clinical_risk_analysis = analyze_clinical_risks(full_transcript, note_result["sections"].get("diagnosis", ""))
    differentials = generate_differential_details(full_transcript, note_result["sections"].get("diagnosis", ""))

    clinical_note = ClinicalNote(
        consultation_id=consultation.id,
        template_used="cura-discharge.json",
        prompt_version=note_result.get("prompt_version", "v1.0.0"),
        generated_text=note_result["structured_note"],
        sections_json=json.dumps(note_result["sections"]),
        raw_generated_sections_json=json.dumps(note_result["sections"]),
        status="review"
    )
    db.add(clinical_note)

    audit_entry = AuditLog(
        consultation_id=consultation.id,
        user_id="dr_raman",
        field_name="session_status",
        old_value="recording",
        new_value="review",
        action_type="CREATE"
    )
    db.add(audit_entry)

    consultation.status = "review"
    db.commit()

    return {
        "consultation_id": consultation.id,
        "patient_name": consultation.patient_name,
        "mrn": consultation.mrn,
        "consult_type": consultation.consult_type,
        "status": consultation.status,
        "full_transcript": full_transcript,
        "redacted_transcript": redacted_transcript,
        "segments": segments,
        "icd10_codes": matched_icd10,
        "prescriptions": suggested_prescriptions,
        "clinical_risk_analysis": clinical_risk_analysis,
        "differential_pinpoints": differentials,
        "note": {
            "id": clinical_note.id,
            "sections": note_result["sections"],
            "structured_note": note_result["structured_note"],
            "llm_model": note_result.get("llm_model"),
            "prompt_version": note_result.get("prompt_version")
        }
    }


@app.get("/api/consultations/{consultation_id}/audit-trail")
def get_audit_trail(consultation_id: str, db: Session = Depends(get_db)):
    """Returns the complete immutable audit trail of edits and state transitions for a session."""
    logs = db.query(AuditLog).filter(AuditLog.consultation_id == consultation_id).order_by(AuditLog.created_at.desc()).all()
    return [
        {
            "id": log.id,
            "user_id": log.user_id,
            "field_name": log.field_name,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "action_type": log.action_type,
            "timestamp": log.created_at.isoformat()
        }
        for log in logs
    ]


@app.put("/api/consultations/{consultation_id}")
def update_consultation(
    consultation_id: str,
    req: UpdateConsultationRequest,
    db: Session = Depends(get_db)
):
    """Updates consultation sections, transcript, or status, generating audit log entries."""
    c = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consultation not found")

    if req.status and req.status != c.status:
        db.add(AuditLog(
            consultation_id=consultation_id,
            field_name="status",
            old_value=c.status,
            new_value=req.status,
            action_type="STATE_TRANSITION"
        ))
        c.status = req.status

    if req.sections:
        n = db.query(ClinicalNote).filter(ClinicalNote.consultation_id == consultation_id).first()
        if n:
            old_sections = json.loads(n.sections_json) if n.sections_json else {}
            for k, new_val in req.sections.items():
                old_val = old_sections.get(k, "")
                if old_val != new_val:
                    db.add(AuditLog(
                        consultation_id=consultation_id,
                        field_name=f"section.{k}",
                        old_value=old_val[:200],
                        new_value=new_val[:200],
                        action_type="EDIT"
                    ))
            n.sections_json = json.dumps(req.sections)
            n.edit_count += 1
            n.updated_at = datetime.utcnow()

    if req.transcript:
        t = db.query(Transcript).filter(Transcript.consultation_id == consultation_id).first()
        if t:
            t.speaker_json = json.dumps(req.transcript)
            t.raw_text = " ".join([seg.get("text", "") for seg in req.transcript])

    if req.icd10_codes is not None:
        n = db.query(ClinicalNote).filter(ClinicalNote.consultation_id == consultation_id).first()
        if n:
            n.icd10_json = json.dumps(req.icd10_codes)
            db.add(AuditLog(
                consultation_id=consultation_id,
                field_name="icd10_codes",
                old_value="",
                new_value=json.dumps(req.icd10_codes)[:200],
                action_type="EDIT"
            ))

    if req.prescriptions is not None:
        n = db.query(ClinicalNote).filter(ClinicalNote.consultation_id == consultation_id).first()
        if n:
            n.prescriptions_json = json.dumps(req.prescriptions)
            db.add(AuditLog(
                consultation_id=consultation_id,
                field_name="prescriptions",
                old_value="",
                new_value=json.dumps(req.prescriptions)[:200],
                action_type="EDIT"
            ))

    db.commit()
    return {"status": "success", "consultation_id": consultation_id}


@app.post("/api/consultations/{consultation_id}/sign")
def sign_consultation(
    consultation_id: str,
    req: SignNoteRequest,
    db: Session = Depends(get_db)
):
    """Marks note as approved & locked, transitioning state to 'signed' and logging audit entry."""
    c = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consultation not found")

    old_status = c.status
    c.status = "signed"
    c.time_to_review_seconds = req.review_seconds
    c.signed_at = datetime.utcnow()

    n = db.query(ClinicalNote).filter(ClinicalNote.consultation_id == consultation_id).first()
    if n:
        n.status = "signed"
        n.updated_at = datetime.utcnow()

    db.add(AuditLog(
        consultation_id=consultation_id,
        field_name="status",
        old_value=old_status,
        new_value="signed",
        action_type="SIGN"
    ))

    db.commit()
    return {
        "status": "signed",
        "consultation_id": consultation_id,
        "time_to_review_seconds": c.time_to_review_seconds,
        "signed_at": c.signed_at.isoformat()
    }


@app.get("/api/consultations")
def list_consultations(db: Session = Depends(get_db)):
    consultations = db.query(Consultation).order_by(Consultation.created_at.desc()).all()
    results = []
    for c in consultations:
        note = db.query(ClinicalNote).filter(ClinicalNote.consultation_id == c.id).first()
        results.append({
            "id": c.id,
            "patientName": c.patient_name,
            "mrn": c.mrn,
            "consultTime": c.created_at.isoformat() if c.created_at else None,
            "type": c.consult_type,
            "status": c.status,
            "reviewSeconds": c.time_to_review_seconds,
            "signedAt": c.signed_at.isoformat() if c.signed_at else None,
            "editsCount": note.edit_count if note else 0
        })
    return results


@app.get("/api/consultations/{consultation_id}")
def get_consultation(consultation_id: str, db: Session = Depends(get_db)):
    c = db.query(Consultation).filter(Consultation.id == consultation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Consultation not found")

    t = db.query(Transcript).filter(Transcript.consultation_id == consultation_id).first()
    n = db.query(ClinicalNote).filter(ClinicalNote.consultation_id == consultation_id).first()

    segments = json.loads(t.speaker_json) if (t and t.speaker_json) else []
    sections = json.loads(n.sections_json) if (n and n.sections_json) else {
        "chiefComplaint": "", "hpi": "", "examination": "", "diagnosis": "", "treatment": "", "followUp": ""
    }

    raw_text = t.raw_text if t else ""
    matched_icd10 = json.loads(n.icd10_json) if (n and n.icd10_json) else auto_match_icd10_codes(raw_text, sections.get("diagnosis", ""))
    suggested_prescriptions = json.loads(n.prescriptions_json) if (n and n.prescriptions_json) else auto_suggest_prescriptions(raw_text, sections.get("diagnosis", ""))
    clinical_risk_analysis = analyze_clinical_risks(raw_text, sections.get("diagnosis", ""))
    differentials = generate_differential_details(raw_text, sections.get("diagnosis", ""))

    evidence_list = json.loads(n.evidence_json) if (n and n.evidence_json) else extract_grounded_evidence(segments, sections)
    completeness_res = json.loads(n.completeness_json) if (n and n.completeness_json) else check_clinical_completeness(sections, raw_text)
    verified_meds = json.loads(n.medications_json) if (n and n.medications_json) else extract_and_verify_medications(segments, sections.get("treatment", ""))
    
    # Calculate AI vs Doctor Diff
    raw_sections = json.loads(n.raw_generated_sections_json) if (n and n.raw_generated_sections_json) else sections
    modified_fields_count = 0
    diff_items = []
    for sec_key, current_val in sections.items():
        original_val = raw_sections.get(sec_key, "")
        if original_val != current_val:
            modified_fields_count += 1
            diff_items.append({
                "field": sec_key,
                "ai_draft": original_val,
                "doctor_final": current_val
            })

    return {
        "id": c.id,
        "patientName": c.patient_name,
        "mrn": c.mrn,
        "consultTime": c.created_at.isoformat() if c.created_at else None,
        "type": c.consult_type,
        "status": c.status,
        "reviewStatus": c.review_status,
        "riskLevel": c.risk_level,
        "completenessScore": c.completeness_score or completeness_res.get("completeness_score", 100),
        "reviewSeconds": c.time_to_review_seconds,
        "signedAt": c.signed_at.isoformat() if c.signed_at else None,
        "transcript": segments,
        "sections": sections,
        "rawGeneratedSections": raw_sections,
        "icd10Codes": matched_icd10,
        "prescriptions": suggested_prescriptions,
        "clinicalRiskAnalysis": clinical_risk_analysis,
        "differentialPinpoints": differentials,
        "evidence": evidence_list,
        "completeness": completeness_res,
        "verifiedMedications": verified_meds,
        "diffAnalysis": {
            "modifiedFieldsCount": modified_fields_count,
            "diffs": diff_items
        },
        "editsCount": n.edit_count if n else 0,
        "editedFields": {}
    }


@app.post("/api/consultations/workflow")
def trigger_langgraph_workflow(payload: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Executes the 11-step LangGraph clinical documentation workflow.
    """
    session_id = payload.get("session_id", str(uuid.uuid4()))
    transcript = payload.get("transcript", "")
    speakers = payload.get("speakers", [])
    patient_name = payload.get("patient_name", "Unknown Patient")
    mrn = payload.get("mrn", "UNKNOWN")

    final_state = run_clinical_workflow(session_id, transcript, speakers, patient_name, mrn)
    return final_state


@app.get("/api/eval/run")
def run_evaluation_endpoint():
    """
    Runs the automated clinical evaluation benchmark suite over synthetic consultation cases.
    """
    return run_pipeline_evaluation()


@app.get("/api/patients/{patient_id}/timeline")
def get_patient_timeline(patient_id: str, db: Session = Depends(get_db)):
    """
    Retrieves longitudinal clinical history for a patient.
    """
    consultations = db.query(Consultation).filter(
        (Consultation.patient_id == patient_id) | (Consultation.mrn == patient_id)
    ).order_by(Consultation.created_at.desc()).all()

    timeline_events = []
    for c in consultations:
        note = db.query(ClinicalNote).filter(ClinicalNote.consultation_id == c.id).first()
        sec = json.loads(note.sections_json) if (note and note.sections_json) else {}
        timeline_events.append({
            "consultation_id": c.id,
            "date": c.created_at.strftime("%d %b %Y"),
            "consult_type": c.consult_type,
            "status": c.status,
            "diagnosis": sec.get("diagnosis", "Clinical Consultation"),
            "treatment": sec.get("treatment", "Standard Care"),
            "risk_level": c.risk_level
        })
    return {
        "patient_id": patient_id,
        "timeline": timeline_events
    }


@app.get("/api/patients/{patient_id}/compare")
def compare_patient_visits(patient_id: str, db: Session = Depends(get_db)):
    """
    Compares symptoms, medications, vitals, and diagnoses between the 2 most recent visits.
    """
    consultations = db.query(Consultation).filter(
        (Consultation.patient_id == patient_id) | (Consultation.mrn == patient_id)
    ).order_by(Consultation.created_at.desc()).limit(2).all()

    if len(consultations) < 2:
        return {
            "has_previous_visit": False,
            "message": "Only 1 consultation found for this patient. Baseline recorded."
        }

    c1, c2 = consultations[0], consultations[1]
    n1 = db.query(ClinicalNote).filter(ClinicalNote.consultation_id == c1.id).first()
    n2 = db.query(ClinicalNote).filter(ClinicalNote.consultation_id == c2.id).first()

    sec1 = json.loads(n1.sections_json) if (n1 and n1.sections_json) else {}
    sec2 = json.loads(n2.sections_json) if (n2 and n2.sections_json) else {}

    return {
        "has_previous_visit": True,
        "current_visit": {
            "date": c1.created_at.strftime("%d %b %Y"),
            "diagnosis": sec1.get("diagnosis", ""),
            "treatment": sec1.get("treatment", "")
        },
        "previous_visit": {
            "date": c2.created_at.strftime("%d %b %Y"),
            "diagnosis": sec2.get("diagnosis", ""),
            "treatment": sec2.get("treatment", "")
        },
        "changes_detected": {
            "diagnosis_changed": sec1.get("diagnosis") != sec2.get("diagnosis"),
            "treatment_changed": sec1.get("treatment") != sec2.get("treatment")
        }
    }


@app.get("/api/icd10")
def search_icd10_codes(q: Optional[str] = Query(None, description="Search term for ICD-10 code, title, or keywords")):
    """
    Searches ICD-10 medical reference dataset by code, title, category, or keyword.
    Supports partial substring matching (e.g. 'he', 'head', 'headache', 'asthma').
    """
    dataset = load_icd10_dataset()
    if not q or not q.strip():
        return dataset

    query_term = q.strip().lower()
    matches = []

    for item in dataset:
        code_match = query_term in item.get("code", "").lower()
        title_match = query_term in item.get("title", "").lower()
        category_match = query_term in item.get("category", "").lower()
        keyword_match = any(query_term in kw.lower() for kw in item.get("keywords", []))

        if code_match or title_match or category_match or keyword_match:
            matches.append({
                "code": item["code"],
                "title": item["title"],
                "category": item.get("category", "General Medical"),
                "keywords": item.get("keywords", [])
            })

    return matches


