# Juno API

A self-hostable API service for the [Juno](https://juno.build) ecosystem. Built as a reusable Docker container that developers can deploy on their own infrastructure to support Juno's capabilities.

## Overview

This API is designed to be deployed independently, giving you full control over your infrastructure while maintaining compatibility with the Juno ecosystem.

**Current Features:**

- **GitHub:**
  - Proxy OAuth integration with JWT token generation
  - JWKS Endpoint: Public key discovery for the token verification by Juno's authentication module

## Quick Start

### Deploy with Docker

1. Copy the environment template:

```bash
cp .env.production.example .env.production
```

2. Configure your settings in `.env.production`:

```bash
GITHUB_CLIENT_ID=your_github_oauth_client_id
GITHUB_CLIENT_SECRET=your_github_oauth_client_secret
GITHUB_AUTH_ISSUER=https://your-domain.com/auth/github
```

> [!NOTE]
> The issuer must be unique for the service. The authentication modules use it to distinguish the providers.

3. Start the container:

```bash
docker compose up -d
```

The API runs at `http://localhost:3000`. RSA keys are automatically generated on startup with unique key IDs.

## API Endpoints

OpenAPI specification available at `/openapi`

View the interactive API documentation:

http://localhost:3000/openapi

## Development

### Prerequisites

- [Bun](https://bun.sh/)
- OpenSSL

### Local Setup

1. Clone and install:

```bash
git clone <repo>
bun install --frozen-lockfile
```

2. Generate test keys:

```bash
openssl genrsa -out private-key.pem 2048
openssl rsa -in private-key.pem -pubout -out public-key.pem
```

3. Configure environment:

```bash
cp .env.development.example .env.local
# Edit .env with your credentials
```

4. Start development server:

```bash
bun dev
```

## Deployment

### Docker

Build and run:

```bash
docker build -t juno-api .
docker run -p 3000:3000 --env-file .env.production juno-api
```

### Docker Compose

```bash
docker compose up -d
```

## Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Run checks: `bun format && bun lint && bun check && bun test && bun run build`
4. Submit a pull request

## License

MIT
