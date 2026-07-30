import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TranscriptWord {
  text: string;
  start: number;
  end: number;
  confidence: number;
  speaker: string; // "A" | "B"
}

interface AssemblyAIUtterance {
  speaker: string; // "A" | "B"
  text: string;
  start: number;
  end: number;
  words: TranscriptWord[];
}

interface AssemblyAIResponse {
  id: string;
  status: "queued" | "processing" | "completed" | "error";
  utterances?: AssemblyAIUtterance[];
  error?: string;
}

interface TranscriptLine {
  speaker: "DOCTOR" | "PATIENT";
  text: string;
  time: string; // e.g. "00:12"
  start_ms: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format milliseconds into MM:SS */
function msToTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const m = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const s = (totalSeconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Heuristic: Determine which AssemblyAI speaker label (A or B) maps to DOCTOR.
 *
 * Strategy (v1 — flagged as accuracy item for v2):
 *   1. Whoever speaks FIRST is the DOCTOR (doctor typically opens the consult).
 *   2. Tie-break: whoever asks more questions (ends more utterances with "?")
 *      is considered the DOCTOR.
 *
 * In v2, replace with a lightweight classifier or prompt the LLM note generator
 * to do the assignment from full transcript context.
 */
function inferDoctorSpeaker(utterances: AssemblyAIUtterance[]): "A" | "B" {
  if (utterances.length === 0) return "A";

  // Rule 1: first speaker is doctor
  const firstSpeaker = utterances[0].speaker as "A" | "B";

  // Rule 2: question count tie-break
  const questionCount: Record<string, number> = { A: 0, B: 0 };
  for (const u of utterances) {
    if (u.text.trim().endsWith("?")) {
      questionCount[u.speaker] = (questionCount[u.speaker] ?? 0) + 1;
    }
  }

  // If the other speaker asks significantly more questions, flip the label
  const otherSpeaker = firstSpeaker === "A" ? "B" : "A";
  if ((questionCount[otherSpeaker] ?? 0) > (questionCount[firstSpeaker] ?? 0) * 2) {
    return otherSpeaker;
  }

  return firstSpeaker;
}

/** Poll AssemblyAI until status is 'completed' or 'error' (max ~10 min) */
async function pollTranscript(
  transcriptId: string,
  apiKey: string
): Promise<AssemblyAIResponse> {
  const maxAttempts = 60;
  const intervalMs = 10_000; // 10 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(
      `https://api.assemblyai.com/v2/transcript/${transcriptId}`,
      { headers: { Authorization: apiKey } }
    );

    if (!res.ok) {
      throw new Error(`AssemblyAI poll error: ${res.status} ${await res.text()}`);
    }

    const data: AssemblyAIResponse = await res.json();

    if (data.status === "completed" || data.status === "error") {
      return data;
    }

    // Wait before next poll
    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error("AssemblyAI transcription timed out after 10 minutes.");
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
    // 1. Parse request body
    const { consultation_id } = await req.json();
    if (!consultation_id) {
      return new Response(JSON.stringify({ error: "consultation_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 2. Init Supabase admin client (bypasses RLS for internal use)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const assemblyApiKey = Deno.env.get("ASSEMBLYAI_API_KEY");
    if (!assemblyApiKey) {
      throw new Error("ASSEMBLYAI_API_KEY environment variable is not set.");
    }

    // 3. Fetch consultation row to get audio_url
    const { data: consultation, error: fetchError } = await supabase
      .from("consultations")
      .select("id, audio_url, doctor_id")
      .eq("id", consultation_id)
      .single();

    if (fetchError || !consultation) {
      throw new Error(`Consultation not found: ${fetchError?.message}`);
    }

    if (!consultation.audio_url) {
      throw new Error("Consultation has no audio_url.");
    }

    // 4. Get a signed URL for the audio file from the private bucket
    const { data: signedData, error: signedError } = await supabase.storage
      .from("consult-audio")
      .createSignedUrl(consultation.audio_url, 3600); // 1 hour expiry

    if (signedError || !signedData?.signedUrl) {
      throw new Error(`Failed to get signed URL: ${signedError?.message}`);
    }

    console.log(`[transcribe-consult] Submitting audio for consultation ${consultation_id}`);

    // 5. Submit audio to AssemblyAI
    const submitRes = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        Authorization: assemblyApiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        audio_url: signedData.signedUrl,
        speaker_labels: true,
        speakers_expected: 2,
      }),
    });

    if (!submitRes.ok) {
      throw new Error(
        `AssemblyAI submission error: ${submitRes.status} ${await submitRes.text()}`
      );
    }

    const { id: transcriptId }: { id: string } = await submitRes.json();
    console.log(`[transcribe-consult] AssemblyAI transcript ID: ${transcriptId}`);

    // 6. Poll until complete
    const transcript = await pollTranscript(transcriptId, assemblyApiKey);

    if (transcript.status === "error") {
      throw new Error(`AssemblyAI transcription failed: ${transcript.error}`);
    }

    const utterances = transcript.utterances ?? [];

    // 7. Map speaker labels A/B → DOCTOR/PATIENT
    //    V1 heuristic — flagged as v2 accuracy item
    const doctorSpeaker = inferDoctorSpeaker(utterances);
    console.log(`[transcribe-consult] Inferred DOCTOR speaker: ${doctorSpeaker}`);

    const transcriptJson: TranscriptLine[] = utterances.map((u) => ({
      speaker: u.speaker === doctorSpeaker ? "DOCTOR" : "PATIENT",
      text: u.text,
      time: msToTime(u.start),
      start_ms: u.start,
    }));

    // 8. Write labeled transcript back to the consultations row
    const { error: updateError } = await supabase
      .from("consultations")
      .update({
        transcript_json: transcriptJson,
        status: "processing", // still processing — generate-note will set 'draft'
      })
      .eq("id", consultation_id);

    if (updateError) {
      throw new Error(`Failed to update transcript: ${updateError.message}`);
    }

    console.log(`[transcribe-consult] Transcript saved. Invoking generate-note...`);

    // 9. Invoke the 'generate-note' edge function
    const { error: invokeError } = await supabase.functions.invoke("generate-note", {
      body: { consultation_id },
    });

    if (invokeError) {
      // Don't throw — transcription succeeded; note gen failure is separate
      console.error(`[transcribe-consult] generate-note invocation failed: ${invokeError.message}`);
      // Set status to draft anyway so the frontend doesn't hang indefinitely
      await supabase
        .from("consultations")
        .update({ status: "draft" })
        .eq("id", consultation_id);
    }

    return new Response(
      JSON.stringify({ success: true, transcript_lines: transcriptJson.length }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[transcribe-consult] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
