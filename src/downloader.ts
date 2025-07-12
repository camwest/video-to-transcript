import { spawn } from "child_process";
import { promisify } from "util";
import { mkdtemp, rm, readdir, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join, resolve } from "path";
import { existsSync } from "fs";
import type { VideoMetadata } from "./ebook";

export interface DownloadOptions {
  url: string;
  quality?: string;
  outputDir?: string;
  force?: boolean;
}

export interface DownloadResult {
  videoPath: string;
  tempDir: string;
  metadata?: VideoMetadata;
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
      
      // Try to load metadata from existing info.json file
      const infoJsonPath = videoPath.replace(/\.(mp4|webm|mkv)$/, '.info.json');
      let metadata: VideoMetadata | undefined;
      if (existsSync(infoJsonPath)) {
        try {
          const infoJson = await readFile(infoJsonPath, 'utf-8');
          metadata = JSON.parse(infoJson);
        } catch (error) {
          console.warn("Failed to load existing metadata:", error);
        }
      }
      
      return { videoPath, tempDir: cwd, metadata };
    }
  }

  // Create temp directory if not provided
  const tempDir = outputDir || await mkdtemp(join(tmpdir(), "video-to-transcript-"));
  
  // Use a deterministic filename based on video ID
  const videoFilename = videoId ? `${videoId}.%(ext)s` : "video.%(ext)s";
  const outputPath = join(tempDir, videoFilename);

  return new Promise((resolve, reject) => {
    const args = [
      "-f", quality,
      "-o", outputPath,
      "--no-playlist",
      "--no-warnings",
      "--quiet",
      "--progress",
      "--write-info-json",
      "--write-thumbnail",
      url
    ];

    const ytDlp = spawn("yt-dlp", args);
    let error = "";

    ytDlp.stdout.on("data", (data) => {
      const output = data.toString();
      
      if (output.includes("[download]") && output.includes("%")) {
        // Progress update - use carriage return to overwrite the line
        process.stdout.write(`\r${output.trim()}`);
      } else if (output.trim()) {
        // Other messages
        console.log(output.trim());
      }
    });

    ytDlp.stderr.on("data", (data) => {
      error += data.toString();
    });

    ytDlp.on("close", async (code) => {
      // Print newline to clear the progress line
      console.log("");
      
      if (code !== 0) {
        reject(new Error(`yt-dlp exited with code ${code}: ${error}`));
        return;
      }
      
      // Determine the video file path based on our deterministic naming
      try {
        const files = await readdir(tempDir);
        const videoFile = files.find(file => 
          (videoId && file.startsWith(videoId)) || (!videoId && file.startsWith('video'))
        );
        
        if (!videoFile) {
          reject(new Error("Downloaded video file not found"));
          return;
        }
        
        const videoPath = join(tempDir, videoFile);
        console.log(`✓ Video downloaded: ${videoPath}`);
        
        // Try to load the metadata from the info.json file
        let metadata: VideoMetadata | undefined;
        const infoJsonPath = videoPath.replace(/\.(mp4|webm|mkv)$/, '.info.json');
        
        try {
          const infoJson = await readFile(infoJsonPath, 'utf-8');
          metadata = JSON.parse(infoJson);
        } catch (error) {
          console.warn("Failed to load video metadata:", error);
        }
        
        resolve({ videoPath, tempDir, metadata });
      } catch (error) {
        reject(new Error(`Failed to process downloaded file: ${error}`));
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