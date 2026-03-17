import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import type { AppSettings } from '../../types';
import { AIGatewayRequest, AIRuntimeContext } from '../../services/ai/types';
import { getProviderModels, handleAiGatewayRequest, handleAiGatewayStreamRequest } from './gateway';
import { readAiGatewayLogs, subscribeAiGatewayLogs, writeAiGatewayLog } from './logger';

interface GatewayEnv {
  GEMINI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
}

const readJsonBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawText = Buffer.concat(chunks).toString('utf-8').trim();
  if (!rawText) {
    return {};
  }

  return JSON.parse(rawText);
};

const sendJson = (
  res: ServerResponse,
  status: number,
  requestId: string,
  payload: Record<string, unknown>,
): void => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Request-Id', requestId);
  res.end(JSON.stringify(payload));
};

const buildRuntime = (
  req: IncomingMessage,
  env: GatewayEnv,
  requestId: string,
): AIRuntimeContext => {
  const host = req.headers.host;
  const fallbackOrigin = host ? `http://${host}` : undefined;

  return {
    defaultGeminiApiKey: env.GEMINI_API_KEY,
    defaultOpenRouterApiKey: env.OPENROUTER_API_KEY,
    referer: req.headers.origin || fallbackOrigin,
    title: 'Pic2Code',
    requestId,
  };
};

