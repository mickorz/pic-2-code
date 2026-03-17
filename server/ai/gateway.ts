import {
  EXPLAIN_SYSTEM_INSTRUCTION,
  FLUTTER_CONVERSION_SYSTEM_INSTRUCTION,
  REACT_CONVERSION_SYSTEM_INSTRUCTION,
  REACT_NATIVE_CLI_SYSTEM_INSTRUCTION,
  REACT_NATIVE_EXPO_SYSTEM_INSTRUCTION,
  REFINE_SYSTEM_INSTRUCTION,
  SYSTEM_INSTRUCTION,
} from '../../constants';
import { AppSettings } from '../../types';
import {
  convertHtmlToFlutterWithRuntime,
  convertHtmlToReactNativeWithRuntime,
  convertHtmlToReactWithRuntime,
  explainCodeWithRuntime,
  generateCodeWithRuntime,
  refineCodeWithRuntime,
  streamGenerateCodeWithRuntime,
  streamRefineCodeWithRuntime,
} from '../../services/ai/service';
import {
  AIGatewayRequest,
  AIGatewayResponse,
  AIRuntimeContext,
  AIProviderRequest,
  AIStreamChunk,
} from '../../services/ai/types';
import {
  executeClaudeAgentRequest,
  listClaudeAgentModels,
} from './claudeAgentRuntime';
import {
  executeCodexRequest,
  listCodexModels,
} from './codexRuntime';

const createHttpError = (message: string, status = 400): Error & { status: number } => {
  const error = new Error(message) as Error & { status: number };
  error.status = status;
  return error;
};

const ensureSettings = (settings?: AppSettings): AppSettings | undefined => settings;

const buildClaudeProviderRequest = (
  request: AIGatewayRequest,
  settings?: AppSettings,
): AIProviderRequest => {
  const provider = 'claude-agent';
  const model = settings?.model || 'default';
  const temperature = settings?.temperature ?? 0.1;

  switch (request.operation) {
    case 'generate': {
      const userPrompt = request.userPrompt || '';
      const isCreative = settings?.quality === 'creative';
      const creativePrompt = isCreative
        ? ' The input is a reference. Feel free to enhance the visual design with modern shadows, gradients, better typography, and spacing while keeping the core layout structure. Make it look professional and polished.'
        : ' Strictly follow the provided reference. Do not improvise. The goal is precise replication.';
      const finalUserPrompt = `
        ${userPrompt ? `User Requirements: ${userPrompt}` : ''}
        ${creativePrompt}
        ${request.base64Image ? 'Analyze the image and generate the HTML code.' : `Create a complete, single-file HTML/Tailwind/JS web page based on this description: "${userPrompt}". Ensure it is visually stunning, responsive, and functional.`}
      `;

      return {
        provider,
        model,
        systemInstruction: SYSTEM_INSTRUCTION,
        userPrompt: finalUserPrompt,
        temperature,
        imageBase64: request.base64Image || null,
        imageType: request.mimeType || null,
      };
    }
    case 'refine': {
      if (!request.currentCode) {
        throw createHttpError('Missing currentCode.');
      }
      if (!request.userInstruction) {
        throw createHttpError('Missing userInstruction.');
      }

      return {
        provider,
        model,
        systemInstruction: REFINE_SYSTEM_INSTRUCTION,
        userPrompt: `
          Current Code:
          \`\`\`html
          ${request.currentCode}
          \`\`\`

          User Instruction: ${request.userInstruction}
        `,
        temperature: 0.1,
      };
    }
    case 'convert-react': {
      if (!request.htmlCode) {
        throw createHttpError('Missing htmlCode.');
      }

      return {
        provider,
        model,
        systemInstruction: REACT_CONVERSION_SYSTEM_INSTRUCTION,
        userPrompt: `
          Convert this HTML code to React:
          \`\`\`html
          ${request.htmlCode}
          \`\`\`
        `,
        temperature: 0.1,
      };
    }
    case 'convert-flutter': {
      if (!request.htmlCode) {
        throw createHttpError('Missing htmlCode.');
      }

      return {
        provider,
        model,
        systemInstruction: FLUTTER_CONVERSION_SYSTEM_INSTRUCTION,
        userPrompt: `
          Convert this HTML code to Flutter (Dart):
          \`\`\`html
          ${request.htmlCode}
          \`\`\`
        `,
        temperature: 0.1,
      };
    }
    case 'convert-react-native': {
      if (!request.htmlCode) {
        throw createHttpError('Missing htmlCode.');
      }

      const platform = request.platform || 'expo';
      const systemInstruction = platform === 'expo'
        ? REACT_NATIVE_EXPO_SYSTEM_INSTRUCTION
        : REACT_NATIVE_CLI_SYSTEM_INSTRUCTION;
      const platformName = platform === 'expo' ? 'React Native (Expo)' : 'React Native (CLI)';

      return {
        provider,
        model,
        systemInstruction,
        userPrompt: `
          Convert this HTML code to ${platformName}:
          \`\`\`html
          ${request.htmlCode}
          \`\`\`
        `,
        temperature: 0.1,
      };
    }
    case 'explain': {
      if (!request.htmlCode) {
        throw createHttpError('Missing htmlCode.');
      }

      return {
        provider,
        model,
        systemInstruction: EXPLAIN_SYSTEM_INSTRUCTION,
        userPrompt: `Explain this code:\n\`\`\`html\n${request.htmlCode.substring(0, 15000)}\n\`\`\``,
        temperature: 0.2,
      };
    }
    default:
      throw createHttpError('Unsupported Claude Code SDK operation.', 404);
  }
};

