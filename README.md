# video-to-transcript

A TypeScript/Bun wrapper that downloads YouTube videos, extracts audio, and transcribes them using Deepgram's API. Also supports transcribing local video files directly.

## Prerequisites

- [Bun](https://bun.sh) runtime
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - for downloading videos
- [FFmpeg](https://ffmpeg.org/) - for audio extraction
- [Deepgram API key](https://console.deepgram.com/) - for transcription

## Installation

```bash
# Clone the repository
git clone https://github.com/camwest/video-to-transcript.git
cd video-to-transcript

# Install dependencies
bun install

# Copy environment variables
cp .env.example .env
# Edit .env and add your Deepgram API key
```

## Usage

### YouTube Videos

```bash
# Basic usage with API key in .env
bun run start "https://www.youtube.com/watch?v=VIDEO_ID"

# Specify API key directly
bun run start "https://www.youtube.com/watch?v=VIDEO_ID" --api-key YOUR_API_KEY

# Save transcript to file
bun run start "https://www.youtube.com/watch?v=VIDEO_ID" --output transcript.txt

# Include timestamps
bun run start "https://www.youtube.com/watch?v=VIDEO_ID" --timestamps

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
# Basic usage with local file
bun run start "path/to/video.mp4"

# Example with a downloaded YouTube video
bun run start "How to Find & Be a Great Romantic Partner ｜ Lori Gottlieb [lYK4UFf8mlc].mp4"

# With options (same as YouTube URLs)
bun run start "video.mp4" --output transcript.txt --timestamps --language en
```

When using local files, the download step is skipped and the tool processes your video file directly.

## Options

- `-k, --api-key <key>` - Deepgram API key (defaults to DEEPGRAM_API_KEY env var)
- `-q, --quality <quality>` - Video quality selector (default: "best[height<=480]")
- `-l, --language <lang>` - Language code for transcription (default: "en")
- `-m, --model <model>` - Deepgram model to use (default: "nova-2")
- `-o, --output <file>` - Output file for transcript
- `-t, --timestamps` - Include timestamps in transcript
- `--keep-temp` - Keep temporary video/audio files after processing

## Development

```bash
# Run in watch mode
bun run dev

# Run with a test URL
bun run start "https://www.youtube.com/watch?v=lYK4UFf8mlc"
```

## License

MIT
