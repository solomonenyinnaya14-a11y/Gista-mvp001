"use client";

import VoiceNote from "@/components/VoiceNote";

type VoicePlayerProps = { src: string; className?: string };

export default function VoicePlayer({ src, className }: VoicePlayerProps) {
  return <div className={className ?? "voice-player"}><VoiceNote src={src} /></div>;
}
