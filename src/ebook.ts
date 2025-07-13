import { createOpenAI } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { z } from "zod";
import { writeFile } from "fs/promises";
import { join } from "path";
import { spawn } from "child_process";
import { promisify } from "util";
import { identifySpeakers, replaceSpeakerNames, type SpeakerMapping } from "./speaker-identifier";

const execAsync = promisify(spawn);

export interface VideoMetadata {
  title: string;
  uploader: string;
  description: string;
  upload_date: string;
  thumbnail: string;
  duration: number;
  view_count?: number;
  like_count?: number;
  channel?: string;
  tags?: string[];
  chapters?: Array<{
    title: string;
    start_time: number;
    end_time: number;
  }>;
}

export interface EbookOptions {
  transcript: string;
  metadata: VideoMetadata;
  outputPath: string;
  workspaceDir: string;
  useAI?: boolean;
  aiApiKey?: string;
}

interface EnhancedMetadata {
  title: string;
  author: string;
  description: string;
  coverImage?: Buffer;
}

async function downloadImage(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

// Schema for book metadata
const bookMetadataSchema = z.object({
  title: z.string().describe("A clean, professional book title without YouTube-specific formatting"),
  description: z.string().describe("A compelling 2-3 paragraph book description that summarizes what readers will learn"),
});

async function enhanceMetadataWithAI(
  metadata: VideoMetadata,
  transcript: string,
  apiKey: string
): Promise<{ title: string; description: string }> {
  const transcriptSnippet = transcript.substring(0, 1000);
  
  // Create OpenAI provider instance with API key
  const openai = createOpenAI({ apiKey });
  
  try {
    const { object } = await generateObject({
      model: openai("gpt-4.1"),
      schema: bookMetadataSchema,
      system: "You are a helpful assistant that creates clean, professional book metadata from YouTube video information. Keep titles concise and descriptions engaging but brief.",
      prompt: `Given this YouTube video metadata, create a clean book title and description suitable for an ebook:

Video Title: ${metadata.title}
Channel: ${metadata.uploader}
Original Description: ${metadata.description.substring(0, 500)}...
Transcript Start: ${transcriptSnippet}...

Please provide:
1. A clean, professional book title (remove YouTube-specific formatting like "MUST WATCH", excessive punctuation, emojis)
2. A compelling book description (2-3 paragraphs) that summarizes what readers will learn`,
    });

    return {
      title: object.title || metadata.title,
      description: object.description || metadata.description,
    };
  } catch (error) {
    console.warn("AI enhancement failed, using original metadata:", error);
    return {
      title: metadata.title,
      description: metadata.description,
    };
  }
}

// Speaker identification functions are now imported from speaker-identifier.ts

async function checkPandocAvailable(): Promise<boolean> {
  return new Promise((resolve) => {
    const pandoc = spawn('pandoc', ['--version']);
    pandoc.on('close', (code) => {
      resolve(code === 0);
    });
    pandoc.on('error', () => {
      resolve(false);
    });
  });
}

function formatMarkdownContent(transcript: string, metadata: VideoMetadata, enhancedMetadata: EnhancedMetadata): string {
  // Format upload date
  let formattedDate = "";
  if (metadata.upload_date) {
    const date = new Date(
      metadata.upload_date.substring(0, 4) + "-" +
      metadata.upload_date.substring(4, 6) + "-" +
      metadata.upload_date.substring(6, 8)
    );
    formattedDate = date.toLocaleDateString("en-US", { 
      year: "numeric", 
      month: "long", 
      day: "numeric" 
    });
  }

  // Build YAML frontmatter
  const yaml = [
    '---',
    `title: "${enhancedMetadata.title.replace(/"/g, '\\"')}"`,
    `author: "${enhancedMetadata.author.replace(/"/g, '\\"')}"`,
    formattedDate ? `date: "${formattedDate}"` : '',
    `description: "${enhancedMetadata.description.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
    'lang: en-US',
    '---',
    ''
  ].filter(line => line !== '').join('\n');

  // Format the main content
  const content = [
    `# ${enhancedMetadata.title}`,
    '',
    `*By ${enhancedMetadata.author}*`,
    '',
    formattedDate ? `*Published: ${formattedDate}*` : '',
    '',
    '---',
    '',
    // Split transcript into paragraphs
    ...transcript
      .split(/\n\n+/)
      .filter(p => p.trim().length > 0)
      .map(p => p.trim()),
    ''
  ].filter(line => line !== null).join('\n\n');

  return yaml + '\n' + content;
}

const kindleCSS = `
body { 
  font-family: Georgia, serif; 
  line-height: 1.6em; 
  margin: 1em;
}
h1 { 
  font-size: 1.5em; 
  margin-bottom: 0.5em;
  page-break-before: always;
}
p { 
  text-indent: 1.5em; 
  margin: 0.5em 0;
}
hr {
  margin: 2em 0;
}
em {
  font-style: italic;
}
`;

export async function generateEbook(options: EbookOptions): Promise<void> {
  const { transcript, metadata, outputPath, workspaceDir, useAI = true, aiApiKey } = options;
  
  // Check if Pandoc is available
  const pandocAvailable = await checkPandocAvailable();
  if (!pandocAvailable) {
    throw new Error(
      'Pandoc is not installed. Please install it:\n' +
      '  macOS: brew install pandoc\n' +
      '  Ubuntu/Debian: sudo apt-get install pandoc\n' +
      '  Windows: Download from https://pandoc.org/installing.html'
    );
  }
  
  let enhancedMetadata: EnhancedMetadata = {
    title: metadata.title,
    author: metadata.uploader,
    description: metadata.description,
  };
  
  // Use workspace directory for temporary files
  const markdownPath = join(workspaceDir, 'transcript.md');
  const cssPath = join(workspaceDir, 'kindle.css');
  let coverPath: string | undefined;
  
  try {
    // Download cover image
    if (metadata.thumbnail) {
      try {
        console.log("Downloading cover image...");
        enhancedMetadata.coverImage = await downloadImage(metadata.thumbnail);
        
        // Save cover image
        coverPath = join(workspaceDir, 'cover.jpg');
        await writeFile(coverPath, enhancedMetadata.coverImage);
      } catch (error) {
        console.warn("Failed to download cover image:", error);
      }
    }
    
    // Enhance metadata with AI if enabled and API key provided
    if (useAI && aiApiKey) {
      console.log("Enhancing metadata with AI...");
      const aiEnhanced = await enhanceMetadataWithAI(metadata, transcript, aiApiKey);
      enhancedMetadata.title = aiEnhanced.title;
      enhancedMetadata.description = aiEnhanced.description;
    } else if (useAI && !aiApiKey) {
      console.warn("AI enhancement requested but no API key provided. Using original metadata.");
    }
    
    // Identify and replace speaker names if AI is enabled
    let processedTranscript = transcript;
    if (useAI && aiApiKey) {
      console.log("Identifying speakers with AI...");
      const speakerMapping = await identifySpeakers(metadata, transcript, aiApiKey);
      if (Object.keys(speakerMapping).length > 0) {
        processedTranscript = replaceSpeakerNames(transcript, speakerMapping);
        console.log("Speaker names replaced in transcript");
      }
    }
    
    // Generate Markdown content
    const markdownContent = formatMarkdownContent(processedTranscript, metadata, enhancedMetadata);
    await writeFile(markdownPath, markdownContent, 'utf-8');
    
    // Write CSS file
    await writeFile(cssPath, kindleCSS, 'utf-8');
    
    // Build Pandoc command
    const pandocArgs = [
      markdownPath,
      '-o', outputPath,
      '--css', cssPath,
      '--toc',
      '--toc-depth=2',
      '--epub-chapter-level=1'
    ];
    
    if (coverPath) {
      pandocArgs.push('--epub-cover-image', coverPath);
    }
    
    // Generate EPUB using Pandoc
    console.log("Generating EPUB with Pandoc...");
    const pandoc = spawn('pandoc', pandocArgs);
    
    let error = '';
    pandoc.stderr.on('data', (data) => {
      error += data.toString();
    });
    
    await new Promise<void>((resolve, reject) => {
      pandoc.on('close', (code) => {
        if (code === 0) {
          console.log(`EPUB saved to: ${outputPath}`);
          resolve();
        } else {
          reject(new Error(`Pandoc failed with exit code ${code}: ${error}`));
        }
      });
      
      pandoc.on('error', (err) => {
        reject(new Error(`Failed to spawn pandoc: ${err.message}`));
      });
    });
    
  } finally {
    // Files are kept in workspace directory for debugging
    console.log(`EPUB intermediate files saved in: ${workspaceDir}`);
  }
}