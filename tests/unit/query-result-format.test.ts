import { beforeEach, describe, expect, it, vi } from "vitest";

const { connection } = vi.hoisted(() => ({
  connection: {
    query: vi.fn(),
    beginTransaction: vi.fn(),
    commit: vi.fn(),
    rollback: vi.fn(),
    release: vi.fn(),
  },
}));

vi.mock("mysql2/promise", () => ({
  createPool: () => ({ getConnection: async () => connection }),
}));
vi.mock("../../src/utils/index.js", () => ({ log: vi.fn() }));
vi.mock("../../src/config/index.js", () => ({
  mcpConfig: { mysql: {} },
  isMultiDbMode: false,
  MYSQL_DISABLE_READ_ONLY_TRANSACTIONS: false,
  ENABLE_PII_REDACTION: false,
  PII_EXTRA_COLUMNS: [],
  PII_EXTRA_COLUMN_PATTERNS: [],
  PII_REDACT_JSON_STRINGS: true,
  PII_ALLOW_SELECT_STAR: false,
  PII_ALLOW_REFERENCES: false,
  PII_ALLOW_INTROSPECTION: false,
  PII_BLOCK_INTROSPECTION: false,
  ALLOW_INSERT_OPERATION: false,
  ALLOW_UPDATE_OPERATION: false,
  ALLOW_DELETE_OPERATION: false,
  ALLOW_DDL_OPERATION: false,
  SCHEMA_INSERT_PERMISSIONS: {},
  SCHEMA_UPDATE_PERMISSIONS: {},
  SCHEMA_DELETE_PERMISSIONS: {},
  SCHEMA_DDL_PERMISSIONS: {},
}));

import { executeReadOnlyQuery, executeWriteQuery } from "../../src/db/index.js";

interface ToolResult {
  content: { type: string; text: string }[];
  isError: boolean;
  _meta: { executionTimeMs: number };
}

describe("query result JSON compatibility", () => {
  beforeEach(() => vi.clearAllMocks());

  for (const [name, execute] of [
    ["read-only", executeReadOnlyQuery],
    ["general query", executeWriteQuery],
  ] as const) {
    it.each([{ rows: [{ connection_ok: 1 }] }, { rows: [] }])(
      `${name} keeps joined text parseable without changing rows: $rows`,
      async ({ rows }) => {
        connection.query.mockResolvedValue([rows, []]);
        const result = await execute<ToolResult>("SELECT 1 AS connection_ok");

        expect(result.isError).toBe(false);
        const text = result.content.map((block) => block.text).join("\n");
        expect(JSON.parse(text)).toEqual(rows);
        expect(result.content).toHaveLength(1);
        expect(result._meta.executionTimeMs).toBeGreaterThanOrEqual(0);
        expect(connection.release).toHaveBeenCalled();
      },
    );
  }
});
