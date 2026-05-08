"use client";

import { Eye, EyeOff, Sparkles, Clock, Edit3 } from "lucide-react";
import { TranscriptWord, ChunkedTranscript, CaptionSettings } from "@/types";

interface SubtitleEditorProps {
  transcription: TranscriptWord[];
  onChangeTranscription: (words: TranscriptWord[]) => void;
  chunks: ChunkedTranscript[];
  settings: CaptionSettings;
}

export function SubtitleEditor({
  transcription,
  onChangeTranscription,
  chunks,
  settings,
}: SubtitleEditorProps) {
  
  // Handle word text edit
  const handleWordTextChange = (globalIndex: number, newText: string) => {
    const updated = [...transcription];
    updated[globalIndex] = {
      ...updated[globalIndex],
      word: newText,
    };
    onChangeTranscription(updated);
  };

  // Handle individual word highlight toggle
  const handleWordHighlightToggle = (globalIndex: number) => {
    const updated = [...transcription];
    updated[globalIndex] = {
      ...updated[globalIndex],
      highlighted: updated[globalIndex].highlighted === false ? true : !updated[globalIndex].highlighted,
    };
    onChangeTranscription(updated);
  };

  // Handle individual word visibility toggle
  const handleWordVisibilityToggle = (globalIndex: number) => {
    const updated = [...transcription];
    updated[globalIndex] = {
      ...updated[globalIndex],
      hidden: !updated[globalIndex].hidden,
    };
    onChangeTranscription(updated);
  };

  // Handle whole chunk visibility toggle
  const handleChunkVisibilityToggle = (chunkWordIndices: number[], isCurrentlyAllHidden: boolean) => {
    const updated = [...transcription];
    chunkWordIndices.forEach((idx) => {
      updated[idx] = {
        ...updated[idx],
        hidden: !isCurrentlyAllHidden, // if all are hidden, make visible. otherwise hide all.
      };
    });
    onChangeTranscription(updated);
  };

  let runningGlobalIndex = 0;

  return (
    <div className="space-y-4 pb-12">
      {chunks.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <Edit3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No subtitles generated yet</p>
          <p className="text-xs mt-1">Upload a video and generate captions to start editing.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="text-xs text-zinc-500 font-medium px-1 flex justify-between items-center">
            <span>{chunks.length} Screen Chunks</span>
            <span>Click sparkle to highlight</span>
          </div>
          
          {chunks.map((chunk, chunkIdx) => {
            // Calculate the global indices of all words in this chunk
            const chunkWordIndices: number[] = [];
            const chunkWords = chunk.words;
            const startIdx = runningGlobalIndex;
            
            chunkWords.forEach((_, idx) => {
              chunkWordIndices.push(startIdx + idx);
            });
            runningGlobalIndex += chunkWords.length;

            const isChunkFullyHidden = chunkWords.every((w) => w.hidden);
            const isChunkPartiallyHidden = chunkWords.some((w) => w.hidden) && !isChunkFullyHidden;

            return (
              <div 
                key={chunk.id} 
                className={`p-4 rounded-2xl border transition-all duration-200 ${
                  isChunkFullyHidden 
                    ? "bg-zinc-950/40 border-zinc-900/80 opacity-50" 
                    : "bg-zinc-900/40 border-zinc-800/80 hover:border-zinc-700/80"
                }`}
              >
                {/* Chunk Header */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800/50">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium">
                    <Clock className="w-3.5 h-3.5 text-zinc-500" />
                    <span>{chunk.start_time.toFixed(1)}s - {chunk.end_time.toFixed(1)}s</span>
                  </div>

                  <button
                    onClick={() => handleChunkVisibilityToggle(chunkWordIndices, isChunkFullyHidden)}
                    className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 text-xs font-semibold ${
                      isChunkFullyHidden 
                        ? "text-zinc-500 bg-zinc-900 hover:text-zinc-300" 
                        : "text-zinc-400 hover:text-yellow-400 hover:bg-zinc-800/50"
                    }`}
                    title={isChunkFullyHidden ? "Show Chunk" : "Hide Chunk"}
                  >
                    {isChunkFullyHidden ? (
                      <>
                        <EyeOff className="w-3.5 h-3.5" />
                        <span className="text-[10px]">Hidden</span>
                      </>
                    ) : (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span className="text-[10px]">{isChunkPartiallyHidden ? "Partial" : "Visible"}</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Chunk Words Editor Grid */}
                <div className="space-y-2.5">
                  {chunkWords.map((wordObj, wordIdx) => {
                    const globalIdx = chunkWordIndices[wordIdx];
                    const isHighlighted = wordObj.highlighted !== false;
                    const isHidden = wordObj.hidden === true;

                    return (
                      <div 
                        key={`${chunk.id}-word-${wordIdx}`}
                        className={`flex items-center gap-2 p-1.5 rounded-xl transition-all ${
                          isHidden 
                            ? "bg-zinc-950/20 opacity-40" 
                            : "bg-zinc-900/60 hover:bg-zinc-900"
                        }`}
                      >
                        {/* Word Input */}
                        <input
                          type="text"
                          value={wordObj.word}
                          onChange={(e) => handleWordTextChange(globalIdx, e.target.value)}
                          disabled={isHidden}
                          className={`flex-1 min-w-0 bg-transparent px-2 py-1 text-sm font-bold border-none outline-none focus:ring-0 focus:outline-none transition-colors ${
                            isHidden 
                              ? "text-zinc-600 line-through" 
                              : isHighlighted && settings.enableHighlight
                                ? "text-yellow-400"
                                : "text-zinc-200 focus:text-white"
                          }`}
                        />

                        {/* Word Highlight Toggle */}
                        <button
                          onClick={() => handleWordHighlightToggle(globalIdx)}
                          disabled={isHidden}
                          className={`p-1.5 rounded-lg transition-all ${
                            isHidden
                              ? "text-zinc-700 cursor-not-allowed"
                              : isHighlighted
                                ? "text-yellow-400 bg-yellow-400/10 hover:bg-yellow-400/20 shadow-sm shadow-yellow-400/5"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80"
                          }`}
                          title={isHighlighted ? "Remove Highlight" : "Highlight Word"}
                        >
                          <Sparkles className={`w-4 h-4 ${isHighlighted && !isHidden ? "fill-yellow-400 animate-pulse" : ""}`} />
                        </button>

                        {/* Word Visibility Toggle */}
                        <button
                          onClick={() => handleWordVisibilityToggle(globalIdx)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            isHidden
                              ? "text-red-400 bg-red-400/10 hover:bg-red-400/20"
                              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/80"
                          }`}
                          title={isHidden ? "Show Word" : "Hide Word"}
                        >
                          {isHidden ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
