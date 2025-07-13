# Video to Transcript

Convert YouTube videos to text transcripts and EPUB ebooks using AI-powered transcription.

## What It Does

Downloads YouTube videos, extracts audio, transcribes using Deepgram API, and generates either plain text or enhanced EPUB ebooks with AI-powered metadata and speaker identification.

## How It Works

```
YouTube URL ──┐
              │
              ▼
         ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
         │ yt-dlp  │───▶│ ffmpeg  │───▶│Deepgram│───▶│ Output  │
         │Download │    │Extract  │    │Transcribe│   │EPUB/TXT │
         └─────────┘    │Audio    │    │+Speaker │    └─────────┘
              │         └─────────┘    │Diarize  │         ▲
              ▼                        └─────────┘         │
         video.mp4 ────▶ audio.mp3 ────▶ transcript ───────┘
                                              │
                                              ▼
                                        ┌─────────┐
                                        │ OpenAI  │
                                        │Enhance  │
                                        │Metadata │
                                        └─────────┘
```

1. **Download** - `yt-dlp` downloads video with deterministic filenames
2. **Extract** - `ffmpeg` extracts audio to MP3  
3. **Transcribe** - Deepgram API converts speech to text with speaker diarization
4. **Generate** - Creates EPUB with AI-enhanced metadata or plain text output

## Setup

Install dependencies:
```bash
# macOS
brew install yt-dlp ffmpeg pandoc

# Ubuntu/Debian  
sudo apt install yt-dlp ffmpeg pandoc
```

Set API keys:
```bash
export DEEPGRAM_API_KEY="your-deepgram-key"
export OPENAI_API_KEY="your-openai-key"  # Optional, for AI metadata
```

Install:
```bash
bun install
```

## Usage

```bash
# Basic - creates EPUB
bun run start "https://www.youtube.com/watch?v=VIDEO_ID"

# Plain text output
bun run start "https://www.youtube.com/watch?v=VIDEO_ID" --txt

# With options
bun run start "URL" -o output.epub --timestamps --force
```

### Key Options

- `-o, --output <file>` - Output file path
- `--txt` - Plain text instead of EPUB
- `--timestamps` - Include timestamps
- `-f, --force` - Skip cache, re-download/process
- `--no-ai` - Disable AI metadata enhancement
- `--cleanup` - Remove workspace directory after processing

## Features

- **Smart Caching** - Reuses downloads, audio, and transcripts
- **Speaker ID** - AI identifies and names speakers in multi-person content  
- **EPUB Generation** - Rich ebook format with metadata and cover
- **Progress Tracking** - Real-time download and processing progress
- **Deterministic Paths** - Predictable file naming for reliability
- **Workspace Directory** - All intermediate files saved in `video-to-transcript-workspace/` for debugging