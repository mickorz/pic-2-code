import { GoogleGenAI } from '@google/genai';
import { AIProviderRequest, AIRuntimeContext, AIStreamChunk } from './types';

export const withSignal = async <T>(
  promise: Promise<T>,
  signal?: AbortSignal,
): Promise<T> => {
  if (!signal) return promise;

  if (signal.aborted) {
    throw new DOMException('Aborted', 'AbortError');
  }

  return new Promise((resolve, reject) => {
    const handleAbort = () => {
      reject(new DOMException('Aborted', 'AbortError'));
      signal.removeEventListener('abort', handleAbort);
    };

    signal.addEventListener('abort', handleAbort);

    promise.then(
      (value) => {
        signal.removeEventListener('abort', handleAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', handleAbort);
        reject(error);
      },
    );
  });
};

const getGeminiApiKey = (
  request: AIProviderRequest,
  runtime?: AIRuntimeContext,
): string => {
  const apiKey = request.geminiApiKey || runtime?.defaultGeminiApiKey;
  if (!apiKey) {
    throw new Error('Gemini API Key 缺失，请在设置中填写或在服务端环境变量中提供。');
  }
  return apiKey;
};

const getOpenRouterApiKey = (
  request: AIProviderRequest,
  runtime?: AIRuntimeContext,
): string => {
  const apiKey = request.openRouterApiKey || runtime?.defaultOpenRouterApiKey;
  if (!apiKey) {
    throw new Error('OpenRouter API Key 缺失，请在设置中填写或在服务端环境变量中提供。');
  }
  return apiKey;
};

const callGemini = async (
  request: AIProviderRequest,
  runtime?: AIRuntimeContext,
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey(request, runtime) });
  const parts: Array<Record<string, unknown>> = [];

  if (request.imageBase64 && request.imageType) {
    parts.push({
      inlineData: {
        mimeType: request.imageType,
        data: request.imageBase64,
      },
    });
  }

  parts.push({ text: request.userPrompt });

  const config: Record<string, unknown> = {
    systemInstruction: request.systemInstruction,
    temperature: request.temperature,
  };

  if (request.model.includes('thinking')) {
    config.thinkingConfig = { thinkingBudget: 2048 };
  }

  if (request.responseMimeType) {
    config.responseMimeType = request.responseMimeType;
  }

  const response = await withSignal(
    ai.models.generateContent({
      model: request.model,
      contents: { parts },
      config,
    }),
    request.signal,
  );

  const text = response.text;
  if (!text) {
    throw new Error('Gemini 没有返回内容。');
  }

  return text;
};

const readOpenRouterError = async (response: Response): Promise<string> => {
  const rawText = await response.text();

  try {
    const parsed = JSON.parse(rawText) as {
      error?: {
        message?: string;
      };
    };
    return parsed.error?.message || response.statusText || rawText;
  } catch {
    return rawText || response.statusText;
  }
};

const callOpenRouter = async (
  request: AIProviderRequest,
  runtime?: AIRuntimeContext,
): Promise<string> => {
  const messages: Array<Record<string, unknown>> = [
    {
      role: 'system',
      content: request.systemInstruction,
    },
  ];

  if (request.imageBase64 && request.imageType) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: request.userPrompt || 'Generate code based on this image.',
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:${request.imageType};base64,${request.imageBase64}`,
          },
        },
      ],
    });
  } else {
    messages.push({
      role: 'user',
      content: request.userPrompt,
    });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${getOpenRouterApiKey(request, runtime)}`,
    'Content-Type': 'application/json',
  };

  if (runtime?.referer) {
    headers['HTTP-Referer'] = runtime.referer;
  }

  if (runtime?.title) {
    headers['X-Title'] = runtime.title;
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: request.model,
      messages,
      temperature: request.temperature,
    }),
    signal: request.signal,
  });

  if (!response.ok) {
    throw new Error(`OpenRouter 调用失败：${await readOpenRouterError(response)}`);
  }

  const data = await response.json() as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('OpenRouter 没有返回内容。');
  }

  return text;
};

