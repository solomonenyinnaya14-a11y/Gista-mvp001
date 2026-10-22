"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import VoiceNote from "@/components/VoiceNote";

type RecordType = "posts" | "responses" | "replies";

type VoicePlayerProps = {
  src: string;
  recordId: string;
  recordType: RecordType;
  transcript?: string | null;
  transcriptStatus?: string | null;
  className?: string;
};

export default function VoicePlayer({
  src, recordId, recordType, transcript: initialTranscript, transcriptStatus: initialStatus, className,
}: VoicePlayerProps) {
  const [transcript, setTranscript] = useState(initialTranscript ?? "");
  const [status, setStatus] = useState(initialStatus ?? "pending");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setTranscript(initialTranscript ?? "");
    setStatus(initialStatus ?? "pending");
    setExpanded(false);
  }, [initialTranscript, initialStatus, recordId]);

  useEffect(() => {
    if (status !== "pending") return;
    const supabase = createClient();
    let active = true;
    let retryStarted = false;

    const refresh = async () => {
      const [{ data: { session } }, { data }] = await Promise.all([
        supabase.auth.getSession(),
        supabase.from(recordType)
          .select("transcript,transcript_status,author_id,created_at")
          .eq("id", recordId)
          .maybeSingle(),
      ]);
      if (!active || !data) return;

      setTranscript(data.transcript ?? "");
      const currentStatus = data.transcript_status ?? "failed";
      setStatus(currentStatus);

      // Older voice records can be left in "pending" if the original background
      // request never reached the transcription API. Retry once when the record's
      // owner views it, but avoid duplicating the request for freshly created audio.
      const isOldPending = currentStatus === "pending"
        && Date.now() - new Date(data.created_at).getTime() > 90_000;
      if (
        isOldPending
        && !retryStarted
        && session?.access_token
        && session.user.id === data.author_id
      ) {
        retryStarted = true;
        try {
          const response = await fetch("/api/transcribe", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ recordType, recordId, mediaUrl: src }),
          });
          if (response.ok) {
            const result = await response.json() as { transcript?: string; status?: string };
            if (!active) return;
            setTranscript(result.transcript ?? "");
            setStatus(result.status ?? "complete");
          } else {
            // The API persists failure details as a status where possible. Stop
            // showing an endless spinner in this view; a later visit can retry.
            if (active) setStatus("failed");
          }
        } catch {
          if (active) setStatus("failed");
        }
      }
    };

    const interval = setInterval(() => { void refresh(); }, 3500);
    void refresh();
    return () => { active = false; clearInterval(interval); };
  }, [recordId, recordType, src, status]);

  const previewLimit = 240;
  const isLong = transcript.length > previewLimit;

  return (
    <div className={className ?? "voice-player"}>
      <VoiceNote src={src} />
      <div className="voice-transcript" aria-live="polite">
        <div className="voice-transcript-label">Transcript</div>
        {transcript ? (
          <>
            <p>{expanded || !isLong ? transcript : transcript.slice(0, previewLimit).trimEnd() + "…"}</p>
            {isLong && <button type="button" className="transcript-toggle" onClick={() => setExpanded(value => !value)}>{expanded ? "Show less" : "Read full transcript"}</button>}
          </>
        ) : status === "pending" ? (
          <p className="transcript-status">Generating transcript…</p>
        ) : (
          <p className="transcript-status">Transcript unavailable. The original voice recording is still available to play.</p>
        )}
      </div>
    </div>
  );
}
