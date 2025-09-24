# Data Gov Agent

[![CI](https://github.com/shai-mann/data-gov-agent/workflows/CI/badge.svg)](https://github.com/shai-mann/data-gov-agent/actions)

A modern microservice built with Hono and Bun, featuring TypeScript, ESLint, and Prettier.

## Features

- ⚡ **Hono** - Fast, lightweight web framework
- 🚀 **Bun** - Fast JavaScript runtime and package manager
- 📝 **TypeScript** - Type-safe development
- 🔍 **ESLint** - Code linting and quality
- 💅 **Prettier** - Code formatting
- 🔥 **Hot reload** - Development with instant updates
- ☁️ **Vercel Ready** - Deploy to Vercel with zero configuration

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed on your system

### Installation

```bash
# Install dependencies
bun install
```

### Development

```bash
# Start development server with hot reload
bun run dev

# Start production server
bun run start

# Run all tests
bun run test # `bun test` doesn't work with `nock` module

# Build for production
bun run build

# Build for Vercel deployment
bun run build:vercel
```

### Code Quality

```bash
# Run ESLint
bun run lint

# Fix ESLint issues
bun run lint:fix

# Format code with Prettier
bun run format

# Check formatting
bun run format:check

# Type check
bun run type-check
```

## API Endpoints

- `GET /` - Welcome message and API info
- `GET /health` - Health check endpoint
- `GET /api/hello?name=World` - Hello world endpoint

## Project Structure

```
├── src/
│   └── index.ts          # Main server file
├── .eslintrc.json        # ESLint configuration
├── .prettierrc           # Prettier configuration
├── .prettierignore       # Prettier ignore patterns
├── tsconfig.json         # TypeScript configuration
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

## CI/CD

This project includes a GitHub Actions CI workflow:

- **CI** - Runs on every push and PR, includes linting, formatting, type checking, and basic testing

## Vercel Deployment

This project is configured for seamless deployment to Vercel's serverless platform:

### Quick Deploy

```bash
# Deploy to Vercel
bun run deploy:vercel
```

### Zero-Config Deployment

- **Automatic Detection** - Vercel automatically detects the configuration
- **GitHub Integration** - Connect your repo for automatic deployments
- **Preview Deployments** - Every PR gets a preview URL
- **Edge Functions** - Global distribution for optimal performance

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (automatically set to `production` on Vercel)
