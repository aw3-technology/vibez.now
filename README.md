# Vibez.now Backend

Express.js backend server for Vibez.now application.

## Prerequisites

- Node.js 18+
- npm or yarn

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
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

- `GET /health` - Health check endpoint
- `GET /api/v1` - API info
- `GET /api/v1/vibez` - Example vibez endpoint

## Deployment

The application is configured to run on AWS EC2 with PM2 process manager.
