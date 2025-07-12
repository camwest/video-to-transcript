import { spawn } from "child_process";
import { promisify } from "util";
import { mkdtemp, rm, readdir } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { existsSync } from "fs";

export interface DownloadOptions {
  url: string;
  quality?: string;
  outputDir?: string;
  force?: boolean;
}

export interface DownloadResult {
  videoPath: string;
  tempDir: string;
}

export async function downloadVideo(options: DownloadOptions): Promise<DownloadResult> {
  const { url, quality = "best[height<=480]", outputDir, force = false } = options;

  // Extract video ID from URL
  const videoIdMatch = url.match(/(?:v=|\/)([\w-]{11})(?:\?|&|$)/);
  const videoId = videoIdMatch ? videoIdMatch[1] : null;

  // If not forcing and we have a video ID, check for existing video files
  if (!force && videoId) {
    const cwd = process.cwd();
    const files = await readdir(cwd);
    
    // Look for video files containing the video ID
    const existingVideo = files.find(file => 
      file.includes(videoId) && 
      (file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.mkv'))
    );
    
    if (existingVideo) {
      const videoPath = resolve(cwd, existingVideo);
      console.log(`✓ Using existing video file: ${videoPath}`);
      return { videoPath, tempDir: cwd };
    }
  }

  // Create temp directory if not provided
  const tempDir = outputDir || await mkdtemp(join(tmpdir(), "video-to-transcript-"));
  const outputPath = join(tempDir, "%(title)s.%(ext)s");

  return new Promise((resolve, reject) => {
    const args = [
      "-f", quality,
      "-o", outputPath,
      "--no-playlist",
      "--no-warnings",
      "--quiet",
      "--progress",
      url
    ];

    const ytDlp = spawn("yt-dlp", args);
    let videoPath = "";
    let error = "";

    ytDlp.stdout.on("data", (data) => {
      const output = data.toString();
      
      // Try to capture the output filename
      const match = output.match(/\[download\] Destination: (.+)/);
      if (match) {
        videoPath = match[1].trim();
        console.log(output.trim());
      } else {
        // Also check for already downloaded message
        const alreadyMatch = output.match(/\[download\] (.+) has already been downloaded/);
        if (alreadyMatch) {
          videoPath = alreadyMatch[1].trim();
          console.log(output.trim());
        } else if (output.includes("[download]") && output.includes("%")) {
          // Progress update - use carriage return to overwrite the line
          process.stdout.write(`\r${output.trim()}`);
        } else if (output.trim()) {
          // Other messages
          console.log(output.trim());
        }
      }
    });

    ytDlp.stderr.on("data", (data) => {
      error += data.toString();
    });

    ytDlp.on("close", (code) => {
      // Print newline to clear the progress line
      console.log("");
      
      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}: ${error}`));
      } else if (!videoPath) {
        // If we didn't capture the path, try to find the downloaded file
        reject(new Error("Could not determine downloaded file path"));
      } else {
        resolve({ videoPath, tempDir });
      }
    });

    ytDlp.on("error", (err) => {
      reject(new Error(`Failed to spawn yt-dlp: ${err.message}`));
    });
  });
}

export async function cleanupTempDir(tempDir: string): Promise<void> {
  try {
    await rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    console.error(`Failed to cleanup temp directory: ${error}`);
  }
}