import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";

// Schema for speaker identification
export const speakerIdentificationSchema = z.object({
  speakers: z.array(z.string()).describe("Array of first names where array index corresponds to speaker number. Index 0 = Speaker 0, Index 1 = Speaker 1, etc."),
  confidence: z.enum(["high", "medium", "low"]).describe("Confidence in speaker identification accuracy")
});

export interface SpeakerMapping {
  [speakerNumber: string]: string;
}

export interface VideoMetadata {
  title: string;
  uploader: string;
  description: string;
}

export function extractTranscriptSnippet(transcript: string): string {
  // Skip frontmatter if present
  const contentStart = transcript.indexOf("**Speaker");
  if (contentStart === -1) {
    return transcript.substring(0, 2000);
  }
  return transcript.substring(contentStart, contentStart + 2000);
}

export function generateSpeakerPrompt(
  metadata: VideoMetadata,
  transcriptSnippet: string,
  speakerCount: number
): string {
  return `You are an expert at identifying speakers in YouTube video content. Extract FIRST NAMES ONLY from video metadata and transcript introductions.

Identify speakers by FIRST NAME ONLY for this YouTube video:

Video Title: "${metadata.title}"
Channel: "${metadata.uploader}"
Description: "${metadata.description.substring(0, 500)}..."
Transcript Start: "${transcriptSnippet}"

Detected ${speakerCount} speakers in the transcript.

IMPORTANT: Return an array where the ORDER MATTERS:
- Index 0 should be Speaker 0's first name (typically the host/channel owner)
- Index 1 should be Speaker 1's first name (typically the guest)
- And so on for additional speakers

Example: If Speaker 0 is "Andrew" and Speaker 1 is "Lori", return ["Andrew", "Lori"]

Return ONLY first names. Be confident only if names are clearly mentioned in the content.
If you cannot identify names with confidence, return an empty array.`;
}

export async function identifySpeakers(
  metadata: VideoMetadata,
  transcript: string,
  apiKey: string
): Promise<SpeakerMapping> {
  const transcriptSnippet = extractTranscriptSnippet(transcript);
  
  // Count detected speakers from transcript
  const speakerMatches = transcript.match(/\*\*Speaker \d+:\*\*/g) || [];
  const uniqueSpeakers = Array.from(new Set(speakerMatches));
  const speakerCount = uniqueSpeakers.length;
  
  // Create OpenAI provider instance with API key
  const openai = createOpenAI({ apiKey });
  
  try {
    const prompt = generateSpeakerPrompt(metadata, transcriptSnippet, speakerCount);

    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: speakerIdentificationSchema,
      prompt,
    });

    // Only return mapping if confidence is high or medium
    if (object.confidence === "low") {
      console.warn("Low confidence in speaker identification, skipping name replacement");
      return {};
    }

    // Ensure speakers object exists
    if (!object.speakers || Object.keys(object.speakers).length === 0) {
      console.warn("No speakers identified");
      return {};
    }

    console.log(`Speaker identification (${object.confidence} confidence):`, object.speakers);

    // map array indexes to object
    const speakerMapping: SpeakerMapping = {};

    object.speakers.forEach((speaker, index) => {
      speakerMapping[index] = speaker;
    });

    return speakerMapping;

  } catch (error) {
    console.warn("Speaker identification failed:", error);
    return {};
  }
}

export function replaceSpeakerNames(transcript: string, speakerMapping: SpeakerMapping): string {
  return transcript.replace(
    /\*\*Speaker (\d+):\*\*/g,
    (match, speakerNum) => {
      const firstName = speakerMapping[speakerNum];
      return firstName ? `**${firstName}:**` : match;
    }
  );
}