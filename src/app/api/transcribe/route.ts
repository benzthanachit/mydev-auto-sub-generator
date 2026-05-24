import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import fs from "fs/promises";

export const dynamic = "force-dynamic";

// Ensure the user has added GEMINI_API_KEY to their .env.local
const apiKey = process.env.GEMINI_API_KEY;

export async function POST(req: NextRequest) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set in the environment variables." },
      { status: 500 }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // Convert file to base64
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");

    const prompt = `
      Act as an expert transcriptionist.
      Please transcribe this audio/video file exactly as spoken.
      
      CRITICAL TIMESTAMP RULE:
      The timestamps 'start_time' and 'end_time' MUST be absolute, monotonically increasing numbers in seconds from the beginning of the file.
      Do NOT reset the timestamps back to 0 or 1 when a new minute starts (for example, 1 minute 5 seconds must be 65.0, NOT 5.0 or 1.05).
      Keep counting upwards continuously (e.g., 60.0, 75.5, 120.0, etc.).
      
      OUTPUT FORMAT:
      You must return ONLY a valid JSON array containing the transcript with word-level timestamps.
      Do not include any markdown formatting like \`\`\`json. Just return the raw JSON array.
      
      Example output format:
      [
        {"word": "Hello", "start_time": 0.0, "end_time": 0.5},
        {"word": "world", "start_time": 0.5, "end_time": 1.0}
      ]
    `;

    const modelNames = ["gemini-2.5-flash", "gemini-1.5-flash", "gemini-1.5-pro"];
    let result = null;
    let lastError = null;

    for (const modelName of modelNames) {
      const model = genAI.getGenerativeModel({ model: modelName });
      let retries = 3;
      let delay = 2000;
      let success = false;

      while (retries > 0) {
        try {
          console.log(`Sending transcription request to model: ${modelName} (retries remaining: ${retries})...`);
          result = await model.generateContent({
            contents: [
              {
                role: "user",
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      data: base64Data,
                      mimeType: file.type,
                    },
                  }
                ]
              }
            ],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: SchemaType.ARRAY,
                items: {
                  type: SchemaType.OBJECT,
                  properties: {
                    word: { type: SchemaType.STRING },
                    start_time: { type: SchemaType.NUMBER },
                    end_time: { type: SchemaType.NUMBER }
                  },
                  required: ["word", "start_time", "end_time"]
                }
              }
            }
          });
          success = true;
          break; // Success, exit retry loop
        } catch (err: any) {
          lastError = err;
          const is503 = err.status === 503 || 
                        err.message?.includes("503") || 
                        err.message?.includes("high demand") || 
                        err.message?.includes("overloaded") || 
                        err.message?.includes("Service Unavailable");

          const is429 = err.status === 429 ||
                        err.message?.includes("429") ||
                        err.message?.includes("Quota exceeded") ||
                        err.message?.includes("Too Many Requests");

          if (is503 || is429) {
            retries--;
            if (retries === 0) {
              console.warn(`Model ${modelName} failed with 503/429 status after all retries.`);
              break; // Try next model in the outer loop
            }

            let retryAfterMs = delay;
            if (is429) {
              // Attempt to extract dynamic retry delay from API response details or message
              const retryInfo = err.errorDetails?.find?.((d: any) => d['@type']?.includes('RetryInfo') || d.retryDelay);
              if (retryInfo && retryInfo.retryDelay) {
                const seconds = parseFloat(retryInfo.retryDelay.replace('s', ''));
                if (!isNaN(seconds)) {
                  retryAfterMs = Math.max(seconds * 1000 + 1000, 2000); // add 1s safety buffer
                }
              } else {
                const match = err.message?.match(/Please retry in (\d+(\.\d+)?)s/);
                if (match && match[1]) {
                  const seconds = parseFloat(match[1]);
                  if (!isNaN(seconds)) {
                    retryAfterMs = Math.max(seconds * 1000 + 1000, 2000); // add 1s safety buffer
                  }
                }
              }
              console.log(`Gemini 429 Rate Limit error on ${modelName}, waiting for ${Math.round(retryAfterMs / 1000)}s before retrying...`);
            } else {
              console.log(`Gemini 503 Overload error on ${modelName}, retrying in ${delay}ms...`);
            }

            await new Promise(resolve => setTimeout(resolve, retryAfterMs));
            delay *= 2; // Exponential backoff for subsequent retries if needed
          } else {
            throw err; // Re-throw non-retryable errors immediately
          }
        }
      }

      if (success && result) {
        break; // Successfully got transcription, exit the model outer loop!
      }
    }

    if (!result) {
      throw new Error(`All Gemini models are currently overloaded (503). Last error: ${lastError?.message || "Unknown error"}`);
    }

    const responseText = result.response.text();
    
    // Write raw response to workspace for debugging
    try {
      await fs.writeFile("raw_response.json", responseText);
      console.log("Wrote raw Gemini response to raw_response.json in the workspace root.");
    } catch (fsErr) {
      console.error("Failed to write debug raw_response.json:", fsErr);
    }
    
    // Attempt to parse the response text as JSON
    let transcription = [];
    try {
      let cleanJson = responseText.trim();
      
      // Extract everything between the first '[' and the last ']'
      const startIndex = cleanJson.indexOf('[');
      const endIndex = cleanJson.lastIndexOf(']');
      
      if (startIndex !== -1 && endIndex !== -1) {
        cleanJson = cleanJson.substring(startIndex, endIndex + 1);
      }
      
      // Fix trailing commas which break JSON.parse
      cleanJson = cleanJson.replace(/,\s*]/g, ']');
      cleanJson = cleanJson.replace(/,\s*}/g, '}');
      
      // Remove bad control characters (ASCII 0-31) which break JSON.parse,
      // but preserve tabs and newlines if they are within strings (though they shouldn't be).
      cleanJson = cleanJson.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, "");
      
      transcription = JSON.parse(cleanJson);
    } catch (parseError: any) {
      console.error("Failed to parse Gemini response as JSON. Error:", parseError.message);
      console.error("Raw response length:", responseText.length);
      console.error("Raw response:", responseText);
      throw new Error(`AI returned invalid JSON. Please try again. Error: ${parseError.message}. Preview: ` + responseText.substring(0, 100).replace(/\n/g, ' '));
    }

    return NextResponse.json({ transcription });
  } catch (error: any) {
    console.error("Transcription API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to transcribe video" },
      { status: 500 }
    );
  }
}
