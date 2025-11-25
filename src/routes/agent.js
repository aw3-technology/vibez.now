// Agent API routes
const express = require('express');
const { createCodingAgent } = require('../agents/claudeCodingAgent');

const router = express.Router();

// In-memory conversation storage (use Redis/DB in production)
const conversations = new Map();

// Initialize the coding agent
let codingAgent;
try {
  codingAgent = createCodingAgent();
} catch (error) {
  console.error('Failed to initialize coding agent:', error.message);
}

/**
 * Get conversation history for a user
 */
function getConversationHistory(userId) {
  if (!conversations.has(userId)) {
    conversations.set(userId, []);
  }
  return conversations.get(userId);
}

/**
 * POST /api/agent/:userId/chat
 * Send a message to the coding agent
 */
router.post('/:userId/chat', async (req, res) => {
  const { userId } = req.params;
  const { message, clearHistory } = req.body;

  // Validation
  if (!message || typeof message !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'message is required and must be a string',
    });
  }

  if (!codingAgent) {
    return res.status(503).json({
      success: false,
      error: 'Coding agent not available. Check ANTHROPIC_API_KEY configuration.',
    });
  }

  try {
    // Get or clear conversation history
    const history = clearHistory ? [] : getConversationHistory(userId);

    // Add user message to history
    history.push({ role: 'user', content: message });

    // Generate response from agent
    const result = await codingAgent.generateText(
      message,
      {
        temperature: 0.2,
        maxTokens: 4096,
        // Pass userId as context for tools
        userId,
      }
    );

    // Add assistant response to history
    history.push({ role: 'assistant', content: result.text });
    conversations.set(userId, history);

    // Return response
    return res.json({
      success: true,
      reply: result.text,
      usage: result.usage,
      toolCalls: result.toolCalls?.length || 0,
      conversationLength: history.length,
    });
  } catch (error) {
    console.error('Agent error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Agent request failed',
    });
  }
});

/**
 * GET /api/agent/:userId/history
 * Get conversation history for a user
 */
router.get('/:userId/history', (req, res) => {
  const { userId } = req.params;
  const history = getConversationHistory(userId);

  return res.json({
    success: true,
    userId,
    messages: history,
    count: history.length,
  });
});

/**
 * DELETE /api/agent/:userId/history
 * Clear conversation history for a user
 */
router.delete('/:userId/history', (req, res) => {
  const { userId } = req.params;
  conversations.delete(userId);

  return res.json({
    success: true,
    message: 'Conversation history cleared',
  });
});

/**
 * GET /api/agent/status
 * Check agent status
 */
router.get('/status', (req, res) => {
  return res.json({
    success: true,
    agentAvailable: !!codingAgent,
    activeConversations: conversations.size,
    apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
  });
});

module.exports = router;
