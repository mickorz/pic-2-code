import { AppSettings } from '../../types';

export interface CodeExplanation {
  summary: string;
  structure: string[];
  styling: string[];
  interactivity: string[];
}

export interface AIRuntimeContext {
  defaultGeminiApiKey?: string;
  defaultOpenRouterApiKey?: string;
  referer?: string;
  title?: string;
  requestId?: string;
}

export interface AIProviderRequest {
  provider: AppSettings['provider'];
  model: string;
  systemInstruction: string;
  userPrompt: string;
  temperature: number;
  imageBase64?: string | null;
  imageType?: string | null;
  geminiApiKey?: string;
  openRouterApiKey?: string;
  responseMimeType?: string;
  signal?: AbortSignal;
}

export interface AIStreamChunk {
  type: 'text' | 'done' | 'error';
  content: string;
  requestId?: string;
}

export type AIExecuteOperation =
  | 'generate'
  | 'refine'
  | 'convert-react'
  | 'convert-flutter'
  | 'convert-react-native'
  | 'explain';

export interface AIGatewayRequest {
  clientRequestId?: string;
  operation: AIExecuteOperation;
  settings?: AppSettings;
  base64Image?: string | null;
  mimeType?: string | null;
  userPrompt?: string;
  currentCode?: string;
  userInstruction?: string;
  htmlCode?: string;
  platform?: 'expo' | 'cli';
}

export type AIGatewayResponse =
  | {
      ok: true;
      text?: string;
      explanation?: CodeExplanation;
      requestId?: string;
    }
  | {
      ok: false;
      error: string;
      requestId?: string;
    };
