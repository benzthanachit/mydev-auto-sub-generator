"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, Video, Settings2, Download, Play, Pause, Save, Loader2, Sparkles } from "lucide-react";
import { TranscriptWord, CaptionSettings, DEFAULT_SETTINGS, ChunkedTranscript } from "@/types";
import { chunkTranscript } from "@/lib/subtitle-utils";
import { VideoPlayer } from "@/components/VideoPlayer";
import { CustomizationPanel } from "@/components/CustomizationPanel";

export default function Home() {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const [transcription, setTranscription] = useState<TranscriptWord[]>([]);
  const [chunks, setChunks] = useState<ChunkedTranscript[]>([]);
  const [settings, setSettings] = useState<CaptionSettings>(DEFAULT_SETTINGS);
  
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  
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
        setTranscription(data.transcription);
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
      const { exportVideo } = await import('@/lib/ffmpeg-utils');
      const url = await exportVideo(videoFile, chunks, settings, (progress) => {
        console.log(`Export progress: ${progress.toFixed(1)}%`);
      });
      
      const a = document.createElement("a");
      a.href = url;
      a.download = "subtitled-video.mp4";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (error) {
      console.error("Export failed:", error);
      alert("Export failed. See console for details.");
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
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between sticky top-0 bg-zinc-950 z-10">
            <h2 className="font-semibold flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-zinc-400" />
              Styling
            </h2>
            <button 
              onClick={handleSaveTemplate}
              className="p-2 text-zinc-400 hover:text-yellow-400 hover:bg-zinc-900 rounded-lg transition-colors group"
              title="Save Template"
            >
              <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          </div>
          
          <div className="p-5 flex-1">
            <CustomizationPanel 
              settings={settings} 
              onChange={setSettings} 
            />
          </div>
        </aside>
      </div>
    </main>
  );
}
