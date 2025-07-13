import { test, expect, describe } from "bun:test";
import { readFileSync } from "fs";
import { identifySpeakers, replaceSpeakerNames, generateSpeakerPrompt, extractTranscriptSnippet } from "./speaker-identifier";

describe("Speaker Identification", () => {
  test("should extract transcript snippet correctly", () => {
    // Test with frontmatter
    const transcriptWithFrontmatter = `---
title: "Test"
---
# Test

**Speaker 0:** Hello, I'm Andrew.
**Speaker 1:** Hi Andrew, I'm Lori.`;
    
    const snippet1 = extractTranscriptSnippet(transcriptWithFrontmatter);
    expect(snippet1).toStartWith("**Speaker 0:");
    expect(snippet1).toContain("Hello, I'm Andrew");
    
    // Test without frontmatter
    const transcriptDirect = `**Speaker 0:** Welcome to the show.
**Speaker 1:** Thanks for having me.`;
    
    const snippet2 = extractTranscriptSnippet(transcriptDirect);
    expect(snippet2).toStartWith("**Speaker 0:");
  });
  
  test("should generate correct prompt", () => {
    const metadata = {
      title: "Interview with Lori Gottlieb | Andrew Huberman Podcast",
      uploader: "Andrew Huberman",
      description: "Andrew Huberman interviews psychotherapist Lori Gottlieb about relationships."
    };
    
    const transcript = `**Speaker 0:** I'm Andrew Huberman.
**Speaker 1:** I'm Lori Gottlieb.`;
    
    const prompt = generateSpeakerPrompt(metadata, transcript, 2);
    
    console.log("\nGenerated prompt:");
    console.log(prompt);
    console.log("\n");
    
    expect(prompt).toContain('Video Title: "Interview with Lori Gottlieb | Andrew Huberman Podcast"');
    expect(prompt).toContain('Channel: "Andrew Huberman"');
    expect(prompt).toContain("I'm Andrew Huberman");
    expect(prompt).toContain("I'm Lori Gottlieb");
    expect(prompt).toContain("Detected 2 speakers");
  });
  test("should identify Andrew and Lori from Huberman Lab podcast", async () => {
    // Load the actual metadata from the workspace
    const metadataPath = "/Users/camwest/src/video-to-transcript/video-to-transcript-workspace/lYK4UFf8mlc/video.info.json";
    const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
    
    // Load the transcript
    const transcriptPath = "/Users/camwest/src/video-to-transcript/video-to-transcript-workspace/lYK4UFf8mlc/transcript.md";
    const transcript = readFileSync(transcriptPath, 'utf-8');
    
    // Get API key from environment
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log("Skipping test - OPENAI_API_KEY not set");
      return;
    }
    
    console.log("Testing with metadata:");
    console.log("Title:", metadata.title);
    console.log("Channel:", metadata.uploader);
    console.log("Description preview:", metadata.description.substring(0, 200) + "...");
    
    const result = await identifySpeakers(metadata, transcript, apiKey);
    
    console.log("\nSpeaker mapping result:", JSON.stringify(result, null, 2));
    
    // Should identify Andrew and Lori
    expect(result["0"]).toBe("Andrew");
    expect(result["1"]).toBe("Lori");
  }, 30000); // 30 second timeout for AI call
  
  test("should handle focused input with clear names", async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.log("Skipping test - OPENAI_API_KEY not set");
      return;
    }
    
    // Very focused test case
    const metadata = {
      title: "Interview with Lori Gottlieb | Andrew Huberman Podcast",
      uploader: "Andrew Huberman",
      description: "Andrew Huberman interviews psychotherapist Lori Gottlieb about relationships."
    };
    
    const transcript = `
**Speaker 0:** I'm Andrew Huberman, and I'm a professor of neurobiology at Stanford.
**Speaker 0:** My guest today is Lori Gottlieb.
**Speaker 1:** Thank you for having me, Andrew.
**Speaker 0:** It's great to have you here, Lori.
    `;
    
    const result = await identifySpeakers(metadata, transcript.trim(), apiKey);
    
    console.log("\nFocused test result:", JSON.stringify(result, null, 2));
    
    expect(result["0"]).toBe("Andrew");
    expect(result["1"]).toBe("Lori");
  }, 30000);
  
  test("should replace speaker names in transcript", () => {
    const transcript = `
**Speaker 0:** Welcome to my show.
**Speaker 1:** Thanks for having me.
**Speaker 0:** Let's begin.
    `;
    
    const speakerMapping = {
      "0": "Andrew",
      "1": "Lori"
    };
    
    const result = replaceSpeakerNames(transcript, speakerMapping);
    
    expect(result).toContain("**Andrew:** Welcome to my show.");
    expect(result).toContain("**Lori:** Thanks for having me.");
    expect(result).toContain("**Andrew:** Let's begin.");
  });
});