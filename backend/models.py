import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base

class Patient(Base):
    __tablename__ = "patients"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False, default="Unknown Patient")
    mrn = Column(String, nullable=False, default="UNKNOWN")
    dob = Column(String, nullable=True, default="1985-06-15")
    gender = Column(String, nullable=True, default="Female")
    created_at = Column(DateTime, default=datetime.utcnow)

    consultations = relationship("Consultation", back_populates="patient")

class Consultation(Base):
    __tablename__ = "consultations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    patient_id = Column(String, ForeignKey("patients.id"), nullable=True)
    patient_name = Column(String, nullable=False, default="Unknown Patient")
    mrn = Column(String, nullable=False, default="UNKNOWN")
    consult_type = Column(String, nullable=False, default="Discharge Summary")
    
    # Explicit State Machine: recording -> processing -> review -> signed -> exported
    status = Column(String, nullable=False, default="processing")
    review_status = Column(String, nullable=False, default="needs_review")  # high_priority, needs_review, ready_for_approval, finalized
    risk_level = Column(String, nullable=False, default="LOW")               # LOW, MEDIUM, HIGH, CRITICAL
    completeness_score = Column(Integer, nullable=True, default=100)
    
    audio_path = Column(String, nullable=True)
    duration = Column(Float, nullable=True, default=0.0)
    time_to_review_seconds = Column(Integer, nullable=True, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    signed_at = Column(DateTime, nullable=True)

    patient = relationship("Patient", back_populates="consultations")
    transcript = relationship("Transcript", back_populates="consultation", uselist=False, cascade="all, delete-orphan")
    clinical_note = relationship("ClinicalNote", back_populates="consultation", uselist=False, cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="consultation", cascade="all, delete-orphan")

class Transcript(Base):
    __tablename__ = "transcripts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    consultation_id = Column(String, ForeignKey("consultations.id"), nullable=False)
    raw_text = Column(Text, nullable=False, default="")
    speaker_json = Column(Text, nullable=False, default="[]")  # JSON string of segments

    consultation = relationship("Consultation", back_populates="transcript")

class ClinicalNote(Base):
    __tablename__ = "clinical_notes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    consultation_id = Column(String, ForeignKey("consultations.id"), nullable=False)
    template_used = Column(String, nullable=False, default="cura-discharge.json")
    prompt_version = Column(String, nullable=False, default="v1.0.0")
    
    # Data preservation: Keep raw generated text separate from edited text
    generated_text = Column(Text, nullable=False, default="")
    edited_text = Column(Text, nullable=True)
    sections_json = Column(Text, nullable=False, default="{}")  # Current sections
    raw_generated_sections_json = Column(Text, nullable=True)   # Original LLM sections
    icd10_json = Column(Text, nullable=True)                     # Persistent ICD-10 codes
    prescriptions_json = Column(Text, nullable=True)              # Persistent Prescriptions
    evidence_json = Column(Text, nullable=True)                   # Grounded evidence links
    completeness_json = Column(Text, nullable=True)               # Section & info completeness audit
    medications_json = Column(Text, nullable=True)                # Extracted & verified meds
    doctor_diff_json = Column(Text, nullable=True)                # AI Draft vs Doctor Final diff
    risk_flags_json = Column(Text, nullable=True)                 # Categorized safety risk flags
    
    status = Column(String, nullable=False, default="draft")
    edit_count = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    consultation = relationship("Consultation", back_populates="clinical_note")

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    consultation_id = Column(String, ForeignKey("consultations.id"), nullable=False)
    user_id = Column(String, nullable=False, default="dr_raman")
    field_name = Column(String, nullable=False)
    old_value = Column(Text, nullable=True)
    new_value = Column(Text, nullable=True)
    action_type = Column(String, nullable=False, default="EDIT")  # EDIT, SIGN, REGENERATE, MERGE_SEGMENTS, SPLIT_SEGMENT, ICD_ACCEPT, ICD_REJECT, MED_CORRECT
    created_at = Column(DateTime, default=datetime.utcnow)

    consultation = relationship("Consultation", back_populates="audit_logs")

