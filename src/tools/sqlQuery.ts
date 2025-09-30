import { tool } from 'langchain';
import { conn } from '../lib/duckdb';
import { z } from 'zod';

export const sqlQueryTool = tool(
  async ({ query, limit = 10 }) => {
    try {
      console.log(
        '🔍 [QUERY] Executing query: "',
        query,
        '" with limit ',
        limit
      );
      const result = await conn.runAndReadAll(query);

      // Create column metadata
      const columns = result.columnNames().map((c, i) => {
        return {
          name: c,
          type: result.columnType(i),
        };
      });

      const output = JSON.stringify({
        rows: result.getRowObjectsJson().slice(0, limit),
        columns,
      });

      console.log('🎉 [QUERY] Returned ', output.length, ' characters');

      return { success: true, output };
    } catch (err) {
      console.error('🔍 [QUERY] Error executing query: ', err);
      return `Error executing query: ${err instanceof Error ? err.message : 'Unknown'}`;
    }
  },
  {
    name: 'sqlQuery',
    description: `Execute a SQL query against the loaded DuckDB tables. Input should be a SQL string.`,
    schema: z.object({
      query: z.string().describe('The SQL query to execute'),
      limit: z
        .number()
        .optional()
        .default(10)
        .describe(
          'The number of rows to limit the output of the query to. Default is 10. Use a limit like 10 or 20 for all queries except the final query.'
        ),
    }),
  }
);
