# Verifact

Verifact is a clinical documentation workspace for turning a consultation recording or test transcript into a structured six-section clinical note that a clinician can review, edit, sign, and export.

The repository currently contains two implementation paths:

1. The path used by the main browser UI: a local React/TanStack frontend calls a local FastAPI service. That service uses SQLite, SQLAlchemy, Faster-Whisper, optional Presidio, optional Ollama, and deterministic clinical enrichment code.
2. A separate Supabase Edge Function path: private Supabase Storage, AssemblyAI transcription, and Groq note generation. The migration and functions are present, but the current `src/routes/consultations.new.tsx` flow calls `http://localhost:8000/api/...` instead of invoking these functions.

That distinction is important. The repository is not evidence for a single production deployment, and the claims in the UI about being “100% local” do not describe the Supabase path. This README documents what the code actually does today.

## What the application does

The frontend provides:

- A local clinician session screen backed by browser `localStorage`.
- A new-consultation flow with microphone capture through `MediaRecorder`.
- Preset/sample transcript and random-case flows for demonstrations.
- A review workspace containing transcript, editable note, ICD-10, medication, evidence, completeness, risk, and timeline panels.
- Speaker correction, transcript editing, note-section editing, ICD-10 attachment, prescription attachment, sign/lock, and Markdown/PDF export.
- An evaluation page that calls the local backend’s synthetic evaluation endpoint.

The local backend can:

- Accept an uploaded recording at `POST /api/transcribe`.
- Normalize audio with FFmpeg when available.
- Transcribe with a cached Faster-Whisper model and assign `DOCTOR`/`PATIENT` labels using text heuristics.
- Redact selected PII with Presidio when available, with a regex fallback.
- Generate a structured note with Ollama when available, then fall back to a deterministic keyword/NLP compiler.
- Add ICD-10 suggestions, prescription suggestions, clinical risk alerts, differentials, evidence links, completeness results, and medication checks.
- Persist consultations, transcripts, notes, and audit events in a local SQLite database.
- Serve list/detail/edit/sign/audit/timeline/visit-comparison endpoints.
- Expose an explicit LangGraph workflow endpoint and a small synthetic evaluation suite.

The application is a documentation aid, not an autonomous diagnostic or treatment system. A clinician must verify every generated section, diagnosis, medication, code, warning, and follow-up instruction.

## Current architecture at a glance

### Main path used by the UI

```text
Browser
  |
  | MediaRecorder, sample cases, local clinician session
  v
React + TanStack Router/Start + custom useSyncExternalStore store
  |
  | HTTP requests to http://localhost:8000/api
  v
FastAPI
  |
  +--> POST /api/transcribe
  |      |
  |      +--> save recording under backend/storage/audio
  |      +--> FFmpeg normalization
  |      +--> Faster-Whisper transcription
  |      +--> speaker heuristics
  |      +--> Presidio or regex redaction
  |      +--> Ollama JSON generation or deterministic fallback
  |      +--> ICD-10 / Rx / risk / differential enrichment
  |      +--> SQLAlchemy writes to SQLite
  |
  +--> GET/PUT /api/consultations/{id}
  +--> POST /api/consultations/{id}/sign
  +--> GET /api/eval/run
  |
  v
SQLite file: backend/data/verifact_local.db
  |
  v
Structured response -> browser store -> clinician review -> client-side export
```

### Separate Supabase Edge Function path in the repository

```text
Supabase Auth user / client integration (schema supports this)
  |
  v
Private `consult-audio` Storage bucket
  |
  v
`transcribe-consult` Edge Function
  |-- signed URL -> AssemblyAI transcription + speaker labels
  |-- A/B speaker mapping heuristic
  |-- writes transcript_json and status=processing
  v
`generate-note` Edge Function
  |-- Groq OpenAI-compatible API, llama-3.3-70b-versatile
  |-- validate six JSON strings, retry once if invalid
  |-- writes `notes`, then status=draft
  v
Supabase Postgres tables + RLS + Realtime publication
```

The Edge Function path is not called by the current local recording flow. It should therefore be read as an alternate or partially integrated backend, not as an additional step in the local request lifecycle.

## Technology and design decisions

The table below describes choices visible in the repository. “Alternative not chosen” means a relevant option that would have been plausible for this project; it does not imply that a formal benchmark was run.

