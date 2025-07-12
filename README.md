# video-to-transcript

A TypeScript/Bun tool that downloads YouTube videos, extracts audio, transcribes them using Deepgram's API, and generates Kindle-optimized EPUB ebooks with AI-enhanced metadata. Also supports transcribing local video files directly.

## Prerequisites

- [Bun](https://bun.sh) runtime
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - for downloading videos
- [FFmpeg](https://ffmpeg.org/) - for audio extraction
- [Pandoc](https://pandoc.org/) - for EPUB generation
- [Deepgram API key](https://console.deepgram.com/) - for transcription
- [OpenAI API key](https://platform.openai.com/api-keys) - for AI-enhanced metadata (optional)

## Installation

```bash
# Clone the repository
git clone https://github.com/camwest/video-to-transcript.git
cd video-to-transcript

# Install dependencies
bun install

# Install system dependencies
# macOS
brew install yt-dlp ffmpeg pandoc

# Ubuntu/Debian
sudo apt update
sudo apt install yt-dlp ffmpeg pandoc

# Windows (using Chocolatey)
choco install yt-dlp ffmpeg pandoc

# Copy environment variables
cp .env.example .env
# Edit .env and add your API keys:
# DEEPGRAM_API_KEY=your_deepgram_key
# OPENAI_API_KEY=your_openai_key (optional, for AI-enhanced metadata)
```

## Usage

### Default: Generate EPUB Ebook

By default, the tool generates a Kindle-optimized EPUB file with AI-enhanced metadata:

```bash
# Basic usage - generates EPUB with AI-enhanced metadata
bun run start "https://www.youtube.com/watch?v=VIDEO_ID"
# Output: video-title.epub

# Disable AI enhancement (use raw YouTube metadata)
bun run start "https://www.youtube.com/watch?v=VIDEO_ID" --no-ai

# Custom output path
bun run start "https://www.youtube.com/watch?v=VIDEO_ID" --output mybook.epub
```

### Plain Text Output

To get plain text transcripts instead of EPUB:

```bash
# Output to console
bun run start "https://www.youtube.com/watch?v=VIDEO_ID" --txt

# Save to text file
bun run start "https://www.youtube.com/watch?v=VIDEO_ID" --txt --output transcript.txt

# Include timestamps
bun run start "https://www.youtube.com/watch?v=VIDEO_ID" --txt --timestamps
```

### YouTube Videos

```bash
# Specify API keys directly
bun run start "https://www.youtube.com/watch?v=VIDEO_ID" --api-key YOUR_DEEPGRAM_KEY --ai-key YOUR_OPENAI_KEY

# Custom video quality (default: best[height<=480])
bun run start "https://www.youtube.com/watch?v=VIDEO_ID" --quality "best[height<=720]"

# Different language
bun run start "https://www.youtube.com/watch?v=VIDEO_ID" --language es

# Keep temporary files
bun run start "https://www.youtube.com/watch?v=VIDEO_ID" --keep-temp
```

### Local Video Files

You can also transcribe already downloaded video files:

```bash
# Basic usage with local file - generates EPUB
bun run start "path/to/video.mp4"

# Example with a downloaded YouTube video
bun run start "How to Find & Be a Great Romantic Partner ｜ Lori Gottlieb [lYK4UFf8mlc].mp4"

# Generate text transcript instead
bun run start "video.mp4" --txt --output transcript.txt --timestamps

# With custom output
bun run start "video.mp4" --output mybook.epub --language en
```

When using local files, the download step is skipped and the tool processes your video file directly. For EPUB generation, metadata will be extracted from the filename or .info.json file if available.

### Resume Support

The tool automatically resumes from where it left off:

- If you run the tool and it fails during transcription, you can simply run the same command again
- It will detect existing video/audio files and skip those steps
- This saves time and bandwidth by not re-downloading or re-extracting

```bash
# First run fails due to API issues
bun run start "https://www.youtube.com/watch?v=lYK4UFf8mlc"
# Downloads video ✓
# Extracts audio ✓
# Transcription fails ✗

# Second run automatically resumes
bun run start "https://www.youtube.com/watch?v=lYK4UFf8mlc"
# ✓ Using existing video file: ...
# ✓ Using existing audio file: ...
# Transcribes audio ✓
```

To force re-download and re-extraction, use the `--force` flag:

```bash
bun run start "https://www.youtube.com/watch?v=lYK4UFf8mlc" --force
```

## Options

### Core Options
- `-k, --api-key <key>` - Deepgram API key (defaults to DEEPGRAM_API_KEY env var)
- `-q, --quality <quality>` - Video quality selector (default: "best[height<=480]")
- `-l, --language <lang>` - Language code for transcription (default: "en")
- `-m, --model <model>` - Deepgram model to use (default: "nova-3")
- `-o, --output <file>` - Output file path (defaults to .epub with video title)
- `-t, --timestamps` - Include timestamps in transcript (text mode only)
- `--keep-temp` - Keep temporary video/audio files after processing
- `-f, --force` - Force re-download and re-extraction even if files exist

### EPUB/Text Options
- `--txt` - Output plain text instead of EPUB (alias for --no-epub)
- `--no-epub` - Disable EPUB generation, output plain text only
- `--no-ai` - Disable AI enhancement of metadata (EPUB mode)
- `--ai-key <key>` - OpenAI API key for metadata enhancement (defaults to OPENAI_API_KEY env var)

## EPUB Generation Details

The tool uses Pandoc to generate high-quality EPUB files optimized for Kindle devices:

### Features
- **AI-Enhanced Metadata**: Uses OpenAI to clean up YouTube titles and generate professional book descriptions
- **Cover Images**: Automatically downloads and includes video thumbnails as book covers
- **Kindle Optimization**: Custom CSS styling optimized for e-reader displays
- **Clean Formatting**: Converts transcript into properly formatted paragraphs with chapter breaks

### How It Works
1. Downloads video metadata and thumbnail from YouTube
2. Transcribes audio using Deepgram's Nova-3 model
3. Enhances metadata with OpenAI (removes YouTube-specific formatting, generates book description)
4. Generates Markdown with YAML frontmatter
5. Uses Pandoc to create EPUB with cover image and custom CSS
6. Outputs a Kindle-ready EPUB file

### Pandoc Requirements
The tool requires Pandoc version 1.6 or higher. If not installed, you'll see an error with installation instructions for your platform.

## Development

```bash
# Run in watch mode
bun run dev

# Run with a test URL
bun run start "https://www.youtube.com/watch?v=lYK4UFf8mlc"
```

## License

MIT
