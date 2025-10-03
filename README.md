# Data.gov Agent 🕵️

[![CI](https://github.com/shai-mann/data-gov-agent/workflows/CI/badge.svg)](https://github.com/shai-mann/data-gov-agent/actions)

> *"Why Google when you can government data?"* — Someone, probably

An agentic microservice that turns natural language questions into actual answers using the treasure trove of data hiding in plain sight on data.gov. Built with Hono, Bun, LangGraph, and a healthy dose of multi-agent orchestration.

*If you're looking for the UI repository, it's right [here](https://github.com/shai-mann/data-gov-ui)*

## What Does This Thing Actually Do?

You ask it a question like "What's the average household income in California?" and instead of shrugging or hallucinating, it:

1. 🔍 Searches through data.gov's 250,000+ datasets to find relevant data
2. 🤔 Evaluates each dataset to see if it's actually useful (spoiler: most aren't)
3. 💾 Downloads the CSV, loads it into DuckDB, and runs SQL queries against it
4. 📊 Returns you an actual answer with citations and links to the source data

No hallucinations. No making stuff up. Just good old-fashioned data extraction with a modern twist.

## The Architecture (Or: How Many Agents Does It Take?)

This project uses a **five-agent orchestration system** because apparently one agent wasn't dramatic enough:

### 🎯 Core Agent
The director. Coordinates the entire workflow from your question to the final answer. Clarifies your query, delegates to other agents, and formats the final response.

**Route:** `POST /research`

### 🔎 Search Agent
The researcher. Generates 5-7 clever search queries (with government-specific keywords like `maintainer:*census*`), searches data.gov, and coordinates parallel evaluation of up to 50 datasets before admitting defeat.

**Key feature:** Won't waste time searching for "climate 2023 data" when it can just search "climate data" and actually find useful results.

### 📋 Eval Agent
The bouncer. Looks at each dataset's metadata and decides if it's worth investigating. Filters out garbage datasets before we waste compute downloading them.

**Valid formats:** CSV only. We're not dealing with your PDFs.

### 🔬 Resource Eval Agent
The deep diver. Does a two-stage evaluation:
1. **Shallow:** "Is this worth my time?" (checks metadata)
2. **Deep:** Downloads preview, analyzes columns, types, and sample values

Handles CSVs, DOIs, HTML pages, and even Excel files (because government agencies love their `.xlsx`).

### ⚗️ Query Agent
The data scientist. Loads the CSV into an in-memory DuckDB instance, generates SQL queries, executes them, evaluates the results, and iterates up to 10 times to get the right answer.

**Flow:** Plan → Execute → Evaluate → Repeat (or give up gracefully)

## The Tech Stack

- **Runtime:** [Bun](https://bun.sh) — because life's too short for `npm install`
- **Framework:** [Hono](https://hono.dev) — lightweight, fast, and doesn't make you fight CORS for 3 hours
- **Agents:** [LangGraph](https://langchain-ai.github.io/langgraph/) — state machines meet AI agents
- **LLM:** OpenAI GPT-4o-mini — fast, cheap, and structured
- **Database:** [DuckDB](https://duckdb.org) — SQL for CSVs without the drama of a real database
- **Data Source:** [data.gov CKAN API](https://www.data.gov/developers/apis) — 250k+ government datasets

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) installed
- OpenAI API key (set as `OPENAI_API_KEY`)
- Data.gov API key (set as `DATA_GOV_API_KEY`) — [get one here](https://api.data.gov/signup/)

### Installation

```bash
# Install dependencies
bun install

# Copy environment template
cp .env.template .env

# Add your API keys to .env
# OPENAI_API_KEY=sk-...
# DATA_GOV_API_KEY=...
```

### Development

```bash
# Start with hot reload
bun run dev

# The server runs on port 3000 by default
# POST to http://localhost:3000/research with:
# { "query": "your question here" }
```

### Testing

```bash
# Run tests
bun run test

# Note: Use `bun run test` not `bun test` because the `nock`
# HTTP mocking library doesn't play nice with Bun's test runner
```

### Code Quality

```bash
# Lint
bun run lint

# Format
bun run format

# Type check
bun run type-check

# Do all the things
bun run lint && bun run format && bun run type-check
```

## API Endpoints

### `POST /research`
The main endpoint. Ask it a question, get an answer.

**Request:**
```json
{
  "query": "What are the top causes of death in the United States?"
}
```

**Response:**
```json
{
  "output": "Based on the CDC data...",
  "dataset": {
    "id": "...",
    "title": "...",
    "url": "..."
  }
}
```

### `GET /ws`
WebSocket endpoint for real-time progress updates. Connect to see what the agents are doing behind the scenes.

**Connection:**
```javascript
const ws = new WebSocket('ws://localhost:3000/ws');
ws.onmessage = (event) => {
  const { type, data } = JSON.parse(event.data);
  console.log(`[${type}]`, data);
};
```

**Message types:**
- `state_transition` — Agent moving between states
- `sub_state_log` — Actions within a state
- `info` — General info
- `error` — Something went wrong

**Reconnection:** Pass `?connectionId=<id>` to reconnect to an existing session.

### `GET /health`
Returns `{ status: 'ok' }` if the server is alive. Riveting stuff.

### Testing Endpoints

- `POST /test/search` — Test search agent directly
- `POST /test/evaluate/:packageId` — Test eval agent on specific dataset
- `POST /test/query/:packageId` — Test query agent on specific dataset

## The Five Tools

Each agent has access to specific tools:

### 1. `packageSearch`
Searches data.gov CKAN API for datasets. Returns top 10 results with metadata (but strips resources/extras to save context).

### 2. `packageShow`
Gets full metadata for a specific dataset by ID. Includes resources, extras, and all the juicy details.

### 3. `datasetDownload`
Downloads CSVs and returns a preview. Has a caching layer (`workingDatasetMemory`) to avoid re-downloading the same dataset multiple times.

### 4. `doiView`
Extracts content from DOI links, HTML pages, and Excel files. Uses Cheerio for HTML parsing with smart semantic selectors.

### 5. `sqlQueryTool`
Executes SQL queries against the DuckDB in-memory database. Returns rows + column metadata.

## Project Structure

```
src/
├── agents/                      # The five agents
│   ├── core-agent/             # Orchestrator
│   ├── search-agent/           # Dataset searcher
│   ├── eval-agent/             # Dataset evaluator
│   ├── resource-eval-agent/    # Resource evaluator
│   ├── query-agent/            # SQL querier
│   └── index.ts                # Agent exports
├── tools/                       # The five tools
│   ├── packageSearch.ts        # Search data.gov
│   ├── packageShow.ts          # Get dataset details
│   ├── datasetDownload.ts      # Download CSVs
│   ├── doiView.ts              # Extract DOI/HTML content
│   ├── sqlQuery.ts             # Execute SQL
│   └── index.ts                # Tool exports
├── lib/                         # Shared utilities
│   ├── data-gov.ts             # CKAN API client
│   ├── database.ts             # DuckDB instance
│   ├── ws-logger.ts            # WebSocket logging
│   ├── annotation.ts           # Zod schemas
│   ├── data-gov.schemas.ts     # API response schemas
│   └── utils.ts                # Helper functions
├── llms/                        # LLM config
│   ├── openai.ts               # GPT-4o-mini setup
│   └── index.ts                # LLM exports
└── index.ts                     # Hono server + routes
```

## How It Works (The Full Flow)

1. **User sends query** → Core Agent
2. **Format Node** → LLM clarifies and expands the query
3. **Search Agent** → Generates 5-7 search queries and searches data.gov
4. **Eval Agent** (parallel fan-out) → Evaluates each dataset's metadata
5. **Resource Eval Agent** (parallel fan-out) → Deep evaluation of each resource
6. **Select Best Dataset** → Chooses the most relevant dataset (or returns null)
7. **Query Agent** → Downloads CSV, loads into DuckDB, runs SQL queries
8. **Evaluate Results** → LLM analyzes results and suggests improvements
9. **Final Output** → Core Agent formats response with full metadata

Throughout this process, WebSocket messages keep you updated on progress.

## Key Design Decisions (Or: Why We Did The Weird Things)

1. **DuckDB for SQL** — Enables SQL querying of CSVs without spinning up Postgres
2. **In-Memory Everything** — Fast, no persistence needed for research tasks
3. **LangGraph for Workflow** — Declarative graph-based agent orchestration beats spaghetti code
4. **Fan-out Parallelization** — Evaluate multiple datasets/resources concurrently
5. **Deferred Nodes** — Wait for all parallel branches before moving on
6. **WebSocket for UX** — Long-running operations need transparency
7. **Structured LLM Output** — Forces the LLM to return parseable JSON schemas
8. **CSV-First** — Primary resources must be CSV (DOI/HTML are context only)
9. **Plan-Execute-Evaluate** — Query agent separates planning, execution, and reflection
10. **Recursion Limits** — Search Agent maxes out at 50 queries, Query Agent at 10 SQL queries

## Environment Variables

```bash
OPENAI_API_KEY=sk-...           # OpenAI API key
DATA_GOV_API_KEY=...            # Data.gov API key (from api.data.gov/signup)
PORT=3000                        # Server port (optional)
```

## Deployment

This thing runs on [Vercel](https://vercel.com) with zero config. Just connect your repo and deploy.

```bash
# Or use the Vercel CLI
vercel
```

## Limitations (Because Nothing Is Perfect)

- **CSV Only:** Primary data sources must be CSV. PDFs, Word docs, and images need not apply.
- **Max 50 Search Queries:** Search Agent gives up after 50 searches if it can't find a relevant dataset.
- **Max 10 SQL Queries:** Query Agent stops after 10 attempts to avoid infinite loops.
- **No Streaming:** Responses come back all at once (but WebSocket provides progress updates).
- **English Only:** Because government data is almost exclusively in English.
- **Data.gov Only:** Not scraping other sources (yet).

## What Makes This Interview-Worthy?

This project demonstrates:

- ✅ **Multi-agent orchestration** with LangGraph's state machines
- ✅ **Parallel execution patterns** (fan-out/fan-in, deferred nodes)
- ✅ **LLM tool use** with structured output schemas
- ✅ **WebSocket real-time updates** for long-running operations
- ✅ **SQL query generation and execution** with DuckDB
- ✅ **Caching strategies** to avoid redundant API calls
- ✅ **Type safety** with TypeScript and Zod
- ✅ **Testing** with Vitest and HTTP mocking
- ✅ **Modern runtime** (Bun) and lightweight framework (Hono)
- ✅ **Production deployment** on Vercel

## Contributing

This is an interview project, so contributions aren't expected. But if you're reading this and want to suggest improvements, feel free to open an issue.

## License

MIT

---

Built with ☕ and a slightly unreasonable amount of agent orchestration.
