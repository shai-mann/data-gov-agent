import { DuckDBInstance } from '@duckdb/node-api';

// Create a persistent DuckDB connection in memory
const instance = await DuckDBInstance.create(':memory:');
export const conn = await instance.connect();

// TODO: FUTURE WORK: This is a hack to store queried datasets in memory so we don't have to download it multiple times
export const workingDatasetMemory: Record<string, string[]> = {};
