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

The data.gov agent helps users find and evaluate datasets from the U.S. government's open data portal. It uses a single LLM node with access to all dataset-finding tools, allowing for flexible and intelligent dataset discovery.

**Available Tools:**

- **Package Search** - Searches for datasets using keywords
- **Package Show** - Retrieves detailed metadata for specific datasets
- **DOI View** - Shows DOI information if available
- **Dataset Download** - Downloads and previews the first 100 rows
- **Dataset Evaluation** - Evaluates if a dataset is suitable for the user's query

**Workflow:**
The LLM intelligently uses these tools to:

1. Search for datasets matching the user's query
2. Get detailed information about promising candidates
3. View DOI information if available
4. Download and preview datasets
5. Evaluate suitability and provide recommendations
6. Return the best match or search for alternatives

#### Usage

```bash
curl -X POST http://localhost:3000/v1/data-gov/search \
  -H "Content-Type: application/json" \
  -d '{"query": "climate change data"}'
```

## Project Structure

> **Note on Import Paths**: This project uses relative imports (e.g., `../../lib/utils.ts`) rather than aliased imports (e.g., `@/lib/utils`). I did everything with aliased imports and it was beautiful, but then I had to remove them to make the app servable on Vercel. There were other solutions, they would just involve deeper rewrites.

```
├── src/
│   ├── agents/                           # LangGraph agent implementations
│   │   ├── core-agent/                   # Main orchestration agent
│   │   │   ├── coreAgent.ts             # Coordinates query, search, and eval agents
│   │   │   └── prompts.ts               # System prompts for core agent
│   │   ├── query-agent/                  # Query analysis and SQL generation
│   │   │   ├── queryAgent.ts            # Analyzes queries and generates SQL
│   │   │   └── prompts.ts               # Query agent prompts
│   │   ├── search-agent/                 # Dataset discovery and evaluation
│   │   │   ├── searchAgent.ts           # Searches and evaluates datasets
│   │   │   └── prompts.ts               # Search agent prompts
│   │   ├── eval-agent/                   # Dataset quality evaluation
│   │   │   ├── evalAgent.ts             # Evaluates dataset suitability
│   │   │   ├── prompts.ts               # Evaluation prompts
│   │   │   └── annotations.ts           # Type definitions for eval state
│   │   ├── resource-eval-agent/          # Resource-specific evaluation
│   │   │   ├── resourceEvalAgent.ts     # Evaluates individual resources
│   │   │   ├── prompts.ts               # Resource eval prompts
│   │   │   └── annotations.ts           # Type definitions for resource state
│   │   └── index.ts                      # Agent exports
│   ├── tools/                            # LangChain tools for Data.gov API
│   │   ├── packageSearch.ts              # Search datasets by keywords
│   │   ├── packageNameSearch.ts          # Search datasets by exact name
│   │   ├── packageShow.ts                # Get detailed dataset metadata
│   │   ├── doiView.ts                    # Retrieve DOI information
│   │   ├── sqlQuery.ts                   # Execute SQL queries on datasets
│   │   ├── datasetDownload.ts            # Download and preview datasets
│   │   └── index.ts                      # Tool exports
│   ├── lib/                              # Shared utilities and data access
│   │   ├── data-gov.ts                   # Data.gov API client functions
│   │   ├── data-gov.schemas.ts           # Zod schemas for API responses
│   │   ├── database.ts                   # Database utilities (if applicable)
│   │   ├── annotation.ts                 # Shared LangGraph annotations
│   │   ├── utils.ts                      # General utility functions
│   │   └── mock-data.ts                  # Mock data for testing
│   ├── llms/                             # LLM configuration
│   │   ├── openai.ts                     # OpenAI model initialization
│   │   └── index.ts                      # LLM exports
│   ├── routes/                           # HTTP route handlers
│   │   ├── agents.ts                     # Agent-related endpoints
│   │   └── testing.ts                    # Testing/development endpoints
│   └── index.ts                          # Main Hono server and routes
├── .github/workflows/
│   └── ci.yml                            # GitHub Actions CI workflow
├── tsconfig.json                         # TypeScript configuration
├── package.json                          # Dependencies and scripts
└── README.md                            # This file
```

### Architecture Overview

The application follows a multi-agent architecture using LangGraph:

- **Core Agent**: Orchestrates the entire workflow, coordinating between query analysis, dataset search, and evaluation
- **Query Agent**: Analyzes user queries to understand data requirements and generates SQL for dataset analysis
- **Search Agent**: Discovers relevant datasets using the Data.gov API and performs initial filtering
- **Eval Agent**: Evaluates datasets for suitability based on metadata, quality, and relevance
- **Resource Eval Agent**: Performs detailed evaluation of individual dataset resources (files, APIs, etc.)

Each agent is implemented as a LangGraph state machine with clearly defined nodes and edges, allowing for complex reasoning workflows while maintaining modularity and testability.

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