| Area | Used here | Why it fits this project | Relevant alternative and why it was not chosen | Trade-off |
| --- | --- | --- | --- | --- |
| Browser UI | React 19, TypeScript, TanStack Start, TanStack Router, Vite | The project is an interactive editor with multiple routes, browser audio APIs, and a typed client model. TanStack’s file-based route generation is used in `src/routes` and `src/routeTree.gen.ts`. | A server-rendered framework such as Next.js could provide routing and server actions, but would not remove the need for browser-side recording and a local FastAPI integration. | Two runtimes must be coordinated: the Vite/TanStack app and the Python server. |
| UI components | Radix UI primitives, Tailwind CSS, `lucide-react`, local `src/components/ui` wrappers | Accessible interactive controls and a consistent review workspace are already scaffolded. | A larger component framework could reduce local component code, but would add another styling system and is unnecessary for the existing screens. | The README should not treat every generated UI primitive as domain architecture; most are presentation components. |
| Client state | A custom external store using `useSyncExternalStore` | The domain model is small: an in-memory list of `Note` objects with update helpers. The store centralizes edits and best-effort local-backend synchronization. | Redux would add reducers, actions, and configuration. Zustand would be a reasonable alternative, but the current store has no extra state library dependency. | State is not durable by itself. If the backend is unavailable, the UI can show local changes that have not been persisted. |
| Local API | FastAPI + Uvicorn + Pydantic request models | Python is already the language of the local audio, NLP, LLM, and database services. FastAPI provides typed request parsing and a small HTTP surface. | Flask would also work but would provide less structure for this typed API. Django would be more framework than this local service needs. | CORS is permissive and the endpoints have no application authentication. |
| Local persistence | SQLite + SQLAlchemy | A single-file database is convenient for a workstation workflow and avoids a separate database service. SQLAlchemy keeps the model relationships and CRUD code explicit. | Postgres would be better for multi-user concurrency and centralized operations, but would add a server and does not match the local-first backend path. MongoDB would weaken the relational links between consultation, note, transcript, and audit log. | SQLite is not encrypted in this repository and is not a multi-user server database. |
| Local speech-to-text | Faster-Whisper with optional model sizes; FFmpeg normalization | The code accepts browser recordings, converts them when possible, and caches the Whisper model. This keeps inference in the Python process and avoids a network STT dependency in the primary path. | A hosted STT API would simplify model operations but would send audio outside the local process. Pyannote is listed in `backend/requirements.txt`, but the active transcription code does not import it; speaker assignment is heuristic instead. | Model startup and CPU/GPU availability affect latency. Heuristics can assign speakers incorrectly. |
| PII redaction | Microsoft Presidio when import/model setup succeeds, otherwise regex fallback | Presidio handles configured entity types (`PERSON`, `PHONE_NUMBER`, `EMAIL_ADDRESS`, `DATE_TIME`, `LOCATION`). The fallback keeps the pipeline usable when Presidio is unavailable. | A cloud DLP/medical NLP service would require externalizing transcript text. A regex-only solution is cheaper but less capable, so it is only the fallback. | The fallback covers a narrow set of patterns and is not a compliance guarantee. The stored local transcript is still the raw transcript; redaction is applied before the Ollama prompt. |
| Local note generation | Ollama HTTP API, Pydantic `ClinicalNoteSchema`, deterministic fallback | The local backend can ask an installed local model for six JSON sections, validate the result, and continue when Ollama is unavailable or returns invalid JSON. | A hosted LLM would usually have stronger model availability but would conflict with the local processing goal. Direct Transformers inference would require more model-loading and hardware code than this small Ollama adapter. | Output quality depends on the local model. The fallback is predictable but much less expressive than an LLM. |
| Workflow orchestration | LangGraph `StateGraph` in `backend/services/workflow.py`, with a direct sequential fallback | Named nodes make the clinical stages inspectable and allow conditional exits after transcription and redaction. The fallback lets the endpoint run if LangGraph is missing or graph invocation raises. | A plain function chain would be shorter for the current linear path. LangGraph is useful if the conditional branches and review states grow, but the current graph does not yet use persistence or a tool-calling agent loop. | The graph and the main `/api/transcribe` pipeline are separate execution paths, which creates maintenance drift. |
| Hosted integration | Supabase Edge Functions, Supabase Storage/Postgres/RLS/Realtime, AssemblyAI, Groq | These files provide an asynchronous hosted design: storage-backed audio, third-party diarized transcription, server-side note generation, row-level policies, and status updates. | The local FastAPI path avoids the hosted dependencies. The project currently contains both rather than one selected system. | Two schemas, two persistence systems, two STT/LLM providers, and two status vocabularies must be reconciled before they can be one product. |
| Export | `jspdf` in `src/lib/export.ts` plus browser Blob download for Markdown | Export can happen after review without another server endpoint. | Server-side document generation would make output more uniform across clients, but would add an API and server-side font/layout concerns. | Export is a client-side snapshot of the current in-memory note. |

### Authentication and authorization

The current frontend login is a local profile switch, not Supabase authentication. `src/lib/auth.tsx` creates a clinician object, stores it in `localStorage` under `verifact_local_doctor`, and uses a generated local ID. The default profile is `local-doctor-001`. The local FastAPI routes do not validate this ID, attach it to database writes, or enforce per-user access.

The Supabase migration defines `auth.users` foreign keys and RLS policies for `patients`, `consultations`, and `notes`, and scopes storage paths to the authenticated user ID. Those protections apply to the Supabase schema and functions, not automatically to the SQLite API.

## Repository map

