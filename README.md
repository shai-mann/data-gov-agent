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

- `GET /v1/health` - Health check endpoint
- `POST /v1/data-gov/search` - Data.gov agent search endpoint

### Data.gov Agent

The data.gov agent helps users find and evaluate datasets from the U.S. government's open data portal. It follows a structured workflow:

1. **Package Search** - Searches for datasets using keywords
2. **Package Show** - Retrieves detailed metadata for candidate datasets
3. **DOI View** - Shows DOI information if available
4. **Dataset Download** - Downloads and previews the first 100 rows
5. **Dataset Evaluation** - Evaluates if the dataset is suitable for the user's query
6. **Select Dataset** - Returns the most suitable dataset

#### Usage

```bash
curl -X POST http://localhost:3000/v1/data-gov/search \
  -H "Content-Type: application/json" \
  -d '{"query": "climate change data"}'
```

## Project Structure

```
├── src/
│   ├── agents/
│   │   ├── calcAgent.ts          # Simple arithmetic calculator agent
│   │   ├── dataGovAgent.ts       # Data.gov dataset search agent
│   │   ├── calcAgent.test.ts     # Calculator agent tests
│   │   ├── dataGovAgent.test.ts  # Data.gov agent tests
│   │   └── helpers/
│   │       └── exportGraphPNG.ts # Graph visualization helper
│   ├── llms/
│   │   ├── index.ts              # LLM exports
│   │   └── openai.ts             # OpenAI configuration
│   ├── tools/
│   │   ├── add.ts                # Simple addition tool
│   │   ├── packageSearch.ts      # Data.gov package search tool
│   │   ├── packageShow.ts        # Data.gov package details tool
│   │   ├── doiView.ts            # DOI information tool
│   │   ├── datasetDownload.ts    # Dataset download and preview tool
│   │   ├── datasetEvaluation.ts  # Dataset suitability evaluation tool
│   │   └── index.ts              # Tool exports
│   └── index.ts                  # Main server file
├── test/
│   ├── __fixtures__/             # Test fixtures and mocks
│   ├── extendExpect.ts           # Test extensions
│   ├── nockSetup.ts              # HTTP mocking setup
│   └── redactInvocationIds.ts    # Test data redaction
├── .github/workflows/
│   └── ci.yml                    # GitHub Actions CI workflow
├── tsconfig.json                 # TypeScript configuration
├── vitest.config.ts              # Vitest test configuration
├── package.json                  # Dependencies and scripts
└── README.md                    # This file
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

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (automatically set to `production` on Vercel)
