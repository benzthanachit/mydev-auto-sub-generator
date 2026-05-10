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
          <div
            className="absolute left-0 w-full flex justify-center pointer-events-none px-8"
            style={{
              top: `${settings.yPosition}%`,
              transform: "translateY(-50%)",
              zIndex: 10,
            }}
          >
            <motion.div
              key={activeChunk.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.1 } }}
              className="w-full flex justify-center"
            >
              <div
                className="flex flex-wrap justify-center items-center text-center"
                style={{
                  columnGap: `${settings.wordSpacing}px`,
                  backgroundColor: settings.bgOpacity > 0 
                    ? `${settings.bgColor}${Math.floor(settings.bgOpacity * 2.55).toString(16).padStart(2, '0')}` 
                    : 'transparent',
                  padding: settings.bgOpacity > 0 ? `${settings.bgPadding}px` : '0',
                }}
              >
                {activeChunk.words
                  .filter((w) => !w.hidden)
                  .map((wordObj, idx) => {
                    const isSpoken =
                      currentTime >= wordObj.start_time && currentTime <= wordObj.end_time;
                    const isPast = currentTime > wordObj.end_time;
                    const shouldHighlight = isSpoken && settings.enableHighlight && (wordObj.highlighted !== false);

                    return (
                      <span
                        key={`${activeChunk.id}-${idx}`}
                        className="transition-colors duration-100 ease-linear inline-block leading-tight"
                        style={{
                          fontFamily: settings.fontFamily,
                          fontSize: `${settings.fontSize}px`,
                          fontWeight: "900",
                          color: shouldHighlight ? settings.highlightColor : settings.textColor,
                          opacity: !isSpoken && !isPast ? 0.8 : 1,
                          textShadow: `${settings.shadowOffsetX}px ${settings.shadowOffsetY}px ${settings.shadowBlur}px ${settings.shadowColor}`,
                          WebkitTextStroke: `${settings.strokeWidth}px ${settings.strokeColor}`,
                          transform: shouldHighlight ? "scale(1.1)" : "scale(1)",
                          transition: "all 0.1s ease-out",
                        }}
                      >
                        {wordObj.word}
                      </span>
                    );
                  })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
