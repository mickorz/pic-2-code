import { AIGatewayRequest, AIGatewayResponse, AIStreamChunk } from './types';

type GatewayAvailability = 'unknown' | 'available' | 'unavailable';

let gatewayAvailability: GatewayAvailability = 'unknown';

const createGatewayUnavailableError = (message: string): Error & { code: 'GATEWAY_UNAVAILABLE' } => {
  const error = new Error(message) as Error & { code: 'GATEWAY_UNAVAILABLE' };
  error.code = 'GATEWAY_UNAVAILABLE';
  return error;
};

const appendRequestId = (message: string, requestId?: string | null): string => {
  if (!requestId) return message;
  if (message.includes(`Request ID: ${requestId}`)) return message;
  return `${message} Request ID: ${requestId}`;
};

export const shouldUseGateway = (): boolean => gatewayAvailability !== 'unavailable';

export const isGatewayUnavailableError = (error: unknown): boolean =>
  error instanceof Error && 'code' in error && (error as { code?: string }).code === 'GATEWAY_UNAVAILABLE';

export const executeGatewayRequest = async (
  request: AIGatewayRequest,
  signal?: AbortSignal,
): Promise<AIGatewayResponse> => {
  try {
    const response = await fetch('/api/ai/execute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal,
    });

    if (response.status === 404 || response.status === 405) {
      gatewayAvailability = 'unavailable';
      throw createGatewayUnavailableError('AI gateway is unavailable and has fallen back to direct mode.');
    }

    const requestId = response.headers.get('x-request-id');
    const data = await response.json() as AIGatewayResponse;

    if (!response.ok) {
      gatewayAvailability = 'available';
      const errorMessage = data.ok
        ? 'AI gateway request failed.'
        : ('error' in data ? data.error : 'AI gateway request failed.');
      throw new Error(
        appendRequestId(
          errorMessage,
          requestId || data.requestId,
        ),
      );
    }

    gatewayAvailability = 'available';
    return {
      ...data,
      requestId: data.requestId || requestId || undefined,
    };
  } catch (error) {
    if (isGatewayUnavailableError(error)) {
      throw error;
    }

    if (error instanceof TypeError) {
      gatewayAvailability = 'unavailable';
      throw createGatewayUnavailableError('AI gateway connection failed and has fallen back to direct mode.');
    }

    throw error;
  }
};

export const streamGatewayRequest = async function* (
  request: AIGatewayRequest,
  signal?: AbortSignal,
): AsyncGenerator<AIStreamChunk> {
  try {
    const response = await fetch('/api/ai/stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal,
    });

    if (response.status === 404 || response.status === 405) {
      gatewayAvailability = 'unavailable';
      throw createGatewayUnavailableError('AI gateway is unavailable and has fallen back to direct mode.');
    }

    const requestId = response.headers.get('x-request-id');

    if (!response.ok) {
      gatewayAvailability = 'available';
      const errorText = await response.text();
      throw new Error(appendRequestId(errorText || 'AI gateway streaming request failed.', requestId));
    }

    const reader = response.body?.getReader();
    if (!reader) {
      gatewayAvailability = 'available';
      throw new Error(appendRequestId('AI gateway streaming response is unavailable.', requestId));
    }

    gatewayAvailability = 'available';
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data:')) continue;

        const payload = line.slice(5).trim();
        if (!payload) continue;

        const chunk = JSON.parse(payload) as AIStreamChunk;
        if (chunk.requestId == null && requestId) {
          chunk.requestId = requestId;
        }

        if (chunk.type === 'error') {
          chunk.content = appendRequestId(chunk.content, chunk.requestId);
        }

        yield chunk;

        if (chunk.type === 'done') {
          return;
        }
      }
    }
  } catch (error) {
    if (isGatewayUnavailableError(error)) {
      throw error;
    }

    if (error instanceof TypeError) {
      gatewayAvailability = 'unavailable';
      throw createGatewayUnavailableError('AI gateway connection failed and has fallen back to direct mode.');
    }

    throw error;
  }
};
