import { mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

const WORKSPACE_DIR = "video-to-transcript-workspace";

export interface WorkspaceInfo {
  workspaceRoot: string;
  projectDir: string;
}

/**
 * Extract a safe directory name from a YouTube URL or file path
 */
function extractProjectId(input: string): string {
  // Try to extract YouTube video ID
  const videoIdMatch = input.match(/(?:v=|\/)([\w-]{11})(?:\?|&|$)/);
  if (videoIdMatch) {
    return videoIdMatch[1];
  }
  
  // For local files, use the filename without extension
  const pathParts = input.split(/[/\\]/);
  const filename = pathParts[pathParts.length - 1];
  const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
  
  // Sanitize the filename to be filesystem-safe
  return nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
}

/**
 * Get or create the workspace directory for a given input
 */
export async function getWorkspaceDir(input: string): Promise<WorkspaceInfo> {
  const projectId = extractProjectId(input);
  const workspaceRoot = join(process.cwd(), WORKSPACE_DIR);
  const projectDir = join(workspaceRoot, projectId);
  
  // Create directories if they don't exist
  if (!existsSync(projectDir)) {
    await mkdir(projectDir, { recursive: true });
    console.log(`Created workspace directory: ${projectDir}`);
  }
  
  return {
    workspaceRoot,
    projectDir
  };
}

/**
 * Get the path to the workspace root directory
 */
export function getWorkspaceRoot(): string {
  return join(process.cwd(), WORKSPACE_DIR);
}