# 🎬 Auto Subtitle Generator (AI-Powered)

An ultra-high-performance Next.js application powered by Gemini AI and FFmpeg, specifically optimized for Apple Silicon (MacBook Pro M4) to instantly transcribe videos and burn professional, stylized subtitles directly into video files with zero quality loss.

---

## 🚀 Key Features

- **AI Word-Level Transcription**: Leverages Google Gemini API with structured JSON output for perfectly accurate timestamps.
- **Dynamic Subtitle Styling**: Generates professional `.ass` subtitle formats with configurable highlighting, fonts, and shadow settings.
- **Hybrid Dual-Engine Export**:
  - **🚀 Local Backend Engine**: Zero memory limit, uses native Mac FFmpeg (`libx264`) running on MacBook Pro M4 CPU cores with professional Cinema-Grade quality (CRF 14, Slow Preset).
  - **🌍 Browser WebAssembly Engine**: Fallback `ffmpeg.wasm` running inside the browser with memory-safe, visually lossless settings (CRF 18).
- **Tailored for Short-Form Content**: Perfect for TikTok, YouTube Shorts, and Instagram Reels.

---

## 🛠️ Tech Stack & Architecture

- **Framework**: [Next.js 15 (App Router)](https://nextjs.org/)
- **Styling**: Vanilla CSS / Tailwind / Modern UI aesthetics.
- **AI Model**: [Google Gemini API (@google/generative-ai)](https://ai.google.dev/)
- **Video Processing (Browser)**: [@ffmpeg/ffmpeg](https://ffmpegwasm.netlify.app/) (Multi-threaded WebAssembly).
- **Video Processing (Native)**: Local Node.js native child_process spawning Host System `ffmpeg`.

---

## 📐 System Workflow Diagram

The following flowchart illustrates the complete life cycle from video upload to generating and burning the AI subtitles into the final product.

```mermaid
graph TD
    A[User Uploads Video] --> B[Extract Audio using FFmpeg.wasm]
    B --> C[Send Audio Data to Next.js Backend API]
    C --> D[Request Gemini AI API with Structured JSON Schema]
    D --> E[AI Returns Word-Level Timestamps JSON]
    E --> F[Convert to Chunked Subtitles & Edit in UI]
    F --> G{User Clicks Export}
    
    G --> H{Is Native FFmpeg installed on Host?}
    
    H -- Yes ✅ --> I[POST to /api/export Backend API]
    I --> J[Run Native FFmpeg libx264 CRF 14]
    J --> K[Return High-Quality Export Stream]
    
    H -- No ❌ --> L[Initialize Browser ffmpeg.wasm]
    L --> M[Run ffmpeg.wasm with CRF 18 & Memory Guard]
    M --> K
    
    K --> N[Trigger File Download]
```

---

## 🔄 Sequence Diagram

This sequence diagram shows the detailed breakdown of communication between the client, local backend server, and global AI APIs.

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser as Frontend (React)
    participant LocalAPI as Next.js API Routes
    participant AI as Google Gemini API
    participant NativeFF as Host Native FFmpeg

    User->>Browser: Upload Video File
    Browser->>Browser: Extract Audio Track (Local JS)
    
    User->>Browser: Click "Generate Subtitles"
    Browser->>LocalAPI: POST /api/transcribe (Audio File)
    LocalAPI->>AI: Send with Schema (word, start, end)
    AI-->>LocalAPI: Return Structured JSON Transcription
    LocalAPI-->>Browser: Pass Data to UI State
    Browser-->>User: Show Editable Subtitles Preview

    User->>Browser: Click "Export Video"
    Browser->>Browser: Generate .ass Subtitle Content
    
    Note over Browser, LocalAPI: Primary Attempt: Native Acceleration
    Browser->>LocalAPI: POST /api/export (Video + .ass)
    
    alt Native FFmpeg is present
        LocalAPI->>NativeFF: Spawn: ffmpeg libx264 crf 14 -preset slow
        NativeFF-->>LocalAPI: Done (Lossless 4K/1080p Stream)
        LocalAPI-->>Browser: Streaming response
    else Native FFmpeg not found
        LocalAPI-->>Browser: Error: NATIVE_FFMPEG_NOT_FOUND
        Note over Browser: Seamless Fallback activated
        Browser->>Browser: Load WebAssembly Worker
        Browser->>Browser: Run ffmpeg.wasm (CRF 18, memory safe)
    end

    Browser-->>User: Download Final Subtitled Video
```

---

## ⚙️ Getting Started

### 1. Environment Setup
Create a `.env.local` file in the root directory and add your Gemini API Key:
```bash
GEMINI_API_KEY=your_api_key_here
```

### 2. Installation & Running
Install project dependencies and run the local development server:
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to use the app.

---

## 🖥️ Optimized for MacBook Pro M4 (Mandatory Performance Tip)

To skip browser limits and unleash the **full multi-core CPU engine** of your MacBook Pro M4 for **Studio Cinema Quality** exports (CRF 14), install native FFmpeg on your Mac using Homebrew:

```bash
brew install ffmpeg
```

Once installed, the web app's backend seamlessly detects it and upgrades your rendering from basic browser encoding to **professional-grade native production** with absolutely zero quality loss.

---
