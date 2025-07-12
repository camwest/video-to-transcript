import { readFile, stat } from "fs/promises";
import { createReadStream } from "fs";
import { PassThrough } from "stream";
import { createClient } from "@deepgram/sdk";

export interface TranscribeOptions {
  audioPath: string;
  apiKey: string;
  language?: string;
  model?: string;
  smartFormat?: boolean;
  punctuate?: boolean;
  paragraphs?: boolean;
}

export interface TranscriptionResult {
  transcript: string;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
  duration?: number;
}

export async function transcribeAudio(options: TranscribeOptions): Promise<TranscriptionResult> {
  const {
    audioPath,
    apiKey,
    language = "en",
    model = "nova-2",
    smartFormat = true,
    punctuate = true,
    paragraphs = true
  } = options;

  // Get file size for progress indication
  const fileStats = await stat(audioPath);
  const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(1);
  const totalSize = fileStats.size;
  
  // Initialize Deepgram client
  const deepgram = createClient(apiKey);

  try {
    process.stdout.write(`\rTranscribing audio... Starting upload of ${fileSizeMB}MB file`);
    
    // Use the official example - create a read stream directly
    const { result, error } = await deepgram.listen.prerecorded.transcribeFile(
      createReadStream(audioPath),
      {
        model,
        language,
        smart_format: smartFormat,
        punctuate,
        paragraphs
      }
    );

    process.stdout.write("\rTranscribing audio... 100%\n");

    if (error) {
      throw new Error(`Deepgram API error: ${JSON.stringify(error)}`);
    }

    if (!result) {
      throw new Error("No result returned from Deepgram");
    }
    
    // Extract the transcript and metadata
    const channel = result.results?.channels?.[0];
    const alternative = channel?.alternatives?.[0];

    if (!alternative?.transcript) {
      console.error("Result structure:", JSON.stringify(result, null, 2));
      throw new Error("No transcript found in Deepgram response");
    }

    return {
      transcript: alternative.transcript,
      words: alternative.words,
      duration: result.metadata?.duration
    };
  } catch (error: any) {
    if (error.status) {
      throw new Error(`Deepgram API error: ${error.status} - ${error.message}`);
    }
    throw error;
  }
}

export function formatTranscript(result: TranscriptionResult, includeTimestamps: boolean = false): string {
  if (!includeTimestamps || !result.words) {
    return result.transcript;
  }

  // Format with timestamps
  let formatted = "";
  let currentTime = 0;

  result.words.forEach((word, index) => {
    // Add timestamp every 10 seconds or at the start
    if (index === 0 || word.start - currentTime >= 10) {
      const timestamp = formatTime(word.start);
      formatted += `\n[${timestamp}] `;
      currentTime = word.start;
    }
    formatted += word.word + " ";
  });

  return formatted.trim();
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}