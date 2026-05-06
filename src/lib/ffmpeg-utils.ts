import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { CaptionSettings, ChunkedTranscript } from '@/types';

// Convert #RRGGBB to ASS &H00BBGGRR& format
function hexToAssColor(hex: string) {
  if (!hex) return "&H00FFFFFF&"; // fallback to white
  hex = hex.replace("#", "");
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  const r = hex.substring(0, 2);
  const g = hex.substring(2, 4);
  const b = hex.substring(4, 6);
  return `&H00${b}${g}${r}&`;
}

// Convert seconds to ASS timestamp (H:MM:SS.cs)
function formatAssTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${cs.toString().padStart(2, "0")}`;
}

// Clean font family string (e.g. "var(--font-inter)" to "Inter")
// In a real app we might need to actually include the font file in ffmpeg's virtual FS.
const FONT_URLS: Record<string, string> = {
  "Inter": "https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf", // Fallback to Roboto
  "Roboto": "https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf",
  "Kanit": "https://raw.githubusercontent.com/google/fonts/main/ofl/kanit/Kanit-Regular.ttf",
  "Prompt": "https://raw.githubusercontent.com/google/fonts/main/ofl/prompt/Prompt-Regular.ttf"
};

function getCleanFontName(fontFamily: string) {
  if (fontFamily.includes("inter")) return "Inter";
  if (fontFamily.includes("roboto")) return "Roboto";
  if (fontFamily.includes("kanit")) return "Kanit";
  if (fontFamily.includes("prompt")) return "Prompt";
  return "Arial";
}

// Convert 0-100 opacity to ASS alpha (0-255 inverted, Hex format)
function getAssAlpha(opacityPercent: number) {
  // 100% opacity = 0 (opaque in ASS)
  // 0% opacity = 255 (transparent in ASS)
  const alphaObj = Math.floor(255 - ((opacityPercent || 0) / 100) * 255);
  return alphaObj.toString(16).padStart(2, "0").toUpperCase();
}

// Convert #RRGGBB and opacity to ASS &HAABBGGRR& format
function hexToAssColorWithAlpha(hex: string, opacityPercent: number) {
  if (!hex) return `&H${getAssAlpha(opacityPercent)}000000&`; // fallback to black bg
  hex = hex.replace("#", "");
  if (hex.length === 3) {
    hex = hex.split("").map((c) => c + c).join("");
  }
  const r = hex.substring(0, 2);
  const g = hex.substring(2, 4);
  const b = hex.substring(4, 6);
  const a = getAssAlpha(opacityPercent);
  return `&H${a}${b}${g}${r}&`;
}

export function generateAssFile(
  chunks: ChunkedTranscript[],
  settings: CaptionSettings,
  videoWidth: number = 1080,
  videoHeight: number = 1920
): string {
  const fontName = getCleanFontName(settings.fontFamily);
  const textColor = hexToAssColor(settings.textColor);
  const highlightColor = hexToAssColor(settings.highlightColor);
  const strokeColor = hexToAssColor(settings.strokeColor);
  const shadowColor = "&H00000000&"; // Simplified black shadow
  
  const marginV = Math.floor((settings.yPosition / 100) * videoHeight) - (settings.fontSize / 2);

  // Background Box Style (Layer 0)
  const hasBg = settings.bgOpacity > 0;
  const bgColorAss = hexToAssColorWithAlpha(settings.bgColor, settings.bgOpacity);
  const bgTransparentText = "&HFF000000&"; // Invisible text
  
  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${settings.fontSize},${textColor},${textColor},${strokeColor},${shadowColor},-1,0,0,0,100,100,0,0,1,${settings.strokeWidth},${settings.shadowOffsetX || settings.shadowBlur},8,10,10,${Math.max(0, marginV)},1
${hasBg ? `Style: BgBox,${fontName},${settings.fontSize},${bgTransparentText},${bgTransparentText},${bgColorAss},&H00000000&,-1,0,0,0,100,100,0,0,3,${settings.bgPadding},0,8,10,10,${Math.max(0, marginV)},1\n` : ''}
[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let events = "";
  
  for (const chunk of chunks) {
    const spaceStr = settings.wordSpacing > 0 ? `{\\hsp${settings.wordSpacing}}` : " ";
    
    if (!settings.enableHighlight) {
      const start = formatAssTime(chunk.start_time);
      const end = formatAssTime(chunk.end_time);
      const textWithColors = `{\\c${textColor}}${chunk.words.map(w => w.word).join(spaceStr)}`;
      const textWithoutColors = chunk.words.map(w => w.word).join(spaceStr);

      if (hasBg) {
        events += `Dialogue: 0,${start},${end},BgBox,,0,0,0,,${textWithoutColors}\n`;
        events += `Dialogue: 1,${start},${end},Default,,0,0,0,,${textWithColors}\n`;
      } else {
        events += `Dialogue: 0,${start},${end},Default,,0,0,0,,${textWithColors}\n`;
      }
      continue;
    }

    for (let i = 0; i < chunk.words.length; i++) {
      const activeWord = chunk.words[i];
      const start = formatAssTime(activeWord.start_time);
      const end = i < chunk.words.length - 1 
        ? formatAssTime(chunk.words[i + 1].start_time)
        : formatAssTime(activeWord.end_time);

      let textWithColors = "";
      let textWithoutColors = "";
      
      for (let j = 0; j < chunk.words.length; j++) {
        const w = chunk.words[j];
        if (j === i && settings.enableHighlight) {
          textWithColors += `{\\c${highlightColor}}{\\fscx110\\fscy110}${w.word}{\\fscx100\\fscy100}${spaceStr}`;
        } else {
          textWithColors += `{\\c${textColor}}${w.word}${spaceStr}`;
        }
        textWithoutColors += `${w.word}${spaceStr}`;
      }
      
      textWithColors = textWithColors.trim();
      textWithoutColors = textWithoutColors.trim();
      
      if (hasBg) {
        events += `Dialogue: 0,${start},${end},BgBox,,0,0,0,,${textWithoutColors}\n`;
        events += `Dialogue: 1,${start},${end},Default,,0,0,0,,${textWithColors}\n`;
      } else {
        events += `Dialogue: 0,${start},${end},Default,,0,0,0,,${textWithColors}\n`;
      }
    }
  }

  return header + events;
}

const getVideoDimensions = (file: File): Promise<{width: number, height: number}> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve({ width: video.videoWidth, height: video.videoHeight });
      URL.revokeObjectURL(video.src);
    };
    video.src = URL.createObjectURL(file);
  });
}

// Reusable ffmpeg instance
let ffmpeg: FFmpeg | null = null;

export async function exportVideo(
  videoFile: File,
  chunks: ChunkedTranscript[],
  settings: CaptionSettings,
  onProgress: (progress: number) => void
): Promise<string> {
  const ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
  });

  const progressHandler = ({ progress, time }: { progress: number, time: number }) => {
    onProgress(progress * 100);
  };
  ffmpeg.on('progress', progressHandler);

  const videoName = 'input.mp4';
  const assName = 'subs.ass';
  const outputName = 'output.mp4';

  // Get exact video dimensions
  const dims = await getVideoDimensions(videoFile);

  // Write video
  await ffmpeg.writeFile(videoName, await fetchFile(videoFile));

  // Fetch a default font so ffmpeg can render text (ffmpeg.wasm has no built-in fonts)
  const cleanFontName = getCleanFontName(settings.fontFamily);
  const fontName = `${cleanFontName}.ttf`;
  const fontUrl = FONT_URLS[cleanFontName] || FONT_URLS["Kanit"]; // Fallback to Kanit to ensure Thai support
  const fontData = await fetchFile(fontUrl);
  await ffmpeg.writeFile(fontName, fontData);

  // ALWAYS download Kanit as a system-level fallback in the virtual FS!
  // This guarantees that if the user selects a font like Roboto (which has no Thai), 
  // libass will automatically fall back to Kanit for Thai characters instead of rendering boxes.
  if (cleanFontName !== "Kanit") {
    const fallbackData = await fetchFile(FONT_URLS["Kanit"]);
    await ffmpeg.writeFile("Kanit-Fallback.ttf", fallbackData);
  }

  // Provide exact dimensions to ASS generator
  const assContent = generateAssFile(chunks, settings, dims.width, dims.height);
  await ffmpeg.writeFile(assName, new TextEncoder().encode(assContent));

  // Run FFmpeg command. fontsdir=. so it finds font.ttf in the current working directory
  await ffmpeg.exec([
    '-i', videoName,
    '-vf', `ass=${assName}:fontsdir=.`,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-threads', '4', // Limit to 4 cores to prevent worker exhaustion/OOM
    '-crf', '28', // Lower quality slightly for faster encoding
    '-c:a', 'copy',
    outputName
  ]);

  ffmpeg.off('progress', progressHandler);

  const data = await ffmpeg.readFile(outputName);
  const blob = new Blob([data as any], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  
  ffmpeg.terminate(); // Free memory and Web Workers
  
  return url;
}

export async function extractAudio(videoFile: File, onProgress: (p: number) => void): Promise<File> {
  const ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    workerURL: await toBlobURL(`${baseURL}/ffmpeg-core.worker.js`, 'text/javascript'),
  });

  const progressHandler = ({ progress }: { progress: number }) => {
    onProgress(progress * 100);
  };
  ffmpeg.on('progress', progressHandler);

  const videoName = 'input.mp4';
  const audioName = 'output.mp3';

  await ffmpeg.writeFile(videoName, await fetchFile(videoFile));

  // Extract audio as 128k mp3 (good enough for transcription)
  await ffmpeg.exec([
    '-i', videoName,
    '-vn', // No video
    '-acodec', 'libmp3lame',
    '-ar', '16000', // 16kHz is perfect for speech recognition
    '-ac', '1', // Mono
    '-b:a', '64k', // Low bitrate to save memory/upload time
    audioName
  ]);

  ffmpeg.off('progress', progressHandler);

  const data = await ffmpeg.readFile(audioName);
  const blob = new Blob([data as any], { type: 'audio/mp3' });
  const file = new File([blob], 'audio.mp3', { type: 'audio/mp3' });
  
  ffmpeg.terminate(); // Free memory and Web Workers
  
  return file;
}
