import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TranscriptLine {
  speaker: "DOCTOR" | "PATIENT";
  text: string;
  time: string;
  start_ms: number;
}

interface NoteSections {
  chiefComplaint: string;
  hpi: string;
  examination: string;
  diagnosis: string;
  treatment: string;
  followUp: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a plain-text version of the transcript for the LLM prompt */
function formatTranscript(lines: TranscriptLine[]): string {
  return lines
    .map((l) => `[${l.time}] ${l.speaker}: ${l.text}`)
    .join("\n");
}

/** Call Groq's OpenAI-compatible chat completion (llama-3.3-70b-versatile — free tier) */
async function callLLM(prompt: string, groqKey: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${groqKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a clinical documentation assistant for a medical practice. 
Your job is to produce structured, professional clinical notes from consultation transcripts.
Always respond with valid JSON matching the schema provided. Be concise and clinically precise.
Do NOT invent information not present in the transcript. Use "Not documented" for missing fields.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Parse request
    const { consultation_id } = await req.json();
    if (!consultation_id) {
      return new Response(
        JSON.stringify({ error: "consultation_id is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 2. Init Supabase admin client (service role bypasses RLS)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const openaiKey = Deno.env.get("GROQ_API_KEY");
    if (!openaiKey) {
      throw new Error("GROQ_API_KEY environment variable is not set.");
    }

    // 3. Fetch the consultation with its transcript and consult_type
    const { data: consultation, error: fetchError } = await supabase
      .from("consultations")
      .select("id, transcript_json, consult_type, patient_id, doctor_id")
      .eq("id", consultation_id)
      .single();

    if (fetchError || !consultation) {
      throw new Error(`Consultation not found: ${fetchError?.message}`);
    }

    const transcript: TranscriptLine[] = consultation.transcript_json ?? [];
    if (transcript.length === 0) {
      throw new Error("Consultation has no transcript to generate a note from.");
    }

    const transcriptText = formatTranscript(transcript);
    const consultType = consultation.consult_type ?? "OPD Note";

    console.log(
      `[generate-note] Generating ${consultType} note for consultation ${consultation_id}`
    );

    // 4. Build LLM prompt
    const prompt = `
You are generating a structured clinical note for a ${consultType}.

Below is the consultation transcript with speaker labels (DOCTOR / PATIENT):

---
${transcriptText}
---

Extract the following six sections from the transcript and return them as a JSON object with EXACTLY these keys:
{
  "chiefComplaint": "<1-2 sentences describing the patient's main complaint>",
  "hpi": "<Detailed history of the present illness, chronological>",
  "examination": "<Examination findings mentioned by the doctor, or 'Not documented'>",
  "diagnosis": "<Diagnosis or differential diagnosis stated by the doctor>",
  "treatment": "<Treatment plan, medications, procedures ordered>",
  "followUp": "<Follow-up instructions, referrals, review dates>"
}

Rules:
- Only extract what is explicitly present in the transcript.
- Write in third person (e.g. "Patient reports...", "Doctor noted...").
- Be concise but clinically accurate.
- If a section has no relevant content, write "Not documented in this consultation."
`;

    // 5. Call the LLM with validate-then-retry logic
    const requiredKeys: (keyof NoteSections)[] = [
      "chiefComplaint",
      "hpi",
      "examination",
      "diagnosis",
      "treatment",
      "followUp",
    ];

    function parseAndValidate(raw: string): NoteSections | null {
      try {
        const parsed = JSON.parse(raw) as NoteSections;
        // All keys must be present and non-empty strings
        for (const key of requiredKeys) {
          if (typeof parsed[key] !== "string" || parsed[key].trim() === "") {
            return null;
          }
        }
        return parsed;
      } catch {
        return null;
      }
    }

    let rawResponse = await callLLM(prompt, openaiKey);
    let sections = parseAndValidate(rawResponse);

    // Retry once with a stricter instruction if first attempt failed validation
    if (!sections) {
      console.warn("[generate-note] First attempt failed schema validation — retrying with stricter prompt.");
      const retryPrompt = `Your previous response did not match the required JSON schema.

Return ONLY a valid JSON object with EXACTLY these six string keys — no markdown, no explanation, no extra keys:
{
  "chiefComplaint": "...",
  "hpi": "...",
  "examination": "...",
  "diagnosis": "...",
  "treatment": "...",
  "followUp": "..."
}

Here is the transcript again:
---
${transcriptText}
---

IMPORTANT: Respond with ONLY the raw JSON object. No backticks, no markdown code blocks, no commentary.`;

      rawResponse = await callLLM(retryPrompt, openaiKey);
      sections = parseAndValidate(rawResponse);

      if (!sections) {
        throw new Error(
          `LLM failed schema validation after retry. Raw response: ${rawResponse.slice(0, 300)}`
        );
      }
    }

    console.log(`[generate-note] Note sections generated successfully.`);

    // 6. Insert into the notes table
    const { data: note, error: noteError } = await supabase
      .from("notes")
      .insert({
        consultation_id,
        doctor_id: consultation.doctor_id,
        sections_json: sections,
        edit_count: 0,
        review_seconds: 0,
      })
      .select()
      .single();

    if (noteError) {
      throw new Error(`Failed to insert note: ${noteError.message}`);
    }

    console.log(`[generate-note] Note saved (id: ${note.id}). Setting consultation status to 'draft'.`);

    // 7. Update consultation status to 'draft'
    //    This triggers the Realtime subscription in the frontend
    //    which will navigate the doctor to the Review & Sign-Off screen.
    const { error: updateError } = await supabase
      .from("consultations")
      .update({ status: "draft" })
      .eq("id", consultation_id);

    if (updateError) {
      throw new Error(`Failed to update consultation status: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, note_id: note.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err: any) {
    console.error("[generate-note] Error:", err.message);

    // Best-effort: mark consultation as draft anyway so frontend doesn't hang
    try {
      const { consultation_id } = await (async () => {
        try { return await req.json(); } catch { return {}; }
      })();
      if (consultation_id) {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase
          .from("consultations")
          .update({ status: "draft" })
          .eq("id", consultation_id);
      }
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