const extractOpenRouterStreamText = (payload: unknown): string => {
  const parsed = payload as {
    choices?: Array<{
      delta?: {
        content?: string | Array<{ text?: string }>;
      };
    }>;
  };

  const content = parsed.choices?.[0]?.delta?.content;

  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item?.text === 'string' ? item.text : ''))
      .join('');
  }

  return '';
};

const streamGemini = async function* (
  request: AIProviderRequest,
  runtime?: AIRuntimeContext,
): AsyncGenerator<AIStreamChunk> {
  const ai = new GoogleGenAI({ apiKey: getGeminiApiKey(request, runtime) });
  const parts: Array<Record<string, unknown>> = [];

  if (request.imageBase64 && request.imageType) {
    parts.push({
      inlineData: {
        mimeType: request.imageType,
        data: request.imageBase64,
      },
    });
  }

  parts.push({ text: request.userPrompt });

  const config: Record<string, unknown> = {
    systemInstruction: request.systemInstruction,
    temperature: request.temperature,
  };

  if (request.model.includes('thinking')) {
    config.thinkingConfig = { thinkingBudget: 2048 };
  }

  const stream = await ai.models.generateContentStream({
    model: request.model,
    contents: { parts },
    config,
  });

  for await (const chunk of stream) {
    if (request.signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    const text = chunk.text;
    if (text) {
      yield { type: 'text', content: text };
    }
  }

  yield { type: 'done', content: '' };
};

const streamOpenRouter = async function* (
  request: AIProviderRequest,
  runtime?: AIRuntimeContext,
): AsyncGenerator<AIStreamChunk> {
  const messages: Array<Record<string, unknown>> = [
    {
      role: 'system',
      content: request.systemInstruction,
    },
  ];

  if (request.imageBase64 && request.imageType) {
    messages.push({
      role: 'user',
      content: [
        {
          type: 'text',
          text: request.userPrompt || 'Generate code based on this image.',
        },
        {
          type: 'image_url',
          image_url: {
            url: `data:${request.imageType};base64,${request.imageBase64}`,
          },
        },
      ],
    });
  } else {
    messages.push({
      role: 'user',
      content: request.userPrompt,
    });
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${getOpenRouterApiKey(request, runtime)}`,
    'Content-Type': 'application/json',
  };

  if (runtime?.referer) {
    headers['HTTP-Referer'] = runtime.referer;
  }

  if (runtime?.title) {
    headers['X-Title'] = runtime.title;
  }

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: request.model,
      messages,
      temperature: request.temperature,
      stream: true,
    }),
    signal: request.signal,
  });

  if (!response.ok) {
    throw new Error(`OpenRouter 调用失败：${await readOpenRouterError(response)}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('OpenRouter 流式响应不可用。');
  }

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

      const data = line.slice(5).trim();
      if (!data) continue;

      if (data === '[DONE]') {
        yield { type: 'done', content: '' };
        return;
      }

      try {
        const payload = JSON.parse(data);
        const text = extractOpenRouterStreamText(payload);
        if (text) {
          yield { type: 'text', content: text };
        }
      } catch {
        // 跳过非 JSON 行
      }
    }
  }

  yield { type: 'done', content: '' };
};

export const executeProviderRequest = async (
  request: AIProviderRequest,
  runtime?: AIRuntimeContext,
): Promise<string> => {
  if (request.provider === 'openrouter') {
    return callOpenRouter(request, runtime);
  }

  return callGemini(request, runtime);
};

export const executeProviderRequestStream = (
  request: AIProviderRequest,
  runtime?: AIRuntimeContext,
): AsyncGenerator<AIStreamChunk> => {
  if (request.provider === 'openrouter') {
    return streamOpenRouter(request, runtime);
  }

  return streamGemini(request, runtime);
};
