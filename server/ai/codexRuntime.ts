import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { AIProviderRequest, AIRuntimeContext } from '../../services/ai/types';
import { writeAiGatewayLog } from './logger';

interface CodexModelOption {
  id: string;
  name: string;
  provider: 'codex-cli';
  description?: string;
}

interface CodexExecOptions {
  model?: string;
  timeoutMs?: number;
  imageFiles?: string[];
}

interface ParsedCodexJsonLine {
  text?: string;
  error?: string;
  event?: Record<string, unknown>;
}

const DEFAULT_CODEX_TIMEOUT_MS = 15 * 60 * 1000;
const HEARTBEAT_INTERVAL_MS = 15 * 1000;
const CODEX_ENV_ALLOWLIST = new Set([
  'PATH', 'HOME', 'TERM', 'LANG', 'SHELL', 'TMPDIR',
  'SYSTEMROOT', 'COMSPEC', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA',
  'PATHEXT', 'SYSTEMDRIVE', 'TEMP', 'TMP', 'HOMEDRIVE', 'HOMEPATH',
]);

const filterCodexEnv = (
  env: Record<string, string | undefined>,
): Record<string, string | undefined> => {
  const result: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    if (CODEX_ENV_ALLOWLIST.has(key) || key.startsWith('OPENAI_') || key.startsWith('CODEX_')) {
      result[key] = value;
    }
  }
  return result;
};

const buildPrompt = (systemPrompt: string | undefined, userPrompt: string): string => {
  if (!systemPrompt?.trim()) {
    return userPrompt.trim();
  }

  return [
    'SYSTEM INSTRUCTIONS:',
    systemPrompt.trim(),
    '',
    'USER REQUEST:',
    userPrompt.trim(),
  ].join('\n');
};

const buildCodexExecArgs = (
  outputPath: string,
  options: CodexExecOptions = {},
): string[] => {
  const args = [
    'exec',
    '--json',
    '--skip-git-repo-check',
    '--sandbox',
    'read-only',
    '--output-last-message',
    outputPath,
  ];

  if (options.model) {
    args.push('--model', options.model);
  }

  for (const imageFile of options.imageFiles ?? []) {
    args.push('--image', imageFile);
  }

  args.push('-');
  return args;
};

const parseCodexJsonLine = (line: string): ParsedCodexJsonLine | null => {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(line) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (parsed.type === 'error') {
    return {
      error: typeof parsed.message === 'string' ? parsed.message : 'Codex 返回了未知错误。',
      event: parsed,
    };
  }

  const text = [parsed.delta, parsed.text, parsed.content]
    .find((item) => typeof item === 'string' && item.length > 0);

  return {
    text: typeof text === 'string' ? text : undefined,
    event: parsed,
  };
};

const extractCodexCliError = (stderr: string): string | null => {
  const trimmed = stderr.trim();
  if (!trimmed) {
    return null;
  }

  const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean);
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line.toLowerCase().startsWith('error:')) {
      return line.replace(/^error:\s*/i, '').trim();
    }
  }

  return lines[lines.length - 1] ?? null;
};

