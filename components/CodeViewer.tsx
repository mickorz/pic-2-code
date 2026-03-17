




import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Copy, Check, FileCode, Download, ShieldCheck, AlertTriangle, Info, AlertOctagon, Zap, Sparkles, Code2, PenLine, Eye, Package, GitCompare, Wrench, BookOpen, Smartphone, Square, TabletSmartphone } from 'lucide-react';
import Prism from 'prismjs';
import * as Diff from 'diff';
import Button from './Button';
import { scanHTML } from '../utils/a11y';
import { openInStackBlitz } from '../utils/stackblitz';
import { convertHtmlToReact, convertHtmlToFlutter, convertHtmlToReactNative } from '../services/ai';
import { generateProjectZip } from '../utils/zipGenerator';
import { AppSettings } from '../types';

const DEFAULT_CONVERSION_TIMEOUT_MS = 120000;
const CODEX_CONVERSION_TIMEOUT_MS = 30 * 60 * 1000;

interface CodeViewerProps {
  code: string;
  previousCode?: string;
  onCodeChange: (code: string) => void;
  extractedColors?: string[];
  showLineNumbers?: boolean;
  onFixIssues?: (issues: string[]) => void;
  isRefining?: boolean;
  onExplain?: () => void;
  reactCode: string;
  onReactCodeChange: (code: string) => void;
  flutterCode: string;
  onFlutterCodeChange: (code: string) => void;
  reactNativeExpoCode: string;
  onReactNativeExpoCodeChange: (code: string) => void;
  reactNativeCliCode: string;
  onReactNativeCliCodeChange: (code: string) => void;
  settings: AppSettings;
}