| Path | Responsibility |
| --- | --- |
| `src/routes/consultations.new.tsx` | Records browser audio, loads sample/random cases, posts recordings to the local `/api/transcribe` route, and navigates to the review workspace. |
| `src/routes/notes.$noteId.tsx` | Review editor, transcript correction, ICD-10 attachment, risk/evidence/completeness panels, regeneration request, sign-off, and export controls. |
| `src/lib/store.ts` | `Note`/transcript types, external store, optimistic edits, and best-effort calls to local consultation endpoints. |
| `src/lib/auth.tsx` | LocalStorage-based clinician session and route-facing auth context. |
| `src/lib/mock-data.ts`, `src/lib/mock-cases.ts` | Seed/demo note data and sample cases used when demonstrating the UI. |
| `src/lib/export.ts` | Markdown and PDF document creation in the browser. |
| `src/router.tsx`, `src/start.ts`, `src/server.ts` | TanStack Router/Start setup and SSR error normalization. |
| `backend/main.py` | FastAPI application, HTTP endpoints, database reads/writes, and local pipeline coordination. |
| `backend/database.py` | SQLite engine, WAL/NORMAL pragmas, runtime directories, and additive schema backfill. |
| `backend/models.py` | SQLAlchemy models for patients, consultations, transcripts, clinical notes, and audit logs. |
| `backend/services/workflow.py` | The explicit LangGraph state, nodes, conditional routers, graph compilation, and sequential fallback. |
| `backend/services/transcription.py`, `audio.py` | Faster-Whisper model cache, FFmpeg normalization, VAD parameters, timestamps, and speaker heuristics. |
| `backend/services/redaction.py` | Presidio initialization and regex fallback. |
| `backend/services/llm.py` | Ollama discovery/call, Pydantic note validation, prompt version, and deterministic note fallback. |
| `backend/services/medical_knowledge.py` | In-repository ICD-10 and medication datasets plus substring/keyword matching. |
| `backend/services/clinical_rules.py` | Keyword-based clinical warning rules and severity aggregation inputs. |
| `backend/services/evidence.py`, `completeness.py`, `medication_verification.py`, `differential.py` | Deterministic enrichment and review signals. |
| `backend/services/evaluation.py` | Three synthetic cases and the evaluation report returned by `/api/eval/run`. |
| `backend/test_clinical_pipeline.py` | Pytest coverage for workflow execution, enrichment helpers, dataset search, and evaluation output. |
| `backend/prompts/v1_discharge.json` | Prompt/configuration artifact for discharge-note generation. |
| `backend/templates/cura-discharge.json` | Template metadata loaded by the local API. |
| `supabase/migrations/20260730000000_init_schema.sql` | Hosted schema, RLS policies, private storage bucket, and Realtime publication. |
| `supabase/functions/transcribe-consult/index.ts` | AssemblyAI submission/polling, A/B speaker mapping, transcript persistence, and note-function invocation. |
| `supabase/functions/generate-note/index.ts` | Groq call, six-key JSON validation/retry, note insert, and status update. |
| `Dockerfile`, `docker-compose.yml`, `start-local.sh` | Local Python container and convenience startup definitions. |

## How one local request moves through the system

This is the path implemented by the main “New Consultation” screen.

1. The user enters a patient name, MRN, and consultation type in `consultations.new.tsx`.
2. The browser requests microphone permission and records `audio/webm`, `audio/mp4`, or the first supported browser format through `MediaRecorder`.
3. On stop, the browser creates a `FormData` request and sends the recording plus metadata to `POST http://localhost:8000/api/transcribe`.
4. FastAPI writes the upload under `backend/storage/audio`. If no file was supplied, the endpoint writes placeholder bytes; that is useful for a smoke path but is not real transcription input.
5. `normalize_audio_ffmpeg` attempts to produce a 16 kHz mono WAV. `transcribe_audio` loads a cached Faster-Whisper model, enables VAD filtering, and emits timestamped segments.
6. Each segment receives a speaker label. A trailing question mark, patient first-person markers, the previous question, and doctor markers influence `_infer_speaker`; ambiguous text retains the current speaker.
7. The full transcript is passed to `redact_pii`. Presidio is attempted once and cached; if it is unavailable or errors, regex rules replace selected title/name, phone, and MRN patterns.
8. The consultation and the raw transcript/segment JSON are persisted in SQLite. The raw transcript is kept for the local review experience; the redacted string is the one passed to the local LLM call.
9. `generate_clinical_note` asks Ollama for JSON matching six keys. The response is validated with `ClinicalNoteSchema`; invalid, unavailable, or timed-out output goes to `_dynamic_nlp_note_generator`.
10. The backend computes ICD-10 matches, medication suggestions, clinical risk results, differential pinpoints, and creates the clinical note and initial audit entry. The consultation is moved to `review`.
11. The response returns the consultation ID, transcript segments, redacted transcript, note sections, and enrichment arrays. The browser converts that payload to its `Note` shape and inserts it into the custom external store.
12. The review page can load the persisted detail again, edit sections/transcript, attach ICD-10 codes or prescriptions, and sign the note. Edits and sign-off are sent back to SQLite on a best-effort basis.
13. Markdown and PDF exports are generated in the browser. The sign endpoint records `signed`, review seconds, signed time, note status, and an audit event.

### What the local endpoint does not do

`POST /api/transcribe` does not call `run_clinical_workflow`. It runs a similar set of operations directly in `backend/main.py`. The LangGraph implementation is exercised by the separate `POST /api/consultations/workflow` endpoint. This is a key distinction when reading logs, tests, or performance results.

## How the AI agent works — explained from first principles

### The basic concepts

An LLM is a model that predicts and generates text from text input. In this repository, Ollama can expose a local model over HTTP, while the hosted Edge Function asks Groq for a hosted model response.

An AI agent is a program that can choose and perform actions toward a goal. A simple text generator only receives a prompt and returns text. An agentic system usually has state, decisions, and tools or services that it can call. Verifact’s current local graph is better described as a typed workflow with LLM generation than as a free-form autonomous agent: the code chooses the next fixed stage, and each stage calls a specific Python service.

Tool calling means asking a model to select a named function and arguments, letting the application run that function, and then giving the result back to the model. The current repository does not implement model-driven tool selection. Its service calls are explicit Python calls such as `auto_match_icd10_codes(...)` and `analyze_clinical_risks(...)`.

A workflow or graph is a set of steps connected by transitions. A state is the shared record carried between steps. A node is one operation that reads and updates state. An edge says what node comes next. A router is a function that selects an edge based on state. A checkpoint is a saved copy of state that allows a workflow to resume or be inspected later. `backend/services/workflow.py` has a state object and graph nodes, but it does not configure a LangGraph checkpointer; persistence is handled separately by SQLite in the FastAPI endpoints.

