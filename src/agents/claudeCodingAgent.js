// Claude Code-style agent with VoltAgent
const { Agent } = require('@voltagent/core');
const { createTool } = require('@voltagent/core');
const { anthropic } = require('@ai-sdk/anthropic');
const { z } = require('zod');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

// Vibez.now approval API configuration
const APPROVAL_API_URL = 'https://ugqmlxjswokfbfwppehz.supabase.co/functions/v1/submit-request';
const APPROVAL_API_KEY = '72fca02d-b5a5-4eb7-8c63-2e687f9c0a7e';

// Workspace root - will be per-user
const WORKSPACES_ROOT = path.join(process.cwd(), 'workspaces');

/**
 * Get or create workspace for a user
 */
async function getUserWorkspace(userId) {
  const workspacePath = path.join(WORKSPACES_ROOT, userId);
  await fs.mkdir(workspacePath, { recursive: true });
  return workspacePath;
}

/**
 * Tool: Read a file from the workspace
 */
const readFileTool = createTool({
  name: 'read_file',
  description: 'Read a text file from the user workspace',
  parameters: z.object({
    relativePath: z.string().describe('Path relative to workspace root, e.g. src/index.js'),
  }),
  async execute({ relativePath }, { userId }) {
    const workspaceRoot = await getUserWorkspace(userId);
    const fullPath = path.join(workspaceRoot, relativePath);

    // Security: prevent path traversal
    if (!fullPath.startsWith(workspaceRoot)) {
      throw new Error('Invalid path: cannot access files outside workspace');
    }

    try {
      const content = await fs.readFile(fullPath, 'utf8');
      return { success: true, content, path: relativePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
});

/**
 * Tool: Write a file to the workspace
 */
const writeFileTool = createTool({
  name: 'write_file',
  description: 'Write (create or overwrite) a text file in the user workspace',
  parameters: z.object({
    relativePath: z.string().describe('Path relative to workspace root'),
    content: z.string().describe('Content to write to the file'),
  }),
  async execute({ relativePath, content }, { userId }) {
    const workspaceRoot = await getUserWorkspace(userId);
    const fullPath = path.join(workspaceRoot, relativePath);

    // Security: prevent path traversal
    if (!fullPath.startsWith(workspaceRoot)) {
      throw new Error('Invalid path: cannot access files outside workspace');
    }

    try {
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf8');
      return { success: true, path: relativePath, bytesWritten: content.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
});

/**
 * Tool: List files in a directory
 */
const listFilesTool = createTool({
  name: 'list_files',
  description: 'List files and directories in the workspace',
  parameters: z.object({
    relativePath: z.string().optional().default('.').describe('Directory path relative to workspace root'),
  }),
  async execute({ relativePath }, { userId }) {
    const workspaceRoot = await getUserWorkspace(userId);
    const fullPath = path.join(workspaceRoot, relativePath);

    // Security: prevent path traversal
    if (!fullPath.startsWith(workspaceRoot)) {
      throw new Error('Invalid path: cannot access files outside workspace');
    }

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });
      const files = entries.map(entry => ({
        name: entry.name,
        type: entry.isDirectory() ? 'directory' : 'file',
        path: path.join(relativePath, entry.name),
      }));
      return { success: true, files, directory: relativePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
});

/**
 * Tool: Run a Node.js script
 */
const runNodeTool = createTool({
  name: 'run_node',
  description: 'Execute a Node.js script from the workspace and return stdout/stderr',
  parameters: z.object({
    relativePath: z.string().describe('Path to a .js file to execute with node'),
    timeout: z.number().optional().default(30000).describe('Timeout in milliseconds (default 30s)'),
  }),
  async execute({ relativePath, timeout }, { userId }) {
    const workspaceRoot = await getUserWorkspace(userId);
    const fullPath = path.join(workspaceRoot, relativePath);

    // Security: prevent path traversal
    if (!fullPath.startsWith(workspaceRoot)) {
      throw new Error('Invalid path: cannot access files outside workspace');
    }

    try {
      const { stdout, stderr } = await execAsync(`node "${fullPath}"`, {
        cwd: workspaceRoot,
        timeout,
      });
      return {
        success: true,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: 0
      };
    } catch (error) {
      return {
        success: false,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code || 1,
        error: error.message,
      };
    }
  },
});

/**
 * Tool: Delete a file
 */
const deleteFileTool = createTool({
  name: 'delete_file',
  description: 'Delete a file from the workspace',
  parameters: z.object({
    relativePath: z.string().describe('Path to file to delete'),
  }),
  async execute({ relativePath }, { userId }) {
    const workspaceRoot = await getUserWorkspace(userId);
    const fullPath = path.join(workspaceRoot, relativePath);

    // Security: prevent path traversal
    if (!fullPath.startsWith(workspaceRoot)) {
      throw new Error('Invalid path: cannot access files outside workspace');
    }

    try {
      await fs.unlink(fullPath);
      return { success: true, deletedPath: relativePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
});

/**
 * Tool: Request user approval
 */
const requestApprovalTool = createTool({
  name: 'request_approval',
  description: 'Request approval from the user before performing a critical action like deleting multiple files, running destructive commands, or deploying code. Use this when you need explicit user confirmation.',
  parameters: z.object({
    title: z.string().describe('Short title describing what needs approval (e.g., "Delete 10 files", "Deploy to production")'),
    description: z.string().describe('Detailed description of the action and why approval is needed'),
    code_snippet: z.string().optional().describe('Optional code snippet or command that will be executed'),
    metadata: z.record(z.any()).optional().describe('Optional additional metadata'),
  }),
  async execute({ title, description, code_snippet, metadata }, { userId }) {
    try {
      const response = await fetch(APPROVAL_API_URL, {
        method: 'POST',
        headers: {
          'x-api-key': APPROVAL_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description,
          code_snippet,
          metadata: {
            ...metadata,
            userId,
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const data = await response.json();

      if (response.ok) {
        return {
          success: true,
          message: 'Approval request submitted successfully. Please check your Vibez.now app to approve or reject.',
          requestId: data.id || data.request_id,
        };
      } else {
        return {
          success: false,
          error: `Failed to submit approval request: ${data.error || response.statusText}`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Error submitting approval request: ${error.message}`,
      };
    }
  },
});

/**
 * Create a Claude coding agent instance
 */
function createCodingAgent() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable is required');
  }

  const model = anthropic('claude-sonnet-4-5');

  return new Agent({
    name: 'claude-coding-agent',
    instructions: `You are a senior full-stack engineer with access to a user's isolated workspace.
You can read, write, list, and delete files, as well as run Node.js scripts.

Your capabilities:
- read_file: Read any file in the workspace
- write_file: Create or modify files
- list_files: List directory contents
- delete_file: Remove files
- run_node: Execute Node.js scripts and see their output

Best practices:
1. Always check if a file exists using list_files before reading
2. Explain what you're doing step-by-step
3. When writing code, follow best practices and include comments
4. Test your code using run_node when appropriate
5. Be helpful, clear, and concise in your responses

Remember: Each user has their own isolated workspace. You can only access files within the current user's workspace.

**IMPORTANT - When to request approval:**
- Before deleting multiple files or important files
- Before running potentially destructive commands
- Before making significant changes to critical files
- When deploying or publishing code
- Any action that could have major consequences

Use the request_approval tool to get explicit user confirmation via the Vibez.now mobile app.`,
    model,
    tools: [
      readFileTool,
      writeFileTool,
      listFilesTool,
      runNodeTool,
      deleteFileTool,
      requestApprovalTool,
    ],
  });
}

module.exports = {
  createCodingAgent,
  getUserWorkspace,
};