const CodeViewer: React.FC<CodeViewerProps> = ({ 
  code, 
  previousCode, 
  onCodeChange, 
  extractedColors, 
  showLineNumbers = true, 
  onFixIssues, 
  isRefining, 
  onExplain,
  reactCode,
  onReactCodeChange,
  flutterCode,
  onFlutterCodeChange,
  reactNativeExpoCode,
  onReactNativeExpoCodeChange,
  reactNativeCliCode,
  onReactNativeCliCodeChange,
  settings
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'code' | 'react' | 'flutter' | 'react-native' | 'audit' | 'diff'>('code');
  const [isEditing, setIsEditing] = useState(false);
  const [isGeneratingReact, setIsGeneratingReact] = useState(false);
  const [isGeneratingFlutter, setIsGeneratingFlutter] = useState(false);
  const [isGeneratingReactNative, setIsGeneratingReactNative] = useState(false);
  const [conversionError, setConversionError] = useState<string | null>(null);
  
  // React Native Sub-tab state
  const [rnPlatform, setRnPlatform] = useState<'expo' | 'cli'>('expo');

  // Local cancellation refs for sub-tasks
  const reactAbortController = useRef<AbortController | null>(null);
  const flutterAbortController = useRef<AbortController | null>(null);
  const reactNativeAbortController = useRef<AbortController | null>(null);

  const auditResult = useMemo(() => scanHTML(code), [code]);

  useEffect(() => {
    if (previousCode && code !== previousCode) {
        // Optionally switch to diff tab automatically
    }
  }, [previousCode, code]);

  useEffect(() => {
    if (!isEditing && activeTab === 'code') {
      Prism.highlightAll();
    }
    if (activeTab === 'react' && reactCode) {
      Prism.highlightAll();
    }
    if (activeTab === 'flutter' && flutterCode) {
      Prism.highlightAll();
    }
    if (activeTab === 'react-native') {
       if (rnPlatform === 'expo' && reactNativeExpoCode) Prism.highlightAll();
       if (rnPlatform === 'cli' && reactNativeCliCode) Prism.highlightAll();
    }
  }, [code, isEditing, activeTab, reactCode, flutterCode, reactNativeExpoCode, reactNativeCliCode, rnPlatform]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    await generateProjectZip(code, reactCode || null, flutterCode || null, reactNativeExpoCode || null, reactNativeCliCode || null, extractedColors);
  };

  const getConversionTimeoutMs = () =>
    settings.provider === 'codex-cli' ? CODEX_CONVERSION_TIMEOUT_MS : DEFAULT_CONVERSION_TIMEOUT_MS;

  const runConversionTask = async ({
    isRunning,
    setIsRunning,
    abortRef,
    execute,
    onSuccess,
    timeoutMessage,
    fallbackMessage,
  }: {
    isRunning: boolean;
    setIsRunning: React.Dispatch<React.SetStateAction<boolean>>;
    abortRef: React.MutableRefObject<AbortController | null>;
    execute: (signal: AbortSignal) => Promise<string>;
    onSuccess: (cleanedCode: string) => void;
    timeoutMessage: string;
    fallbackMessage: string;
  }) => {
    if (isRunning) {
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
      setIsRunning(false);
      return;
    }

    setConversionError(null);
    setIsRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutMs = getConversionTimeoutMs();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);

    try {
      const result = await execute(controller.signal);
      const cleaned = result.replace(/^```(javascript|typescript|jsx|tsx|dart)?/, '').replace(/```$/, '').trim();
      onSuccess(cleaned);
      setTimeout(() => Prism.highlightAll(), 100);
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        const message = e instanceof Error && e.message ? e.message : fallbackMessage;
        console.error(e);
        setConversionError(message);
      } else if (timedOut) {
        setConversionError(timeoutMessage);
      }
    } finally {
      clearTimeout(timeout);
      setIsRunning(false);
      abortRef.current = null;
    }
  };

  const handleGenerateReact = async () => {
    if (!code) return;

    await runConversionTask({
      isRunning: isGeneratingReact,
      setIsRunning: setIsGeneratingReact,
      abortRef: reactAbortController,
      execute: (signal) => convertHtmlToReact(code, settings, signal),
      onSuccess: onReactCodeChange,
      timeoutMessage: 'React 转换超时，请稍后重试。',
      fallbackMessage: 'React 转换失败。',
    });
  };

  const handleGenerateFlutter = async () => {
    if (!code) return;

    await runConversionTask({
      isRunning: isGeneratingFlutter,
      setIsRunning: setIsGeneratingFlutter,
      abortRef: flutterAbortController,
      execute: (signal) => convertHtmlToFlutter(code, settings, signal),
      onSuccess: onFlutterCodeChange,
      timeoutMessage: 'Flutter 转换超时，请稍后重试。',
      fallbackMessage: 'Flutter 转换失败。',
    });
  };

  const handleGenerateReactNative = async () => {
    if (!code) return;

    await runConversionTask({
      isRunning: isGeneratingReactNative,
      setIsRunning: setIsGeneratingReactNative,
      abortRef: reactNativeAbortController,
      execute: (signal) => convertHtmlToReactNative(code, settings, signal, rnPlatform),
      onSuccess: (cleaned) => {
        if (rnPlatform === 'expo') {
          onReactNativeExpoCodeChange(cleaned);
        } else {
          onReactNativeCliCodeChange(cleaned);
        }
      },
      timeoutMessage: 'React Native 转换超时，请稍后重试。',
      fallbackMessage: 'React Native 转换失败。',
    });
  };

  const renderDiff = () => {
    if (!previousCode) return <div className="p-4 text-gray-500">No previous version to compare.</div>;
    
    const diff = Diff.diffLines(previousCode, code);

    return (
      <div className="font-mono text-sm bg-[#0d1117] p-4 overflow-auto custom-scrollbar h-full">
        {diff.map((part, index) => {
          const color = part.added ? 'bg-green-900/30 text-green-300' : part.removed ? 'bg-red-900/30 text-red-300' : 'text-gray-400';
          const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
          return (
            <div key={index} className={`${color} whitespace-pre-wrap`}>
                {part.value.split('\n').map((line, i) => (
                    line ? <div key={i}>{prefix}{line}</div> : null
                ))}
            </div>
          );
        })}
      </div>
    );
  };

  const LineNumbers = ({ text }: { text: string }) => {
    const lines = text.split('\n').length;
    return (
      <div className="flex flex-col text-right pr-4 text-gray-600 select-none font-mono text-sm leading-6 pt-4 pb-4 bg-[#0d1117] border-r border-gray-800 min-h-full">
        {Array.from({ length: lines }).map((_, i) => (
          <span key={i} className="px-2">{i + 1}</span>
        ))}
      </div>
    );
  };

  const getCurrentCode = () => {
    switch (activeTab) {
      case 'react': return reactCode;
      case 'flutter': return flutterCode;
      case 'react-native': return rnPlatform === 'expo' ? reactNativeExpoCode : reactNativeCliCode;
      default: return code;
    }
  };

  return (
    <div className="bg-[#0d1117] rounded-xl border border-gray-800 overflow-hidden flex flex-col h-full shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
        <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
          <button 
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'code' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <FileCode className="w-4 h-4" />
            <span>index.html</span>
          </button>
          
           <button 
            onClick={() => setActiveTab('react')}
            className={`flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'react' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Code2 className="w-4 h-4" />
            <span>React</span>
          </button>

          <button 
            onClick={() => setActiveTab('flutter')}
            className={`flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'flutter' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Flutter</span>
          </button>

          <button 
            onClick={() => setActiveTab('react-native')}
            className={`flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'react-native' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <TabletSmartphone className="w-4 h-4" />
            <span>React Native</span>
          </button>

          {previousCode && (
             <button 
              onClick={() => setActiveTab('diff')}
              className={`flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'diff' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <GitCompare className="w-4 h-4 text-blue-400" />
              <span>Diff</span>
            </button>
          )}

          <button 
             onClick={() => setActiveTab('audit')}
             className={`flex items-center gap-2 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'audit' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <ShieldCheck className={`w-4 h-4 ${auditResult.score < 100 ? 'text-yellow-500' : 'text-green-500'}`} />
            <span>A11y Audit</span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
              auditResult.score >= 90 ? 'bg-green-500/20 text-green-400' : 
              auditResult.score >= 70 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'
            }`}>
              {auditResult.score}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
           {activeTab === 'code' && (
             <div className="flex bg-gray-800 rounded-lg p-0.5 border border-gray-700 mr-2">
               <button
                 onClick={() => setIsEditing(false)}
                 className={`p-1 rounded transition-all ${!isEditing ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                 title="Read Mode"
               >
                 <Eye className="w-3.5 h-3.5" />
               </button>
               <button
                 onClick={() => setIsEditing(true)}
                 className={`p-1 rounded transition-all ${isEditing ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'}`}
                 title="Edit Mode"
               >
                 <PenLine className="w-3.5 h-3.5" />
               </button>
             </div>
           )}

            {activeTab === 'code' && onExplain && (
              <Button
                variant="secondary"
                size="sm"
                onClick={onExplain}
                icon={<BookOpen className="w-3 h-3 text-pink-400" />}
                title="Explain Code"
              >
                Explain
              </Button>
            )}

           {activeTab === 'code' && (
             <Button
               variant="secondary"
               size="sm"
               onClick={() => openInStackBlitz(code)}
               icon={<Zap className="w-3 h-3 text-yellow-400" />}
               title="Open in StackBlitz"
             >
               Run
             </Button>
           )}
           
           <Button
             variant="secondary"
             size="sm"
             onClick={handleDownloadZip}
             icon={<Package className="w-3 h-3" />}
             title="Download Project ZIP"
           >
             ZIP
           </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleCopy(getCurrentCode())}
            disabled={
                (activeTab === 'react' && !reactCode) || 
                (activeTab === 'flutter' && !flutterCode) || 
                (activeTab === 'react-native' && !getCurrentCode())
            }
            icon={copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </div>

      {conversionError && (
        <div className="px-4 py-2 text-sm text-red-300 bg-red-500/10 border-b border-red-500/20">
          {conversionError}
        </div>
      )}
      
      <div className="relative flex-1 overflow-hidden group bg-[#0d1117] flex flex-col">
        {/* Sub-navigation for React Native */}
        {activeTab === 'react-native' && (
             <div className="bg-[#0d1117] border-b border-gray-800 px-4 py-2 flex justify-center">
                <div className="bg-gray-800/50 p-1 rounded-lg flex">
                   <button
                     onClick={() => setRnPlatform('expo')}
                     className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                        rnPlatform === 'expo' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                     }`}
                   >
                     Expo (Managed)
                   </button>
                   <button
                     onClick={() => setRnPlatform('cli')}
                     className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                        rnPlatform === 'cli' ? 'bg-indigo-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                     }`}
                   >
                     CLI (Bare)
                   </button>
                </div>
             </div>
        )}

        <div className="flex-1 relative overflow-hidden flex">
            {activeTab === 'code' && (
            isEditing ? (
                <textarea
                value={code}
                onChange={(e) => onCodeChange(e.target.value)}
                className="w-full h-full bg-[#0d1117] text-gray-300 font-mono text-sm p-4 resize-none focus:outline-none focus:ring-1 focus:ring-indigo-500/50 leading-6"
                spellCheck="false"
                />
            ) : (
                <>
                    {showLineNumbers && <LineNumbers text={code} />}
                    <div className="flex-1 h-full overflow-auto custom-scrollbar">
                    <pre className="!m-0 !bg-[#0d1117] !p-4 min-h-full">
                        <code className="language-html">{code}</code>
                    </pre>
                    </div>
                </>
            )
            )}

            {activeTab === 'react' && (
            <div className="w-full h-full bg-[#0d1117] text-gray-300 font-mono text-sm relative overflow-hidden flex">
                {reactCode ? (
                    <>
                        {showLineNumbers && <LineNumbers text={reactCode} />}
                        <div className="flex-1 h-full overflow-auto custom-scrollbar">
                        <pre className="!m-0 !bg-[#0d1117] !p-4 min-h-full">
                            <code className="language-tsx">{reactCode}</code>
                        </pre>
                        </div>
                    </>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <div className="max-w-md space-y-4">
                        <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto ring-4 ring-gray-800">
                            <Code2 className="w-8 h-8 text-indigo-400" />
                        </div>
                        <h3 className="text-xl font-medium text-white">Generate React Component</h3>
                        <p className="text-gray-400 text-sm">
                            Use AI to convert your HTML layout into a fully functional React component with 
                            <span className="text-indigo-400 font-mono mx-1">lucide-react</span> icons and proper state management.
                        </p>
                        <Button 
                            onClick={handleGenerateReact} 
                            isLoading={isGeneratingReact}
                            className={`w-full ${isGeneratingReact ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : ''}`}
                            icon={isGeneratingReact ? <Square className="w-4 h-4 fill-current" /> : <Sparkles className="w-4 h-4" />}
                        >
                            {isGeneratingReact ? 'Stop Converting' : 'Convert to React'}
                        </Button>
                    </div>
                    </div>
                )}
            </div>
            )}

            {activeTab === 'flutter' && (
            <div className="w-full h-full bg-[#0d1117] text-gray-300 font-mono text-sm relative overflow-hidden flex">
                {flutterCode ? (
                    <>
                        {showLineNumbers && <LineNumbers text={flutterCode} />}
                        <div className="flex-1 h-full overflow-auto custom-scrollbar">
                        <pre className="!m-0 !bg-[#0d1117] !p-4 min-h-full">
                            <code className="language-dart">{flutterCode}</code>
                        </pre>
                        </div>
                    </>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <div className="max-w-md space-y-4">
                        <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto ring-4 ring-gray-800">
                            <Smartphone className="w-8 h-8 text-blue-400" />
                        </div>
                        <h3 className="text-xl font-medium text-white">Generate Flutter App</h3>
                        <p className="text-gray-400 text-sm">
                            Convert your design into a production-ready 
                            <span className="text-blue-400 font-mono mx-1">Flutter (Dart)</span> application using Material 3 widgets.
                        </p>
                        <Button 
                            onClick={handleGenerateFlutter} 
                            isLoading={isGeneratingFlutter}
                            className={`w-full ${isGeneratingFlutter ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : ''}`}
                            icon={isGeneratingFlutter ? <Square className="w-4 h-4 fill-current" /> : <Sparkles className="w-4 h-4" />}
                        >
                            {isGeneratingFlutter ? 'Stop Converting' : 'Convert to Flutter'}
                        </Button>
                    </div>
                    </div>
                )}
            </div>
            )}

            {activeTab === 'react-native' && (
            <div className="w-full h-full bg-[#0d1117] text-gray-300 font-mono text-sm relative overflow-hidden flex">
                {getCurrentCode() ? (
                    <>
                        {showLineNumbers && <LineNumbers text={getCurrentCode()} />}
                        <div className="flex-1 h-full overflow-auto custom-scrollbar">
                        <pre className="!m-0 !bg-[#0d1117] !p-4 min-h-full">
                            <code className="language-tsx">{getCurrentCode()}</code>
                        </pre>
                        </div>
                    </>
                ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <div className="max-w-md space-y-4">
                        <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto ring-4 ring-gray-800">
                            <TabletSmartphone className="w-8 h-8 text-purple-400" />
                        </div>
                        <h3 className="text-xl font-medium text-white">
                            Generate {rnPlatform === 'expo' ? 'Expo' : 'React Native CLI'} App
                        </h3>
                        <p className="text-gray-400 text-sm">
                            Convert your design into a mobile app using 
                            <span className="text-purple-400 font-mono mx-1">
                                {rnPlatform === 'expo' ? 'Expo Go' : 'React Native CLI'}
                            </span>.
                        </p>
                        <Button 
                            onClick={handleGenerateReactNative} 
                            isLoading={isGeneratingReactNative}
                            className={`w-full ${isGeneratingReactNative ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : ''}`}
                            icon={isGeneratingReactNative ? <Square className="w-4 h-4 fill-current" /> : <Sparkles className="w-4 h-4" />}
                        >
                            {isGeneratingReactNative ? 'Stop Converting' : `Convert to ${rnPlatform === 'expo' ? 'Expo' : 'CLI'}`}
                        </Button>
                    </div>
                    </div>
                )}
            </div>
            )}

            {activeTab === 'diff' && renderDiff()}

            {activeTab === 'audit' && (
            <div className="w-full h-full bg-[#0d1117] overflow-y-auto p-6 custom-scrollbar">
                <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between mb-8">
                    <div>
                    <h2 className="text-xl font-semibold text-white">Accessibility Report</h2>
                    <p className="text-gray-400 text-sm">Automated checks for common WCAG issues.</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {auditResult.issues.length > 0 && onFixIssues && (
                        <Button
                            size="sm"
                            variant="primary"
                            onClick={() => onFixIssues(auditResult.issues.map(i => i.message))}
                            isLoading={isRefining}
                            icon={<Wrench className="w-4 h-4" />}
                        >
                            Fix with AI
                        </Button>
                        )}
                        <div className="text-center">
                            <div className={`text-3xl font-bold ${
                            auditResult.score >= 90 ? 'text-green-400' : 
                            auditResult.score >= 70 ? 'text-yellow-400' : 'text-red-400'
                            }`}>
                            {auditResult.score}/100
                            </div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Health Score</div>
                        </div>
                    </div>
                </div>

                {auditResult.issues.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500 bg-gray-900/50 rounded-lg border border-gray-800 border-dashed">
                    <ShieldCheck className="w-12 h-12 text-green-500 mb-4 opacity-50" />
                    <p className="text-lg font-medium text-gray-300">No issues found!</p>
                    <p className="text-sm">Your HTML structure looks good.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                    {auditResult.issues.map((issue) => (
                        <div key={issue.id} className="bg-gray-900/50 border border-gray-800 rounded-lg p-4 flex gap-4 transition-all hover:bg-gray-900">
                        <div className={`mt-1 flex-shrink-0 ${
                            issue.severity === 'error' ? 'text-red-400' :
                            issue.severity === 'warning' ? 'text-yellow-400' : 'text-blue-400'
                        }`}>
                            {issue.severity === 'error' && <AlertOctagon className="w-5 h-5" />}
                            {issue.severity === 'warning' && <AlertTriangle className="w-5 h-5" />}
                            {issue.severity === 'info' && <Info className="w-5 h-5" />}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-gray-200">{issue.message}</h4>
                            {issue.element && (
                            <div className="mt-2 bg-black/50 p-2 rounded border border-gray-800 font-mono text-xs text-gray-400 overflow-x-auto">
                                {issue.element}
                            </div>
                            )}
                        </div>
                        <div className="flex-shrink-0">
                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded border ${
                            issue.severity === 'error' ? 'bg-red-900/20 text-red-300 border-red-900/50' :
                            issue.severity === 'warning' ? 'bg-yellow-900/20 text-yellow-300 border-yellow-900/50' : 'bg-blue-900/20 text-blue-300 border-blue-900/50'
                            }`}>
                            {issue.severity}
                            </span>
                        </div>
                        </div>
                    ))}
                    </div>
                )}
                </div>
            </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default CodeViewer;