RAG, or retrieval-augmented generation, means retrieving relevant document chunks and putting them into the model prompt before generation. This repository has no vector database, embeddings, chunking pipeline, or RAG retriever. Its evidence feature is a post-generation word-overlap alignment between note sections and transcript segments, not RAG.

An analogy: imagine a medical scribe’s checklist. The checklist has boxes for transcript, redaction, facts, note, codes, risks, evidence, completeness, and review. Each box is a node. The paper passed between boxes is state. A red flag can stop the checklist. In Verifact, the same idea is represented as a Python `TypedDict` and a LangGraph `StateGraph`.

### The actual LangGraph state

The state type is `ClinicalWorkflowState` in `backend/services/workflow.py`. It is initialized in `run_clinical_workflow` and passed to every node.

| Field | Meaning | Writers | Readers / lifecycle |
| --- | --- | --- | --- |
| `session_id` | Workflow identifier supplied by the caller. | Initializer. | Logged by nodes and returned. |
| `patient_id` | Derived `pat-...` identifier. | Initializer. | Available to nodes but not used by the node implementations. |
| `patient_name`, `mrn` | Display metadata. | Initializer. | Available in state; not used by current node logic. |
| `audio_path` | Optional source audio path. | Initializer, always `None` in `run_clinical_workflow`. | `node_transcribe` reads it; therefore the workflow endpoint expects a transcript unless extended. |
| `transcript` | Full unredacted text supplied or transcribed. | Initializer or `node_transcribe`. | Redaction node and downstream state. |
| `speakers` | Timestamped speaker segments. | Initializer or `node_transcribe`. | Medication extraction and evidence grounding. |
| `redacted_transcript` | Transcript after PII sanitization. | `node_redact_phi`. | Note generation, risk analysis, completeness, and routing. |
| `extracted_clinical_facts` | Small summary of extracted facts. | `node_extract_clinical_facts` writes `extracted_med_count`. | Not used by later nodes in the current code. |
| `symptoms` | Intended symptom collection. | Initializer only. | Not populated or read by current nodes. |
| `medications` | Extracted/verified medication records. | `node_extract_clinical_facts`. | Stored in state; not consumed by later graph nodes. |
| `vitals` | Intended vitals collection. | Initializer only. | Not populated by current nodes. |
| `diagnoses` | Intended diagnosis collection. | Initializer only. | Not populated by current nodes. |
| `generated_note` | Note result containing sections and metadata. | `node_generate_clinical_note`. | ICD-10, risk, evidence, completeness, and review nodes. |
| `note_type` | Defaults to `Discharge Summary`. | Initializer. | Not read by current node logic. |
| `icd10_suggestions` | Suggested code objects with confidence/status. | `node_suggest_icd10`. | Returned in final state; no later graph node reads it. |
| `risk_flags` | Alert records from clinical rules. | `node_detect_risks`. | Used by the same node to derive `risk_level`; then available to caller. |
| `risk_level` | Highest detected severity bucket. | Initializer, then `node_detect_risks`. | `node_doctor_review` and caller. |
| `evidence` | Transcript-to-section grounding records. | `node_ground_evidence`. | Returned to caller. |
| `completeness_results` | Completeness checker output. | `node_check_completeness`. | Used to set `completeness_score` and returned. |
| `completeness_score` | Numeric completeness score. | Initializer, then completeness node. | `node_doctor_review` and caller. |
| `review_status` | `needs_review`, `high_priority`, `ready_for_approval`, or `finalized`. | Initializer, `node_doctor_review`, and `node_finalize_document`. | Returned to caller; not written to SQLite by the graph endpoint. |
| `doctor_edits` | Placeholder for clinician changes. | Initializer only. | Not populated by current nodes. |
| `audit_events` | In-memory step completion records. | Every node appends an event. | Returned to caller; separate API code writes SQL audit rows. |
| `final_document` | Placeholder finalized-document payload. | `node_finalize_document`. | Not reached by the compiled graph’s current edges or the sequential fallback. |
| `errors` | Error strings that affect early routing. | `node_transcribe`, `node_redact_phi`; initializer. | `route_after_transcription` checks it. |
| `current_node` | Last node name for observability. | Every node. | Returned to caller. |

Several fields are intentionally present for a broader workflow shape but are not populated yet. In particular, this is not a hidden memory system: there is no checkpointer and no graph-level durable state.

### Nodes and transitions

| Node | Reads | Writes | Previous / next | Why separate |
| --- | --- | --- | --- | --- |
| `transcribe` | `audio_path`, `transcript`, `session_id` | `current_node`, `transcript`, `speakers`, `errors`, `audit_events` | Entry node; routes to `redact_phi` or `END` | Keeps audio-to-text concerns separate from text privacy processing. |
| `redact_phi` | `transcript` | `current_node`, `redacted_transcript`, `errors`, `audit_events` | After successful transcription; routes to `extract_clinical_facts` or `END` | Establishes a privacy boundary before downstream generation. |
| `extract_clinical_facts` | `speakers` | `medications`, `extracted_clinical_facts`, audit/current node | `redact_phi` -> `generate_clinical_note` | Keeps medication verification separate from note generation. |
| `generate_clinical_note` | `redacted_transcript` | `generated_note`, audit/current node | -> `suggest_icd10` | Isolates probabilistic/LLM output from deterministic enrichment. |
| `suggest_icd10` | `generated_note.sections.diagnosis` | `icd10_suggestions`, audit/current node | -> `detect_risks` | Code suggestions can be reviewed independently of note generation. |
| `detect_risks` | `redacted_transcript`, diagnosis section | `risk_flags`, `risk_level`, audit/current node | -> `ground_evidence` | Safety signals need a distinct rule-engine boundary. |
| `ground_evidence` | `speakers`, generated sections | `evidence`, audit/current node | -> `check_completeness` | Creates traceable transcript links after content exists. |
| `check_completeness` | generated sections, redacted transcript | `completeness_results`, `completeness_score`, audit/current node | -> `doctor_review` | Separates missing-information checks from risk checks. |
| `doctor_review` | `risk_level`, `completeness_score` | `review_status`, audit/current node | Terminal in the currently compiled graph | Converts machine checks into review priority. |
| `finalize_document` | State metadata | `review_status=finalized`, `final_document`, audit/current node | Defined but not connected | Intended for approval sealing, but it is not part of the current executed graph. |
| `export_pdf` | State metadata | audit/current node | Defined but not connected | Defined as a workflow stage, while actual PDF export is implemented in the browser. |

