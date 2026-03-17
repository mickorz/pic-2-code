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
import { executeProviderRequest, executeProviderRequestStream } from './providerRuntime';
import { AIRuntimeContext, AIProviderRequest, AIStreamChunk, CodeExplanation } from './types';

const DEFAULT_MODEL_BY_PROVIDER: Record<AppSettings['provider'], string> = {
  gemini: 'gemini-3-pro-preview',
  openrouter: 'google/gemini-2.0-flash-exp:free',
  'claude-agent': 'default',
  'codex-cli': 'gpt-5.3-codex',
};

const createBrowserRuntime = (): AIRuntimeContext => ({
  defaultGeminiApiKey: typeof process !== 'undefined' ? process.env.API_KEY : undefined,
  referer: typeof window !== 'undefined' ? window.location.origin : undefined,
  title: 'Pic2Code',
});

const resolveExecutionSettings = (settings?: AppSettings) => {
  const provider = settings?.provider || 'gemini';
  return {
    provider,
    model: settings?.model || DEFAULT_MODEL_BY_PROVIDER[provider],
    temperature: settings?.temperature ?? 0.1,
    geminiApiKey: settings?.customApiKey,
    openRouterApiKey: settings?.openRouterApiKey,
  };
};

const getRuntime = (runtime?: AIRuntimeContext): AIRuntimeContext => {
  if (runtime) return runtime;
  return createBrowserRuntime();
};

const assertDirectProviderSupported = (provider: AppSettings['provider']): void => {
  if (provider === 'claude-agent' || provider === 'codex-cli') {
    throw new Error(`${provider} provider requires the local AI gateway and cannot run in browser direct mode.`);
  }
};