const executeCodexCommand = async (
  args: string[],
  prompt: string,
  timeoutMs: number,
  onEvent?: (event: Record<string, unknown>) => void | Promise<void>,
): Promise<{ text: string; errors: string[] }> => {
  return await new Promise((resolve, reject) => {
    const child = spawn('codex', args, {
      env: filterCodexEnv(process.env as Record<string, string | undefined>),
      stdio: ['pipe', 'pipe', 'pipe'],
      ...(process.platform === 'win32' ? { shell: true } : {}),
    });

    let stdoutBuffer = '';
    let stderrBuffer = '';
    let textAccumulator = '';
    const errors: string[] = [];

    const emitEvent = (event: Record<string, unknown>) => {
      if (!onEvent) {
        return;
      }

      void Promise.resolve(onEvent(event)).catch(() => {
        // 日志回调失败时忽略，避免影响主流程
      });
    };

    const flushStdoutLine = (line: string) => {
      const parsed = parseCodexJsonLine(line);
      if (!parsed) {
        return;
      }

      if (parsed.event) {
        emitEvent(parsed.event);
      }

      if (parsed.text) {
        textAccumulator += parsed.text;
        emitEvent({
          type: 'stream.text',
          text: parsed.text,
          chunkLength: parsed.text.length,
        });
      }

      if (parsed.error) {
        errors.push(parsed.error);
      }
    };

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Codex 请求超过 ${Math.round(timeoutMs / 1000)} 秒仍未完成。`));
    }, timeoutMs);

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString('utf-8');
      let index = stdoutBuffer.indexOf('\n');
      while (index >= 0) {
        const line = stdoutBuffer.slice(0, index).trim();
        stdoutBuffer = stdoutBuffer.slice(index + 1);
        if (line) {
          flushStdoutLine(line);
        }
        index = stdoutBuffer.indexOf('\n');
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderrBuffer += chunk.toString('utf-8');
    });

    child.stdin.on('error', () => {
      // 子进程提前退出时忽略 stdin 写入错误
    });

    child.on('error', (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.stdin.end(`${prompt.trim() || 'Please help with the request.'}\n`);

    child.on('close', (code) => {
      clearTimeout(timer);

      const tail = stdoutBuffer.trim();
      if (tail) {
        flushStdoutLine(tail);
      }

      if (code === 0) {
        resolve({ text: textAccumulator, errors });
        return;
      }

      reject(new Error(
        extractCodexCliError(stderrBuffer)
          || errors[errors.length - 1]
          || `Codex 进程异常退出，退出码 ${code ?? 'unknown'}。`,
      ));
    });
  });
};

const createImageFiles = async (
  request: AIProviderRequest,
): Promise<{ tempDir?: string; imageFiles: string[] }> => {
  if (!request.imageBase64 || !request.imageType) {
    return { imageFiles: [] };
  }

  const tempDir = await mkdtemp(join(tmpdir(), 'pic2code-codex-'));
  const extension = request.imageType.split('/')[1] || 'png';
  const filePath = join(tempDir, `input.${extension}`);
  await writeFile(filePath, Buffer.from(request.imageBase64, 'base64'));

  return {
    tempDir,
    imageFiles: [filePath],
  };
};

export const listCodexModels = async (): Promise<CodexModelOption[]> => {
  const cachePath = join(homedir(), '.codex', 'models_cache.json');

  try {
    const raw = await readFile(cachePath, 'utf-8');
    const cache = JSON.parse(raw) as {
      models?: Array<{
        slug: string;
        display_name: string;
        description?: string;
        visibility?: string;
        priority?: number;
      }>;
    };

    return (cache.models || [])
      .filter((model) => model.visibility === 'list')
      .sort((a, b) => (a.priority ?? 999) - (b.priority ?? 999))
      .map((model) => ({
        id: model.slug,
        name: model.display_name,
        provider: 'codex-cli',
        description: model.description,
      }));
  } catch {
    return [
      { id: 'gpt-5.3-codex', name: 'gpt-5.3-codex', provider: 'codex-cli' },
      { id: 'gpt-5.4', name: 'gpt-5.4', provider: 'codex-cli' },
    ];
  }
};

const logCodexPhase = async (
  request: AIProviderRequest,
  runtime: AIRuntimeContext | undefined,
  message: string,
  details: Record<string, string | number | boolean | null | undefined>,
) => {
  await writeAiGatewayLog({
    level: 'info',
    event: 'codex_phase',
    requestId: runtime?.requestId,
    provider: request.provider,
    model: request.model,
    message,
    details,
  });
};

export const executeCodexRequest = async (
  request: AIProviderRequest,
  runtime?: AIRuntimeContext,
): Promise<string> => {
  const startedAt = Date.now();
  let lastObservedPhase = 'prepare';
  let hasSeenGenerationOutput = false;

  await logCodexPhase(request, runtime, '开始准备 Codex 请求', {
    phase: 'prepare',
    hasImage: !!request.imageBase64,
  });

  const { tempDir, imageFiles } = await createImageFiles(request);

  await logCodexPhase(
    request,
    runtime,
    imageFiles.length > 0 ? '已准备图片输入文件' : '本次请求没有图片输入',
    {
      phase: 'prepare_input',
      imageCount: imageFiles.length,
    },
  );

  const workDir = await mkdtemp(join(tmpdir(), 'pic2code-codex-run-'));
  const outputPath = join(workDir, 'last-message.txt');
  const prompt = buildPrompt(request.systemInstruction, request.userPrompt);

  await logCodexPhase(request, runtime, '已构建完整提示词', {
    phase: 'build_prompt',
    promptLength: prompt.length,
    systemPrompt: request.systemInstruction,
    userPrompt: request.userPrompt,
    fullPrompt: prompt,
  });

  const args = buildCodexExecArgs(outputPath, {
    model: request.model,
    timeoutMs: DEFAULT_CODEX_TIMEOUT_MS,
    imageFiles,
  });

  await writeAiGatewayLog({
    level: 'info',
    event: 'codex_query_start',
    requestId: runtime?.requestId,
    provider: request.provider,
    model: request.model,
    details: {
      hasImage: imageFiles.length > 0,
      imageCount: imageFiles.length,
    },
  });

  await logCodexPhase(request, runtime, 'Codex CLI 进程已启动', {
    phase: 'launch_cli',
    argCount: args.length,
  });
  lastObservedPhase = 'launch_cli';

  const heartbeat = setInterval(() => {
    const elapsedSeconds = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
    const phase = hasSeenGenerationOutput
      ? 'generation'
      : (
        lastObservedPhase === 'prepare_input'
        || lastObservedPhase === 'build_prompt'
        || lastObservedPhase === 'launch_cli'
          ? 'reasoning'
          : lastObservedPhase
      );

    const message = hasSeenGenerationOutput
      ? 'Codex 仍在生成和整理页面代码'
      : 'Codex 仍在分析截图结构和页面布局';

    void logCodexPhase(request, runtime, message, {
      phase,
      elapsedSeconds,
      heartbeat: true,
    });
  }, HEARTBEAT_INTERVAL_MS);

  try {
    const result = await executeCodexCommand(
      args,
      prompt,
      DEFAULT_CODEX_TIMEOUT_MS,
      async (event) => {
        const type = typeof event.type === 'string' ? event.type : 'unknown';
        let message = type;
        let phase = 'tooling';
        let details: Record<string, string | number | boolean | null | undefined> = {};

        if (type === 'thread.started') {
          message = 'Codex 会话已创建';
          phase = 'session';
          lastObservedPhase = phase;
          details = {
            threadId: typeof event.thread_id === 'string' ? event.thread_id : undefined,
          };
        } else if (type === 'turn.started') {
          message = 'Codex 开始推理';
          phase = 'reasoning';
          lastObservedPhase = phase;
        } else if (type === 'stream.text') {
          const text = typeof event.text === 'string' ? event.text : '';
          message = 'Codex 正在流式输出响应';
          phase = 'generation';
          lastObservedPhase = phase;
          hasSeenGenerationOutput = hasSeenGenerationOutput || text.length > 0;
          details = {
            text,
            chunkLength: typeof event.chunkLength === 'number' ? event.chunkLength : text.length,
          };
        } else if (type === 'item.completed') {
          const item = event.item as Record<string, unknown> | undefined;
          const itemType = typeof item?.type === 'string' ? item.type : 'unknown';

          if (itemType === 'agent_message') {
            const text = typeof item?.text === 'string' ? item.text : '';
            message = 'Codex 产出一段结果';
            phase = 'generation';
            lastObservedPhase = phase;
            hasSeenGenerationOutput = hasSeenGenerationOutput || text.length > 0;
            details = {
              itemType,
              textLength: text.length,
              text,
              preview: text.slice(0, 200),
            };
          } else {
            message = 'Codex 完成一个内部步骤';
            phase = 'tooling';
            lastObservedPhase = phase;
            details = {
              itemType,
            };
          }
        } else if (type === 'turn.completed') {
          const usage = event.usage as Record<string, unknown> | undefined;
          message = 'Codex 完成本轮处理';
          phase = 'finalize';
          lastObservedPhase = phase;
          details = {
            inputTokens: typeof usage?.input_tokens === 'number' ? usage.input_tokens : undefined,
            cachedInputTokens: typeof usage?.cached_input_tokens === 'number' ? usage.cached_input_tokens : undefined,
            outputTokens: typeof usage?.output_tokens === 'number' ? usage.output_tokens : undefined,
          };
        }

        await writeAiGatewayLog({
          level: 'info',
          event: type === 'stream.text' ? 'codex_stream_text' : 'codex_cli_event',
          requestId: runtime?.requestId,
          provider: request.provider,
          model: request.model,
          message,
          details: {
            eventType: type,
            phase,
            ...details,
          },
        });
      },
    );

    await logCodexPhase(request, runtime, '开始读取 Codex 最终输出文件', {
      phase: 'read_output',
    });
    lastObservedPhase = 'read_output';

    const finalText = await readFile(outputPath, 'utf-8').catch(() => '');
    const normalizedText = finalText.trim() || result.text.trim();

    if (!normalizedText) {
      throw new Error(result.errors[0] || 'Codex 没有返回任何内容。');
    }

    await logCodexPhase(request, runtime, 'Codex 最终输出已整理完成', {
      phase: 'normalize_output',
      finalLength: normalizedText.length,
    });
    lastObservedPhase = 'normalize_output';

    await writeAiGatewayLog({
      level: 'info',
      event: 'codex_query_complete',
      requestId: runtime?.requestId,
      provider: request.provider,
      model: request.model,
      durationMs: Date.now() - startedAt,
      outputLength: normalizedText.length,
    });

    return normalizedText;
  } catch (error) {
    await writeAiGatewayLog({
      level: 'error',
      event: 'codex_query_error',
      requestId: runtime?.requestId,
      provider: request.provider,
      model: request.model,
      durationMs: Date.now() - startedAt,
      message: error instanceof Error ? error.message : 'Codex 执行失败。',
    });
    throw error;
  } finally {
    clearInterval(heartbeat);
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    }
  }
};
