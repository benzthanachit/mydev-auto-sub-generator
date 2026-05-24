const fs = require('fs');

const parseTime = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const cleaned = val.trim().replace(/s$/, "");
    if (cleaned.includes(":")) {
      const parts = cleaned.split(":");
      let hours = 0;
      let minutes = 0;
      let seconds = 0;
      if (parts.length === 3) {
        hours = parseFloat(parts[0]) || 0;
        minutes = parseFloat(parts[1]) || 0;
        seconds = parseFloat(parts[2]) || 0;
      } else if (parts.length === 2) {
        minutes = parseFloat(parts[0]) || 0;
        seconds = parseFloat(parts[1]) || 0;
      }
      return hours * 3600 + minutes * 60 + seconds;
    }
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
};

const runTest = (name, rawData) => {
  console.log(`\n=== Running Test: ${name} ===`);
  
  let maxTimeSeen = 0;
  let lastRawVal = 0;
  let minuteOffset = 0;

  const adjustTime = (rawVal) => {
    // If the previous raw value was > 40, and the new raw value has jumped backward by > 20 seconds,
    // it is a minute boundary reset. Increment the offset by 60 seconds.
    if (lastRawVal > 40 && rawVal < lastRawVal - 20) {
      minuteOffset += 60;
      console.log(`[Parser] Detected minute boundary reset! Adding +60s offset. (lastRawVal: ${lastRawVal}, rawVal: ${rawVal}, newOffset: ${minuteOffset})`);
    }

    lastRawVal = rawVal;
    let timeInSeconds = rawVal + minuteOffset;
    
    // Clean up float representation
    timeInSeconds = Math.round(timeInSeconds * 1000) / 1000;

    if (timeInSeconds > maxTimeSeen) {
      maxTimeSeen = timeInSeconds;
    }
    return timeInSeconds;
  };

  const parsedWords = rawData.map((w, index) => {
    const parsedStart = parseTime(w.start_time);
    const parsedEnd = parseTime(w.end_time);

    const finalStart = adjustTime(parsedStart);
    const finalEnd = adjustTime(parsedEnd);

    return {
      word: w.word,
      raw_start: w.start_time,
      raw_end: w.end_time,
      final_start: finalStart,
      final_end: finalEnd,
    };
  });

  console.log("First 3 words:", parsedWords.slice(0, 3));
  console.log("Middle/Transition words:", parsedWords.slice(Math.max(0, Math.floor(parsedWords.length / 2) - 2), Math.floor(parsedWords.length / 2) + 3));
  console.log("Last 3 words:", parsedWords.slice(-3));
};

// Test Case 1: The user's buggy standard absolute seconds video
const standardSecondsData = [
  { word: "start", start_time: 0.3, end_time: 1.5 },
  { word: "before_limit", start_time: 59.4, end_time: 76.0 },
  { word: "after_limit_1", start_time: 76.0, end_time: 179.0 },
  { word: "after_limit_2", start_time: 179.0, end_time: 229.0 },
];
runTest("Standard Absolute Seconds (No resets)", standardSecondsData);

// Test Case 2: The Gemini reset seconds video (from raw_response.json)
const resetData = JSON.parse(fs.readFileSync('raw_response.json', 'utf8'));
runTest("Gemini Reset Seconds (from raw_response.json)", resetData);



