import { readFile } from "fs/promises";

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

  // Read the audio file
  const audioBuffer = await readFile(audioPath);

  // Build query parameters
  const params = new URLSearchParams({
    language,
    model,
    smart_format: smartFormat.toString(),
    punctuate: punctuate.toString(),
    paragraphs: paragraphs.toString()
  });

  const url = `https://api.deepgram.com/v1/listen?${params}`;

  console.log("Sending audio to Deepgram for transcription...");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Token ${apiKey}`,
      "Content-Type": "audio/*"
    },
    body: audioBuffer
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepgram API error: ${response.status} - ${errorText}`);
  }

  const result = await response.json();

  // Extract the transcript and metadata
  const channel = result.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];

  if (!alternative?.transcript) {
    throw new Error("No transcript found in Deepgram response");
  }

  return {
    transcript: alternative.transcript,
    words: alternative.words,
    duration: result.metadata?.duration
  };
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