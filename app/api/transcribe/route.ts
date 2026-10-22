import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowedTables = new Set(["posts", "responses", "replies"]);

export async function POST(request: Request) {
  // The browser Supabase client may keep its session in browser storage rather
  // than a server cookie. When a bearer token is supplied, use that token for BOTH
  // Auth validation and PostgREST requests so RLS sees the same authenticated user.
  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const supabase = bearerToken
    ? createSupabaseClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${bearerToken}` } },
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        },
      )
    : await createServerSupabaseClient();
  const { data: { user }, error: authError } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Sign in to transcribe this voice recording." }, { status: 401 });
  }

  let payload: { recordType?: string; recordId?: string; mediaUrl?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const { recordType, recordId, mediaUrl } = payload;
  if (!recordType || !allowedTables.has(recordType) || !recordId || !mediaUrl) {
    return NextResponse.json({ error: "Missing or invalid recording details." }, { status: 400 });
  }

  const table = recordType as "posts" | "responses" | "replies";
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!projectUrl || !apiKey) {
    await supabase.from(table).update({ transcript_status: "failed" }).eq("id", recordId).eq("author_id", user.id);
    return NextResponse.json({ error: "Transcription is not configured yet." }, { status: 503 });
  }

  let audioUrl: URL;
  try {
    audioUrl = new URL(mediaUrl);
  } catch {
    return NextResponse.json({ error: "Invalid audio URL." }, { status: 400 });
  }
  const expectedOrigin = new URL(projectUrl).origin;
  const expectedPrefix = "/storage/v1/object/public/gist-audio/";
  if (audioUrl.origin !== expectedOrigin || !audioUrl.pathname.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: "Audio URL is not an approved Gista recording." }, { status: 400 });
  }

  const { data: ownedRecord, error: recordError } = await supabase
    .from(recordType)
    .select("id,content_type,media_url,transcript,transcript_status")
    .eq("id", recordId)
    .eq("author_id", user.id)
    .single();

  if (recordError || !ownedRecord || ownedRecord.content_type !== "voice" || ownedRecord.media_url !== mediaUrl) {
    return NextResponse.json({ error: "Recording not found or not owned by this account." }, { status: 404 });
  }

  if (ownedRecord.transcript_status === "complete" && ownedRecord.transcript) {
    return NextResponse.json({ transcript: ownedRecord.transcript, status: "complete" });
  }

  try {
    const audioResponse = await fetch(audioUrl, { signal: AbortSignal.timeout(20000) });
    if (!audioResponse.ok) throw new Error("The uploaded recording could not be read.");
    const audioBytes = await audioResponse.arrayBuffer();
    if (audioBytes.byteLength === 0 || audioBytes.byteLength > 25 * 1024 * 1024) {
      throw new Error("The recording must be smaller than 25 MB.");
    }

    const form = new FormData();
    form.append("model", "gpt-4o-mini-transcribe");
    form.append("response_format", "json");
    form.append("file", new Blob([audioBytes], { type: audioResponse.headers.get("content-type") || "audio/webm" }), "voice.webm");

    const transcriptionResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(45000),
    });
    if (!transcriptionResponse.ok) {
      const detail = await transcriptionResponse.text();
      throw new Error(detail.slice(0, 300) || "Transcription service failed.");
    }
    const result = await transcriptionResponse.json() as { text?: string };
    const transcript = typeof result.text === "string" ? result.text.trim() : "";
    if (!transcript) throw new Error("No speech could be transcribed from this recording.");

    const { error: updateError } = await supabase
      .from(recordType)
      .update({ transcript, transcript_status: "complete" })
      .eq("id", recordId)
      .eq("author_id", user.id);
    if (updateError) throw new Error("The transcript could not be saved.");

    return NextResponse.json({ transcript, status: "complete" });
  } catch (error) {
    await supabase.from(recordType).update({ transcript_status: "failed" }).eq("id", recordId).eq("author_id", user.id);
    const message = error instanceof Error ? error.message : "Transcription failed.";
    return NextResponse.json({ error: message, status: "failed" }, { status: 502 });
  }
}
