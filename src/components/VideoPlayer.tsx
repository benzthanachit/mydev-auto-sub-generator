"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CaptionSettings, ChunkedTranscript, TranscriptWord } from "@/types";

interface VideoPlayerProps {
  videoUrl: string;
  chunks: ChunkedTranscript[];
  settings: CaptionSettings;
}

export function VideoPlayer({ videoUrl, chunks, settings }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);

  // Sync video time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [videoUrl]);

  // Find active chunk
  const activeChunk = chunks.find(
    (c) => currentTime >= c.start_time && currentTime <= c.end_time
  );

  return (
    <div className="relative inline-block max-w-full max-h-[80vh] bg-black rounded-xl overflow-hidden shadow-2xl border border-zinc-800">
      <video
        ref={videoRef}
        src={videoUrl}
        className="block max-w-full max-h-[80vh] w-auto h-auto"
        controls
        playsInline
      />
      
      {/* Subtitles Overlay */}
      <AnimatePresence mode="wait">
        {activeChunk && (
          <motion.div
            key={activeChunk.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
            className="absolute left-0 w-full flex flex-wrap justify-center items-center gap-x-2 gap-y-1 px-8 pointer-events-none"
            style={{
              top: `${settings.yPosition}%`,
              transform: "translateY(-50%)",
            }}
          >
            {activeChunk.words.map((wordObj, idx) => {
              const isSpoken =
                currentTime >= wordObj.start_time && currentTime <= wordObj.end_time;
              const isPast = currentTime > wordObj.end_time;

              return (
                <span
                  key={`${activeChunk.id}-${idx}`}
                  className="transition-colors duration-100 ease-linear inline-block leading-tight text-center"
                  style={{
                    fontFamily: settings.fontFamily,
                    fontSize: `${settings.fontSize}px`,
                    fontWeight: "900",
                    color: isSpoken ? settings.highlightColor : isPast ? settings.textColor : settings.textColor,
                    opacity: !isSpoken && !isPast ? 0.8 : 1,
                    textShadow: `${settings.shadowOffsetX}px ${settings.shadowOffsetY}px ${settings.shadowBlur}px ${settings.shadowColor}`,
                    WebkitTextStroke: `${settings.strokeWidth}px ${settings.strokeColor}`,
                    transform: isSpoken ? "scale(1.1)" : "scale(1)",
                    transition: "all 0.1s ease-out",
                  }}
                >
                  {wordObj.word}
                </span>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
