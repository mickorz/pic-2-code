import { AppSettings } from '../../types';
import {
  executeGatewayRequest,
  isGatewayUnavailableError,
  shouldUseGateway,
  streamGatewayRequest,
} from './gatewayClient';
import {
  convertHtmlToFlutterWithRuntime,
  convertHtmlToReactNativeWithRuntime,
  convertHtmlToReactWithRuntime,
  explainCodeWithRuntime,
  generateCodeWithRuntime,
  refineCodeWithRuntime,
  streamGenerateCodeWithRuntime,
  streamRefineCodeWithRuntime,
} from './service';
import { AIGatewayRequest, AIGatewayResponse, AIStreamChunk, CodeExplanation } from './types';

const requiresGateway = (settings?: AppSettings): boolean =>
  settings?.provider === 'claude-agent' || settings?.provider === 'codex-cli';

const withRequestId = (message: string, requestId?: string): string =>
  requestId ? `${message} Request ID: ${requestId}` : message;

const requireTextResult = (
  response: AIGatewayResponse,
  emptyMessage: string,
): string => {
  if (!response.ok || !response.text) {
    throw new Error(withRequestId(emptyMessage, response.requestId));
  }
  return response.text;
};

const requireExplanationResult = (
  response: AIGatewayResponse,
  emptyMessage: string,
): CodeExplanation => {
  if (!response.ok || !response.explanation) {
    throw new Error(withRequestId(emptyMessage, response.requestId));
  }
  return response.explanation;
};

const executeWithGatewayFallback = async <T>(
  request: AIGatewayRequest,
  fallback: () => Promise<T>,
  pickResult: (response: AIGatewayResponse) => T,
  signal?: AbortSignal,
): Promise<T> => {
  if (requiresGateway(request.settings) && !shouldUseGateway()) {
    throw new Error(`${request.settings?.provider} provider requires the local AI gateway. Please run the app through the local web server.`);
  }

  if (!shouldUseGateway()) {
    return fallback();
  }

  try {
    const response = await executeGatewayRequest(request, signal);
    return pickResult(response);
  } catch (error) {
    if (isGatewayUnavailableError(error)) {
      if (requiresGateway(request.settings)) {
        throw new Error(`${request.settings?.provider} provider requires the local AI gateway. The gateway is currently unavailable.`);
      }
      return fallback();
    }

    throw error;
  }
};

export const generateCode = async (
  base64Image: string | null,
  mimeType: string | null,
  userPrompt = '',
  settings?: AppSettings,
  signal?: AbortSignal,
): Promise<string> =>
  executeWithGatewayFallback(
    {
      operation: 'generate',
      settings,
      base64Image,
      mimeType,
      userPrompt,
    },
    () => generateCodeWithRuntime(base64Image, mimeType, userPrompt, settings, signal),
    (response) => requireTextResult(response, 'AI gateway returned no generated code.'),
    signal,
  );

export const refineCode = async (
  currentCode: string,
  userInstruction: string,
  settings?: AppSettings,
  signal?: AbortSignal,
): Promise<string> =>
  executeWithGatewayFallback(
    {
      operation: 'refine',
      settings,
      currentCode,
      userInstruction,
    },
    () => refineCodeWithRuntime(currentCode, userInstruction, settings, signal),
    (response) => requireTextResult(response, 'AI gateway returned no refined code.'),
    signal,
  );

export const convertHtmlToReact = async (
  htmlCode: string,
  settings?: AppSettings,
  signal?: AbortSignal,
): Promise<string> =>
  executeWithGatewayFallback(
    {
      operation: 'convert-react',
      settings,
      htmlCode,
    },
    () => convertHtmlToReactWithRuntime(htmlCode, settings, signal),
    (response) => requireTextResult(response, 'AI gateway returned no React conversion result.'),
    signal,
  );

export const convertHtmlToFlutter = async (
  htmlCode: string,
  settings?: AppSettings,
  signal?: AbortSignal,
): Promise<string> =>
  executeWithGatewayFallback(
    {
      operation: 'convert-flutter',
      settings,
      htmlCode,
    },
    () => convertHtmlToFlutterWithRuntime(htmlCode, settings, signal),
    (response) => requireTextResult(response, 'AI gateway returned no Flutter conversion result.'),
    signal,
  );

export const convertHtmlToReactNative = async (
  htmlCode: string,
  settings?: AppSettings,
  signal?: AbortSignal,
  platform: 'expo' | 'cli' = 'expo',
): Promise<string> =>
  executeWithGatewayFallback(
    {
      operation: 'convert-react-native',
      settings,
      htmlCode,
      platform,
    },
    () => convertHtmlToReactNativeWithRuntime(htmlCode, settings, signal, platform),
    (response) => requireTextResult(response, 'AI gateway returned no React Native conversion result.'),
    signal,
  );

export const explainCode = async (
  htmlCode: string,
  settings?: AppSettings,
  signal?: AbortSignal,
): Promise<CodeExplanation> =>
  executeWithGatewayFallback(
    {
      operation: 'explain',
      settings,
      htmlCode,
    },
    () => explainCodeWithRuntime(htmlCode, settings, signal),
    (response) => requireExplanationResult(response, 'AI gateway returned no explanation result.'),
    signal,
  );

export const streamGenerateCode = async function* (
  base64Image: string | null,
  mimeType: string | null,
  userPrompt = '',
  settings?: AppSettings,
  signal?: AbortSignal,
  clientRequestId?: string,
): AsyncGenerator<AIStreamChunk> {
  const request: AIGatewayRequest = {
    clientRequestId,
    operation: 'generate',
    settings,
    base64Image,
    mimeType,
    userPrompt,
  };

  if (requiresGateway(settings)) {
    const response = await executeGatewayRequest(request, signal);
    const text = requireTextResult(response, `${settings?.provider} did not return generated code.`);
    yield { type: 'text', content: text, requestId: response.requestId };
    yield { type: 'done', content: '', requestId: response.requestId };
    return;
  }

  if (shouldUseGateway()) {
    try {
      yield* streamGatewayRequest(request, signal);
      return;
    } catch (error) {
      if (!isGatewayUnavailableError(error)) {
        throw error;
      }
    }
  }

  yield* streamGenerateCodeWithRuntime(base64Image, mimeType, userPrompt, settings, signal);
};

export const streamRefineCode = async function* (
  currentCode: string,
  userInstruction: string,
  settings?: AppSettings,
  signal?: AbortSignal,
  clientRequestId?: string,
): AsyncGenerator<AIStreamChunk> {
  const request: AIGatewayRequest = {
    clientRequestId,
    operation: 'refine',
    settings,
    currentCode,
    userInstruction,
  };

  if (requiresGateway(settings)) {
    const response = await executeGatewayRequest(request, signal);
    const text = requireTextResult(response, `${settings?.provider} did not return refined code.`);
    yield { type: 'text', content: text, requestId: response.requestId };
    yield { type: 'done', content: '', requestId: response.requestId };
    return;
  }

  if (shouldUseGateway()) {
    try {
      yield* streamGatewayRequest(request, signal);
      return;
    } catch (error) {
      if (!isGatewayUnavailableError(error)) {
        throw error;
      }
    }
  }

  yield* streamRefineCodeWithRuntime(currentCode, userInstruction, settings, signal);
};

export type { CodeExplanation } from './types';
