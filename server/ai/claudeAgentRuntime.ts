import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { AIProviderRequest, AIRuntimeContext, AIStreamChunk } from '../../services/ai/types';
import { writeAiGatewayLog } from './logger';

interface ClaudeModelOption {
  id: string;
  name: string;
  provider: 'claude-agent';
  description?: string;
}

const extractAssistantText = (message: unknown): string => {
  const parsed = message as {
    type?: string;
    message?: {
      content?: Array<{ type?: string; text?: string }>;
    };
  };

  if (parsed.type !== 'assistant' || !Array.isArray(parsed.message?.content)) {
    return '';
  }

  return parsed.message.content
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text || '')
    .join('\n');
};

const extractResultText = (message: unknown): string => {
  const parsed = message as {
    type?: string;
    subtype?: string;
    result?: string;
  };

  if (parsed.type !== 'result' || parsed.subtype !== 'success' || typeof parsed.result !== 'string') {
    return '';
  }

  return parsed.result;
};

const createImageContext = async (
  request: AIProviderRequest,
): Promise<{ prompt: string; tempDir?: string; tools: string[]; maxTurns: number }> => {
  if (!request.imageBase64 || !request.imageType) {
    return {
      prompt: request.userPrompt,
      tools: [],
      maxTurns: 4,
    };
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'pic2code-claude-'));
  const extension = request.imageType.split('/')[1] || 'png';
  const filePath = join(tempDir, `input.${extension}`);
  await writeFile(filePath, Buffer.from(request.imageBase64, 'base64'));

  return {
    prompt: [
      `First, use the Read tool to inspect the image at "${filePath}".`,
      'Then complete the task below based on that image.',
      '',
      request.userPrompt,
    ].join('\n'),
    tempDir,
    tools: ['Read'],
    maxTurns: 8,
  };
};

