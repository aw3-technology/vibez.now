# Vibez.now Backend

Express.js backend server with headless Claude Code-style AI agents.

## Features

- ✅ REST API with Express.js
- ✅ Claude AI coding agents powered by VoltAgent
- ✅ Per-user isolated workspaces
- ✅ HTTPS with SSL/TLS (Let's Encrypt)
- ✅ PM2 process management
- ✅ Production-ready deployment on AWS EC2

## Prerequisites

- Node.js 18+
- npm or yarn
- Anthropic API key ([get one here](https://console.anthropic.com/))

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Add your Anthropic API key:
```bash
ANTHROPIC_API_KEY=sk-ant-api03-...
```

## Running Locally

Development mode with auto-reload:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## API Endpoints

### Core API
- `GET /health` - Health check endpoint
- `GET /api/v1` - API info
- `GET /api/v1/vibez` - Example vibez endpoint

### AI Agent API
- `POST /api/agent/:userId/chat` - Chat with coding agent
- `GET /api/agent/:userId/history` - Get conversation history
- `DELETE /api/agent/:userId/history` - Clear conversation
- `GET /api/agent/status` - Check agent status

See [AGENT_API.md](./AGENT_API.md) for complete agent documentation.

## Deployment

The application is deployed on AWS EC2 with Nginx reverse proxy and SSL.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for deployment guide.
