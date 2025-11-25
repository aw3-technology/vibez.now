# Claude Code Agent API

Headless Claude Code-style agents powered by VoltAgent and Anthropic Claude.

## Overview

The Vibez.now backend now includes AI coding agents that can:
- Read, write, and manipulate files in isolated user workspaces
- Execute Node.js scripts
- Maintain conversation history across sessions
- Provide step-by-step explanations of their actions

Each user gets their own isolated workspace at `workspaces/{userId}/`.

## Prerequisites

1. **Anthropic API Key**: Get one from [console.anthropic.com](https://console.anthropic.com/)
2. Add to your `.env` file:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-api03-...
   ```

## API Endpoints

### 1. Chat with Agent

Send a message to the coding agent and get a response.

**Endpoint**: `POST /api/agent/:userId/chat`

**Request Body**:
```json
{
  "message": "Create a simple Express route that returns 'Hello World'",
  "clearHistory": false
}
```

**Parameters**:
- `userId` (path): Unique identifier for the user
- `message` (body): The message/instruction for the agent
- `clearHistory` (body, optional): Set to `true` to start a fresh conversation

**Response**:
```json
{
  "success": true,
  "reply": "I'll create a simple Express route for you...",
  "usage": {
    "promptTokens": 1234,
    "completionTokens": 567,
    "totalTokens": 1801
  },
  "toolCalls": 2,
  "conversationLength": 4
}
```

**Example with curl**:
```bash
curl -X POST https://dev.vibez.now/api/agent/user123/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Create a file hello.js that prints Hello World"
  }'
```

**Example with JavaScript/fetch**:
```javascript
const response = await fetch('https://dev.vibez.now/api/agent/user123/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'List all files in my workspace'
  })
});

const data = await response.json();
console.log(data.reply);
```

### 2. Get Conversation History

Retrieve the full conversation history for a user.

**Endpoint**: `GET /api/agent/:userId/history`

**Response**:
```json
{
  "success": true,
  "userId": "user123",
  "messages": [
    { "role": "user", "content": "Create a hello.js file" },
    { "role": "assistant", "content": "I'll create that file for you..." }
  ],
  "count": 2
}
```

### 3. Clear Conversation History

Delete all conversation history for a user.

**Endpoint**: `DELETE /api/agent/:userId/history`

**Response**:
```json
{
  "success": true,
  "message": "Conversation history cleared"
}
```

### 4. Check Agent Status

Verify that the agent is properly configured and available.

**Endpoint**: `GET /api/agent/status`

**Response**:
```json
{
  "success": true,
  "agentAvailable": true,
  "activeConversations": 5,
  "apiKeyConfigured": true
}
```

## Agent Capabilities

The coding agent has access to the following tools:

### 1. `read_file`
Read the contents of a file from the user's workspace.

**Example prompt**: "Read the contents of package.json"

### 2. `write_file`
Create or overwrite a file in the workspace.

**Example prompt**: "Create a file called app.js with a basic Express server"

### 3. `list_files`
List files and directories in the workspace.

**Example prompt**: "What files are in my workspace?"

### 4. `run_node`
Execute a Node.js script and return its output.

**Example prompt**: "Run the hello.js file and show me the output"

### 5. `delete_file`
Remove a file from the workspace.

**Example prompt**: "Delete the test.js file"

## Usage Examples

### Example 1: Create and Run a Script

```bash
curl -X POST https://dev.vibez.now/api/agent/user123/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Create a file called greet.js that exports a function to greet a user by name. Then create a test.js file that imports and uses it."
  }'
```

The agent will:
1. Create `greet.js` with the export
2. Create `test.js` with the import
3. Explain what it created

### Example 2: Debug Existing Code

```bash
curl -X POST https://dev.vibez.now/api/agent/user123/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "I have a file called buggy.js. Read it, identify the issues, fix them, and run it to verify it works."
  }'
