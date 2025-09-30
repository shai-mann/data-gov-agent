import { DuckDBInstance } from '@duckdb/node-api';

// Create a persistent DuckDB connection in memory
const instance = await DuckDBInstance.create(':memory:');
export const conn = await instance.connect();
