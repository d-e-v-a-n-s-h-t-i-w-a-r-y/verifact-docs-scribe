import { type Note, getState, setState } from "./store";

const seedNotes: Note[] = [
  {
    id: "n-001",
    patientName: "Ananya Krishnan",
    mrn: "MRN-48213",
    consultTime: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
    type: "Discharge Summary",
    status: "pending",
    editedFields: {},
    editsCount: 0,
    sections: {
      chiefComplaint:
        "Progressive shortness of breath and bilateral pedal edema over the past 10 days.",
      hpi:
        "62-year-old female with known hypertension and type 2 diabetes mellitus presented with a 10-day history of exertional dyspnea, orthopnea, and paroxysmal nocturnal dyspnea. Patient reports 4 kg weight gain over the same period and worsening bilateral lower-limb swelling. No chest pain, syncope or palpitations. Medication compliance has been inconsistent over the last month due to family bereavement.",
      examination:
        "Alert, oriented, in mild respiratory distress. BP 158/94 mmHg, HR 102 bpm regular, RR 22, SpO2 93% on room air. JVP elevated to 8 cm. Bilateral basal crepitations on auscultation. S3 gallop present. Pitting edema to mid-shin bilaterally. Abdomen soft, mild hepatomegaly.",
      diagnosis:
        "1. Acute decompensated heart failure (HFrEF, EF 32% on TTE)\n2. Hypertension — poorly controlled\n3. Type 2 diabetes mellitus\n4. Medication non-adherence",
      treatment:
        "IV furosemide 40 mg BD, oral ramipril 5 mg OD, bisoprolol 2.5 mg OD, spironolactone 25 mg OD, empagliflozin 10 mg OD. Fluid restriction 1.5 L/day, low-sodium diet. Daily weights charted. Patient counselled on medication adherence and salt intake.",
      followUp:
        "Cardiology OPD in 2 weeks. Repeat echocardiogram in 3 months. Home BP diary. Return immediately if worsening dyspnea, chest pain or weight gain >2 kg in 3 days.",
    },
    transcript: [
      { speaker: "DOCTOR", time: "00:02", text: "Good morning, Mrs Krishnan. How have things been since we last spoke?" },
      { speaker: "PATIENT", time: "00:07", text: "Not great, doctor. The breathlessness is worse. I can't sleep flat anymore — I've been using three pillows." },
      { speaker: "DOCTOR", time: "00:18", text: "And the swelling in your feet — has that changed?" },
      { speaker: "PATIENT", time: "00:22", text: "Much worse. My shoes don't fit. And I've put on almost four kilos in a week and a half." },
      { speaker: "DOCTOR", time: "00:31", text: "Any chest pain, palpitations, or dizzy spells?" },
      { speaker: "PATIENT", time: "00:35", text: "No chest pain. Just very tired and short of breath even walking to the bathroom." },
      { speaker: "DOCTOR", time: "00:44", text: "Have you been taking your medications regularly?" },
      { speaker: "PATIENT", time: "00:48", text: "Honestly, no. Since my sister passed I've missed a lot of doses. Sometimes days at a time." },
      { speaker: "DOCTOR", time: "01:02", text: "That's likely a big part of what's going on. We'll admit you, get the fluid off with IV diuretics, and restart your heart failure medications properly." },
      { speaker: "PATIENT", time: "01:14", text: "How long will I be in?" },
      { speaker: "DOCTOR", time: "01:17", text: "Usually three to five days once we see good diuresis and your weight stabilises." },
    ],
  },
  {
    id: "n-002",
    patientName: "Rohit Menon",
    mrn: "MRN-51907",
    consultTime: new Date(Date.now() - 1000 * 60 * 95).toISOString(),
    type: "OPD Note",
    status: "pending",
    editedFields: {},
    editsCount: 0,
    sections: {
      chiefComplaint: "Recurrent epigastric pain and early satiety for 6 weeks.",
      hpi:
        "34-year-old male, non-smoker, occasional alcohol, presents with burning epigastric pain worse after meals, associated with nausea and a sensation of fullness after small quantities of food. No hematemesis, melena or weight loss. NSAID use for chronic low back pain (self-medicated) over the last 3 months.",
      examination:
        "Well, afebrile. Vitals stable. Abdomen soft, mild epigastric tenderness, no guarding or rebound. No organomegaly. Bowel sounds normal.",
      diagnosis: "1. NSAID-induced gastritis, likely peptic ulcer disease — for OGD\n2. Chronic mechanical low back pain",
      treatment:
        "Stop all NSAIDs. Start pantoprazole 40 mg OD before breakfast for 8 weeks. Sucralfate 1 g QDS for 4 weeks. H. pylori stool antigen sent. Referred for OGD. Paracetamol 1 g QDS PRN for back pain, physiotherapy referral.",
      followUp: "Review in 2 weeks with OGD report and H. pylori result. Earlier review if hematemesis, melena or severe pain.",
    },
    transcript: [
      { speaker: "DOCTOR", time: "00:03", text: "Tell me about the pain — where exactly and what does it feel like?" },
      { speaker: "PATIENT", time: "00:08", text: "Right here, in the upper stomach. Burning, especially after I eat." },
      { speaker: "DOCTOR", time: "00:15", text: "How long has this been going on?" },
      { speaker: "PATIENT", time: "00:18", text: "About six weeks now. It's getting more frequent." },
      { speaker: "DOCTOR", time: "00:24", text: "Any painkillers you've been taking regularly?" },
      { speaker: "PATIENT", time: "00:28", text: "Yeah — ibuprofen almost every day for my back. Sometimes twice a day." },
      { speaker: "DOCTOR", time: "00:36", text: "That's very likely the cause. We need to stop those immediately and start you on acid-suppression." },
    ],
  },
  {
    id: "n-003",
    patientName: "Priya Sharma",
    mrn: "MRN-33478",
    consultTime: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    type: "Discharge Summary",
    status: "draft",
    editedFields: {},
    editsCount: 0,
    sections: {
      chiefComplaint: "Fever, productive cough and right-sided chest pain for 4 days.",
      hpi:
        "48-year-old female with well-controlled asthma presented with high-grade fever (max 39.4°C), productive cough with yellow-green sputum, and pleuritic right-sided chest pain. No hemoptysis. Mildly breathless on exertion. No recent travel or sick contacts.",
      examination:
        "Febrile 38.6°C, HR 108, BP 118/72, RR 24, SpO2 94% on room air. Reduced air entry and bronchial breathing right lower zone with coarse crepitations. No wheeze.",
      diagnosis: "1. Community-acquired pneumonia — right lower lobe (CURB-65 score 1)\n2. Bronchial asthma — stable",
      treatment:
        "IV co-amoxiclav 1.2 g TDS switched to oral amoxicillin 1 g TDS on day 3 after clinical improvement. Paracetamol PRN. Chest physiotherapy. Salbutamol nebs PRN. Discharged on oral amoxicillin to complete 7-day course.",
      followUp: "GP review in 1 week. Repeat CXR in 6 weeks to confirm resolution. Return if fever, worsening breathlessness or hemoptysis.",
    },
    transcript: [
      { speaker: "DOCTOR", time: "00:02", text: "How are you feeling today compared to when you came in?" },
      { speaker: "PATIENT", time: "00:06", text: "So much better. The fever's gone and I can actually take a deep breath without the pain." },
      { speaker: "DOCTOR", time: "00:14", text: "Good. Your chest x-ray shows the pneumonia is clearing. We'll switch you to oral antibiotics today and get you home." },
    ],
  },
  {
    id: "n-004",
    patientName: "James O'Connor",
    mrn: "MRN-72104",
    consultTime: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
    type: "Discharge Summary",
    status: "signed",
    editedFields: { treatment: true, followUp: true },
    editsCount: 3,
    reviewSeconds: 214,
    signedAt: new Date(Date.now() - 1000 * 60 * 60 * 22).toISOString(),
    sections: {
      chiefComplaint: "Sudden onset left-sided weakness and slurred speech.",
      hpi:
        "71-year-old male, ex-smoker, known atrial fibrillation on apixaban, presented via ambulance 90 minutes after sudden onset of left facial droop, left arm weakness (MRC 2/5) and dysarthria while watching television. NIHSS 8 on arrival.",
      examination:
        "GCS 15. BP 172/94, HR 88 irregular. Left facial droop, left pronator drift, dysarthria. No visual field defect. Sensation intact.",
      diagnosis: "1. Acute ischaemic stroke — right MCA territory (confirmed on MRI)\n2. Atrial fibrillation — anticoagulated\n3. Hypertension",
      treatment:
        "Thrombolysis with alteplase given at 2h 20min from onset. Admitted to stroke unit. Apixaban held for 24 hours post-thrombolysis then resumed. Amlodipine 5 mg added for BP. Swallow assessment clear. Physiotherapy and OT input daily.",
      followUp: "Stroke clinic in 4 weeks. TIA/stroke secondary prevention counselling completed. Community stroke rehab team to visit within 72 hours of discharge.",
    },
    transcript: [
      { speaker: "DOCTOR", time: "00:04", text: "How's the arm feeling this morning, James?" },
      { speaker: "PATIENT", time: "00:08", text: "Stronger. I can lift it against the pillow now." },
      { speaker: "DOCTOR", time: "00:14", text: "Excellent recovery. Speech is much clearer too." },
    ],
  },
  {
    id: "n-005",
    patientName: "Fatima Al-Rashid",
    mrn: "MRN-89230",
    consultTime: new Date(Date.now() - 1000 * 60 * 60 * 50).toISOString(),
    type: "OPD Note",
    status: "signed",
    editedFields: { hpi: true },
    editsCount: 1,
    reviewSeconds: 168,
    signedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    sections: {
      chiefComplaint: "Routine review — type 2 diabetes.",
      hpi:
        "56-year-old female, T2DM diagnosed 8 years ago, on metformin 1 g BD and gliclazide 80 mg BD. Reports good compliance. No hypoglycaemic episodes. Home glucose 7-9 mmol/L fasting. No polyuria, polydipsia or weight loss. Walks 30 minutes daily.",
      examination: "BMI 27.4. BP 128/78. Feet — sensation intact, pulses palpable, no ulcers. Fundoscopy deferred to annual retinal screen.",
      diagnosis: "1. Type 2 diabetes mellitus — well controlled (HbA1c 6.9%)\n2. Overweight",
      treatment: "Continue current regime. Reinforce dietary and lifestyle advice. Annual bloods, urine ACR and retinal screen due.",
      followUp: "Diabetic nurse review in 3 months. Annual review in 12 months.",
    },
    transcript: [
      { speaker: "DOCTOR", time: "00:02", text: "Your sugars are looking excellent. HbA1c is 6.9." },
      { speaker: "PATIENT", time: "00:07", text: "The walking is really helping. I feel more energetic too." },
    ],
  },
];

let seeded = false;
export function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  if (getState().notes.length === 0) {
    setState(() => ({ notes: seedNotes }));
  }
}