```

The agent will:
1. Read the file
2. Analyze for bugs
3. Fix the issues
4. Run it to verify
5. Explain what was wrong

### Example 3: Project Setup

```bash
curl -X POST https://dev.vibez.now/api/agent/user123/chat \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Set up a basic Express API project with a health check endpoint, proper error handling, and a README."
  }'
```

## Security

- **Workspace Isolation**: Each user has an isolated workspace. The agent cannot access files outside the workspace.
- **Path Traversal Protection**: All file paths are validated to prevent directory traversal attacks.
- **Execution Timeout**: Script execution has a 30-second timeout by default.
- **No System Access**: The agent can only run Node.js scripts, not arbitrary shell commands.

## Best Practices

### 1. Use Descriptive User IDs
```javascript
// Good
const userId = `user_${authenticatedUser.id}`;

// Avoid
const userId = 'anonymous';
```

### 2. Clear History for New Sessions
```javascript
await fetch('/api/agent/user123/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    message: 'Start a new project',
    clearHistory: true  // Fresh start
  })
});
```

### 3. Handle Errors Gracefully
```javascript
try {
  const response = await fetch('/api/agent/user123/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: 'Create a complex app' })
  });

  const data = await response.json();

  if (!data.success) {
    console.error('Agent error:', data.error);
  }
} catch (error) {
  console.error('Network error:', error);
}
```

### 4. Monitor Token Usage
```javascript
const { usage } = await response.json();
console.log(`Tokens used: ${usage.totalTokens}`);
```

## Integration with Mobile Apps

### React Native Example
```javascript
async function askAgent(userId, question) {
  try {
    const response = await fetch(`https://dev.vibez.now/api/agent/${userId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: question })
    });

    const data = await response.json();
    return data.reply;
  } catch (error) {
    console.error('Failed to get agent response:', error);
    throw error;
  }
}

// Usage
const reply = await askAgent('user123', 'Create a login component');
console.log(reply);
```

### Flutter Example
```dart
Future<String> askAgent(String userId, String message) async {
  final response = await http.post(
    Uri.parse('https://dev.vibez.now/api/agent/$userId/chat'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({'message': message}),
  );

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body);
    return data['reply'];
  } else {
    throw Exception('Failed to get agent response');
  }
}
```

## Production Considerations

### 1. Conversation Storage
The current implementation uses in-memory storage. For production:
- Use Redis for distributed caching
- Or store in a database (PostgreSQL, MongoDB, etc.)

### 2. Rate Limiting
Add rate limiting to prevent abuse:
```javascript
const rateLimit = require('express-rate-limit');

const agentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20 // limit each user to 20 requests per window
});

app.use('/api/agent', agentLimiter);
```

### 3. Authentication
Protect the API with authentication:
```javascript
const authenticate = require('./middleware/auth');
app.use('/api/agent', authenticate);
```

### 4. Cost Management
Monitor Anthropic API usage and set budgets:
- Track tokens per user
- Implement daily/monthly limits
- Cache common responses

## Troubleshooting

### Agent Not Available
**Error**: `"Coding agent not available"`

**Solution**: Check that `ANTHROPIC_API_KEY` is set in your environment:
```bash
# On EC2
echo $ANTHROPIC_API_KEY

# If not set, add to .env file
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env
```

### Rate Limit Errors
**Error**: `"rate_limit_error"`

**Solution**: Implement exponential backoff or reduce request frequency.

### Workspace Permissions
**Error**: `"EACCES: permission denied"`

**Solution**: Ensure the `workspaces/` directory is writable:
```bash
mkdir -p workspaces
chmod 755 workspaces
```

## Pricing

The agent uses Claude 3.5 Sonnet by default. Pricing (as of 2024):
- Input: $3 per million tokens
- Output: $15 per million tokens

Typical conversation:
- Simple request: ~1,000-2,000 tokens (~$0.02-0.04)
- Complex task: ~5,000-10,000 tokens (~$0.10-0.20)

## Support

For issues or questions:
- Check the main [DEPLOYMENT.md](./DEPLOYMENT.md) guide
- Review server logs: `pm2 logs vibez-now-backend`
- GitHub: https://github.com/aw3-technology/vibez.now