const parseExplanationJson = (text: string): CodeExplanation => {
  const cleanedText = text
    .replace(/^```json/, '')
    .replace(/^```/, '')
    .replace(/```$/, '')
    .trim();

  return JSON.parse(cleanedText) as CodeExplanation;
};

const buildGenerateRequest = (
  base64Image: string | null,
  mimeType: string | null,
  userPrompt = '',
  settings?: AppSettings,
  signal?: AbortSignal,
): AIProviderRequest => {
  const resolved = resolveExecutionSettings(settings);
  const isCreative = settings?.quality === 'creative';
  const creativePrompt = isCreative
    ? ' The input is a reference. Feel free to enhance the visual design with modern shadows, gradients, better typography, and spacing while keeping the core layout structure. Make it look professional and polished.'
    : ' Strictly follow the provided reference. Do not improvise. The goal is precise replication.';

  const finalUserPrompt = `
    ${userPrompt ? `User Requirements: ${userPrompt}` : ''}
    ${creativePrompt}
    ${base64Image ? 'Analyze the image and generate the HTML code.' : `Create a complete, single-file HTML/Tailwind/JS web page based on this description: "${userPrompt}". Ensure it is visually stunning, responsive, and functional.`}
  `;

  return {
    provider: resolved.provider,
    model: resolved.model,
    systemInstruction: SYSTEM_INSTRUCTION,
    userPrompt: finalUserPrompt,
    temperature: resolved.temperature,
    imageBase64: base64Image,
    imageType: mimeType,
    geminiApiKey: resolved.geminiApiKey,
    openRouterApiKey: resolved.openRouterApiKey,
    signal,
  };
};

const buildRefineRequest = (
  currentCode: string,
  userInstruction: string,
  settings?: AppSettings,
  signal?: AbortSignal,
): AIProviderRequest => {
  const resolved = resolveExecutionSettings(settings);
  const prompt = `
    Current Code:
    \`\`\`html
    ${currentCode}
    \`\`\`

    User Instruction: ${userInstruction}
  `;

  return {
    provider: resolved.provider,
    model: resolved.model,
    systemInstruction: REFINE_SYSTEM_INSTRUCTION,
    userPrompt: prompt,
    temperature: 0.1,
    geminiApiKey: resolved.geminiApiKey,
    openRouterApiKey: resolved.openRouterApiKey,
    signal,
  };
};

export const generateCodeWithRuntime = async (
  base64Image: string | null,
  mimeType: string | null,
  userPrompt = '',
  settings?: AppSettings,
  signal?: AbortSignal,
  runtime?: AIRuntimeContext,
): Promise<string> => {
  assertDirectProviderSupported(settings?.provider || 'gemini');
  return executeProviderRequest(
    buildGenerateRequest(base64Image, mimeType, userPrompt, settings, signal),
    getRuntime(runtime),
  );
};

export const refineCodeWithRuntime = async (
  currentCode: string,
  userInstruction: string,
  settings?: AppSettings,
  signal?: AbortSignal,
  runtime?: AIRuntimeContext,
): Promise<string> => {
  assertDirectProviderSupported(settings?.provider || 'gemini');
  return executeProviderRequest(
    buildRefineRequest(currentCode, userInstruction, settings, signal),
    getRuntime(runtime),
  );
};

export const streamGenerateCodeWithRuntime = (
  base64Image: string | null,
  mimeType: string | null,
  userPrompt = '',
  settings?: AppSettings,
  signal?: AbortSignal,
  runtime?: AIRuntimeContext,
): AsyncGenerator<AIStreamChunk> =>
  (assertDirectProviderSupported(settings?.provider || 'gemini'),
  executeProviderRequestStream(
    buildGenerateRequest(base64Image, mimeType, userPrompt, settings, signal),
    getRuntime(runtime),
  ));

export const streamRefineCodeWithRuntime = (
  currentCode: string,
  userInstruction: string,
  settings?: AppSettings,
  signal?: AbortSignal,
  runtime?: AIRuntimeContext,
): AsyncGenerator<AIStreamChunk> =>
  (assertDirectProviderSupported(settings?.provider || 'gemini'),
  executeProviderRequestStream(
    buildRefineRequest(currentCode, userInstruction, settings, signal),
    getRuntime(runtime),
  ));

export const convertHtmlToReactWithRuntime = async (
  htmlCode: string,
  settings?: AppSettings,
  signal?: AbortSignal,
  runtime?: AIRuntimeContext,
): Promise<string> => {
  const resolved = resolveExecutionSettings(settings);
  assertDirectProviderSupported(resolved.provider);
  const prompt = `
    Convert this HTML code to React:
    \`\`\`html
    ${htmlCode}
    \`\`\`
  `;

  return executeProviderRequest(
    {
      provider: resolved.provider,
      model: resolved.model,
      systemInstruction: REACT_CONVERSION_SYSTEM_INSTRUCTION,
      userPrompt: prompt,
      temperature: 0.1,
      geminiApiKey: resolved.geminiApiKey,
      openRouterApiKey: resolved.openRouterApiKey,
      signal,
    },
    getRuntime(runtime),
  );
};

export const convertHtmlToFlutterWithRuntime = async (
  htmlCode: string,
  settings?: AppSettings,
  signal?: AbortSignal,
  runtime?: AIRuntimeContext,
): Promise<string> => {
  const resolved = resolveExecutionSettings(settings);
  assertDirectProviderSupported(resolved.provider);
  const prompt = `
    Convert this HTML code to Flutter (Dart):
    \`\`\`html
    ${htmlCode}
    \`\`\`
  `;

  return executeProviderRequest(
    {
      provider: resolved.provider,
      model: resolved.model,
      systemInstruction: FLUTTER_CONVERSION_SYSTEM_INSTRUCTION,
      userPrompt: prompt,
      temperature: 0.1,
      geminiApiKey: resolved.geminiApiKey,
      openRouterApiKey: resolved.openRouterApiKey,
      signal,
    },
    getRuntime(runtime),
  );
};

export const convertHtmlToReactNativeWithRuntime = async (
  htmlCode: string,
  settings?: AppSettings,
  signal?: AbortSignal,
  platform: 'expo' | 'cli' = 'expo',
  runtime?: AIRuntimeContext,
): Promise<string> => {
  const resolved = resolveExecutionSettings(settings);
  assertDirectProviderSupported(resolved.provider);
  const instruction = platform === 'expo'
    ? REACT_NATIVE_EXPO_SYSTEM_INSTRUCTION
    : REACT_NATIVE_CLI_SYSTEM_INSTRUCTION;
  const platformName = platform === 'expo' ? 'React Native (Expo)' : 'React Native (CLI)';
  const prompt = `
    Convert this HTML code to ${platformName}:
    \`\`\`html
    ${htmlCode}
    \`\`\`
  `;

  return executeProviderRequest(
    {
      provider: resolved.provider,
      model: resolved.model,
      systemInstruction: instruction,
      userPrompt: prompt,
      temperature: 0.1,
      geminiApiKey: resolved.geminiApiKey,
      openRouterApiKey: resolved.openRouterApiKey,
      signal,
    },
    getRuntime(runtime),
  );
};

export const explainCodeWithRuntime = async (
  htmlCode: string,
  settings?: AppSettings,
  signal?: AbortSignal,
  runtime?: AIRuntimeContext,
): Promise<CodeExplanation> => {
  const resolved = resolveExecutionSettings(settings);
  assertDirectProviderSupported(resolved.provider);
  const prompt = `Explain this code:\n\`\`\`html\n${htmlCode.substring(0, 15000)}\n\`\`\``;

  const text = await executeProviderRequest(
    {
      provider: resolved.provider,
      model: resolved.model,
      systemInstruction: EXPLAIN_SYSTEM_INSTRUCTION,
      userPrompt: prompt,
      temperature: 0.2,
      geminiApiKey: resolved.geminiApiKey,
      openRouterApiKey: resolved.openRouterApiKey,
      responseMimeType: resolved.provider === 'gemini' ? 'application/json' : undefined,
      signal,
    },
    getRuntime(runtime),
  );

  return parseExplanationJson(text);
};
