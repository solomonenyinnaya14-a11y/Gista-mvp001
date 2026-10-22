"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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
  }, [initialTranscript, initialStatus, recordId]);

  useEffect(() => {
    if (status !== "pending") return;
    const supabase = createClient();
    let active = true;
    const refresh = async () => {
      const { data } = await supabase.from(recordType).select("transcript,transcript_status").eq("id", recordId).maybeSingle();
      if (!active || !data) return;
      setTranscript(data.transcript ?? "");
      setStatus(data.transcript_status ?? "failed");
    };
    const interval = setInterval(refresh, 3500);
    refresh();
    return () => { active = false; clearInterval(interval); };
  }, [recordId, recordType, status]);

  const previewLimit = 240;
  const isLong = transcript.length > previewLimit;

  return (
    <div className={className ?? "voice-player"}>
      <audio controls preload="metadata" src={src} style={{ width: "100%" }} />
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
