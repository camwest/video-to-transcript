import { stat } from "fs/promises";
import { spawn } from "child_process";
import { readFileSync, unlinkSync, existsSync } from "fs";

export interface TranscribeOptions {
  audioPath: string;
  apiKey: string;
  language?: string;
  model?: string;
  smartFormat?: boolean;
  punctuate?: boolean;
  paragraphs?: boolean;
  utterances?: boolean;
  diarize?: boolean;
  force?: boolean;
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
    model = "nova-3",
    smartFormat = true,
    punctuate = true,
    paragraphs = true,
    utterances = true,
    diarize = true,
    force = false
  } = options;

  // Check for existing Deepgram response file
  const responseFile = audioPath.replace(/\.[^.]+$/, '.deepgram.json');
  
  if (!force && existsSync(responseFile)) {
    console.log(`✓ Using existing transcription: ${responseFile}`);
    try {
      const responseText = readFileSync(responseFile, 'utf8');
      const result = JSON.parse(responseText);

      // Check for API errors in the response
      if (result.err_code) {
        throw new Error(`Deepgram API error: ${result.err_code} - ${result.err_msg}`);
      }

      // Extract the transcript and metadata
      const channel = result.results?.channels?.[0];
      const alternative = channel?.alternatives?.[0];

      if (!alternative?.transcript) {
        throw new Error("No transcript found in cached Deepgram response");
      }

      return {
        transcript: alternative.transcript,
        words: alternative.words,
        duration: result.metadata?.duration
      };
    } catch (error) {
      console.log(`Error reading cached transcription, will re-transcribe: ${error}`);
      // Fall through to re-transcribe
    }
  }

  // Get file size for progress indication
  const fileStats = await stat(audioPath);
  const fileSizeMB = (fileStats.size / (1024 * 1024)).toFixed(1);

  // Build query parameters
  const params = new URLSearchParams({
    model,
    language,
    smart_format: smartFormat.toString(),
    punctuate: punctuate.toString(),
    paragraphs: paragraphs.toString(),
    utterances: utterances.toString(),
    diarize: diarize.toString()
  });

  const url = `https://api.deepgram.com/v1/listen?${params}`;

  return new Promise((resolve, reject) => {
    // Save response alongside the audio file with consistent naming
    const responseFile = audioPath.replace(/\.[^.]+$/, '.deepgram.json');
    
    const args = [
      '-X', 'POST',
      '-H', `Authorization: Token ${apiKey}`,
      '-H', 'Content-Type: audio/mpeg',
      '--data-binary', `@${audioPath}`,
      '-o', responseFile,
      url
    ];

    const curl = spawn('curl', args);
    let error = '';
    let lastProgress = 0;

    // Initial progress message
    process.stdout.write(`\rTranscribing audio... 0% (${fileSizeMB}MB)`);

    // Buffer to accumulate partial lines
    let lineBuffer = '';
    
    curl.stderr.on('data', (data) => {
      const output = data.toString();
      lineBuffer += output;
      
      // Split by carriage return or newline
      const lines = lineBuffer.split(/[\r\n]/);
      
      // Keep the last partial line in the buffer
      lineBuffer = lines[lines.length - 1];
      
      // Process complete lines
      for (let i = 0; i < lines.length - 1; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        // Parse curl's progress line
        // Format: "  5  185M    0     0    5 10.6M      0   761k  0:04:09  0:00:14  0:03:55  805k"
        // We want the 5th field (upload %)
        const fields = line.split(/\s+/).filter(f => f);
        if (fields.length >= 5 && /^\d+$/.test(fields[0])) {
          const uploadProgress = parseInt(fields[4]);
          if (uploadProgress > lastProgress) {
            lastProgress = uploadProgress;
            process.stdout.write(`\rTranscribing audio... ${uploadProgress}%`);
          }
        } else if (line.includes('curl:')) {
          error += line + '\n';
        }
      }
    });

    curl.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`curl exited with code ${code}: ${error}`));
        return;
      }

      process.stdout.write('\rTranscribing audio... 100%\n');

      try {
        // Read and parse the response
        const responseText = readFileSync(responseFile, 'utf8');
        const result = JSON.parse(responseText);

        // Check for API errors in the response
        if (result.err_code) {
          throw new Error(`Deepgram API error: ${result.err_code} - ${result.err_msg}`);
        }

        // Extract the transcript and metadata
        const channel = result.results?.channels?.[0];
        const alternative = channel?.alternatives?.[0];

        if (!alternative?.transcript) {
          console.error("Result structure:", JSON.stringify(result, null, 2));
          throw new Error("No transcript found in Deepgram response");
        }

        console.log(`Deepgram response saved: ${responseFile}`);

        resolve({
          transcript: alternative.transcript,
          words: alternative.words,
          duration: result.metadata?.duration
        });
      } catch (error: any) {
        reject(error);
      }
    });

    curl.on('error', (err) => {
      reject(new Error(`Failed to spawn curl: ${err.message}`));
    });
  });
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