const buildOptions = (
  request: AIProviderRequest,
  runtime: AIRuntimeContext | undefined,
  tools: string[],
  maxTurns: number,
) => ({
  cwd: process.cwd(),
  maxTurns,
  tools,
  allowedTools: tools,
  disallowedTools: ['Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'Bash'],
  permissionMode: tools.length > 0 ? 'dontAsk' as const : 'default' as const,
  persistSession: false,
  includePartialMessages: false,
  systemPrompt: request.systemInstruction,
  ...(request.model && request.model !== 'default' ? { model: request.model } : {}),
  env: {
    ...process.env,
    CLAUDE_AGENT_SDK_CLIENT_APP: 'pic2code/web-gateway',
    ...(runtime?.referer ? { PIC2CODE_ORIGIN: runtime.referer } : {}),
  },
});

const readResultError = (message: unknown): string | null => {
  const parsed = message as {
    type?: string;
    subtype?: string;
    errors?: string[];
  };

  if (parsed.type !== 'result' || parsed.subtype === 'success') {
    return null;
  }

  if (Array.isArray(parsed.errors) && parsed.errors.length > 0) {
    return parsed.errors.join('\n');
  }

  if (parsed.subtype === 'error_max_turns') {
    return 'Claude Code SDK request hit the max turn limit before finishing. Consider increasing maxTurns for this workflow.';
  }

  return `Claude Code SDK request failed: ${parsed.subtype || 'unknown_error'}`;
};

export const listClaudeAgentModels = async (): Promise<ClaudeModelOption[]> => {
  const q = query({
    prompt: '',
    options: {
      cwd: process.cwd(),
      maxTurns: 1,
      tools: [],
      permissionMode: 'plan',
      persistSession: false,
      env: {
        ...process.env,
        CLAUDE_AGENT_SDK_CLIENT_APP: 'pic2code/model-list',
      },
    },
  });

  try {
    const models = await q.supportedModels();
    return models.map((model) => ({
      id: model.value,
      name: model.displayName,
      provider: 'claude-agent',
      description: model.description,
    }));
  } finally {
    q.close();
  }
};

export const executeClaudeAgentRequest = async (
  request: AIProviderRequest,
  runtime?: AIRuntimeContext,
): Promise<string> => {
  const startedAt = Date.now();
  const imageContext = await createImageContext(request);
  const q = query({
    prompt: imageContext.prompt,
    options: buildOptions(request, runtime, imageContext.tools, imageContext.maxTurns),
  });

  let assistantText = '';
  let resultText = '';
  let assistantTextLength = 0;
  let resultTextLength = 0;

  await writeAiGatewayLog({
    level: 'info',
    event: 'claude_query_start',
    requestId: runtime?.requestId,
    provider: request.provider,
    model: request.model,
    details: {
      hasImage: !!request.imageBase64,
      maxTurns: imageContext.maxTurns,
      toolCount: imageContext.tools.length,
    },
  });

  try {
    for await (const message of q) {
      const errorText = readResultError(message);
      if (errorText) {
        await writeAiGatewayLog({
          level: 'error',
          event: 'claude_query_error',
          requestId: runtime?.requestId,
          provider: request.provider,
          model: request.model,
          durationMs: Date.now() - startedAt,
          message: errorText,
        });
        throw new Error(errorText);
      }

      const text = extractAssistantText(message);
      if (text) {
        assistantText = text;
        assistantTextLength = text.length;
      }

      const finalResultText = extractResultText(message);
      if (finalResultText) {
        resultText = finalResultText;
        resultTextLength = finalResultText.length;
      }
    }

    const finalText = assistantText.trim() ? assistantText : resultText;

    if (!finalText.trim()) {
      await writeAiGatewayLog({
        level: 'error',
        event: 'claude_query_empty',
        requestId: runtime?.requestId,
        provider: request.provider,
        model: request.model,
        durationMs: Date.now() - startedAt,
        details: {
          assistantTextLength,
          resultTextLength,
        },
      });
      throw new Error('Claude Code SDK returned no content.');
    }

    await writeAiGatewayLog({
      level: 'info',
      event: 'claude_query_complete',
      requestId: runtime?.requestId,
      provider: request.provider,
      model: request.model,
      durationMs: Date.now() - startedAt,
      outputLength: finalText.length,
      details: {
        textSource: assistantText.trim() ? 'assistant' : 'result',
        assistantTextLength,
        resultTextLength,
      },
    });

    return finalText;
  } finally {
    q.close();
    if (imageContext.tempDir) {
      await rm(imageContext.tempDir, { recursive: true, force: true });
    }
  }
};

export const streamClaudeAgentRequest = async function* (
  request: AIProviderRequest,
  runtime?: AIRuntimeContext,
): AsyncGenerator<AIStreamChunk> {
  const startedAt = Date.now();
  const imageContext = await createImageContext(request);
  const q = query({
    prompt: imageContext.prompt,
    options: buildOptions(request, runtime, imageContext.tools, imageContext.maxTurns),
  });

  let hasEmittedText = false;
  let emittedLength = 0;

  await writeAiGatewayLog({
    level: 'info',
    event: 'claude_stream_start',
    requestId: runtime?.requestId,
    provider: request.provider,
    model: request.model,
    details: {
      hasImage: !!request.imageBase64,
      maxTurns: imageContext.maxTurns,
      toolCount: imageContext.tools.length,
    },
  });

  try {
    for await (const message of q) {
      const errorText = readResultError(message);
      if (errorText) {
        await writeAiGatewayLog({
          level: 'error',
          event: 'claude_stream_error',
          requestId: runtime?.requestId,
          provider: request.provider,
          model: request.model,
          durationMs: Date.now() - startedAt,
          message: errorText,
        });
        throw new Error(errorText);
      }

      const text = extractAssistantText(message);
      if (text) {
        hasEmittedText = true;
        emittedLength += text.length;
        yield { type: 'text', content: text };
      }

      const resultText = extractResultText(message);
      if (resultText && !hasEmittedText) {
        hasEmittedText = true;
        emittedLength += resultText.length;
        yield { type: 'text', content: resultText };
      }
    }

    await writeAiGatewayLog({
      level: 'info',
      event: 'claude_stream_complete',
      requestId: runtime?.requestId,
      provider: request.provider,
      model: request.model,
      durationMs: Date.now() - startedAt,
      outputLength: emittedLength,
      details: {
        emittedText: hasEmittedText,
      },
    });

    yield { type: 'done', content: '' };
  } finally {
    q.close();
    if (imageContext.tempDir) {
      await rm(imageContext.tempDir, { recursive: true, force: true });
    }
  }
};
