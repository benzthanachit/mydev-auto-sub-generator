import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { CaptionSettings, ChunkedTranscript } from '@/types';

// Convert #RRGGBB to ASS &H00BBGGRR& format
function hexToAssColor(hex: string) {
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
function getCleanFontName(fontFamily: string) {
  if (fontFamily.includes("inter")) return "Inter";
  if (fontFamily.includes("roboto")) return "Roboto";
  if (fontFamily.includes("montserrat")) return "Montserrat";
  if (fontFamily.includes("bangers")) return "Bangers";
  return "Arial";
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
  
  // Convert RGBA shadow to ASS color. Assuming rgba(0,0,0,0.8) for now.
  const shadowColor = "&H00000000&"; // Simplified black shadow
  
  // Calculate vertical margin from Y position percentage
  // Alignment 8 is Top Center, 2 is Bottom Center, 5 is Middle Center
  // Let's use Alignment 2 (Bottom Center) and marginV to position it
  // Or better, use Alignment 5 (Middle Center) and specify X,Y with pos
  // But standard ASS MarginV with Alignment=8 (Top) is easiest.
  const marginV = Math.floor((settings.yPosition / 100) * videoHeight) - (settings.fontSize / 2);

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: ${videoWidth}
PlayResY: ${videoHeight}
WrapStyle: 1

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,${fontName},${settings.fontSize},${textColor},${textColor},${strokeColor},${shadowColor},-1,0,0,0,100,100,0,0,1,${settings.strokeWidth},${settings.shadowOffsetX || settings.shadowBlur},8,10,10,${Math.max(0, marginV)},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
`;

  let events = "";

  for (const chunk of chunks) {
    // For each word in the chunk, we need to create a separate ASS event for its exact duration
    // so it can be highlighted, while the rest of the chunk is normal color.
    
    // Instead of doing it word-by-word with separate events covering the whole chunk time,
    // we generate a single text line for a specific sub-time range.
    
    for (let i = 0; i < chunk.words.length; i++) {
      const activeWord = chunk.words[i];
      const start = formatAssTime(activeWord.start_time);
      
      // The end time of this highlight state is the start of the next word, or the chunk end.
      const end = i < chunk.words.length - 1 
        ? formatAssTime(chunk.words[i + 1].start_time)
        : formatAssTime(activeWord.end_time);

      let text = "";
      for (let j = 0; j < chunk.words.length; j++) {
        const w = chunk.words[j];
        if (j === i) {
          text += `{\\c${highlightColor}}{\\fscx110\\fscy110}${w.word}{\\fscx100\\fscy100} `;
        } else {
          text += `{\\c${textColor}}${w.word} `;
        }
      }
      
      events += `Dialogue: 0,${start},${end},Default,,0,0,0,,${text.trim()}\n`;
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
  if (!ffmpeg) {
    ffmpeg = new FFmpeg();
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
    await ffmpeg.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
    });
  }

  ffmpeg.on('progress', ({ progress, time }) => {
    onProgress(progress * 100);
  });

  const videoName = 'input.mp4';
  const assName = 'subs.ass';
  const fontName = 'font.ttf';
  const outputName = 'output.mp4';

  // Get exact video dimensions
  const dims = await getVideoDimensions(videoFile);

  // Write video
  await ffmpeg.writeFile(videoName, await fetchFile(videoFile));

  // Fetch a default font so ffmpeg can render text (ffmpeg.wasm has no built-in fonts)
  // We use Roboto Regular as a safe fallback
  const fontData = await fetchFile('https://raw.githubusercontent.com/google/fonts/main/ofl/roboto/Roboto-Regular.ttf');
  await ffmpeg.writeFile(fontName, fontData);

  // Provide exact dimensions to ASS generator
  const assContent = generateAssFile(chunks, settings, dims.width, dims.height);
  await ffmpeg.writeFile(assName, new TextEncoder().encode(assContent));

  // Run FFmpeg command. fontsdir=/ so it finds font.ttf
  await ffmpeg.exec([
    '-i', videoName,
    '-vf', `ass=${assName}:fontsdir=/`,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-c:a', 'copy',
    outputName
  ]);

  const data = await ffmpeg.readFile(outputName);
  const blob = new Blob([data as any], { type: 'video/mp4' });
  const url = URL.createObjectURL(blob);
  
  return url;
}
