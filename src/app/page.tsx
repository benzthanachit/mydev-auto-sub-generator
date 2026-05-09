"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, Video, Settings2, Download, Play, Pause, Save, Loader2, Sparkles, Edit3 } from "lucide-react";
import { TranscriptWord, CaptionSettings, DEFAULT_SETTINGS, ChunkedTranscript } from "@/types";
import { chunkTranscript } from "@/lib/subtitle-utils";
import { VideoPlayer } from "@/components/VideoPlayer";
import { CustomizationPanel } from "@/components/CustomizationPanel";
import { SubtitleEditor } from "@/components/SubtitleEditor";

export default function Home() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const [transcription, setTranscription] = useState<TranscriptWord[]>([]);
  const [chunks, setChunks] = useState<ChunkedTranscript[]>([]);
  const [settings, setSettings] = useState<CaptionSettings>(DEFAULT_SETTINGS);
  
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState<"styling" | "editor">("styling");
  
  // Load settings from localStorage
  useEffect(() => {
    const savedSettings = localStorage.getItem("subtitle-settings");
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings((prev) => ({ ...DEFAULT_SETTINGS, ...parsed }));
      } catch (e) {
        console.error("Failed to parse saved settings", e);
      }
    }
  }, []);

  // Update chunks when transcription or settings change
  useEffect(() => {
    if (transcription.length > 0) {
      setChunks(chunkTranscript(transcription, settings.wordsPerScreen, settings.maxGapTime));
    }
  }, [transcription, settings.wordsPerScreen, settings.maxGapTime]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    
    // Reset state for new video
    setTranscription([]);
    setChunks([]);
  };

  const handleTranscribe = async () => {
    if (!videoFile) return;
    
    setIsTranscribing(true);
    try {
      // First, extract audio from the video to save bandwidth and prevent server OOM
      const { extractAudio } = await import('@/lib/ffmpeg-utils');
      console.log("Extracting audio from video...");
      const audioFile = await extractAudio(videoFile, (progress) => {
        console.log(`Audio extraction progress: ${progress.toFixed(1)}%`);
      });
      console.log("Audio extracted successfully, uploading to server...");

      const formData = new FormData();
      formData.append("file", audioFile);
      
      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        let errorMessage = "Failed to transcribe";
        try {
          const errData = await response.json();
          if (errData.error) errorMessage = errData.error;
        } catch (e) {
          // ignore
        }
        throw new Error(errorMessage);
      }
      
      const data = await response.json();
      if (data.transcription) {
        const parseTime = (val: any): number => {
          if (val === null || val === undefined) return 0;
          if (typeof val === "number") return val;
          if (typeof val === "string") {
            const cleaned = val.trim().replace(/s$/, "");
            const parsed = parseFloat(cleaned);
            return isNaN(parsed) ? 0 : parsed;
          }
          return 0;
        };

        const normalized: TranscriptWord[] = data.transcription.map((w: any) => {
          const start = w.start_time !== undefined ? w.start_time : (w.startTime !== undefined ? w.startTime : w.start);
          const end = w.end_time !== undefined ? w.end_time : (w.endTime !== undefined ? w.endTime : w.end);
          return {
            word: String(w.word || ""),
            start_time: parseTime(start),
            end_time: parseTime(end),
          };
        });

        setTranscription(normalized);
        setActiveTab("editor");
      }
    } catch (error: any) {
      console.error("Transcription error:", error);
      alert(`Transcription failed: ${error.message || "See console for details."}`);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSaveTemplate = () => {
    localStorage.setItem("subtitle-settings", JSON.stringify(settings));
    alert("Template saved successfully!");
  };

  const handleExport = async () => {
    if (!videoFile || transcription.length === 0) return;
    
    setIsExporting(true);
    try {
      const { exportVideo, generateAssFile, getVideoDimensions } = await import('@/lib/ffmpeg-utils');
      const dims = await getVideoDimensions(videoFile);
      const assContent = generateAssFile(chunks, settings, dims.width, dims.height);

      // 1. Try local native server-side export first (utilizes MacBook Pro M4's full CPU/GPU)
      try {
        const formData = new FormData();
        formData.append("video", videoFile);
        formData.append("ass", assContent);

        const response = await fetch("/api/export", {
          method: "POST",
          body: formData,
        });

        if (response.ok) {
          const blob = await response.blob();
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `subtitled-${videoFile.name || "video.mp4"}`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return; // Success, skip browser-side export
        }

        const errData = await response.json().catch(() => ({}));
        if (errData.error === "NATIVE_FFMPEG_NOT_FOUND") {
          console.warn("Native FFmpeg not found on host Mac. Falling back to browser ffmpeg.wasm...");
        } else if (errData.error) {
          console.error("Local native export failed:", errData.error);
        }
      } catch (nativeErr) {
        console.warn("Native backend export skipped or failed, falling back to browser-side ffmpeg.wasm...", nativeErr);
      }

      // 2. Fallback: Browser-side ffmpeg.wasm (safe, high-quality fallback)
      const url = await exportVideo(videoFile, chunks, settings, (progress) => {
        console.log(`Export progress: ${progress.toFixed(1)}%`);
      });
      
      const a = document.createElement("a");
      a.href = url;
      a.download = `subtitled-${videoFile.name || "video.mp4"}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error: any) {
      console.error("Export failed:", error);
      alert(`Export failed: ${error.message || "See console for details."}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (!videoUrl) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-8 bg-zinc-950 min-h-screen">
        <div className="max-w-2xl w-full flex flex-col items-center gap-8 text-center">
          <div className="flex items-center gap-3 text-4xl font-black tracking-tighter text-zinc-100 uppercase font-bangers tracking-wider">
            <Sparkles className="w-10 h-10 text-yellow-400" />
            Auto Subtitle Generator
          </div>
          
          <p className="text-zinc-400 text-lg">
            Upload a short-form video (TikTok, Reels, Shorts) and generate perfectly synced, highly customizable captions instantly using Gemini AI.
          </p>

          <label className="group relative flex flex-col items-center justify-center w-full max-w-md h-64 border-2 border-dashed border-zinc-700 rounded-3xl bg-zinc-900/50 hover:bg-zinc-800/50 hover:border-yellow-500/50 transition-all cursor-pointer overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <Upload className="w-12 h-12 text-zinc-500 group-hover:text-yellow-400 mb-4 transition-colors" />
            <span className="text-zinc-300 font-medium">Click or drag video to upload</span>
            <span className="text-zinc-500 text-sm mt-2">MP4, WebM, MOV (Max 50MB recommended)</span>
            <input 
              type="file" 
              accept="video/*,audio/*" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col h-screen overflow-hidden bg-zinc-950">
      <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 shrink-0 bg-zinc-950/80 backdrop-blur-md z-10">
        <div className="flex items-center gap-2 text-xl font-bold font-bangers tracking-wide text-zinc-100">
          <Sparkles className="w-6 h-6 text-yellow-400" />
          Auto Subs
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => {
              setVideoFile(null);
              setVideoUrl(null);
            }}
            className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            New Project
          </button>
          
          <button 
            onClick={handleExport}
            disabled={isExporting || transcription.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-yellow-950 text-sm font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export Video
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Workspace */}
        <div className="flex-1 flex flex-col bg-zinc-900 relative">
          <div className="flex-1 p-8 flex items-center justify-center overflow-hidden">
            <VideoPlayer 
              videoUrl={videoUrl} 
              chunks={chunks} 
              settings={settings} 
            />
          </div>
          
          {/* Timeline / Action Bar */}
          <div className="h-24 bg-zinc-950 border-t border-zinc-800 p-4 flex items-center justify-center shrink-0">
            {transcription.length === 0 ? (
              <button 
                onClick={handleTranscribe}
                disabled={isTranscribing}
                className="flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-full hover:bg-zinc-200 transition-transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isTranscribing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Transcribing with Gemini...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Auto Captions
                  </>
                )}
              </button>
            ) : (
              <div className="text-zinc-400 flex items-center gap-2">
                <Video className="w-5 h-5" />
                <span className="font-medium">{transcription.length} words transcribed</span>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-80 bg-zinc-950 border-l border-zinc-800 overflow-y-auto shrink-0 flex flex-col">
          {/* Tabs Header */}
          <div className="flex border-b border-zinc-800 sticky top-0 bg-zinc-950 z-10 shrink-0">
            <button
              onClick={() => setActiveTab("styling")}
              className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
                activeTab === "styling"
                  ? "border-yellow-500 text-yellow-500 bg-zinc-900/30"
                  : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/10"
              }`}
            >
              <Settings2 className="w-4 h-4" />
              Styling
            </button>
            <button
              onClick={() => setActiveTab("editor")}
              className={`flex-1 py-4 text-sm font-semibold flex items-center justify-center gap-2 border-b-2 transition-all ${
                activeTab === "editor"
                  ? "border-yellow-500 text-yellow-500 bg-zinc-900/30"
                  : "border-transparent text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/10"
              }`}
            >
              <Edit3 className="w-4 h-4" />
              Editor
            </button>
          </div>
          
          <div className="p-5 flex-1">
            {activeTab === "styling" ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/50">
                  <span className="text-zinc-400 font-medium text-xs">Save current styling as default</span>
                  <button 
                    onClick={handleSaveTemplate}
                    className="p-2 text-zinc-400 hover:text-yellow-400 hover:bg-zinc-900 rounded-lg transition-colors group"
                    title="Save Template"
                  >
                    <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
                  </button>
                </div>
                <CustomizationPanel 
                  settings={settings} 
                  onChange={setSettings} 
                />
              </div>
            ) : (
              <SubtitleEditor
                transcription={transcription}
                onChangeTranscription={setTranscription}
                chunks={chunks}
                settings={settings}
              />
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