const createMiddleware = (env: GatewayEnv) => {
  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: () => void,
  ) => {
    const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
    const url = requestUrl.pathname;
    const generatedRequestId: string = randomUUID();
    const startedAt = Date.now();

    if (req.method === 'GET' && url === '/api/ai/health') {
      sendJson(res, 200, generatedRequestId, { ok: true, requestId: generatedRequestId });
      return;
    }

    if (req.method === 'GET' && url === '/api/ai/logs') {
      const requestId = requestUrl.searchParams.get('requestId') || undefined;
      const limit = Number.parseInt(requestUrl.searchParams.get('limit') || '80', 10);
      const logs = await readAiGatewayLogs(
        requestId,
        Number.isNaN(limit) ? 80 : Math.max(1, Math.min(limit, 200)),
      );
      sendJson(res, 200, generatedRequestId, {
        ok: true,
        requestId: generatedRequestId,
        logs,
      });
      return;
    }

    if (req.method === 'GET' && url === '/api/ai/logs/stream') {
      const requestId = requestUrl.searchParams.get('requestId') || undefined;
      const limit = Number.parseInt(requestUrl.searchParams.get('limit') || '40', 10);
      const recentLogs = await readAiGatewayLogs(
        requestId,
        Number.isNaN(limit) ? 40 : Math.max(1, Math.min(limit, 200)),
      );

      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Request-Id', generatedRequestId);
      res.flushHeaders?.();

      const sendLog = (log: unknown) => {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify(log)}\n\n`);
        }
      };

      for (const log of recentLogs) {
        sendLog(log);
      }

      const pingTimer = setInterval(() => {
        if (!res.writableEnded) {
          res.write(': ping\n\n');
        }
      }, 15000);

      const unsubscribe = subscribeAiGatewayLogs((log) => {
        if (requestId && log.requestId !== requestId) {
          return;
        }
        sendLog(log);
      });

      const handleClose = () => {
        clearInterval(pingTimer);
        unsubscribe();
        if (!res.writableEnded) {
          res.end();
        }
      };

      req.on('close', handleClose);
      req.on('aborted', handleClose);
      return;
    }

    if (req.method === 'GET' && url === '/api/ai/models') {
      const requestId = generatedRequestId;
      const provider = requestUrl.searchParams.get('provider') as AppSettings['provider'] | null;

      try {
        await writeAiGatewayLog({
          level: 'info',
          event: 'request_start',
          requestId,
          route: url,
          provider: provider || undefined,
        });

        const models = await getProviderModels(provider || undefined);

        await writeAiGatewayLog({
          level: 'info',
          event: 'request_complete',
          requestId,
          route: url,
          provider: provider || undefined,
          durationMs: Date.now() - startedAt,
          details: {
            modelCount: models.length,
          },
        });

        sendJson(res, 200, requestId, { ok: true, requestId, models });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load provider models.';
        await writeAiGatewayLog({
          level: 'error',
          event: 'request_error',
          requestId,
          route: url,
          provider: provider || undefined,
          durationMs: Date.now() - startedAt,
          message,
        });
        sendJson(res, 500, requestId, { ok: false, requestId, error: message });
      }
      return;
    }

    if (req.method === 'POST' && url === '/api/ai/stream') {
      const abortController = new AbortController();
      const handleClose = () => abortController.abort();
      let requestId: string = generatedRequestId;
      req.on('close', handleClose);

      try {
        const body = await readJsonBody(req) as AIGatewayRequest;
        requestId = body.clientRequestId || generatedRequestId;
        const provider = body.settings?.provider || 'gemini';
        const model = body.settings?.model;

        await writeAiGatewayLog({
          level: 'info',
          event: 'request_start',
          requestId,
          route: url,
          provider,
          model,
          operation: body.operation,
        });

        const stream = handleAiGatewayStreamRequest(
          body,
          buildRuntime(req, env, requestId),
          abortController.signal,
        );

        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Request-Id', requestId);
        res.flushHeaders?.();

        let outputLength = 0;

        for await (const chunk of stream) {
          if (res.writableEnded || abortController.signal.aborted) {
            break;
          }

          res.write(`data: ${JSON.stringify({ ...chunk, requestId })}\n\n`);

          if (chunk.type === 'text') {
            outputLength += chunk.content.length;
          }

          if (chunk.type === 'done' || chunk.type === 'error') {
            break;
          }
        }

        await writeAiGatewayLog({
          level: 'info',
          event: abortController.signal.aborted ? 'request_aborted' : 'request_complete',
          requestId,
          route: url,
          provider,
          model,
          operation: body.operation,
          durationMs: Date.now() - startedAt,
          outputLength,
        });

        if (!res.writableEnded) {
          res.end();
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'AI stream execution failed.';
        await writeAiGatewayLog({
          level: 'error',
          event: 'request_error',
          requestId,
          route: url,
          durationMs: Date.now() - startedAt,
          message,
        });
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
          res.setHeader('X-Request-Id', requestId);
        }
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ type: 'error', content: message, requestId })}\n\n`);
          res.end();
        }
      } finally {
        req.off('close', handleClose);
      }

      return;
    }

    if (req.method !== 'POST' || url !== '/api/ai/execute') {
      next();
      return;
    }

    let requestId: string = generatedRequestId;
    try {
      const body = await readJsonBody(req) as AIGatewayRequest;
      requestId = body.clientRequestId || generatedRequestId;
      const provider = body.settings?.provider || 'gemini';
      const model = body.settings?.model;

      await writeAiGatewayLog({
        level: 'info',
        event: 'request_start',
        requestId,
        route: url,
        provider,
        model,
        operation: body.operation,
      });

      const result = await handleAiGatewayRequest(body, buildRuntime(req, env, requestId));

      await writeAiGatewayLog({
        level: 'info',
        event: 'request_complete',
        requestId,
        route: url,
        provider,
        model,
        operation: body.operation,
        durationMs: Date.now() - startedAt,
        outputLength: result.ok
          ? result.text?.length ?? JSON.stringify(result.explanation || {}).length
          : 0,
      });

      sendJson(res, 200, requestId, { ...result, requestId });
    } catch (error) {
      const status = typeof (error as { status?: unknown })?.status === 'number'
        ? (error as { status: number }).status
        : 500;
      const message = error instanceof Error ? error.message : 'AI execution failed.';

      await writeAiGatewayLog({
        level: 'error',
        event: 'request_error',
        requestId,
        route: url,
        durationMs: Date.now() - startedAt,
        message,
      });

      sendJson(res, status, requestId, { ok: false, requestId, error: message });
    }
  };
};

export const createAiGatewayPlugin = (env: GatewayEnv): Plugin => {
  const middleware = createMiddleware(env);

  return {
    name: 'pic2code-ai-gateway',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
};
