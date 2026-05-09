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
    const videoFile = formData.get("video") as File;
    const assContent = formData.get("ass") as string;

    if (!videoFile || !assContent) {
      return NextResponse.json({ error: "Missing video file or ASS subtitle content" }, { status: 400 });
    }

    // Check if native ffmpeg is installed
    try {
      await execAsync("which ffmpeg");
    } catch {
      return NextResponse.json({
        error: "NATIVE_FFMPEG_NOT_FOUND",
        message: "Native ffmpeg not found on your Mac. Please run 'brew install ffmpeg' in your terminal first."
      }, { status: 400 });
    }

    // Create a unique temporary directory inside the OS temp dir
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "auto-sub-"));
    const videoPath = path.join(tempDir, "input.mp4");
    const assPath = path.join(tempDir, "subs.ass");
    const outputPath = path.join(tempDir, "output.mp4");

    // Write input files
    const videoBuffer = Buffer.from(await videoFile.arrayBuffer());
    await fs.writeFile(videoPath, videoBuffer);
    await fs.writeFile(assPath, assContent);

    // Run native ffmpeg using Apple Silicon's hardware acceleration (h264_videotoolbox)
    // -q:v 50 represents high-quality hardware encoding.
    // If it fails or is not supported, it falls back to native libx264 with visually lossless CRF 18.
    let ffmpegCmd = `ffmpeg -y -i "${videoPath}" -vf "ass=${assPath}" -c:v h264_videotoolbox -q:v 50 -c:a copy "${outputPath}"`;
    
    try {
      await execAsync(ffmpegCmd);
    } catch (hwError) {
      console.log("Hardware acceleration failed, falling back to CPU libx264...");
      ffmpegCmd = `ffmpeg -y -i "${videoPath}" -vf "ass=${assPath}" -c:v libx264 -preset fast -crf 18 -c:a copy "${outputPath}"`;
      await execAsync(ffmpegCmd);
    }

    // Read the processed video
    const outputBuffer = await fs.readFile(outputPath);

    // Clean up temp files asynchronously
    fs.rm(tempDir, { recursive: true, force: true }).catch(console.error);

    return new NextResponse(outputBuffer, {
      headers: {
        "Content-Type": "video/mp4",
        "Content-Disposition": `attachment; filename="subtitled-${videoFile.name || "video.mp4"}"`,
      },
    });
  } catch (error: any) {
    console.error("Native Export API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to export natively" }, { status: 500 });
  }
}
