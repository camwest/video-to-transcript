import { spawn } from "child_process";
import { join, parse } from "path";

export interface ExtractAudioOptions {
  videoPath: string;
  outputFormat?: "mp3" | "wav" | "m4a";
  bitrate?: string;
}

export interface ExtractAudioResult {
  audioPath: string;
}

export async function extractAudio(options: ExtractAudioOptions): Promise<ExtractAudioResult> {
  const { videoPath, outputFormat = "mp3", bitrate = "128k" } = options;
  
  const parsedPath = parse(videoPath);
  const audioPath = join(parsedPath.dir, `${parsedPath.name}.${outputFormat}`);

  // Get video duration first for progress calculation
  const duration = await getVideoDuration(videoPath);

  return new Promise((resolve, reject) => {
    const args = [
      "-i", videoPath,
      "-vn", // No video
      "-acodec", outputFormat === "mp3" ? "libmp3lame" : outputFormat === "m4a" ? "aac" : "pcm_s16le",
      "-ab", bitrate,
      "-y", // Overwrite output file
      "-progress", "pipe:2", // Output progress info to stderr
      audioPath
    ];

    const ffmpeg = spawn("ffmpeg", args);
    let error = "";
    let lastProgress = 0;

    ffmpeg.stderr.on("data", (data) => {
      const output = data.toString();
      
      // Parse progress information
      const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (timeMatch && duration > 0) {
        const hours = parseInt(timeMatch[1]);
        const minutes = parseInt(timeMatch[2]);
        const seconds = parseFloat(timeMatch[3]);
        const currentTime = hours * 3600 + minutes * 60 + seconds;
        const progress = Math.min(100, Math.round((currentTime / duration) * 100));
        
        if (progress > lastProgress) {
          lastProgress = progress;
          process.stdout.write(`\rExtracting audio... ${progress}%`);
        }
      }
      
      // Still capture errors
      if (output.includes("error") || output.includes("Error")) {
        error += output;
      }
    });

    ffmpeg.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffmpeg exited with code ${code}: ${error}`));
      } else {
        process.stdout.write("\rExtracting audio... 100%\n");
        resolve({ audioPath });
      }
    });

    ffmpeg.on("error", (err) => {
      reject(new Error(`Failed to spawn ffmpeg: ${err.message}`));
    });
  });
}

function getVideoDuration(videoPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const args = [
      "-i", videoPath,
      "-show_entries", "format=duration",
      "-v", "quiet",
      "-of", "csv=p=0"
    ];

    const ffprobe = spawn("ffprobe", args);
    let output = "";
    let error = "";

    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on("data", (data) => {
      error += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}: ${error}`));
      } else {
        const duration = parseFloat(output.trim());
        if (isNaN(duration)) {
          reject(new Error("Could not parse video duration"));
        } else {
          resolve(duration);
        }
      }
    });

    ffprobe.on("error", (err) => {
      reject(new Error(`Failed to spawn ffprobe: ${err.message}`));
    });
  });
}

export function getAudioDuration(audioPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const args = [
      "-i", audioPath,
      "-show_entries", "format=duration",
      "-v", "quiet",
      "-of", "csv=p=0"
    ];

    const ffprobe = spawn("ffprobe", args);
    let output = "";
    let error = "";

    ffprobe.stdout.on("data", (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on("data", (data) => {
      error += data.toString();
    });

    ffprobe.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe exited with code ${code}: ${error}`));
      } else {
        const duration = parseFloat(output.trim());
        if (isNaN(duration)) {
          reject(new Error("Could not parse audio duration"));
        } else {
          resolve(duration);
        }
      }
    });

    ffprobe.on("error", (err) => {
      reject(new Error(`Failed to spawn ffprobe: ${err.message}`));
    });
  });
}