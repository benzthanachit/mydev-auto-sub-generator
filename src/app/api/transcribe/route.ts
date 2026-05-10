import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

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
      
      OUTPUT FORMAT:
      You must return ONLY a valid JSON array containing the transcript with word-level timestamps.
      Do not include any markdown formatting like \`\`\`json. Just return the raw JSON array.
      
      Example output format:
      [
        {"word": "Hello", "start_time": 0.0, "end_time": 0.5},
        {"word": "world", "start_time": 0.5, "end_time": 1.0}
      ]
    `;

    let result;
    let retries = 3;
    let delay = 2000;

    while (retries > 0) {
      try {
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
        break; // Success, exit retry loop
      } catch (err: any) {
        if (err.status === 503 || err.message?.includes("503") || err.message?.includes("high demand")) {
          retries--;
          if (retries === 0) {
            throw new Error("Gemini API is currently overloaded (503). Please try again in a few minutes.");
          }
          console.log(`Gemini 503 error, retrying in ${delay}ms... (${retries} retries left)`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2; // Exponential backoff
        } else {
          throw err; // Re-throw non-503 errors immediately
        }
      }
    }

    if (!result) {
      throw new Error("Failed to generate content after retries");
    }

    const responseText = result.response.text();
    
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
