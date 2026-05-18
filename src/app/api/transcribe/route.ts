import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Convert file to buffer and save it to a temporary location
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Create a temp directory
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "whisper-"));
    const tempFilePath = path.join(tempDir, file.name || "input_audio.tmp");
    
    await fs.writeFile(tempFilePath, buffer);

    // Call the python script
    // Find python executable (prefer Anaconda on Mac if it exists)
    let pythonExec = "python3";
    try {
      await fs.access("/opt/anaconda3/bin/python3");
      pythonExec = "/opt/anaconda3/bin/python3";
    } catch {
      // fallback to default python3
    }
    
    const scriptPath = path.join(process.cwd(), "src", "scripts", "transcribe.py");
    const cmd = `"${pythonExec}" "${scriptPath}" "${tempFilePath}" --model large-v3-turbo --language th`;
    
    console.log(`Running transcription command: ${cmd}`);
    
    // We increase maxBuffer because JSON output for long videos can be large
    const { stdout, stderr } = await execAsync(cmd, { maxBuffer: 1024 * 1024 * 10 });
    
    // Clean up the temporary file and directory asynchronously
    fs.rm(tempDir, { recursive: true, force: true }).catch(console.error);

    let parsedOutput;
    try {
      parsedOutput = JSON.parse(stdout);
    } catch (parseError: any) {
      console.error("Failed to parse python script output.", stdout);
      console.error("stderr:", stderr);
      throw new Error("Invalid output from transcription script.");
    }

    if (parsedOutput.error) {
      throw new Error(`Transcription script error: ${parsedOutput.error}`);
    }

    // Map faster-whisper output to our frontend's expected format (if needed)
    // The frontend currently expects an array of words:
    // { word: string, start_time: number, end_time: number }
    // We'll return BOTH the flat word list (for backward compatibility) and the segments (for new logic)
    
    const transcription = [];
    const segments = parsedOutput.segments || [];

    for (const segment of segments) {
      if (segment.words) {
        for (const w of segment.words) {
          transcription.push({
            word: w.word,
            start_time: w.start,
            end_time: w.end,
            segment_id: segment.id // Optional tag for frontend to know which segment it belongs to
          });
        }
      }
    }

    return NextResponse.json({ 
      transcription, 
      segments // Passing segments as well so the frontend can use natural chunking
    });
  } catch (error: any) {
    console.error("Transcription API Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to transcribe video" },
      { status: 500 }
    );
  }
}
