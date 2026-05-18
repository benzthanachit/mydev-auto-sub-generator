import { TranscriptWord, ChunkedTranscript } from "@/types";

export function chunkTranscript(
  words: TranscriptWord[],
  wordsPerScreen: number,
  maxGapTime: number = 1.0
): ChunkedTranscript[] {
  if (!words || !Array.isArray(words)) return [];

  // Robust parsing to handle various API output formats (e.g. strings, startTime/endTime)
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

  const normalizedWords: TranscriptWord[] = words.map((w: any) => {
    const start = w.start_time !== undefined ? w.start_time : (w.startTime !== undefined ? w.startTime : w.start);
    const end = w.end_time !== undefined ? w.end_time : (w.endTime !== undefined ? w.endTime : w.end);
    return {
      word: String(w.word || ""),
      start_time: parseTime(start),
      end_time: parseTime(end),
      hidden: w.hidden ?? false,
      highlighted: w.highlighted ?? true, // Default to true so words are highlighted when spoken unless deselected
      segment_id: w.segment_id,
    };
  });

  const chunks: ChunkedTranscript[] = [];
  
  // Check if we have faster-whisper segment IDs. If so, group by segment.
  const hasSegments = normalizedWords.some(w => w.segment_id !== undefined);
  
  if (hasSegments) {
    let currentSegmentId: string | number | undefined = normalizedWords[0]?.segment_id;
    let currentChunkWords: TranscriptWord[] = [];
    
    for (let i = 0; i < normalizedWords.length; i++) {
      const word = normalizedWords[i];
      if (word.segment_id !== currentSegmentId) {
        if (currentChunkWords.length > 0) {
          chunks.push({
            id: `chunk-${chunks.length}`,
            words: currentChunkWords,
            start_time: currentChunkWords[0].start_time,
            end_time: currentChunkWords[currentChunkWords.length - 1].end_time,
          });
        }
        currentSegmentId = word.segment_id;
        currentChunkWords = [word];
      } else {
        currentChunkWords.push(word);
      }
    }
    if (currentChunkWords.length > 0) {
      chunks.push({
        id: `chunk-${chunks.length}`,
        words: currentChunkWords,
        start_time: currentChunkWords[0].start_time,
        end_time: currentChunkWords[currentChunkWords.length - 1].end_time,
      });
    }
    return chunks;
  }

  // Fallback to legacy wordsPerScreen chunking
  let currentChunkWords: TranscriptWord[] = [];
  for (let i = 0; i < normalizedWords.length; i++) {
    const word = normalizedWords[i];
    
    // Check if we need to force a split due to a long gap
    if (currentChunkWords.length > 0) {
      const prevWord = currentChunkWords[currentChunkWords.length - 1];
      if (word.start_time - prevWord.end_time > maxGapTime) {
        // Push current chunk and start a new one
        chunks.push({
          id: `chunk-${chunks.length}`,
          words: currentChunkWords,
          start_time: currentChunkWords[0].start_time,
          end_time: currentChunkWords[currentChunkWords.length - 1].end_time,
        });
        currentChunkWords = [];
      }
    }
    
    currentChunkWords.push(word);
    
    // Check if we reached the max words per screen
    if (currentChunkWords.length >= wordsPerScreen) {
      chunks.push({
        id: `chunk-${chunks.length}`,
        words: currentChunkWords,
        start_time: currentChunkWords[0].start_time,
        end_time: currentChunkWords[currentChunkWords.length - 1].end_time,
      });
      currentChunkWords = [];
    }
  }
  
  // Push any remaining words
  if (currentChunkWords.length > 0) {
    chunks.push({
      id: `chunk-${chunks.length}`,
      words: currentChunkWords,
      start_time: currentChunkWords[0].start_time,
      end_time: currentChunkWords[currentChunkWords.length - 1].end_time,
    });
  }
  
  return chunks;
}

export function generateSRT(chunks: ChunkedTranscript[]): string {
  if (!chunks || chunks.length === 0) return "";

  const formatTime = (seconds: number) => {
    const pad = (num: number, size: number) => String(num).padStart(size, '0');
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${pad(hrs, 2)}:${pad(mins, 2)}:${pad(secs, 2)},${pad(ms, 3)}`;
  };

  let srt = "";
  let index = 1;

  for (const chunk of chunks) {
    // Only include visible words
    const visibleWords = chunk.words.filter(w => !w.hidden);
    if (visibleWords.length === 0) continue;
    
    // Recalculate start and end times based on visible words, or fallback to chunk times
    const startTime = visibleWords[0]?.start_time ?? chunk.start_time;
    const endTime = visibleWords[visibleWords.length - 1]?.end_time ?? chunk.end_time;
    const text = visibleWords.map(w => w.word).join(" ");

    srt += `${index}\n`;
    srt += `${formatTime(startTime)} --> ${formatTime(endTime)}\n`;
    srt += `${text}\n\n`;
    index++;
  }

  return srt.trim();
}
