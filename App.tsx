




import React, { useState, useEffect, useRef } from 'react';
import { Wand2, AlertCircle, Eye, Code, Smartphone, Tablet, Monitor, Clock, Trash2, RotateCcw, Sparkles, SlidersHorizontal, ExternalLink, Send, MessageSquare, Download, Upload, Play, Pause, Settings, MousePointer2, Palette, Edit3, ChevronDown, Grid3X3, Layers, Square } from 'lucide-react';
import Header from './components/Header';
import UploadZone from './components/UploadZone';
import CodeViewer from './components/CodeViewer';
import Button from './components/Button';
import SkeletonLoader from './components/SkeletonLoader';
import ImageModal from './components/ImageModal';
import ExplainModal from './components/ExplainModal';
import VoiceInput from './components/VoiceInput';
import ColorPalette from './components/ColorPalette';
import ProcessingLogPanel, { ProcessingLogItem } from './components/ProcessingLogPanel';
import SettingsModal from './components/SettingsModal';
import Toast, { ToastType } from './components/Toast';
import {
  explainCode,
  streamGenerateCode,
  streamRefineCode,
  CodeExplanation,
} from './services/ai';
import { extractColors } from './utils/colorExtractor';
import { AppStatus, ImageFile, HistoryItem, AppSettings } from './types';
import { generateShareUrl, loadFromShareUrl } from './utils/share';
import { THEME_PRESETS, WIREFRAME_SCRIPT } from './constants';

const SUGGESTIONS = [
  "Modern & Minimal",
  "Dark Theme",
  "Dashboard Layout",
  "Landing Page",
  "Mobile First",
  "Glassmorphism"
];

const DEFAULT_OPERATION_TIMEOUT_MS = 120000;
const CODEX_OPERATION_TIMEOUT_MS = 30 * 60 * 1000;
const APP_SETTINGS_STORAGE_KEY = 'pic2code_app_settings';
const DEFAULT_APP_SETTINGS: AppSettings = {
  temperature: 0.1,
  quality: 'exact',
  showLineNumbers: true,
  customApiKey: '',
  openRouterApiKey: '',
  model: 'gemini-3-pro-preview',
  provider: 'gemini',
};

const loadStoredAppSettings = (): AppSettings => {
  if (typeof window === 'undefined') {
    return DEFAULT_APP_SETTINGS;
  }

  try {
    const raw = localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!raw) {
      return DEFAULT_APP_SETTINGS;
    }

    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_APP_SETTINGS,
      ...parsed,
    };
  } catch {
    return DEFAULT_APP_SETTINGS;
  }
};

// Script injected for Inspector Mode
const INSPECTOR_SCRIPT = `
  <style>
    .inspector-overlay {
      position: fixed;
      z-index: 10000;
      background: rgba(99, 102, 241, 0.95);
      color: white;
      padding: 6px 10px;
      border-radius: 6px;
      font-family: monospace;
      font-size: 12px;
      pointer-events: none;
      transform: translateY(-100%);
      margin-top: -8px;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .inspector-target {
      outline: 2px solid #6366f1 !important;
      outline-offset: -2px;
      cursor: default;
    }
  </style>
  <script>
    (function() {
      let overlay = document.createElement('div');
      overlay.className = 'inspector-overlay';
      overlay.style.display = 'none';
      document.body.appendChild(overlay);
      
      let lastTarget = null;

      function getSelector(el) {
        let tag = el.tagName.toLowerCase();
        let classes = Array.from(el.classList).map(c => '.' + c).join('');
        return tag + classes;
      }

      window.addEventListener('message', (event) => {
        if (event.data === 'TOGGLE_INSPECTOR') {
             // Logic could go here to toggle if needed, but we mostly just add/remove listener in React
        }
      });

      document.addEventListener('mouseover', (e) => {
        if (document.body.getAttribute('data-mode') !== 'inspector') return;
        if (e.target === document.body || e.target === document.documentElement || e.target === overlay) return;
        
        e.stopPropagation();
        if (lastTarget) lastTarget.classList.remove('inspector-target');
        
        e.target.classList.add('inspector-target');
        lastTarget = e.target;
        
        const rect = e.target.getBoundingClientRect();
        overlay.textContent = getSelector(e.target);
        overlay.style.display = 'block';
        overlay.style.top = (rect.top + window.scrollY) + 'px';
        overlay.style.left = (rect.left + window.scrollX) + 'px';
      }, true);

      document.addEventListener('mouseout', (e) => {
        if (document.body.getAttribute('data-mode') !== 'inspector') return;
        if (lastTarget) lastTarget.classList.remove('inspector-target');
        overlay.style.display = 'none';
      }, true);
    })();
  </script>
`;

// Script injected for Design Mode (Visual Editing)
const DESIGN_MODE_SCRIPT = `
  <style>
    .design-mode-active *[contenteditable="true"] {
      outline: 1px dashed rgba(99, 102, 241, 0.5);
      cursor: text;
    }
    .design-mode-active *[contenteditable="true"]:focus {
      outline: 2px solid #6366f1;
      background-color: rgba(99, 102, 241, 0.05);
    }
  </style>
  <script>
    (function() {
      function enableDesignMode() {
        document.body.classList.add('design-mode-active');
        document.body.setAttribute('data-mode', 'design');
        
        // Make text elements editable
        const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6, p, span, a, button, li, td, th, div');
        elements.forEach(el => {
          if (el.children.length === 0 && el.innerText.trim().length > 0) {
            el.setAttribute('contenteditable', 'true');
            el.addEventListener('input', handleInput);
          }
        });
      }

      function disableDesignMode() {
        document.body.classList.remove('design-mode-active');
        document.body.removeAttribute('data-mode');
        const elements = document.querySelectorAll('[contenteditable="true"]');
        elements.forEach(el => {
          el.removeAttribute('contenteditable');
          el.removeEventListener('input', handleInput);
        });
      }

      let timeout;
      function handleInput() {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
           const html = document.documentElement.outerHTML;
           window.parent.postMessage({ type: 'CODE_UPDATE', html: html }, '*');
        }, 800);
      }

      window.addEventListener('message', (event) => {
        if (event.data === 'ENABLE_DESIGN_MODE') enableDesignMode();
        if (event.data === 'DISABLE_DESIGN_MODE') disableDesignMode();
      });
    })();
  </script>
`;

