#!/usr/bin/env bun

import { Command } from "commander";
import { config } from "dotenv";
import { writeFile } from "fs/promises";
import { existsSync } from "fs";
import { resolve, basename } from "path";
import { downloadVideo, cleanupTempDir } from "./downloader";
import { extractAudio } from "./audio";
import { transcribeAudio, formatTranscript } from "./transcriber";
import { generateEbook, type VideoMetadata } from "./ebook";
import { readFile } from "fs/promises";

// Load environment variables
config();

const program = new Command();

program
  .name("video-to-transcript")
  .description("Download YouTube videos and transcribe them using Deepgram")
  .version("0.1.0")
  .argument("<input>", "YouTube video URL or local video file path")
  .option("-k, --api-key <key>", "Deepgram API key (or set DEEPGRAM_API_KEY env var)")
  .option("-q, --quality <quality>", "Video quality (e.g., 'best[height<=480]')", "best[height<=480]")
  .option("-l, --language <lang>", "Language code for transcription", "en")
  .option("-m, --model <model>", "Deepgram model to use", "nova-3")
  .option("-o, --output <file>", "Output file path")
  .option("-t, --timestamps", "Include timestamps in transcript")
  .option("--keep-temp", "Keep temporary files after processing")
  .option("-f, --force", "Force re-download and re-extraction even if files exist")
  .option("--txt", "Output plain text instead of EPUB (alias for --no-epub)")
  .option("--no-epub", "Disable EPUB generation, output plain text only")
  .option("--no-ai", "Disable AI enhancement of metadata")
  .option("--ai-key <key>", "OpenAI API key for metadata enhancement (or set OPENAI_API_KEY env var)")
  .action(async (input, options) => {
    const apiKey = options.apiKey || process.env.DEEPGRAM_API_KEY;

    if (!apiKey) {
      console.error("Error: Deepgram API key is required. Set DEEPGRAM_API_KEY env var or use --api-key option");
      process.exit(1);
    }

    let tempDir: string | null = null;
    let videoPath: string;
    let metadata: VideoMetadata | undefined;

    try {
      // Check if input is a local file or URL
      const isLocalFile = existsSync(input);
      
      if (isLocalFile) {
        // Use the local file directly
        videoPath = resolve(input);
        console.log(`Using local video file: ${videoPath}`);
        
        // Try to load metadata from existing info.json file
        const infoJsonPath = videoPath.replace(/\.(mp4|webm|mkv)$/, '.info.json');
        if (existsSync(infoJsonPath)) {
          try {
            const infoJson = await readFile(infoJsonPath, 'utf-8');
            metadata = JSON.parse(infoJson);
          } catch (error) {
            console.warn("Failed to load existing metadata:", error);
          }
        }
      } else {
        // Download video from URL
        console.log("Downloading video...");
        const downloadResult = await downloadVideo({
          url: input,
          quality: options.quality,
          force: options.force
        });
        videoPath = downloadResult.videoPath;
        tempDir = downloadResult.tempDir;
        metadata = downloadResult.metadata;
        console.log(`Video downloaded: ${videoPath}`);
      }

      // Step 2: Extract audio
      const { audioPath } = await extractAudio({
        videoPath,
        outputFormat: "mp3",
        force: options.force
      });
      console.log(`Audio extracted: ${audioPath}`);

      // Step 3: Transcribe audio
      const result = await transcribeAudio({
        audioPath,
        apiKey,
        language: options.language,
        model: options.model
      });

      // Format the transcript
      const formattedTranscript = formatTranscript(result, options.timestamps);

      // Determine if we should output EPUB or plain text
      const shouldOutputEpub = !options.txt && options.epub !== false;
      
      if (shouldOutputEpub) {
        // Generate EPUB output
        const aiApiKey = options.aiKey || process.env.OPENAI_API_KEY || process.env.AI_API_KEY;
        
        // Create default metadata if not available from yt-dlp
        if (!metadata) {
          metadata = {
            title: basename(videoPath, '.mp4').replace(/_/g, ' '),
            uploader: 'Unknown Author',
            description: 'Transcribed from video',
            upload_date: new Date().toISOString().substring(0, 10).replace(/-/g, ''),
            thumbnail: '',
            duration: 0
          };
        }
        
        // Determine output path
        const outputPath = options.output || `${metadata.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.epub`;
        
        await generateEbook({
          transcript: formattedTranscript,
          metadata,
          outputPath,
          useAI: options.ai !== false,
          aiApiKey
        });
      } else {
        // Output plain text (old behavior)
        if (options.output) {
          await writeFile(options.output, formattedTranscript, "utf-8");
          console.log(`Transcript saved to: ${options.output}`);
        } else {
          console.log("\n--- TRANSCRIPT ---\n");
          console.log(formattedTranscript);
        }
      }

      // Clean up unless --keep-temp is specified
      if (!options.keepTemp && tempDir) {
        console.log("Cleaning up temporary files...");
        await cleanupTempDir(tempDir);
      }

    } catch (error) {
      console.error("Error:", error);
      
      // Clean up on error unless --keep-temp is specified
      if (!options.keepTemp && tempDir) {
        await cleanupTempDir(tempDir);
      }
      
      process.exit(1);
    }
  });

program.parse();