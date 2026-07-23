import type { NoteSections, NoteType, TranscriptLine } from "./store";

export interface MockCase {
  type: NoteType;
  sections: NoteSections;
  transcript: TranscriptLine[];
}

const OPD_CASES: MockCase[] = [
  {
    type: "OPD Note",
    sections: {
      chiefComplaint: "Recurrent frontal headaches for 3 weeks, worse in the mornings.",
      hpi:
        "29-year-old female, software engineer, presents with a 3-week history of dull, band-like frontal headaches occurring most mornings and easing by mid-afternoon. Rates pain 5/10, no aura, no photophobia, no vomiting. Associated with neck stiffness and long hours at a laptop. Sleep 5–6 hours nightly with irregular schedule. No red-flag features — no thunderclap onset, no focal neurology, no fever, no weight loss. Family history negative for migraine or intracranial pathology.",
      examination:
        "Alert, well. BP 118/74, HR 76, afebrile. Fundoscopy — discs sharp, no papilloedema. Cranial nerves intact. Power 5/5 all limbs, reflexes symmetrical, no cerebellar signs. Tenderness over bilateral trapezius and suboccipital muscles. Neck range of movement mildly reduced on rotation.",
      diagnosis:
        "1. Chronic tension-type headache — postural / ergonomic contribution\n2. Sleep deprivation",
      treatment:
        "Reassurance regarding benign nature. Paracetamol 1 g QDS PRN, limit to <15 days/month to avoid medication-overuse headache. Ergonomic advice — monitor at eye level, hourly micro-breaks. Sleep hygiene counselling, target 7–8 hours. Neck stretches handout provided. Consider physiotherapy if no improvement in 4 weeks.",
      followUp:
        "Review in 4 weeks. Return sooner if new focal symptoms, sudden severe headache, visual disturbance or vomiting.",
    },
    transcript: [
      { speaker: "DOCTOR", time: "00:03", text: "Tell me about the headaches — when did they start?" },
      { speaker: "PATIENT", time: "00:07", text: "About three weeks ago. Almost every morning when I wake up." },
      { speaker: "DOCTOR", time: "00:15", text: "Where exactly, and what does it feel like?" },
      { speaker: "PATIENT", time: "00:19", text: "Across the forehead, like a tight band. Not throbbing." },
      { speaker: "DOCTOR", time: "00:28", text: "Any nausea, visual changes, or sensitivity to light?" },
      { speaker: "PATIENT", time: "00:33", text: "No, nothing like that. My neck feels stiff though." },
      { speaker: "DOCTOR", time: "00:41", text: "How's your sleep and screen time been?" },
      { speaker: "PATIENT", time: "00:45", text: "Terrible. I'm on the laptop till 1 a.m. most nights." },
    ],
  },
  {
    type: "OPD Note",
    sections: {
      chiefComplaint: "Painful right ankle for 2 days following a fall while jogging.",
      hpi:
        "41-year-old male, otherwise well, twisted his right ankle inverting off a kerb 48 hours ago. Immediate pain and swelling over the lateral aspect. Able to weight-bear with a limp. Applied ice and elevation at home. No numbness, no proximal leg pain. No prior ankle injuries.",
      examination:
        "Afebrile. Right ankle — swelling and bruising over the lateral malleolus. Tenderness maximal over the anterior talofibular ligament. No bony tenderness along posterior edge of lateral or medial malleolus. Able to weight-bear four steps. Ottawa ankle rules — no x-ray indicated. Neurovascularly intact.",
      diagnosis: "Grade II lateral ligament sprain, right ankle.",
      treatment:
        "PRICE regime — protection, relative rest, ice 15 min every 2–3 hours, compression bandage, elevation. Ibuprofen 400 mg TDS with food for 5 days. Weight-bear as tolerated. Ankle proprioception exercises handout. Physiotherapy referral if not improved in 2 weeks.",
      followUp: "GP review in 2 weeks. Return earlier if increasing pain, inability to weight-bear, or numbness.",
    },
    transcript: [
      { speaker: "DOCTOR", time: "00:02", text: "How did it happen?" },
      { speaker: "PATIENT", time: "00:05", text: "I stepped off a kerb wrong while jogging. Rolled the ankle inward." },
      { speaker: "DOCTOR", time: "00:14", text: "Can you put weight on it?" },
      { speaker: "PATIENT", time: "00:17", text: "Yes, but it hurts. I'm limping." },
      { speaker: "DOCTOR", time: "00:24", text: "Any numbness or tingling in the foot?" },
      { speaker: "PATIENT", time: "00:28", text: "No, just sore and swollen on the outside." },
    ],
  },
  {
    type: "OPD Note",
    sections: {
      chiefComplaint: "Sore throat and fever for 3 days.",
      hpi:
        "24-year-old female, non-smoker, 3-day history of severe sore throat, odynophagia, and subjective fevers up to 38.8°C. Denies cough, coryza, or rhinorrhoea. Tender neck lumps noted. No rash, no joint pains. No known unwell contacts. Sexually active, monogamous.",
      examination:
        "Temp 38.4°C, HR 96, BP 116/70. Oropharynx — bilateral tonsillar enlargement with white exudate, no asymmetry, no trismus. Tender bilateral anterior cervical lymphadenopathy. Chest clear. Centor score 4/4.",
      diagnosis: "Acute bacterial tonsillitis — probable Group A streptococcal.",
      treatment:
        "Phenoxymethylpenicillin 500 mg QDS for 10 days. Paracetamol 1 g QDS and ibuprofen 400 mg TDS PRN. Adequate oral fluids. Throat swab sent. Safety-net advice given regarding airway compromise.",
      followUp:
        "GP review if not improving at 72 hours, or immediately if drooling, difficulty swallowing saliva, neck swelling, or muffled voice.",
    },
    transcript: [
      { speaker: "DOCTOR", time: "00:03", text: "When did the sore throat start?" },
      { speaker: "PATIENT", time: "00:06", text: "Three days ago. It's really painful to swallow now." },
      { speaker: "DOCTOR", time: "00:14", text: "Any cough or runny nose?" },
      { speaker: "PATIENT", time: "00:17", text: "No, none of that. Just the throat and fevers." },
      { speaker: "DOCTOR", time: "00:24", text: "Let me have a look — open wide, say ahh." },
    ],
  },
];