The conditional routers are:

- `route_after_transcription`: if `errors` is non-empty, return `error_exit`/`END`; otherwise go to `redact_phi`.
- `route_after_redaction`: if `redacted_transcript` is empty, return `error_exit`/`END`; otherwise go to `extract_clinical_facts`.

The fixed edges after redaction are:

```text
extract_clinical_facts
  -> generate_clinical_note
  -> suggest_icd10
  -> detect_risks
  -> ground_evidence
  -> check_completeness
  -> doctor_review
```

`finalize_document` and `export_pdf` are registered nodes but have no incoming edges in `create_clinical_graph`. The direct fallback runner also stops after `node_doctor_review`. Therefore the README should not describe the current LangGraph endpoint as producing a finalized/exported document.

### Tools and service calls

There are no model-selected tools or ReAct loop in the current implementation. The workflow performs ordinary Python function calls:

| Service call | Purpose | Inputs | Output / state effect | Failure behavior |
| --- | --- | --- | --- | --- |
| `transcribe_audio` | Convert audio to text and timestamped segments. | Audio path, first speaker, model name. | Full transcript and segment list. | Logs the error and returns a “no clear audio” fallback segment. |
| `redact_pii` | Replace configured PII. | Transcript string. | Redacted text and redaction metadata. | Presidio errors fall back to regex. |
| `extract_and_verify_medications` | Compare medication mentions in speakers and treatment text. | Speaker segments and treatment text. | Medication records, including discrepancy information. | Normal Python exceptions propagate to the caller/node. |
| `generate_clinical_note_fast` / `generate_clinical_note` | Produce six note sections. | Redacted transcript and optional template config. | Structured note, sections, model, prompt version. | Ollama or validation failures use deterministic fallback in the full generator; the fast path is deterministic. |
| `auto_match_icd10_codes` | Match diagnosis/text against the local reference dataset. | Transcript/diagnosis text. | Code suggestion records. | Dataset lookup is local; missing matches produce an empty list. |
| `auto_suggest_prescriptions` | Match medication/indication terms against the local medication dataset. | Transcript/diagnosis text. | Prescription suggestions. | Missing matches produce an empty list. |
| `analyze_clinical_risks` | Apply keyword/rule alerts and severity. | Transcript and diagnosis text. | Alert records. | No external call; rule errors are ordinary exceptions. |
| `extract_grounded_evidence` | Align note claims with speaker text by word overlap. | Segments and note sections. | Evidence records with grounding status. | No retrieval service is used. |
| `check_clinical_completeness` | Check note sections and transcript for expected clinical information. | Sections and transcript. | Score and missing-field results. | No external call. |
| `generate_differential_details` | Create deterministic differential pinpoints from text/rules. | Transcript and diagnosis. | Differential records. | No external call. |

Because the model is never asked to select one of these services, the system has no tool-selection accuracy metric and no agent reasoning/action/result loop to explain. The safe architectural description is “fixed workflow plus an LLM generation node.”

## Supabase path, from request to response

The hosted functions implement a different lifecycle:

1. A consultation row contains an `audio_url` pointing to the private `consult-audio` bucket.
2. `transcribe-consult` creates a service-role Supabase client and generates a one-hour signed storage URL.
3. It submits that URL to AssemblyAI with speaker labels and `speakers_expected: 2`.
4. It polls up to 60 times at 10-second intervals, so its maximum polling window is about 10 minutes.
5. It maps AssemblyAI speakers A/B to `DOCTOR`/`PATIENT`: first speaker is the doctor unless the other speaker asks more than twice as many questions.
6. It writes `transcript_json` and status `processing` to Supabase, then invokes `generate-note`.
7. `generate-note` formats the labeled transcript, calls Groq’s OpenAI-compatible endpoint with `llama-3.3-70b-versatile`, requires a JSON object, and validates exactly six non-empty string fields.
8. If validation fails once, it retries with a stricter prompt. A second failure returns HTTP 500; the best-effort error path attempts to set the consultation back to `draft`.
9. On success it inserts a `notes` row and updates the consultation to `draft`.

This path sends audio to AssemblyAI and transcript text to Groq. It is therefore not equivalent to the local FastAPI/Ollama path and should not be described as zero-cloud processing.

## Persistence and state transitions

### Local SQLite model

The local schema contains:

- `patients`: optional patient records with name, MRN, demographics, and a relationship to consultations.
- `consultations`: patient metadata, status, risk level, completeness score, audio path, review time, and sign time.
- `transcripts`: one raw transcript plus JSON speaker segments per consultation.
- `clinical_notes`: generated text, current sections, original generated sections, ICD-10, prescriptions, evidence, completeness, medication, risk, and diff JSON fields, plus edit counts and status.
- `audit_logs`: consultation, user, field, old/new values, action type, and timestamp.