function App() {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [image, setImage] = useState<ImageFile | null>(null);
  const [generatedCode, setGeneratedCode] = useState<string>("");
  const [previousCode, setPreviousCode] = useState<string>("");
  const [reactCode, setReactCode] = useState<string>("");
  const [flutterCode, setFlutterCode] = useState<string>("");
  const [reactNativeExpoCode, setReactNativeExpoCode] = useState<string>("");
  const [reactNativeCliCode, setReactNativeCliCode] = useState<string>("");
  const [prompt, setPrompt] = useState<string>("");
  const [refinePrompt, setRefinePrompt] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [previewWidth, setPreviewWidth] = useState<'100%' | '768px' | '375px'>('100%');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isDarker, setIsDarker] = useState(false);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [comparePos, setComparePos] = useState(50);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [activeModalImage, setActiveModalImage] = useState<string>('');
  const [isRefining, setIsRefining] = useState(false);
  const [extractedColors, setExtractedColors] = useState<string[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [appSettings, setAppSettings] = useState<AppSettings>(() => loadStoredAppSettings());
  const [isPlayingResponsive, setIsPlayingResponsive] = useState(false);
  const [isInspectorActive, setIsInspectorActive] = useState(false);
  const [isDesignMode, setIsDesignMode] = useState(false);
  const [isWireframeMode, setIsWireframeMode] = useState(false);
  const [showRemixMenu, setShowRemixMenu] = useState(false);
  
  // Explanation State
  const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);
  const [explanation, setExplanation] = useState<CodeExplanation | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);

  // Toast State
  const [toast, setToast] = useState<{message: string, type: ToastType, isVisible: boolean}>({
    message: '', type: 'info', isVisible: false
  });
  const [operationStartedAt, setOperationStartedAt] = useState<number | null>(null);
  const [operationElapsedSeconds, setOperationElapsedSeconds] = useState(0);
  const [processingLogs, setProcessingLogs] = useState<ProcessingLogItem[]>([]);
  const [activeLogRequestId, setActiveLogRequestId] = useState<string | null>(null);
  const [isLogPollingActive, setIsLogPollingActive] = useState(false);

  const historyFileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const remixMenuRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const operationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortReasonRef = useRef<'user' | 'timeout' | null>(null);
  const activeOperationTokenRef = useRef(0);
  const gatewayLogKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setIsVisible(true);
    
    // Load local history
    const savedHistory = localStorage.getItem('pixel2code_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }

    // Load from share URL if present
    const shared = loadFromShareUrl();
    if (shared) {
      setGeneratedCode(shared.code);
      setPrompt(shared.prompt);
      setStatus(AppStatus.SUCCESS);
      setViewMode('preview');
      window.location.hash = ''; // Clear hash after load
      showToast('Project loaded from shared URL', 'success');
    }

    // Handle iframe messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data && event.data.type === 'CODE_UPDATE') {
        const newHtml = event.data.html;
        // Clean up the injected scripts before saving
        const cleaned = newHtml.replace(DESIGN_MODE_SCRIPT, '').replace(INSPECTOR_SCRIPT, '').replace(WIREFRAME_SCRIPT, '');
        setGeneratedCode(cleaned);
      }
    };
    window.addEventListener('message', handleMessage);
    
    // Close remix menu on click outside
    const handleClickOutside = (event: MouseEvent) => {
      if (remixMenuRef.current && !remixMenuRef.current.contains(event.target as Node)) {
        setShowRemixMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('message', handleMessage);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('pixel2code_history', JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(appSettings));
  }, [appSettings]);

  useEffect(() => {
    if (image) {
      extractColors(image.preview).then(setExtractedColors).catch(console.error);
    } else {
      setExtractedColors([]);
    }
  }, [image]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (isPlayingResponsive) {
      const widths: ('100%' | '768px' | '375px')[] = ['100%', '768px', '375px'];
      let currentIndex = widths.indexOf(previewWidth);
      
      interval = setInterval(() => {
        currentIndex = (currentIndex + 1) % widths.length;
        setPreviewWidth(widths[currentIndex]);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [isPlayingResponsive, previewWidth]);

  useEffect(() => {
    if (operationStartedAt == null) {
      setOperationElapsedSeconds(0);
      return;
    }

    setOperationElapsedSeconds(Math.max(0, Math.floor((Date.now() - operationStartedAt) / 1000)));
    const interval = setInterval(() => {
      setOperationElapsedSeconds(Math.max(0, Math.floor((Date.now() - operationStartedAt) / 1000)));
    }, 1000);

    return () => clearInterval(interval);
  }, [operationStartedAt]);

  const appendProcessingLog = (
    source: 'ui' | 'gateway',
    level: ProcessingLogItem['level'],
    title: string,
    detail?: string,
  ) => {
    setProcessingLogs((prev) => [
      ...prev,
      {
        id: `${source}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        ts: new Date().toISOString(),
        source,
        level,
        title,
        detail,
      },
    ]);
  };

  const beginProcessingLogSession = (requestId: string) => {
    gatewayLogKeysRef.current.clear();
    setProcessingLogs([]);
    setActiveLogRequestId(requestId);
    setIsLogPollingActive(true);
  };

  const beginUiOnlyLogSession = () => {
    gatewayLogKeysRef.current.clear();
    setProcessingLogs([]);
    setActiveLogRequestId(null);
    setIsLogPollingActive(false);
  };

  const endProcessingLogSession = () => {
    window.setTimeout(() => {
      setIsLogPollingActive(false);
    }, 4000);
  };

  const mapGatewayLogToItem = (log: any): ProcessingLogItem => {
    let title = log.event || 'gateway_event';
    let detail = '';
    let level: ProcessingLogItem['level'] = log.level === 'error' ? 'error' : 'info';
    let stage: string | undefined;
    const preview = typeof log.details?.preview === 'string' ? log.details.preview : '';
    const text = typeof log.details?.text === 'string' ? log.details.text : '';

    switch (log.event) {
      case 'request_start':
        title = '网关已接收请求';
        detail = `provider=${log.provider || '-'} model=${log.model || '-'} operation=${log.operation || '-'}`;
        stage = 'prepare';
        break;
      case 'request_complete':
        title = '网关请求完成';
        level = 'success';
        detail = `耗时 ${Math.round((log.durationMs || 0) / 1000)} 秒，输出 ${log.outputLength || 0} 字符`;
        stage = 'finalize';
        break;
      case 'request_error':
        title = '网关请求失败';
        detail = log.message || '未知错误';
        level = 'error';
        stage = 'finalize';
        break;
      case 'request_aborted':
        title = '网关请求中止';
        detail = `已写出 ${log.outputLength || 0} 字符`;
        level = 'error';
        stage = 'finalize';
        break;
      case 'claude_query_start':
        title = 'Claude Code SDK 开始处理';
        detail = `model=${log.model || '-'} toolCount=${log.details?.toolCount ?? 0}`;
        stage = 'reasoning';
        break;
      case 'claude_query_complete':
        title = 'Claude Code SDK 处理完成';
        detail = `耗时 ${Math.round((log.durationMs || 0) / 1000)} 秒，输出 ${log.outputLength || 0} 字符`;
        level = 'success';
        stage = 'finalize';
        break;
      case 'claude_query_error':
        title = 'Claude Code SDK 处理失败';
        detail = log.message || '未知错误';
        level = 'error';
        stage = 'finalize';
        break;
      case 'codex_query_start':
        title = 'Codex CLI 开始处理';
        detail = `model=${log.model || '-'} imageCount=${log.details?.imageCount ?? 0}`;
        stage = 'prepare';
        break;
      case 'codex_query_complete':
        title = 'Codex CLI 处理完成';
        detail = `耗时 ${Math.round((log.durationMs || 0) / 1000)} 秒，输出 ${log.outputLength || 0} 字符`;
        level = 'success';
        stage = 'finalize';
        break;
      case 'codex_query_error':
        title = 'Codex CLI 处理失败';
        detail = log.message || '未知错误';
        level = 'error';
        stage = 'finalize';
        break;
      case 'codex_phase':
        title = typeof log.message === 'string' ? log.message : 'Codex CLI 阶段事件';
        stage = log.details?.phase || 'prepare';
        if (stage === 'build_prompt') {
          title = '已构建完整提示词';
          detail = [
            typeof log.details?.promptLength === 'number' ? `promptLength: ${log.details.promptLength}` : '',
            typeof log.details?.systemPrompt === 'string' ? `systemPrompt:\n${log.details.systemPrompt}` : '',
            typeof log.details?.userPrompt === 'string' ? `userPrompt:\n${log.details.userPrompt}` : '',
            typeof log.details?.fullPrompt === 'string' ? `fullPrompt:\n${log.details.fullPrompt}` : '',
          ].filter(Boolean).join('\n\n');
        } else {
          detail = Object.entries(log.details || {})
            .filter(([key]) => key !== 'phase' && key !== 'heartbeat')
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
        }
        break;
      case 'codex_cli_event':
        title = typeof log.message === 'string' ? log.message : 'Codex CLI 内部步骤';
        stage = log.details?.phase || 'tooling';
        if (stage === 'session') {
          title = '已建立 Codex 会话';
          detail = log.details?.threadId ? `threadId: ${log.details.threadId}` : '';
        } else if (stage === 'reasoning') {
          title = '正在分析截图结构';
          detail = 'Codex 正在理解页面布局、分区层级和主要组件关系。';
        } else if (stage === 'generation') {
          if (preview.includes('布局') || preview.includes('拆解') || preview.includes('结构')) {
            title = '正在规划页面结构';
          } else {
            title = '正在输出页面代码';
          }

          detail = [
            typeof log.details?.textLength === 'number' ? `textLength: ${log.details.textLength}` : '',
            text ? `text:\n${text}` : '',
            !text && preview ? `preview: ${preview}` : '',
          ].filter(Boolean).join('\n');
        } else if (stage === 'tooling') {
          title = '正在处理内部步骤';
          detail = typeof log.details?.itemType === 'string'
            ? `itemType: ${log.details.itemType}`
            : '';
        } else if (stage === 'finalize') {
          title = '本轮推理完成';
          detail = [
            typeof log.details?.inputTokens === 'number' ? `inputTokens: ${log.details.inputTokens}` : '',
            typeof log.details?.cachedInputTokens === 'number' ? `cachedInputTokens: ${log.details.cachedInputTokens}` : '',
            typeof log.details?.outputTokens === 'number' ? `outputTokens: ${log.details.outputTokens}` : '',
          ].filter(Boolean).join('\n');
        } else {
          detail = Object.entries(log.details || {})
            .filter(([key]) => key !== 'eventType' && key !== 'phase')
            .map(([key, value]) => `${key}: ${value}`)
            .join('\n');
        }
        break;
      case 'codex_stream_text':
        title = 'Codex 姝ｅ湪娴佸紡杈撳嚭鍐呭';
        stage = log.details?.phase || 'generation';
        detail = [
          typeof log.details?.chunkLength === 'number' ? `chunkLength: ${log.details.chunkLength}` : '',
          text ? `text:\n${text}` : '',
        ].filter(Boolean).join('\n');
        break;
      default:
        detail = log.message || '';
        break;
    }

    return {
      id: `${log.seq || `${log.requestId || 'no-request'}-${log.ts}-${log.event}`}`,
      ts: log.ts || new Date().toISOString(),
      source: 'gateway',
      level,
      title,
      detail,
      stage,
    };
  };

  useEffect(() => {
    if (!activeLogRequestId || !isLogPollingActive) return;

    let cancelled = false;

    const fetchLogs = async () => {
      try {
        const response = await fetch(`/api/ai/logs?requestId=${encodeURIComponent(activeLogRequestId)}&limit=120`);
        const data = await response.json();
        if (!response.ok || !data.ok || cancelled || !Array.isArray(data.logs)) {
          return;
        }

        const newItems: ProcessingLogItem[] = [];
        for (const log of data.logs) {
          const key = `${log.seq || `${log.requestId || 'no-request'}-${log.ts}-${log.event}`}`;
          if (gatewayLogKeysRef.current.has(key)) {
            continue;
          }
          gatewayLogKeysRef.current.add(key);
          newItems.push(mapGatewayLogToItem(log));
        }

        if (newItems.length > 0) {
          setProcessingLogs((prev) => [...prev, ...newItems]);
        }
      } catch {
        // 忽略日志轮询错误，避免影响主流程
      }
    };

    fetchLogs();
    const interval = window.setInterval(fetchLogs, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeLogRequestId, isLogPollingActive]);

  useEffect(() => {
    if (!activeLogRequestId || !isLogPollingActive || typeof window === 'undefined' || !('EventSource' in window)) {
      return;
    }

    let closed = false;
    const eventSource = new EventSource(`/api/ai/logs/stream?requestId=${encodeURIComponent(activeLogRequestId)}&limit=5`);

    eventSource.onmessage = (event) => {
      if (closed || !event.data) {
        return;
      }

      try {
        const log = JSON.parse(event.data);
        const key = `${log.seq || `${log.requestId || 'no-request'}-${log.ts}-${log.event}`}`;
        if (gatewayLogKeysRef.current.has(key)) {
          return;
        }

        gatewayLogKeysRef.current.add(key);
        setProcessingLogs((prev) => [...prev, mapGatewayLogToItem(log)]);
      } catch {
        // 蹇界暐鍗曟潯 SSE 鏃ュ織瑙ｆ瀽閿欒
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    return () => {
      closed = true;
      eventSource.close();
    };
  }, [activeLogRequestId, isLogPollingActive]);

  // Sync inspector/design/wireframe mode state with iframe
  useEffect(() => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    
    const win = iframeRef.current.contentWindow;
    const body = win.document?.body;
    if (!body) return;
    
    // Design Mode
    if (isDesignMode) {
      win.postMessage('ENABLE_DESIGN_MODE', '*');
      setIsInspectorActive(false); 
    } else {
      win.postMessage('DISABLE_DESIGN_MODE', '*');
    }
    
    // Inspector Mode
    if (isInspectorActive) {
      body.setAttribute('data-mode', 'inspector');
      setIsDesignMode(false);
    } else {
      if (!isDesignMode) body.removeAttribute('data-mode');
    }

    // Wireframe Mode
    if (isWireframeMode) {
       body.classList.add('wireframe-mode');
    } else {
       body.classList.remove('wireframe-mode');
    }

  }, [isDesignMode, isInspectorActive, isWireframeMode, generatedCode]);

  const showToast = (message: string, type: ToastType = 'info') => {
    setToast({ message, type, isVisible: true });
  };

  const cleanMarkdown = (text: string) => {
    if (text.trim().startsWith('```')) {
        return text.replace(/^```(html|xml|javascript|ts|tsx)?/, '').replace(/```$/, '').trim();
    }
    return text;
  };

  const getOperationTimeoutMs = (provider: AppSettings['provider']) =>
    provider === 'codex-cli' ? CODEX_OPERATION_TIMEOUT_MS : DEFAULT_OPERATION_TIMEOUT_MS;

  const getLoadingHint = (provider: AppSettings['provider'], hasImage: boolean) => {
    if (provider === 'codex-cli' && hasImage) {
      return `Codex CLI 图片生成通常需要 10 到 30 分钟，请保持页面打开。已等待 ${operationElapsedSeconds} 秒。`;
    }

    if (provider === 'codex-cli') {
      return `Codex CLI 正在生成代码，通常会比其他渠道更慢。已等待 ${operationElapsedSeconds} 秒。`;
    }

    if (provider === 'claude-agent' && hasImage) {
      return `Claude Code SDK 正在处理图片和提示词，请稍候。已等待 ${operationElapsedSeconds} 秒。`;
    }

    return `AI 正在生成代码，请稍候。已等待 ${operationElapsedSeconds} 秒。`;
  };

  const clearOperationTimeout = () => {
    if (operationTimeoutRef.current) {
      clearTimeout(operationTimeoutRef.current);
      operationTimeoutRef.current = null;
    }
  };

  const isCurrentOperation = (token: number) => activeOperationTokenRef.current === token;

  const beginOperation = (provider: AppSettings['provider'] = appSettings.provider) => {
    if (abortControllerRef.current) {
      abortReasonRef.current = 'user';
      abortControllerRef.current.abort();
    }

    clearOperationTimeout();
    activeOperationTokenRef.current += 1;
    const token = activeOperationTokenRef.current;
    abortReasonRef.current = null;
    setOperationStartedAt(Date.now());

    const controller = new AbortController();
    const timeoutMs = getOperationTimeoutMs(provider);
    abortControllerRef.current = controller;
    operationTimeoutRef.current = setTimeout(() => {
      if (!isCurrentOperation(token)) return;
      abortReasonRef.current = 'timeout';
      controller.abort();
    }, timeoutMs);

    return { controller, token };
  };

  const finishOperation = (token: number, controller: AbortController) => {
    if (!isCurrentOperation(token) || abortControllerRef.current !== controller) {
      return;
    }
    clearOperationTimeout();
    abortControllerRef.current = null;
    abortReasonRef.current = null;
    setOperationStartedAt(null);
  };

  const resolveErrorMessage = (
    error: unknown,
    fallback: string,
    provider: AppSettings['provider'] = appSettings.provider,
  ) => {
    if (abortReasonRef.current === 'timeout') {
      if (provider === 'codex-cli') {
        return 'Codex CLI 请求超时。当前已放宽到 30 分钟，若仍超时，建议简化页面复杂度或减少图片范围后重试。';
      }

      return '请求超时，请简化需求或稍后重试。';
    }

    if (error instanceof Error) {
      const message = error.message.trim();
      if (!message) return fallback;

      if (message.includes('API Key')) {
        return 'API Key 不可用，请检查设置或本地网关配置。';
      }

      if (message.includes('网关') || message.includes('OpenRouter') || message.includes('Gemini')) {
        return message;
      }

      return message;
    }

    return fallback;
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortReasonRef.current = 'user';
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    clearOperationTimeout();
    setOperationStartedAt(null);
    setStatus(AppStatus.IDLE);
    setIsRefining(false);
    setIsExplaining(false);
    showToast('Generation stopped', 'info');
  };

  const handleGenerate = async () => {
    if (!image && !prompt) return;

    const operationProvider = appSettings.provider;
    const requestId = crypto.randomUUID();
    const { controller, token } = beginOperation(operationProvider);
    beginProcessingLogSession(requestId);
    appendProcessingLog('ui', 'info', '开始生成', `渠道：${operationProvider}${image ? '，已附加图片' : '，纯文本模式'}`);
    appendProcessingLog('ui', 'info', '准备请求', prompt ? `提示词长度 ${prompt.length} 字符` : '未填写额外提示词');

    setStatus(AppStatus.LOADING);
    setError(null);
    setGeneratedCode("");
    setPreviousCode("");
    setReactCode("");
    setFlutterCode("");
    setReactNativeExpoCode("");
    setReactNativeCliCode("");
    setViewMode('code');
    setIsCompareMode(false);

    try {
      // Append colors to prompt if available
      let finalPrompt = prompt;
      if (extractedColors.length > 0) {
        finalPrompt += ` Use these colors from the image: ${extractedColors.join(', ')}.`;
      }

      // If no image, default to creative mode implicitly
      const effectiveSettings = !image ? { ...appSettings, quality: 'creative' } : appSettings;

      let streamedCode = '';

      for await (const chunk of streamGenerateCode(
        image?.base64 || null, 
        image?.type || null, 
        finalPrompt, 
        effectiveSettings as AppSettings,
        controller.signal,
        requestId
      )) {
        if (!isCurrentOperation(token)) {
          return;
        }

        if (chunk.type === 'error') {
          appendProcessingLog('ui', 'error', '生成失败', chunk.content);
          throw new Error(chunk.content);
        }

        if (chunk.type === 'text') {
          if (streamedCode.length === 0) {
            appendProcessingLog('ui', 'info', '收到首段响应', chunk.requestId ? `Request ID: ${chunk.requestId}` : undefined);
          }
          streamedCode += chunk.content;
          setGeneratedCode(cleanMarkdown(streamedCode));
        }
      }

      const cleanedCode = cleanMarkdown(streamedCode);
      if (!cleanedCode.trim()) {
        throw new Error('模型没有返回代码内容。');
      }

      setGeneratedCode(cleanedCode);
      setStatus(AppStatus.SUCCESS);
      setViewMode('preview');
      appendProcessingLog('ui', 'success', '生成完成', `共生成 ${cleanedCode.length} 个字符`);
      
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        image: image || { preview: 'https://placehold.co/600x400?text=Text+Prompt', base64: '', type: 'text' },
        code: cleanedCode,
        timestamp: Date.now(),
        prompt: prompt
      };
      setHistory(prev => [newItem, ...prev]);

    } catch (err: any) {
      if (!isCurrentOperation(token)) {
        return;
      }

        if (err.name === 'AbortError') {
        if (abortReasonRef.current === 'timeout') {
          const timeoutMessage = resolveErrorMessage(err, '请求超时，请稍后重试。', operationProvider);
          setError(timeoutMessage);
          setStatus(AppStatus.ERROR);
          showToast(timeoutMessage, 'error');
          appendProcessingLog('ui', 'error', '请求超时', timeoutMessage);
        } else {
          setStatus(AppStatus.IDLE);
          appendProcessingLog('ui', 'info', '请求已停止');
        }
        return;
      }
      const message = resolveErrorMessage(
        err,
        'Failed to generate code. Please try again or check your API key.',
        operationProvider,
      );
      setError(message);
      setStatus(AppStatus.ERROR);
      showToast(message, 'error');
      appendProcessingLog('ui', 'error', '生成失败', message);
    } finally {
      finishOperation(token, controller);
      endProcessingLogSession();
    }
  };

  const handleRefine = async () => {
    if (!generatedCode || !refinePrompt.trim()) return;
    performRefinement(refinePrompt);
  };

  const handleRemix = (themeName: string) => {
    const instruction = THEME_PRESETS[themeName];
    if (instruction) {
      performRefinement(instruction);
      setShowRemixMenu(false);
      showToast(`Applying ${themeName} theme...`, 'info');
    }
  };

  const performRefinement = async (instruction: string) => {
    const operationProvider = appSettings.provider;
    const requestId = crypto.randomUUID();
    const { controller, token } = beginOperation(operationProvider);
    const originalCode = generatedCode;
    beginProcessingLogSession(requestId);
    appendProcessingLog('ui', 'info', '开始精修', `渠道：${operationProvider}`);
    appendProcessingLog('ui', 'info', '应用修改指令', instruction);

    setIsRefining(true);
    setError(null);
    setPreviousCode(generatedCode);
    setViewMode('code');
    // Disable interactive modes during refinement
    setIsDesignMode(false);
    setIsInspectorActive(false);

    try {
      let streamedCode = '';

      for await (const chunk of streamRefineCode(generatedCode, instruction, appSettings, controller.signal, requestId)) {
        if (!isCurrentOperation(token)) {
          return;
        }

        if (chunk.type === 'error') {
          appendProcessingLog('ui', 'error', '精修失败', chunk.content);
          throw new Error(chunk.content);
        }

        if (chunk.type === 'text') {
          if (streamedCode.length === 0) {
            appendProcessingLog('ui', 'info', '收到首段精修结果', chunk.requestId ? `Request ID: ${chunk.requestId}` : undefined);
          }
          streamedCode += chunk.content;
          setGeneratedCode(cleanMarkdown(streamedCode));
        }
      }

      const cleanedCode = cleanMarkdown(streamedCode);
      if (!cleanedCode.trim()) {
        throw new Error('模型没有返回精修结果。');
      }

      setGeneratedCode(cleanedCode);
      // Clear derived code as the base HTML has changed
      setReactCode("");
      setFlutterCode("");
      setReactNativeExpoCode("");
      setReactNativeCliCode("");
      setRefinePrompt("");
      setViewMode('preview');
      showToast('Code updated successfully!', 'success');
      appendProcessingLog('ui', 'success', '精修完成', `共生成 ${cleanedCode.length} 个字符`);

    } catch (err: any) {
      if (!isCurrentOperation(token)) {
        return;
      }

      setGeneratedCode(originalCode);
      if (err.name === 'AbortError') {
        if (abortReasonRef.current === 'timeout') {
          const timeoutMessage = resolveErrorMessage(err, '精修请求超时，请稍后重试。', operationProvider);
          setError(timeoutMessage);
          showToast(timeoutMessage, 'error');
          appendProcessingLog('ui', 'error', '精修超时', timeoutMessage);
        }
        setIsRefining(false);
        return;
      }
      const message = resolveErrorMessage(err, 'Failed to refine code. Please try again.', operationProvider);
      setError(message);
      showToast(message, 'error');
      appendProcessingLog('ui', 'error', '精修失败', message);
    } finally {
      if (isCurrentOperation(token)) {
        setIsRefining(false);
      }
      finishOperation(token, controller);
      endProcessingLogSession();
    }
  };

  const handleExplain = async () => {
    if (!generatedCode) return;
    setIsExplainModalOpen(true);
    setExplanation(null);
    setIsExplaining(true);
    
    const operationProvider = appSettings.provider;
    const { controller, token } = beginOperation(operationProvider);
    beginUiOnlyLogSession();
    appendProcessingLog('ui', 'info', '开始代码解释', `渠道：${operationProvider}`);

    try {
      const result = await explainCode(generatedCode, appSettings, controller.signal);
      if (!isCurrentOperation(token)) {
        return;
      }
      setExplanation(result);
      appendProcessingLog('ui', 'success', '代码解释完成');
    } catch (e: any) {
      if (!isCurrentOperation(token)) {
        return;
      }

      if (e.name === 'AbortError') {
         if (abortReasonRef.current === 'timeout') {
           const timeoutMessage = resolveErrorMessage(e, '代码解释超时，请稍后重试。', operationProvider);
           showToast(timeoutMessage, 'error');
           appendProcessingLog('ui', 'error', '代码解释超时', timeoutMessage);
         }
         setIsExplaining(false);
         return;
      }
      const message = resolveErrorMessage(e, 'Failed to explain code', operationProvider);
      console.error(e);
      showToast(message, 'error');
      appendProcessingLog('ui', 'error', '代码解释失败', message);
    } finally {
      if (isCurrentOperation(token)) {
        setIsExplaining(false);
      }
      finishOperation(token, controller);
    }
  };

  const handleReset = () => {
    if (abortControllerRef.current) {
       abortReasonRef.current = 'user';
       abortControllerRef.current.abort();
       abortControllerRef.current = null;
    }
    activeOperationTokenRef.current += 1;
    clearOperationTimeout();
    setOperationStartedAt(null);
    setActiveLogRequestId(null);
    setIsLogPollingActive(false);
    gatewayLogKeysRef.current.clear();
    setProcessingLogs([]);
    setImage(null);
    setGeneratedCode("");
    setPreviousCode("");
    setReactCode("");
    setFlutterCode("");
    setReactNativeExpoCode("");
    setReactNativeCliCode("");
    setPrompt("");
    setRefinePrompt("");
    setStatus(AppStatus.IDLE);
    setError(null);
    setExtractedColors([]);
    setIsPlayingResponsive(false);
    setIsWireframeMode(false);
  };

  const loadHistoryItem = (item: HistoryItem) => {
    setImage(item.image);
    setGeneratedCode(item.code);
    setPreviousCode("");
    setReactCode("");
    setFlutterCode("");
    setReactNativeExpoCode("");
    setReactNativeCliCode("");
    setPrompt(item.prompt);
    setStatus(AppStatus.SUCCESS);
    setViewMode('preview');
    showToast('History item loaded', 'info');
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setHistory(prev => prev.filter(item => item.id !== id));
    showToast('Item deleted from history', 'info');
  };

  const openImageModal = (imageUrl: string) => {
    setActiveModalImage(imageUrl);
    setIsImageModalOpen(true);
  };

  const openInNewTab = () => {
    if (!generatedCode) return;
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(generatedCode);
      newWindow.document.close();
    }
  };

  const exportHistory = () => {
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pic2code-history-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('History exported', 'success');
  };

  const importHistory = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          setHistory(prev => [...imported, ...prev]);
          showToast('History imported successfully', 'success');
        } else {
          showToast('Invalid history file format', 'error');
        }
      } catch (err) {
        showToast('Failed to parse history file', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input
  };

  const toggleResponsivePlay = () => {
    setIsPlayingResponsive(!isPlayingResponsive);
    if (isPlayingResponsive) {
      setPreviewWidth('100%');
    }
  };

  const handleShare = () => {
    const url = generateShareUrl(generatedCode, prompt);
    navigator.clipboard.writeText(url).then(() => {
      showToast('Share URL copied to clipboard!', 'success');
    });
  };

  const handleFixA11yIssues = (issues: string[]) => {
    const instruction = `Fix the following accessibility issues: \n- ${issues.join('\n- ')}`;
    performRefinement(instruction);
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans selection:bg-indigo-500/30 transition-colors duration-300 ${isDarker ? 'bg-black' : 'bg-[#0d1117]'}`}>
      <Header 
        isDarker={isDarker} 
        toggleTheme={() => setIsDarker(!isDarker)} 
        onOpenSettings={() => setIsSettingsOpen(true)}
        onShare={handleShare}
        hasContent={!!generatedCode}
      />
      
      <Toast 
        message={toast.message} 
        type={toast.type} 
        isVisible={toast.isVisible} 
        onClose={() => setToast(prev => ({ ...prev, isVisible: false }))} 
      />

      <main 
        className={`flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-opacity duration-700 ${isVisible ? 'opacity-100' : 'opacity-0'}`}
        role="main"
      >
        
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center text-red-400" role="alert">
            <AlertCircle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(320px,24rem)_minmax(0,1fr)] xl:grid-cols-[minmax(320px,24rem)_minmax(0,1fr)_minmax(320px,30%)] gap-8 h-[calc(100vh-140px)] min-h-[600px]">
          
          <section className="flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar" aria-label="Input Configuration">
            
            <div className="flex flex-col gap-4 flex-shrink-0">
               <div className="bg-[#161b22] p-1 rounded-xl border border-gray-800 shadow-sm relative">
                  <UploadZone 
                    selectedImage={image} 
                    onImageSelect={(file) => {
                      setImage(file);
                      if (!file && !prompt) setStatus(AppStatus.IDLE);
                    }}
                    onImageClick={() => image && openImageModal(image.preview)}
                  />
                  {(image || (generatedCode && !image)) && status !== AppStatus.LOADING && (
                    <button 
                      onClick={handleReset}
                      className="absolute top-3 left-3 p-2 bg-gray-900/80 hover:bg-red-900/50 backdrop-blur rounded-lg text-gray-400 hover:text-red-200 transition-all border border-gray-700 hover:border-red-800 z-10"
                      title="Reset All"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
               </div>

               {extractedColors.length > 0 && (
                 <ColorPalette 
                   colors={extractedColors} 
                   onColorSelect={(c) => setPrompt(prev => prev ? `${prev} Use color ${c}.` : `Use color ${c}.`)} 
                 />
               )}

               <div className="relative">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={image ? "Describe your UI (e.g., 'Modern dashboard')..." : "Describe the website you want to build..."}
                    className="w-full h-32 bg-[#161b22] border border-gray-800 rounded-xl p-4 pr-12 text-gray-300 placeholder-gray-600 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none resize-none transition-all text-sm"
                    aria-label="Additional requirements"
                    disabled={status === AppStatus.LOADING}
                  />
                  <VoiceInput onTranscript={(text) => setPrompt(prev => prev ? `${prev} ${text}` : text)} disabled={status === AppStatus.LOADING} />
                  <div className="absolute bottom-3 right-3">
                    {status === AppStatus.LOADING ? (
                      <Button
                        onClick={handleStop}
                        variant="secondary"
                        className="bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border-red-500/50 animate-pulse"
                        icon={<Square className="w-4 h-4 fill-current" />}
                        aria-label="Stop Generation"
                      >
                        Stop
                      </Button>
                    ) : (
                      <Button
                        onClick={handleGenerate}
                        disabled={(!image && !prompt)}
                        className="shadow-xl shadow-indigo-500/10"
                        icon={<Wand2 className="w-4 h-4" />}
                        aria-label="Generate Code"
                      >
                        {image ? "Generate" : "Create"}
                      </Button>
                    )}
                  </div>
               </div>

               <div className="flex flex-col gap-2">
                 <div className="flex items-center gap-2 text-xs text-gray-400 px-1">
                   <Sparkles className="w-3 h-3 text-yellow-500" />
                   <span className="font-medium">Quick Enhancements</span>
                 </div>
                 <div className="flex flex-wrap gap-2">
                   {SUGGESTIONS.map(s => (
                     <button
                       key={s}
                       onClick={() => setPrompt(prev => prev ? `${prev}, ${s}` : s)}
                       disabled={status === AppStatus.LOADING}
                       className="text-xs px-2.5 py-1.5 bg-[#1f242d] hover:bg-indigo-500/10 hover:text-indigo-300 hover:border-indigo-500/30 border border-gray-800 rounded-full text-gray-300 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                     >
                       {s}
                     </button>
                   ))}
                 </div>
               </div>
            </div>

            {history.length > 0 && (
              <div className="flex flex-col bg-[#161b22] border border-gray-800 rounded-xl overflow-hidden">
                <div className="p-3 border-b border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Clock className="w-4 h-4" />
                    <span className="text-sm font-medium">Session History</span>
                  </div>
                  <div className="flex items-center gap-1">
                     <input 
                        type="file" 
                        ref={historyFileInputRef}
                        className="hidden"
                        accept=".json"
                        onChange={importHistory}
                     />
                     <button 
                       onClick={() => historyFileInputRef.current?.click()}
                       className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                       title="Import History"
                     >
                       <Upload className="w-3.5 h-3.5" />
                     </button>
                     <button 
                       onClick={exportHistory}
                       className="p-1.5 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors"
                       title="Export History"
                     >
                       <Download className="w-3.5 h-3.5" />
                     </button>
                  </div>
                </div>
                <div className="flex-1 p-2 space-y-2">
                  {history.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => loadHistoryItem(item)}
                      className="group flex gap-3 p-2 rounded-lg hover:bg-gray-800/50 cursor-pointer border border-transparent hover:border-gray-700 transition-all"
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') loadHistoryItem(item);
                      }}
                    >
                      <img 
                        src={item.image.preview} 
                        alt="Thumbnail" 
                        className="w-16 h-16 object-cover rounded-md bg-gray-900 border border-gray-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          openImageModal(item.image.preview);
                        }}
                      />
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div className="flex justify-between items-start">
                          <p className="text-sm text-gray-300 truncate font-medium">
                            {item.prompt || "Generated UI"}
                          </p>
                          <button 
                            onClick={(e) => deleteHistoryItem(e, item.id)}
                            className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label="Delete history item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-500">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section className="h-full flex flex-col min-h-[500px] min-w-0" aria-label="Output Preview">
            
            {(generatedCode || status === AppStatus.LOADING) && (
              <div className="flex items-center justify-between mb-3 p-2 bg-[#161b22] border border-gray-800 rounded-lg">
                <div className="flex items-center gap-1 bg-gray-900 rounded-md p-1 border border-gray-800">
                  <button
                    onClick={() => setViewMode('preview')}
                    disabled={status === AppStatus.LOADING}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'preview' 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-50'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    Preview
                  </button>
                  <button
                    onClick={() => setViewMode('code')}
                    disabled={status === AppStatus.LOADING && !generatedCode}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'code' 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800 disabled:opacity-50'
                    }`}
                  >
                    <Code className="w-4 h-4" />
                    Code
                  </button>
                </div>

                {status === AppStatus.LOADING && (
                  <div className="hidden md:flex items-center gap-2 text-xs text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-md max-w-[420px]">
                    <Clock className="w-3.5 h-3.5 animate-pulse" />
                    <span>{getLoadingHint(appSettings.provider, !!image)}</span>
                  </div>
                )}

                {viewMode === 'preview' && status === AppStatus.SUCCESS && (
                  <div className="flex items-center gap-4">
                     {/* Theme Remix Menu */}
                     <div className="relative" ref={remixMenuRef}>
                        <button
                          onClick={() => setShowRemixMenu(!showRemixMenu)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                            showRemixMenu ? 'bg-indigo-500/20 text-indigo-400' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                          }`}
                        >
                          <Palette className="w-4 h-4" />
                          Remix
                          <ChevronDown className="w-3 h-3 opacity-50" />
                        </button>
                        
                        {showRemixMenu && (
                          <div className="absolute top-full right-0 mt-2 w-48 bg-[#161b22] border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                             <div className="p-2 space-y-1">
                                <div className="px-2 py-1 text-xs font-semibold text-gray-500 uppercase tracking-wider">Select Theme</div>
                                {Object.keys(THEME_PRESETS).map(theme => (
                                  <button
                                    key={theme}
                                    onClick={() => handleRemix(theme)}
                                    className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-indigo-600 hover:text-white rounded-lg transition-colors"
                                  >
                                    {theme}
                                  </button>
                                ))}
                             </div>
                          </div>
                        )}
                     </div>

                     <div className="flex items-center gap-1 bg-gray-900 rounded-md p-1 border border-gray-800">
                        <button
                          onClick={() => setIsWireframeMode(!isWireframeMode)}
                          className={`p-1.5 rounded-md transition-all ${
                            isWireframeMode 
                            ? 'bg-indigo-500 text-white ring-1 ring-indigo-400' 
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                          }`}
                          title={isWireframeMode ? "Exit Wireframe Mode" : "Wireframe Mode"}
                        >
                          <Grid3X3 className="w-4 h-4" />
                        </button>
                        <div className="w-px h-4 bg-gray-700 mx-1"></div>
                        <button
                          onClick={() => setIsDesignMode(!isDesignMode)}
                          className={`p-1.5 rounded-md transition-all ${
                            isDesignMode 
                            ? 'bg-indigo-500 text-white ring-1 ring-indigo-400' 
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                          }`}
                          title={isDesignMode ? "Finish Editing Text" : "Visual Text Editor (Click text to edit)"}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <div className="w-px h-4 bg-gray-700 mx-1"></div>
                        <button
                          onClick={() => setIsInspectorActive(!isInspectorActive)}
                          className={`p-1.5 rounded-md transition-all ${
                            isInspectorActive 
                            ? 'bg-indigo-500 text-white ring-1 ring-indigo-400' 
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                          }`}
                          title={isInspectorActive ? "Disable Inspector" : "Enable Inspector (Hover to see classes)"}
                        >
                          <MousePointer2 className="w-4 h-4" />
                        </button>
                        {image && (
                          <>
                             <div className="w-px h-4 bg-gray-700 mx-1"></div>
                             <button
                               onClick={() => setIsCompareMode(!isCompareMode)}
                               className={`p-1.5 rounded-md transition-all ${
                                 isCompareMode 
                                 ? 'bg-indigo-500 text-white ring-1 ring-indigo-400' 
                                 : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                               }`}
                               title="Compare with Original"
                               aria-label="Compare with Original"
                             >
                               <SlidersHorizontal className="w-4 h-4" />
                             </button>
                          </>
                        )}
                     </div>

                     <div className="flex items-center gap-1 bg-gray-900 rounded-md p-1 border border-gray-800">
                        <button
                          onClick={toggleResponsivePlay}
                          title={isPlayingResponsive ? "Pause Responsive Test" : "Auto-Play Responsive Test"}
                          className={`p-1.5 rounded-md transition-all ${
                             isPlayingResponsive ? 'text-indigo-400 bg-gray-800' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                          }`}
                        >
                           {isPlayingResponsive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>
                        <div className="w-px h-4 bg-gray-700 mx-1"></div>
                        <button
                          onClick={() => setPreviewWidth('100%')}
                          title="Desktop View"
                          aria-label="Desktop View"
                          className={`p-1.5 rounded-md transition-all ${
                            previewWidth === '100%' 
                            ? 'bg-gray-700 text-white' 
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                          }`}
                        >
                          <Monitor className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPreviewWidth('768px')}
                           title="Tablet View"
                           aria-label="Tablet View"
                          className={`p-1.5 rounded-md transition-all ${
                            previewWidth === '768px' 
                            ? 'bg-gray-700 text-white' 
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                          }`}
                        >
                          <Tablet className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setPreviewWidth('375px')}
                           title="Mobile View"
                           aria-label="Mobile View"
                          className={`p-1.5 rounded-md transition-all ${
                            previewWidth === '375px' 
                            ? 'bg-gray-700 text-white' 
                            : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'
                          }`}
                        >
                          <Smartphone className="w-4 h-4" />
                        </button>
                     </div>
                     
                     <div className="flex items-center gap-1 bg-gray-900 rounded-md p-1 border border-gray-800">
                       <button
                          onClick={openInNewTab}
                          title="Open in New Tab"
                          className="p-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-all"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                     </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex-1 relative bg-[#0d1117] rounded-xl border border-gray-800 shadow-2xl overflow-hidden group flex flex-col">
             {status === AppStatus.LOADING && !generatedCode ? (
               <div className="relative h-full">
                 <SkeletonLoader />
                 <div className="absolute left-4 right-4 bottom-4 rounded-lg border border-indigo-500/20 bg-[#161b22]/90 backdrop-blur px-4 py-3 text-sm text-indigo-200">
                   {getLoadingHint(appSettings.provider, !!image)}
                 </div>
               </div>
             ) : generatedCode ? (
               <>
                 <div className="flex-1 overflow-hidden relative bg-[#0d1117]">
                   {viewMode === 'preview' ? (
                     <div className="w-full h-full flex justify-center bg-gray-900/50 backdrop-blur-sm overflow-hidden relative">
                       <div 
                          className="h-full bg-white relative transition-all duration-300 ease-in-out shadow-2xl border-x border-gray-800"
                          style={{ width: previewWidth }}
                       >
                         <iframe
                           ref={iframeRef}
                           title="Preview"
                           srcDoc={generatedCode + INSPECTOR_SCRIPT + DESIGN_MODE_SCRIPT + WIREFRAME_SCRIPT}
                           className="w-full h-full"
                           sandbox="allow-scripts allow-modals allow-same-origin"
                         />
                         
                         {isRefining && (
                            <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-30 animate-in fade-in duration-300">
                               <div className="bg-[#161b22] border border-gray-700 p-6 rounded-xl shadow-2xl flex flex-col items-center gap-4">
                                  <div className="relative">
                                     <div className="w-12 h-12 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                                     <div className="absolute inset-0 flex items-center justify-center">
                                       <Sparkles className="w-5 h-5 text-indigo-400 animate-pulse" />
                                     </div>
                                  </div>
                                  <div className="text-center">
                                    <h3 className="text-white font-medium text-lg">Refining Code</h3>
                                    <p className="text-gray-400 text-sm">Applying your changes...</p>
                                  </div>
                                  <Button 
                                    size="sm" 
                                    variant="secondary" 
                                    onClick={handleStop}
                                    className="bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20"
                                  >
                                    Cancel
                                  </Button>
                               </div>
                            </div>
                         )}

                         {isCompareMode && image && !isRefining && (
                            <>
                              <div 
                                className="absolute inset-0 pointer-events-none overflow-hidden bg-gray-900/10 border-r-2 border-indigo-500 z-10"
                                style={{ width: `${comparePos}%` }}
                              >
                                 <img 
                                   src={image.preview} 
                                   className="w-full h-auto object-cover object-top opacity-95" 
                                   style={{ maxWidth: '100%' }}
                                   alt="Original Overlay"
                                 />
                              </div>
                              <input 
                                type="range" 
                                min="0" max="100" 
                                value={comparePos}
                                onChange={(e) => setComparePos(Number(e.target.value))}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                                aria-label="Comparison Slider"
                              />
                              <div 
                                className="absolute top-0 bottom-0 pointer-events-none z-20 flex flex-col items-center justify-center"
                                style={{ left: `${comparePos}%`, transform: 'translateX(-50%)' }}
                              >
                                 <div className="w-8 h-8 bg-indigo-500 rounded-full flex items-center justify-center shadow-xl text-white">
                                   <SlidersHorizontal className="w-4 h-4" />
                                 </div>
                              </div>
                            </>
                         )}
                       </div>
                     </div>
                   ) : (
                     <CodeViewer 
                        code={generatedCode} 
                        previousCode={previousCode}
                        onCodeChange={setGeneratedCode} 
                        extractedColors={extractedColors}
                        showLineNumbers={appSettings.showLineNumbers}
                        onFixIssues={handleFixA11yIssues}
                        isRefining={isRefining}
                        onExplain={handleExplain}
                        reactCode={reactCode}
                        onReactCodeChange={setReactCode}
                        flutterCode={flutterCode}
                        onFlutterCodeChange={setFlutterCode}
                        reactNativeExpoCode={reactNativeExpoCode}
                        onReactNativeExpoCodeChange={setReactNativeExpoCode}
                        reactNativeCliCode={reactNativeCliCode}
                        onReactNativeCliCodeChange={setReactNativeCliCode}
                        settings={appSettings}
                     />
                   )}
                 </div>
                 
                 <div className="p-3 bg-[#161b22] border-t border-gray-800">
                    <div className="flex gap-2">
                       <div className="flex-1 relative">
                          <input
                            type="text"
                            value={refinePrompt}
                            onChange={(e) => setRefinePrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
                            placeholder="Tell AI to make changes (e.g., 'Make the header sticky', 'Change blue to red')..."
                            className="w-full bg-[#0d1117] border border-gray-700 hover:border-gray-600 focus:border-indigo-500 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                            disabled={isRefining}
                          />
                          <MessageSquare className="w-4 h-4 text-gray-500 absolute left-3.5 top-3" />
                       </div>
                       <Button 
                         onClick={handleRefine}
                         disabled={!refinePrompt.trim() || isRefining}
                         isLoading={isRefining}
                         size="sm"
                         className="px-4"
                         icon={!isRefining && <Send className="w-4 h-4" />}
                       >
                         Send
                       </Button>
                    </div>
                 </div>
               </>
             ) : (
               <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 bg-[#161b22]/50">
                 <div className="w-20 h-20 rounded-full bg-gray-800/50 flex items-center justify-center mb-6 ring-4 ring-gray-800/30">
                   <Wand2 className="w-10 h-10 opacity-40" />
                 </div>
                 <h3 className="text-xl font-medium text-gray-300 mb-2">Ready to Create</h3>
                 <p className="text-gray-500 max-w-sm text-center px-4">
                   Upload an image or describe your idea to start generating code.
                 </p>
               </div>
             )}
            </div>

            {generatedCode && !isRefining && (
              <div className="mt-4 flex justify-end">
                 <Button 
                   variant="ghost" 
                   size="sm" 
                   className="text-gray-500 hover:text-gray-300"
                   onClick={() => window.open('https://tailwindcss.com/docs', '_blank')}
                   aria-label="Learn more about the generated technologies"
                 >
                   Learn More
                 </Button>
              </div>
            )}
          </section>

          <ProcessingLogPanel
            logs={processingLogs}
            requestId={activeLogRequestId}
            isRunning={status === AppStatus.LOADING || isRefining || isExplaining}
            elapsedSeconds={operationElapsedSeconds}
          />

        </div>
      </main>

      <ImageModal 
        isOpen={isImageModalOpen} 
        onClose={() => setIsImageModalOpen(false)} 
        imageUrl={activeModalImage} 
      />

      <ExplainModal
        isOpen={isExplainModalOpen}
        onClose={() => setIsExplainModalOpen(false)}
        explanation={explanation}
        isLoading={isExplaining}
      />

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        settings={appSettings} 
        onSettingsChange={setAppSettings} 
      />
    </div>
  );
}

export default App;