const DISCHARGE_CASES: MockCase[] = [
  {
    type: "Discharge Summary",
    sections: {
      chiefComplaint: "Severe right-sided abdominal pain and vomiting for 18 hours.",
      hpi:
        "27-year-old male admitted via A&E with an 18-hour history of periumbilical pain migrating to the right iliac fossa, associated with anorexia, nausea, and two episodes of vomiting. No diarrhoea, no urinary symptoms. Underwent laparoscopic appendicectomy on day 1 of admission. Histology confirmed acute suppurative appendicitis without perforation. Uneventful post-operative recovery.",
      examination:
        "On discharge — afebrile, HR 72, BP 122/76. Abdomen soft, non-tender. Laparoscopic port sites clean and dry, no erythema or discharge. Bowel sounds present. Tolerating full diet, passed flatus and stool.",
      diagnosis: "1. Acute appendicitis — laparoscopic appendicectomy, day 3\n2. Post-operative recovery uncomplicated",
      treatment:
        "IV co-amoxiclav 1.2 g TDS for 24 hours post-op then stopped. Paracetamol 1 g QDS and ibuprofen 400 mg TDS PRN for 5 days. Wound care advice — keep dry for 48 hours, dressings can be removed on day 5. No heavy lifting for 2 weeks.",
      followUp:
        "GP suture check in 7 days (absorbable sutures, no removal required). Return to A&E if fever, worsening abdominal pain, wound discharge, or vomiting.",
    },
    transcript: [
      { speaker: "DOCTOR", time: "00:03", text: "How are you feeling this morning?" },
      { speaker: "PATIENT", time: "00:06", text: "Much better. The pain's mostly gone, just a bit sore at the incisions." },
      { speaker: "DOCTOR", time: "00:14", text: "Eating and drinking normally?" },
      { speaker: "PATIENT", time: "00:17", text: "Yes, had breakfast without any trouble." },
      { speaker: "DOCTOR", time: "00:24", text: "Good. Everything looks well healed. We'll get you home today." },
    ],
  },
  {
    type: "Discharge Summary",
    sections: {
      chiefComplaint: "Sudden onset severe headache and neck stiffness.",
      hpi:
        "54-year-old female, hypertensive on amlodipine, admitted with a sudden severe occipital headache described as 'the worst of my life' while gardening, associated with photophobia and one episode of vomiting. CT head on admission showed no acute haemorrhage. Lumbar puncture at 12 hours — no xanthochromia, normal opening pressure. Symptoms settled with analgesia over 48 hours. Neurology reviewed — no features of subarachnoid haemorrhage, likely primary thunderclap headache.",
      examination:
        "On discharge — alert, orientated. BP 138/82, HR 74. No neck stiffness, negative Kernig's and Brudzinski's. Cranial nerves intact, no focal neurology. Fundoscopy normal.",
      diagnosis:
        "1. Thunderclap headache — subarachnoid haemorrhage excluded (CT and LP negative)\n2. Essential hypertension",
      treatment:
        "Paracetamol 1 g QDS PRN. Amlodipine 5 mg OD continued. Nimodipine not indicated. Advised to avoid strenuous exertion for 2 weeks. Reversible cerebral vasoconstriction syndrome discussed as possible aetiology; MRA outpatient arranged.",
      followUp:
        "Outpatient MRA in 4 weeks, neurology clinic review with results. Return immediately for recurrent thunderclap headache, focal neurology, seizure, or reduced consciousness.",
    },
    transcript: [
      { speaker: "DOCTOR", time: "00:03", text: "How's the headache today compared to admission?" },
      { speaker: "PATIENT", time: "00:07", text: "Almost gone. Just a dull ache now, nothing like that first day." },
      { speaker: "DOCTOR", time: "00:15", text: "All your scans and the lumbar puncture were reassuring." },
      { speaker: "PATIENT", time: "00:21", text: "That's a relief. I really thought something serious was happening." },
      { speaker: "DOCTOR", time: "00:28", text: "We'll arrange an outpatient scan of the blood vessels just to be thorough." },
    ],
  },
  {
    type: "Discharge Summary",
    sections: {
      chiefComplaint: "Central chest pain radiating to left arm.",
      hpi:
        "63-year-old male, ex-smoker, hypercholesterolaemia, admitted with 2 hours of central crushing chest pain radiating to the left arm, associated with diaphoresis and nausea. Troponin I peaked at 4.8 ng/mL. ECG showed 2 mm ST elevation in the inferior leads. Underwent primary PCI to a fully occluded right coronary artery with a drug-eluting stent, door-to-balloon time 62 minutes. Uneventful recovery on the cardiac care unit.",
      examination:
        "On discharge — comfortable, chest pain free since PCI. BP 124/78, HR 68 regular. Heart sounds normal, no murmurs. Chest clear. Right femoral access site clean, no haematoma, distal pulses intact.",
      diagnosis:
        "1. Inferior ST-elevation myocardial infarction — primary PCI to RCA with DES\n2. Hypercholesterolaemia\n3. Ex-smoker (quit 4 years ago)",
      treatment:
        "Aspirin 75 mg OD lifelong, ticagrelor 90 mg BD for 12 months. Atorvastatin 80 mg nocte, bisoprolol 2.5 mg OD, ramipril 2.5 mg OD (titrate as tolerated). GTN spray PRN. Cardiac rehabilitation referral made. Driving cessation for 1 week (DVLA group 1) advised.",
      followUp:
        "Cardiology clinic in 6 weeks with repeat lipids and U&Es. Cardiac rehab to contact within 10 days. Return immediately for recurrent chest pain, breathlessness, or syncope.",
    },
    transcript: [
      { speaker: "DOCTOR", time: "00:03", text: "How's the chest feeling today?" },
      { speaker: "PATIENT", time: "00:06", text: "No pain at all since the procedure. It's like night and day." },
      { speaker: "DOCTOR", time: "00:13", text: "The stent is doing its job. You'll be on two blood thinners for a year." },
      { speaker: "PATIENT", time: "00:22", text: "Understood. When can I get back to driving?" },
      { speaker: "DOCTOR", time: "00:27", text: "One week off, then you're fine for a regular licence." },
    ],
  },
];

export function pickCase(type: NoteType): MockCase {
  const pool = type === "Discharge Summary" ? DISCHARGE_CASES : OPD_CASES;
  return pool[Math.floor(Math.random() * pool.length)];
}