`database.py` enables SQLite WAL mode and `synchronous=NORMAL`. It also calls `Base.metadata.create_all()` and then performs additive column checks. This is a lightweight compatibility helper, not a full migration system: it skips required columns that cannot be safely added and does not version schema changes.

The local status lifecycle intended by the models is:

```text
recording -> processing -> review -> signed -> exported
```

The current local API creates a consultation, persists the transcript and note, sets `review`, and supports `signed`. There is no local API implementation that performs the `exported` state transition; browser export only downloads a file.

### Hosted Supabase model

The SQL migration instead defines UUID `patients`, `consultations`, and `notes` tables tied to `auth.users`, JSONB transcript/note sections, an `audio_url`, statuses `recording | processing | draft | signed`, RLS policies, a private storage bucket, and Realtime publication for `consultations`.

The two stores are not synchronized by any repository code. A record created in SQLite is not automatically visible in Supabase, and vice versa.

## Main technical challenge and how the repository addresses it

### Challenge: two incompatible backend contracts evolved side by side

The most significant repository-level failure mode is integration drift between the local platform and the hosted MVP path. This conclusion is supported by the history and code rather than by an explicit incident report: commit `212c1e4` introduced the Supabase/AssemblyAI/Groq path, and the later platform commits added the local FastAPI/LangGraph/SQLite path. The current frontend sends its primary recording and review requests to FastAPI, while the Supabase functions expect Supabase rows, storage URLs, service-role secrets, and external provider keys.

The problem is difficult because each path is internally understandable but their contracts differ:

- SQLite models use `clinical_notes`, while Supabase uses `notes`.
- The local path uses statuses such as `review`; the hosted path uses `draft`.
- Local transcript segments use `start`/`end`; the hosted function writes `start_ms`.
- Local transcription uses Faster-Whisper and heuristic speaker inference; hosted transcription uses AssemblyAI and a different A/B mapping heuristic.
- Local note generation uses Ollama or a deterministic fallback; hosted generation uses Groq.
- The local login is a LocalStorage profile; the hosted schema is designed around Supabase Auth and RLS.
- The local API stores a raw transcript in SQLite and passes a redacted copy to Ollama; the hosted function sends the audio and transcript through external services.

The issue manifests as documentation and deployment ambiguity more than as one single exception: a reader can follow the local UI and believe the app is completely local, or follow the migration/functions and believe the app is a Supabase product. Either interpretation misses part of the actual repository.

### Approaches considered

The first approach—adding a second implementation without a shared API contract—was insufficient because it duplicated domain concepts without a common source of truth. Keeping both paths can be useful during prototyping, but it increases the chance that a UI change, status change, or field rename updates only one side.

The repository contains several useful containment mechanisms:

- The local backend keeps provider calls behind service modules and falls back from Presidio/Ollama to deterministic logic.
- The frontend keeps failed real recordings in memory and exposes a retry action instead of fabricating a completed clinical note.
- The hosted note function validates the LLM response and retries once.
- Supabase RLS and private storage policies constrain the hosted tables/files by doctor ID.
- The local database stores original generated sections separately from the current edited sections and writes audit events for edits/sign-off.

These measures improve failure handling inside each path, but they do not unify the paths. The architectural issue is therefore only partially addressed in the current repository. A complete fix would select one system of record, define a shared consultation/note contract, choose one auth model, align status and segment schemas, and add contract tests that exercise the chosen end-to-end path. If both backends must remain, the project needs an explicit adapter and a user-visible deployment mode rather than implicit URL selection.

The current test run validates the scope of the remaining problem: four of six backend tests passed, while the LangGraph workflow test failed because `node_suggest_icd10` calls `auto_match_icd10_codes` with one argument even though the service requires two, and the ICD-10 dataset test failed because it references an undefined `meds` variable. These failures were not changed while updating this documentation.

### Other important gaps

- The LangGraph graph registers `finalize_document` and `export_pdf` but does not connect them.
- The main `/api/transcribe` path does not call the LangGraph graph.
- The frontend review screen calls `/api/generate-note`, but the inspected FastAPI file does not define a matching `@app.post("/api/generate-note")` route; regeneration is therefore not a reliable local API operation.
- The local API uses permissive CORS and has no request authentication.
- The UI and export copy describe encryption, cloud absence, and data deletion, but the inspected code does not implement SQLite encryption, authenticated local API access, automatic audio deletion after sign-off, or a deletion workflow.
- The fallback PII scanner is intentionally narrow and must not be treated as a compliance boundary.

## How the system is evaluated

### What is implemented today

`backend/services/evaluation.py` defines three de-identified synthetic cases: chest pain/ACS, appendicitis, and asthma exacerbation. `GET /api/eval/run` runs a fixed sequence of redaction, deterministic note generation, completeness, risk rules, and evidence alignment. The report includes:

- Average section completeness.
- Risk alert recall over the three cases.
- A proxy PHI-redaction pass rate.
- Evidence grounding rate and unsupported-claim rate.
- Per-case completeness, first risk title, and grounded-claim counts.

The report also returns `medication_extraction_accuracy: 96.4%` and `icd10_suggestion_accuracy: 95.0%` as fixed strings in the source. They are not calculated from the three-case loop, so they must not be presented as measured benchmark results.

`backend/test_clinical_pipeline.py` contains tests for workflow execution, evidence grounding, completeness, medication verification, dataset lookup, and the evaluation suite. The tests are useful regression checks, but they are not a broad clinical validation set.

### Metrics that fit this architecture

