import { TranscriptWord, ChunkedTranscript } from "@/types";

export function chunkTranscript(
  words: TranscriptWord[],
  wordsPerScreen: number,
  maxGapTime: number = 1.0
): ChunkedTranscript[] {
  const chunks: ChunkedTranscript[] = [];
  
  let currentChunkWords: TranscriptWord[] = [];
  
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    
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
