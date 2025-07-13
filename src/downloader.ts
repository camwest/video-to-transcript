import { spawn } from "child_process";
import { promisify } from "util";
import { rm, readdir, readFile } from "fs/promises";
import { join, resolve } from "path";
import { existsSync } from "fs";
import type { VideoMetadata } from "./ebook";
import { getWorkspaceDir } from "./workspace";

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

  // Get workspace directory for this URL
  const workspace = await getWorkspaceDir(url);
  const { projectDir } = workspace;

  // Check for existing video files in workspace if not forcing
  if (!force) {
    try {
      const files = await readdir(projectDir);
      
      // Look for video files
      const existingVideo = files.find(file => 
        file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.mkv')
      );
      
      if (existingVideo) {
        const videoPath = resolve(projectDir, existingVideo);
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
        
        return { videoPath, tempDir: projectDir, metadata };
      }
    } catch (error) {
      // Directory doesn't exist yet, will be created during download
    }
  }

  // Use workspace directory
  const tempDir = outputDir || projectDir;
  
  // Use a simple filename since we're in a dedicated directory
  const videoFilename = "video.%(ext)s";
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
          file.startsWith('video') && (file.endsWith('.mp4') || file.endsWith('.webm') || file.endsWith('.mkv'))
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

// Cleanup function removed - files are kept by default
// Use --cleanup flag in CLI to remove workspace directory