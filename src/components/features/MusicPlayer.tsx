import { useState, useRef, useEffect } from "react";
import { Music, VolumeX } from "lucide-react";
import { supabase } from "@/lib/supabase";

export function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [trackUrl, setTrackUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch music URL from app_settings
  useEffect(() => {
    supabase.from("app_settings").select("value").eq("key", "music_url").single()
      .then(({ data }) => {
        if (data?.value) setTrackUrl(data.value);
      });
  }, []);

  useEffect(() => {
    if (!trackUrl) return;
    const audio = new Audio(trackUrl);
    audio.loop = true;
    audio.volume = 0.35;
    audioRef.current = audio;
    audio.addEventListener("canplaythrough", () => setIsLoading(false));
    audio.addEventListener("waiting", () => setIsLoading(true));
    return () => { audio.pause(); audio.src = ""; };
  }, [trackUrl]);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) { audio.pause(); setIsPlaying(false); }
    else {
      setIsLoading(true);
      try { await audio.play(); setIsPlaying(true); }
      catch { setIsLoading(false); }
    }
  };

  return (
    <button onClick={toggle} aria-label={isPlaying ? "Pause music" : "Play music"}
      className="relative group flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 hover:scale-110"
      style={{ background: "rgba(20, 12, 4, 0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(196, 168, 130, 0.3)" }}>
      {isLoading ? (
        <span className="w-3.5 h-3.5 border-2 border-[#c4a882] border-t-transparent rounded-full animate-spin" />
      ) : isPlaying ? (
        <>
          <Music size={14} className="text-[#d4b896]" />
          <span className="absolute inset-0 rounded-full border border-[#c4a882]/40 animate-ping" style={{ animationDuration: "2s" }} />
        </>
      ) : (
        <VolumeX size={14} className="text-[#a08060] group-hover:text-[#c4a882] transition-colors" />
      )}
    </button>
  );
}
