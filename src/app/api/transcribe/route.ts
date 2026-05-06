import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

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

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      },
    ]);

    const responseText = result.response.text();
    
    // Attempt to parse the response text as JSON
    let transcription = [];
    try {
      // Strip markdown code block backticks if Gemini accidentally includes them
      const cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim();
      transcription = JSON.parse(cleanJson);
    } catch (parseError) {
      console.error("Failed to parse Gemini response as JSON:", responseText);
      throw new Error("Invalid response format from Gemini");
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
