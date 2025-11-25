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
  }),
  async execute({ title, description, code_snippet }, { userId }) {
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
 * Tool: Configure Git credentials
 */
const gitConfigTool = createTool({
  name: 'git_config',
  description: 'Configure Git user identity (name and email) for commits in the workspace. Required before committing.',
  parameters: z.object({
    name: z.string().describe('Git user name for commits'),
    email: z.string().describe('Git user email for commits'),
  }),
  async execute({ name, email }, { userId }) {
    const workspaceRoot = await getUserWorkspace(userId);

    try {
      await execAsync(`git config --global user.name "${name}"`, { cwd: workspaceRoot });
      await execAsync(`git config --global user.email "${email}"`, { cwd: workspaceRoot });

      return {
        success: true,
        message: `Git configured with name: ${name}, email: ${email}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
});

/**
 * Tool: Clone a Git repository
 */
const gitCloneTool = createTool({
  name: 'git_clone',
  description: 'Clone a Git repository into a folder in the workspace. Useful for pulling projects from GitHub. For private repos, include token in URL: https://TOKEN@github.com/user/repo.git',
  parameters: z.object({
    repoUrl: z.string().describe('Git repository URL. For private repos use: https://TOKEN@github.com/user/repo.git where TOKEN is a GitHub Personal Access Token'),
    folderName: z.string().describe('Name of the folder to clone into'),
    branch: z.string().optional().describe('Specific branch to clone (optional, defaults to main/master)'),
  }),
  async execute({ repoUrl, folderName, branch }, { userId }) {
    const workspaceRoot = await getUserWorkspace(userId);
    const targetPath = path.join(workspaceRoot, folderName);

    // Security: prevent path traversal
    if (!targetPath.startsWith(workspaceRoot)) {
      throw new Error('Invalid path: cannot access files outside workspace');
    }

    // Check if folder already exists
    try {
      await fs.access(targetPath);
      return { success: false, error: 'Folder already exists. Please use a different folder name or delete the existing folder first.' };
    } catch {
      // Folder doesn't exist, good to proceed
    }

    try {
      const branchArg = branch ? `-b ${branch}` : '';
      const { stdout, stderr } = await execAsync(
        `git clone ${branchArg} "${repoUrl}" "${targetPath}"`,
        { cwd: workspaceRoot, timeout: 60000 }
      );
      return {
        success: true,
        message: `Successfully cloned repository to ${folderName}`,
        stdout: stdout || '',
        stderr: stderr || '',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stderr: error.stderr || '',
      };
    }
  },
});

/**
 * Tool: Run git commands
 */
const gitCommandTool = createTool({
  name: 'git_command',
  description: 'Run git commands like status, add, commit, push, pull, etc. in a specific folder.',
  parameters: z.object({
    command: z.string().describe('Git command to run (e.g., "status", "add .", "commit -m \'message\'", "push origin main")'),
    folderPath: z.string().describe('Path to the git repository folder (relative to workspace root)'),
  }),
  async execute({ command, folderPath }, { userId }) {
    const workspaceRoot = await getUserWorkspace(userId);
    const repoPath = path.join(workspaceRoot, folderPath);

    // Security: prevent path traversal
    if (!repoPath.startsWith(workspaceRoot)) {
      throw new Error('Invalid path: cannot access files outside workspace');
    }

    // Check if folder exists
    try {
      await fs.access(repoPath);
    } catch {
      return { success: false, error: `Folder ${folderPath} does not exist` };
    }

    try {
      const { stdout, stderr } = await execAsync(
        `git ${command}`,
        { cwd: repoPath, timeout: 30000 }
      );
      return {
        success: true,
        stdout: stdout || '',
        stderr: stderr || '',
        command: `git ${command}`,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.code || 1,
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
You can read, write, list, and delete files, run Node.js scripts, and work with Git repositories.

Your capabilities:
- read_file: Read any file in the workspace
- write_file: Create or modify files
- list_files: List directory contents
- delete_file: Remove files
- run_node: Execute Node.js scripts and see their output
- git_config: Configure Git user name and email (required before committing)
- git_clone: Clone a Git repository into a folder (supports private repos with tokens)
- git_command: Run git commands (status, add, commit, push, pull, etc.)

Git workflow example:
1. Configure Git identity: git_config with name and email
2. Clone repository: git_clone with repoUrl (use https://TOKEN@github.com/user/repo.git for private repos) and folderName
3. Make changes to files using write_file
4. Stage changes: git_command with command "add ." and folderPath
5. Commit: git_command with command "commit -m 'your message'" and folderPath
6. Push: git_command with command "push" and folderPath (token in clone URL is cached)

Best practices:
1. Always check if a file exists using list_files before reading
2. Explain what you're doing step-by-step
3. When writing code, follow best practices and include comments
4. Test your code using run_node when appropriate
5. Be helpful, clear, and concise in your responses
6. For git operations, always check git status before committing
7. Use descriptive commit messages

Remember: Each user has their own isolated workspace. You can only access files within the current user's workspace.

**IMPORTANT - When to request approval:**
- Before deleting multiple files or important files
- Before running potentially destructive commands
- Before making significant changes to critical files
- Before pushing to a git repository (deploying code)
- Any action that could have major consequences

Use the request_approval tool to get explicit user confirmation via the Vibez.now mobile app.`,
    model,
    tools: [
      readFileTool,
      writeFileTool,
      listFilesTool,
      runNodeTool,
      deleteFileTool,
      gitConfigTool,
      gitCloneTool,
      gitCommandTool,
      requestApprovalTool,
    ],
  });
}

module.exports = {
  createCodingAgent,
  getUserWorkspace,
};
