import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const runtimeDir = join(process.cwd(), '.codex-runtime');
const logFilePath = join(runtimeDir, 'ai-gateway.log');
let logSequence = 0;
const logListeners = new Set<(record: AILogRecord) => void>();

type Primitive = string | number | boolean | null | undefined;

const isPrimitive = (value: unknown): value is Primitive =>
  value === null
  || value === undefined
  || typeof value === 'string'
  || typeof value === 'number'
  || typeof value === 'boolean';

export interface AILogEntry {
  level: 'info' | 'error';
  event: string;
  requestId?: string;
  route?: string;
  provider?: string;
  model?: string;
  operation?: string;
  durationMs?: number;
  outputLength?: number;
  message?: string;
  details?: Record<string, Primitive>;
}

export interface AILogRecord extends AILogEntry {
  seq: number;
  ts: string;
}

const sanitize = (value: unknown): Primitive | Record<string, Primitive> => {
  if (isPrimitive(value)) {
    return value;
  }

  if (value instanceof Error) {
    return value.message;
  }

  if (typeof value === 'object') {
    const result: Record<string, Primitive> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const sanitized = sanitize(item);
      if (isPrimitive(sanitized)) {
        result[key] = sanitized;
      }
    }
    return result;
  }

  return String(value);
};

export const getAiGatewayLogPath = (): string => logFilePath;

export const subscribeAiGatewayLogs = (
  listener: (record: AILogRecord) => void,
): (() => void) => {
  logListeners.add(listener);
  return () => {
    logListeners.delete(listener);
  };
};

export const readAiGatewayLogs = async (
  requestId?: string,
  limit = 80,
): Promise<AILogRecord[]> => {
  try {
    const raw = await readFile(logFilePath, 'utf-8');
    const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
    const records = lines
      .map((line, index) => {
        try {
          const parsed = JSON.parse(line) as Partial<AILogRecord>;
          return {
            seq: typeof parsed.seq === 'number' ? parsed.seq : index + 1,
            ts: typeof parsed.ts === 'string' ? parsed.ts : new Date().toISOString(),
            ...parsed,
          } as AILogRecord;
        } catch {
          return null;
        }
      })
      .filter((record): record is AILogRecord => record != null)
      .filter((record) => !requestId || record.requestId === requestId);

    return records.slice(-limit);
  } catch {
    return [];
  }
};

export const writeAiGatewayLog = async (entry: AILogEntry): Promise<void> => {
  const payload: AILogRecord = {
    seq: ++logSequence,
    ts: new Date().toISOString(),
    ...entry,
    ...(entry.details ? { details: sanitize(entry.details) as Record<string, Primitive> } : {}),
  };

  try {
    await mkdir(runtimeDir, { recursive: true });
    await appendFile(logFilePath, `${JSON.stringify(payload)}\n`, 'utf-8');
  } catch {
    // 日志写入失败时不阻塞主流程
  }

  for (const listener of logListeners) {
    try {
      listener(payload);
    } catch {
      // 单个监听器异常时忽略，避免影响其他订阅者
    }
  }
};
