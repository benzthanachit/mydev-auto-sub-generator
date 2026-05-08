export interface TranscriptWord {
  word: string;
  start_time: number;
  end_time: number;
  hidden?: boolean;
  highlighted?: boolean;
}

export interface ChunkedTranscript {
  id: string;
  words: TranscriptWord[];
  start_time: number;
  end_time: number;
  hidden?: boolean;
}

export interface CaptionSettings {
  wordsPerScreen: number;
  fontFamily: string;
  textColor: string;
  highlightColor: string;
  strokeColor: string;
  strokeWidth: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  yPosition: number;
  fontSize: number;
  maxGapTime: number; // seconds
  wordSpacing: number; // px
  bgColor: string; // hex
  bgOpacity: number; // 0-100
  bgPadding: number; // px
  enableHighlight: boolean;
}

export const DEFAULT_SETTINGS: CaptionSettings = {
  wordsPerScreen: 3,
  fontFamily: "var(--font-kanit)",
  textColor: "#ffffff",
  highlightColor: "#eab308", // Yellow
  strokeColor: "#000000",
  strokeWidth: 4,
  shadowColor: "rgba(0,0,0,0.8)",
  shadowBlur: 10,
  shadowOffsetX: 0,
  shadowOffsetY: 4,
  yPosition: 80, // percentage from top
  fontSize: 48,
  maxGapTime: 1.0, // 1 second
  wordSpacing: 8,
  bgColor: "#000000",
  bgOpacity: 0, // 0 means no background
  bgPadding: 16,
  enableHighlight: true,
};
