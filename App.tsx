




import React, { useState, useEffect, useRef } from 'react';
import { Wand2, AlertCircle, Eye, Code, Smartphone, Tablet, Monitor, Clock, Trash2, RotateCcw, Sparkles, SlidersHorizontal, ExternalLink, Send, MessageSquare, Download, Upload, Play, Pause, Settings, MousePointer2, Palette, Edit3, ChevronDown, Grid3X3, Layers, Square } from 'lucide-react';
import confetti from 'canvas-confetti';
import Header from './components/Header';
import UploadZone from './components/UploadZone';
import CodeViewer from './components/CodeViewer';
import Button from './components/Button';
import SkeletonLoader from './components/SkeletonLoader';
import ImageModal from './components/ImageModal';
import ExplainModal from './components/ExplainModal';
import VoiceInput from './components/VoiceInput';
import ColorPalette from './components/ColorPalette';
import SettingsModal from './components/SettingsModal';
import Toast, { ToastType } from './components/Toast';
import { generateCode, refineCode, explainCode, CodeExplanation } from './services/geminiService';
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
  const [appSettings, setAppSettings] = useState<AppSettings>({
    temperature: 0.1,
    quality: 'exact',
    showLineNumbers: true,
    customApiKey: '',
    openRouterApiKey: '',
    model: 'gemini-3-pro-preview',
    provider: 'gemini'
  });
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

  const historyFileInputRef = useRef<HTMLInputElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const remixMenuRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

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
    if (image) {
      extractColors(image.preview).then(setExtractedColors).catch(console.error);
    } else {
      setExtractedColors([]);
    }
  }, [image]);

  useEffect(() => {
    // Trigger confetti on successful generation
    if (status === AppStatus.SUCCESS && !isRefining && !generatedCode.includes('Design Mode')) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [status]);

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

  // Sync inspector/design/wireframe mode state with iframe
  useEffect(() => {
    if (!iframeRef.current || !iframeRef.current.contentWindow) return;
    
    const win = iframeRef.current.contentWindow;
    
    // Design Mode
    if (isDesignMode) {
      win.postMessage('ENABLE_DESIGN_MODE', '*');
      setIsInspectorActive(false); 
    } else {
      win.postMessage('DISABLE_DESIGN_MODE', '*');
    }
    
    // Inspector Mode
    if (isInspectorActive) {
      win.document.body.setAttribute('data-mode', 'inspector');
      setIsDesignMode(false);
    } else {
      if (!isDesignMode) win.document.body.removeAttribute('data-mode');
    }

    // Wireframe Mode
    if (isWireframeMode) {
       win.document.body.classList.add('wireframe-mode');
    } else {
       win.document.body.classList.remove('wireframe-mode');
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

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setStatus(AppStatus.IDLE);
    setIsRefining(false);
    setIsExplaining(false);
    showToast('Generation stopped', 'info');
  };

  const handleGenerate = async () => {
    if (!image && !prompt) return;

    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setStatus(AppStatus.LOADING);
    setError(null);
    setGeneratedCode("");
    setPreviousCode("");
    setReactCode("");
    setFlutterCode("");
    setReactNativeExpoCode("");
    setReactNativeCliCode("");
    setViewMode('preview');
    setIsCompareMode(false);

    try {
      // Append colors to prompt if available
      let finalPrompt = prompt;
      if (extractedColors.length > 0) {
        finalPrompt += ` Use these colors from the image: ${extractedColors.join(', ')}.`;
      }

      // If no image, default to creative mode implicitly
      const effectiveSettings = !image ? { ...appSettings, quality: 'creative' } : appSettings;

      const code = await generateCode(
        image?.base64 || null, 
        image?.type || null, 
        finalPrompt, 
        effectiveSettings as AppSettings,
        controller.signal
      );
      
      const cleanedCode = cleanMarkdown(code);
      setGeneratedCode(cleanedCode);
      setStatus(AppStatus.SUCCESS);
      
      const newItem: HistoryItem = {
        id: Date.now().toString(),
        image: image || { preview: 'https://placehold.co/600x400?text=Text+Prompt', base64: '', type: 'text' },
        code: cleanedCode,
        timestamp: Date.now(),
        prompt: prompt
      };
      setHistory(prev => [newItem, ...prev]);

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setStatus(AppStatus.IDLE);
        return;
      }
      setError("Failed to generate code. Please try again or check your API key.");
      setStatus(AppStatus.ERROR);
    } finally {
      abortControllerRef.current = null;
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
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setIsRefining(true);
    setError(null);
    setPreviousCode(generatedCode);
    // Disable interactive modes during refinement
    setIsDesignMode(false);
    setIsInspectorActive(false);

    try {
      const updatedCode = await refineCode(generatedCode, instruction, appSettings, controller.signal);
      const cleanedCode = cleanMarkdown(updatedCode);
      setGeneratedCode(cleanedCode);
      // Clear derived code as the base HTML has changed
      setReactCode("");
      setFlutterCode("");
      setReactNativeExpoCode("");
      setReactNativeCliCode("");
      setRefinePrompt("");
      setViewMode('preview');
      showToast('Code updated successfully!', 'success');
      
      // Trigger mini confetti for refinement
      confetti({
        particleCount: 50,
        spread: 50,
        origin: { y: 0.6 },
        colors: ['#6366f1', '#a855f7']
      });

    } catch (err: any) {
      if (err.name === 'AbortError') {
        setIsRefining(false);
        return;
      }
      setError("Failed to refine code. Please try again.");
      showToast('Failed to update code', 'error');
    } finally {
      setIsRefining(false);
      abortControllerRef.current = null;
    }
  };

  const handleExplain = async () => {
    if (!generatedCode) return;
    setIsExplainModalOpen(true);
    setExplanation(null);
    setIsExplaining(true);
    
    if (abortControllerRef.current) abortControllerRef.current.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const result = await explainCode(generatedCode, appSettings, controller.signal);
      setExplanation(result);
    } catch (e: any) {
      if (e.name === 'AbortError') {
         setIsExplaining(false);
         return;
      }
      console.error(e);
      showToast('Failed to explain code', 'error');
    } finally {
      setIsExplaining(false);
      abortControllerRef.current = null;
    }
  };

  const handleReset = () => {
    if (abortControllerRef.current) {
       abortControllerRef.current.abort();
       abortControllerRef.current = null;
    }
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

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-140px)] min-h-[600px]">
          
          <section className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar" aria-label="Input Configuration">
            
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

          <section className="lg:col-span-8 xl:col-span-9 h-full flex flex-col min-h-[500px]" aria-label="Output Preview">
            
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
                    disabled={status === AppStatus.LOADING}
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
             {status === AppStatus.LOADING ? (
               <SkeletonLoader />
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