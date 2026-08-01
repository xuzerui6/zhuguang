interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success: boolean;
  meta: { changes?: number; last_row_id?: number; [key: string]: unknown };
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run<T = Record<string, unknown>>(): Promise<D1Result<T>>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<{ count: number; duration: number }>;
}

interface R2ObjectBody {
  body: ReadableStream;
  httpEtag: string;
  size: number;
  writeHttpMetadata(headers: Headers): void;
}

interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(key: string, value: ReadableStream | ArrayBuffer | string, options?: Record<string, unknown>): Promise<unknown>;
  delete(key: string): Promise<void>;
}