| Metric | What it measures and why it matters | Calculation / instrumentation | Interpretation |
| --- | --- | --- | --- |
| Note schema validity | Whether the LLM returns all six required non-empty fields. | `valid_responses / total_generation_attempts`; instrument `backend/services/llm.py` and `generate-note/index.ts` around parse/validation and retry. | A low rate indicates prompt/model instability and more fallback or failed requests. |
| Section completeness | Whether expected note information is present. | Already calculated by `check_clinical_completeness`; report mean and per-section missing rates from `/api/consultations/{id}` and `/api/eval/run`. | A high score is useful only if the checker correlates with clinician judgment; a high score with missing critical facts indicates a weak checker. |
| Risk recall | How often known high-risk synthetic cases trigger a matching severity. | `cases_with_expected_alert / total_expected_alert_cases`; the current suite computes this approximately through `risk_recalled / total_tests`. | Low recall is a safety concern. A high rate on three cases is not evidence of clinical safety. |
| Evidence grounding rate | Fraction of generated claims that the word-overlap aligner marks as supported by a transcript segment. | `grounded_evidence_items / total_evidence_items`; instrument `extract_grounded_evidence`. | A low value suggests unsupported or poorly aligned text, but the heuristic can miss valid paraphrases. |
| Physician edit rate | How often and how extensively clinicians change AI sections. | `notes_with_edits / reviewed_notes`, and `changed_sections / total_sections`; local fields exist in `edit_count`, `raw_generated_sections_json`, and audit rows. | High edits can mean poor generation or healthy review discipline; pair it with clinician quality judgments. |
| Sign-off completion rate | Fraction of started consultations reaching `signed`. | `signed_consultations / consultations_started`; instrument status transitions in `main.py` and frontend lifecycle. | Low completion can indicate workflow friction, failures, or abandonment. |
| End-to-end latency | Time from upload/submit to note available for review. | Add timestamps around browser submit, `/api/transcribe`, STT, generation, enrichment, and database commit; the current code has no complete latency record. | Separate cold model startup from warm requests before comparing. |
| Component latency | Time spent in STT, redaction, LLM, rules, and database operations. | Add structured timers in `transcription.py`, `redaction.py`, `llm.py`, enrichment helpers, and `main.py`. | Shows whether CPU inference, model startup, external polling, or storage is the bottleneck. |
| Workflow failure rate | Requests that return an error or leave a non-terminal status. | `failed_requests / started_requests`; use HTTP errors, logged exceptions, and status transitions. | High values indicate reliability problems even when individual notes look good. |
| Tool/service failure rate | Failures for Ollama, Presidio, FFmpeg, AssemblyAI, or Groq. | Count exceptions and fallback activations at each adapter. | A rising fallback rate can hide degraded quality, so it should be visible rather than treated as success only. |
| Retry rate | Fraction of hosted LLM generations needing the second prompt. | `retry_attempts / generation_attempts` in `generate-note`. | High retry rate signals output-format instability or prompt/model mismatch. |
| Cost per hosted request | External provider cost for the Supabase path. | Record AssemblyAI duration and Groq tokens/requests; the current code does not record provider usage. | Useful only for the hosted path; local Ollama cost is primarily hardware/time and is not an API bill. |
| Tokens per note | Prompt/completion size for hosted generation. | Store provider usage metadata where returned; not implemented today. | Helps explain cost and latency changes. |
| Review abandonment | Consultations started but neither signed nor explicitly discarded. | Add a terminal/abandoned event and compare with `recording`/`processing`/`draft` records. | Shows product friction and may also reveal backend hangs. |

### Metrics that do not currently apply

There is no semantic-search or vector retrieval implementation, so retrieval precision/recall and RAG relevance are not currently measurable. There is no model-selected tool call, so tool-selection accuracy is not currently measurable. A claim-level groundedness score from `evidence.py` is a lightweight post-generation heuristic, not a validated faithfulness metric.

### Evaluation cautions

- The synthetic suite is only three cases and is not representative of clinical language, accents, recording quality, demographics, or specialty variation.
- The PHI check currently verifies that “sharma” is absent from the redacted result; it does not prove complete PHI recall.
- The hard-coded medication and ICD-10 percentages should be removed or replaced with calculations tied to labeled expected outputs.
- A test that passes means the code matched the fixture, not that a clinical note is safe to use without review.

## Practical end-to-end walkthrough

Suppose a clinician records: “The patient has severe chest pain radiating to the left arm.”

1. The clinician enters metadata and clicks Start Recording.
2. The browser records microphone chunks with `MediaRecorder` and tracks elapsed time/audio level.
3. Stop creates a multipart request to local FastAPI with the audio and metadata.
4. FastAPI writes the audio to `backend/storage/audio` and attempts FFmpeg normalization.
5. Faster-Whisper returns text segments and timestamps. The speaker heuristic labels the segments based on question/first-person/doctor markers and the selected initial speaker.
6. The redaction service scans the full transcript. The redacted version is used for note generation; the local SQLite transcript record remains the raw transcript plus segment JSON.
7. Ollama is queried for six JSON fields. If Ollama is unavailable, returns invalid JSON, or times out, the local deterministic fallback creates sections from recognized clinical terms.
8. The local backend matches ICD-10 and medications, checks clinical rules, derives differentials, and saves the consultation/note/audit row.
9. The endpoint returns the note payload. The frontend maps it into its `Note` type and routes to `/notes/{id}`.
10. The clinician can correct speaker labels or note text. Each store helper updates the UI immediately and sends a best-effort PUT to FastAPI.
11. The review page displays transcript evidence, completeness, risk, and medication panels. These panels are review aids, not an autonomous approval gate.
12. On approval, the frontend calls `/api/consultations/{id}/sign` with elapsed review seconds. FastAPI sets consultation and note status to `signed`, stores the timestamp, and adds a `SIGN` audit event.
13. The clinician can export the current note as Markdown or PDF from the browser.

