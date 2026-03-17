
export enum AppStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  SUCCESS = 'SUCCESS',
  ERROR = 'ERROR'
}

export interface GeneratedResponse {
  code: string;
  explanation?: string;
}

export interface ImageFile {
  preview: string;
  base64: string;
  type: string;
}

export interface HistoryItem {
  id: string;
  image: ImageFile;
  code: string;
  timestamp: number;
  prompt: string;
}

export type AiProvider = 'gemini' | 'openrouter' | 'claude-agent' | 'codex-cli';

export interface AppSettings {
  temperature: number;
  quality: 'exact' | 'creative';
  showLineNumbers: boolean;
  customApiKey: string;
  openRouterApiKey: string;
  model: string;
  provider: AiProvider;
}
