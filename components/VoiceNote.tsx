"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type VoiceNoteProps = {
  src: string;
  durationHint?: number | null;
};

export default function VoiceNote({ src, durationHint }: VoiceNoteProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationHint ?? 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrent(audio.currentTime);
    const onLoaded = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : (durationHint ?? 0));
    const onEnded = () => { setPlaying(false); setCurrent(0); };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
  }, [durationHint, src]);

  const bars = useMemo(() => [18, 26, 34, 22, 40, 30, 48, 28, 38, 52, 31, 44, 24, 46, 35, 55, 27, 42, 32, 50, 29, 39, 23, 47, 34, 43, 26, 51, 31, 40, 22, 36], []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    } else {
      audio.pause();
      setPlaying(false);
    }
  }

  function seek(event: React.MouseEvent<HTMLDivElement>) {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrent(audio.currentTime);
  }

  const progress = duration ? Math.min(1, current / duration) : 0;
  const shownDuration = Math.max(0, Math.round(duration || durationHint || 0));
  const remaining = Math.max(0, Math.round((duration || 0) - current));

  return (
    <div className="voice-note">
      <button className="voice-play" type="button" onClick={toggle} aria-label={playing ? "Pause voice note" : "Play voice note"}>
        {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
      </button>
      <div className="voice-track-wrap">
        <div className="voice-track" onClick={seek} role="slider" aria-label="Voice note progress" aria-valuemin={0} aria-valuemax={shownDuration} aria-valuenow={Math.round(current)}>
          {bars.map((height, index) => (
            <span
              key={index}
              className={index / bars.length <= progress ? "voice-bar played" : "voice-bar"}
              style={{ height: height + "%" }}
            />
          ))}
        </div>
        <div className="voice-time">{playing ? remaining + "s" : shownDuration + "s"}</div>
      </div>
      <audio ref={audioRef} src={src} preload="metadata" />
    </div>
  );
}