const buildCodexProviderRequest = (
  request: AIGatewayRequest,
  settings?: AppSettings,
): AIProviderRequest => {
  const provider = 'codex-cli';
  const model = settings?.model || 'gpt-5.3-codex';
  const temperature = settings?.temperature ?? 0.1;

  switch (request.operation) {
    case 'generate': {
      const userPrompt = request.userPrompt || '';
      const isCreative = settings?.quality === 'creative';
      const creativePrompt = isCreative
        ? ' The input is a reference. Feel free to enhance the visual design with modern shadows, gradients, better typography, and spacing while keeping the core layout structure. Make it look professional and polished.'
        : ' Strictly follow the provided reference. Do not improvise. The goal is precise replication.';
      const finalUserPrompt = `
        ${userPrompt ? `User Requirements: ${userPrompt}` : ''}
        ${creativePrompt}
        ${request.base64Image ? 'Analyze the image and generate the HTML code.' : `Create a complete, single-file HTML/Tailwind/JS web page based on this description: "${userPrompt}". Ensure it is visually stunning, responsive, and functional.`}
      `;

      return {
        provider,
        model,
        systemInstruction: SYSTEM_INSTRUCTION,
        userPrompt: finalUserPrompt,
        temperature,
        imageBase64: request.base64Image || null,
        imageType: request.mimeType || null,
      };
    }
    case 'refine': {
      if (!request.currentCode) {
        throw createHttpError('Missing currentCode.');
      }
      if (!request.userInstruction) {
        throw createHttpError('Missing userInstruction.');
      }

      return {
        provider,
        model,
        systemInstruction: REFINE_SYSTEM_INSTRUCTION,
        userPrompt: `
          Current Code:
          \`\`\`html
          ${request.currentCode}
          \`\`\`

          User Instruction: ${request.userInstruction}
        `,
        temperature: 0.1,
      };
    }
    case 'convert-react': {
      if (!request.htmlCode) {
        throw createHttpError('Missing htmlCode.');
      }

      return {
        provider,
        model,
        systemInstruction: REACT_CONVERSION_SYSTEM_INSTRUCTION,
        userPrompt: `
          Convert this HTML code to React:
          \`\`\`html
          ${request.htmlCode}
          \`\`\`
        `,
        temperature: 0.1,
      };
    }
    case 'convert-flutter': {
      if (!request.htmlCode) {
        throw createHttpError('Missing htmlCode.');
      }

      return {
        provider,
        model,
        systemInstruction: FLUTTER_CONVERSION_SYSTEM_INSTRUCTION,
        userPrompt: `
          Convert this HTML code to Flutter (Dart):
          \`\`\`html
          ${request.htmlCode}
          \`\`\`
        `,
        temperature: 0.1,
      };
    }
    case 'convert-react-native': {
      if (!request.htmlCode) {
        throw createHttpError('Missing htmlCode.');
      }

      const platform = request.platform || 'expo';
      const systemInstruction = platform === 'expo'
        ? REACT_NATIVE_EXPO_SYSTEM_INSTRUCTION
        : REACT_NATIVE_CLI_SYSTEM_INSTRUCTION;
      const platformName = platform === 'expo' ? 'React Native (Expo)' : 'React Native (CLI)';

      return {
        provider,
        model,
        systemInstruction,
        userPrompt: `
          Convert this HTML code to ${platformName}:
          \`\`\`html
          ${request.htmlCode}
          \`\`\`
        `,
        temperature: 0.1,
      };
    }
    case 'explain': {
      if (!request.htmlCode) {
        throw createHttpError('Missing htmlCode.');
      }

      return {
        provider,
        model,
        systemInstruction: EXPLAIN_SYSTEM_INSTRUCTION,
        userPrompt: `Explain this code:\n\`\`\`html\n${request.htmlCode.substring(0, 15000)}\n\`\`\``,
        temperature: 0.2,
      };
    }
    default:
      throw createHttpError('Unsupported Codex CLI operation.', 404);
  }
};

export const getProviderModels = async (provider?: AppSettings['provider']) => {
  if (provider === 'claude-agent') {
    return listClaudeAgentModels();
  }

  if (provider === 'codex-cli') {
    return listCodexModels();
  }

  return [];
};