The explicit LangGraph endpoint would be a different walkthrough: the caller posts an already available transcript and speaker list to `/api/consultations/workflow`; the graph runs transcription/redaction/facts/generation/enrichment/review nodes and returns in-memory state. It does not persist the graph state or execute the unconnected finalize/export nodes.

## Running the project locally

### Prerequisites

- Node.js and npm compatible with the package lock.
- Python 3.10 or a compatible Python version for the backend. The Dockerfile uses Python 3.10.
- FFmpeg on the host if local audio normalization is required outside Docker.
- An Ollama installation and a compatible local model are optional. The backend defaults to `llama3.2:3b` if it cannot discover a preferred model; it falls back to deterministic note generation when Ollama is unavailable.
- Presidio and its NLP model are optional at runtime because the code falls back to regex redaction, although installing `backend/requirements.txt` is the intended setup.

### Frontend

```bash
npm install
npm run dev
```

The Vite/TanStack development server is configured by `vite.config.ts`. The frontend’s local API calls are hard-coded to `http://localhost:8000/api` in the inspected source.

### Local FastAPI backend

In a second terminal:

```bash
python -m venv backend/venv
# Windows PowerShell
backend\\venv\\Scripts\\Activate.ps1
pip install -r backend/requirements.txt
uvicorn --app-dir backend main:app --reload --port 8000
```

The repository also includes `start-local.sh` and an npm `dev:all` script for POSIX-style environments. The script creates `backend/venv`, installs Python dependencies, starts Uvicorn, and then starts the frontend.

The local API exposes interactive FastAPI documentation at `/docs` while it is running. Useful smoke endpoints are:

```text
GET  http://localhost:8000/api/health
GET  http://localhost:8000/api/consultations
GET  http://localhost:8000/api/eval/run
POST http://localhost:8000/api/consultations/workflow
```

### Tests and checks

```bash
npm run build
npm run lint
pytest backend/test_clinical_pipeline.py
```

The Python tests require the backend dependencies and should be run with the repository root/import layout expected by the test file. The repository does not include a browser end-to-end test suite, provider mocks, schema contract tests between the local and hosted paths, or measured performance benchmarks.

### Docker

`Dockerfile` builds only the Python backend, installs FFmpeg and `backend/requirements.txt`, copies `backend/`, and serves Uvicorn on port 8000. `docker-compose.yml` mounts `backend/data` and `backend/storage` and passes `OLLAMA_MODEL`; it does not define an Ollama service or the frontend service.

## Security, privacy, and operational limitations

The local path can keep inference inside the workstation when Faster-Whisper, Presidio, and Ollama are installed locally. That is an architectural option, not proof of DPDP/HIPAA compliance. The repository does not implement a compliance certification boundary.

Specific limitations visible in code:

- Local FastAPI CORS allows all origins and the local API has no authentication or authorization checks.
- The local clinician session is a browser LocalStorage profile and is not a verified identity.
- SQLite data is not encrypted at rest by the inspected code.
- Raw transcripts are stored locally in `transcripts.raw_text`; redaction protects the local LLM prompt, not the database file.
- The regex fallback does not recognize all names, identifiers, locations, or clinical PHI.
- The hosted Edge Functions send audio to AssemblyAI and transcript text to Groq, so the hosted path has a different privacy boundary.
- Service-role keys are read inside Edge Functions, which is appropriate for server-side code, but deployment secret management is outside this repository.
- No automatic deletion of audio after sign-off is implemented in the local backend.
- A signed local note is locked in the editor by status, but the API does not enforce a general “no edits after signing” rule on every update route.

For real clinical deployment, the project would need a deliberate data-residency decision, authenticated users, authorization on every API/database operation, encrypted storage, robust PHI handling, provider agreements where hosted services are used, audit-log hardening, retention/deletion policies, backup/recovery procedures, and clinical validation.

## Engineering takeaways

1. The project separates browser capture/review from Python clinical-processing services.
2. The local note path has an explicit validation boundary: Ollama output must match a six-field Pydantic schema, with a deterministic fallback when it does not.
3. The local backend preserves original generated sections separately from clinician-edited sections and records edit/sign events.
4. The LangGraph workflow makes the intended clinical stages and early error routes inspectable, even though the main transcription endpoint currently bypasses it.
5. Clinical review is supported by multiple deterministic signals—ICD-10 matching, medication checks, rule-based risks, evidence alignment, and completeness checks—rather than by a single LLM response alone.
6. The frontend keeps real recording failures retryable and avoids fabricating a completed note when the local pipeline fails.
7. The repository demonstrates an important engineering lesson: parallel local and hosted implementations need shared contracts, explicit deployment modes, and end-to-end tests or they become difficult to reason about.

## Documentation gaps and source-of-truth notes

This README intentionally does not claim production readiness, measured latency, clinical accuracy, encryption, or complete privacy compliance because the repository does not provide evidence for those claims. It also does not describe RAG, ReAct, model-selected tools, LangGraph checkpointing, or a fully connected finalize/export graph because those mechanisms are not implemented in the inspected code.

The most reliable way to understand behavior is to follow the actual caller chain: `src/routes/consultations.new.tsx` -> `backend/main.py` -> the service modules -> SQLite -> `src/lib/store.ts` -> `src/routes/notes.$noteId.tsx`. The Supabase migration and Edge Functions describe a separate integration that requires explicit wiring and deployment configuration before it is the same application path.