export const handleAiGatewayRequest = async (
  request: AIGatewayRequest,
  runtime: AIRuntimeContext,
): Promise<AIGatewayResponse> => {
  const settings = ensureSettings(request.settings);
  const provider = settings?.provider || 'gemini';

  if (provider === 'claude-agent') {
    const claudeRequest = buildClaudeProviderRequest(request, settings);

    if (request.operation === 'explain') {
      const text = await executeClaudeAgentRequest(claudeRequest, runtime);
      const cleanedText = text
        .replace(/^```json/, '')
        .replace(/^```/, '')
        .replace(/```$/, '')
        .trim();

      return {
        ok: true,
        explanation: JSON.parse(cleanedText),
      };
    }

    return {
      ok: true,
      text: await executeClaudeAgentRequest(claudeRequest, runtime),
    };
  }

  if (provider === 'codex-cli') {
    const codexRequest = buildCodexProviderRequest(request, settings);

    if (request.operation === 'explain') {
      const text = await executeCodexRequest(codexRequest, runtime);
      const cleanedText = text
        .replace(/^```json/, '')
        .replace(/^```/, '')
        .replace(/```$/, '')
        .trim();

      return {
        ok: true,
        explanation: JSON.parse(cleanedText),
      };
    }

    return {
      ok: true,
      text: await executeCodexRequest(codexRequest, runtime),
    };
  }

  switch (request.operation) {
    case 'generate':
      return {
        ok: true,
        text: await generateCodeWithRuntime(
          request.base64Image || null,
          request.mimeType || null,
          request.userPrompt || '',
          settings,
          undefined,
          runtime,
        ),
      };
    case 'refine':
      if (!request.currentCode) {
        throw createHttpError('Missing currentCode.');
      }
      if (!request.userInstruction) {
        throw createHttpError('Missing userInstruction.');
      }
      return {
        ok: true,
        text: await refineCodeWithRuntime(
          request.currentCode,
          request.userInstruction,
          settings,
          undefined,
          runtime,
        ),
      };
    case 'convert-react':
      if (!request.htmlCode) {
        throw createHttpError('Missing htmlCode.');
      }
      return {
        ok: true,
        text: await convertHtmlToReactWithRuntime(
          request.htmlCode,
          settings,
          undefined,
          runtime,
        ),
      };
    case 'convert-flutter':
      if (!request.htmlCode) {
        throw createHttpError('Missing htmlCode.');
      }
      return {
        ok: true,
        text: await convertHtmlToFlutterWithRuntime(
          request.htmlCode,
          settings,
          undefined,
          runtime,
        ),
      };
    case 'convert-react-native':
      if (!request.htmlCode) {
        throw createHttpError('Missing htmlCode.');
      }
      return {
        ok: true,
        text: await convertHtmlToReactNativeWithRuntime(
          request.htmlCode,
          settings,
          undefined,
          request.platform || 'expo',
          runtime,
        ),
      };
    case 'explain':
      if (!request.htmlCode) {
        throw createHttpError('Missing htmlCode.');
      }
      return {
        ok: true,
        explanation: await explainCodeWithRuntime(
          request.htmlCode,
          settings,
          undefined,
          runtime,
        ),
      };
    default:
      throw createHttpError('Unsupported AI operation.', 404);
  }
};

export const handleAiGatewayStreamRequest = (
  request: AIGatewayRequest,
  runtime: AIRuntimeContext,
  signal?: AbortSignal,
): AsyncGenerator<AIStreamChunk> => {
  const settings = ensureSettings(request.settings);
  const provider = settings?.provider || 'gemini';

  if (provider === 'claude-agent') {
    const claudeRequest = buildClaudeProviderRequest(request, settings);

    switch (request.operation) {
      case 'generate':
      case 'refine':
        return (async function* () {
          const text = await executeClaudeAgentRequest(claudeRequest, runtime);
          yield { type: 'text', content: text };
          yield { type: 'done', content: '' };
        })();
      default:
        throw createHttpError('This streaming endpoint only supports generate and refine for Claude Code SDK.', 404);
    }
  }

  if (provider === 'codex-cli') {
    const codexRequest = buildCodexProviderRequest(request, settings);

    switch (request.operation) {
      case 'generate':
      case 'refine':
        return (async function* () {
          const text = await executeCodexRequest(codexRequest, runtime);
          yield { type: 'text', content: text };
          yield { type: 'done', content: '' };
        })();
      default:
        throw createHttpError('This streaming endpoint only supports generate and refine for Codex CLI.', 404);
    }
  }

  switch (request.operation) {
    case 'generate':
      return streamGenerateCodeWithRuntime(
        request.base64Image || null,
        request.mimeType || null,
        request.userPrompt || '',
        settings,
        signal,
        runtime,
      );
    case 'refine':
      if (!request.currentCode) {
        throw createHttpError('Missing currentCode.');
      }
      if (!request.userInstruction) {
        throw createHttpError('Missing userInstruction.');
      }
      return streamRefineCodeWithRuntime(
        request.currentCode,
        request.userInstruction,
        settings,
        signal,
        runtime,
      );
    default:
      throw createHttpError('This streaming endpoint only supports generate and refine.', 404);
  }
};
