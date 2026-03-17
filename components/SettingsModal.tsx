import React, { useEffect, useMemo, useState } from 'react';
import { X, Sliders, Zap, ListOrdered, Key, Cpu, Globe } from 'lucide-react';
import { AVAILABLE_MODELS } from '../constants';
import { AppSettings, AiProvider } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

interface RemoteModelOption {
  id: string;
  name: string;
  provider: AiProvider;
  description?: string;
}

const PROVIDER_LABEL: Record<AiProvider, string> = {
  gemini: 'Google Gemini',
  openrouter: 'OpenRouter',
  'claude-agent': 'Claude Code SDK',
  'codex-cli': 'Codex CLI',
};

const DEFAULT_MODELS_BY_PROVIDER: Record<AiProvider, string> = {
  gemini: 'gemini-3-pro-preview',
  openrouter: 'google/gemini-2.0-flash-exp:free',
  'claude-agent': 'default',
  'codex-cli': 'gpt-5.3-codex',
};

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}) => {
  const [remoteModels, setRemoteModels] = useState<RemoteModelOption[]>([]);
  const [isLoadingRemoteModels, setIsLoadingRemoteModels] = useState(false);

  useEffect(() => {
    const needsRemoteModels = settings.provider === 'claude-agent' || settings.provider === 'codex-cli';
    if (!isOpen || !needsRemoteModels) return;

    let isMounted = true;
    setIsLoadingRemoteModels(true);

    fetch(`/api/ai/models?provider=${settings.provider}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.ok) {
          throw new Error(data.error || `Failed to load ${settings.provider} models.`);
        }
        return data.models as RemoteModelOption[];
      })
      .then((models) => {
        if (!isMounted) return;
        setRemoteModels(models);
      })
      .catch(() => {
        if (!isMounted) return;
        setRemoteModels([]);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingRemoteModels(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, settings.provider]);

  const availableModels = useMemo(() => {
    if ((settings.provider === 'claude-agent' || settings.provider === 'codex-cli') && remoteModels.length > 0) {
      return remoteModels;
    }

    return AVAILABLE_MODELS.filter((model) => model.provider === settings.provider).map((model) => ({
      id: model.id,
      name: model.name,
      provider: model.provider,
    }));
  }, [remoteModels, settings.provider]);

  useEffect(() => {
    const currentModelExists = availableModels.some((model) => model.id === settings.model);
    if (!currentModelExists) {
      const nextModel = availableModels[0]?.id || DEFAULT_MODELS_BY_PROVIDER[settings.provider];
      if (nextModel && nextModel !== settings.model) {
        onSettingsChange({ ...settings, model: nextModel });
      }
    }
  }, [availableModels, onSettingsChange, settings]);

  if (!isOpen) return null;

  const updateProvider = (provider: AiProvider) => {
    const nextModel = DEFAULT_MODELS_BY_PROVIDER[provider];
    onSettingsChange({
      ...settings,
      provider,
      model: nextModel,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#161b22] border border-gray-700 rounded-xl shadow-2xl w-full max-w-md p-6 relative animate-in slide-in-from-bottom-4 duration-300 max-h-[90vh] overflow-y-auto custom-scrollbar">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <Sliders className="w-6 h-6 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Settings</h2>
        </div>

        <div className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              AI Provider
            </label>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {(['gemini', 'openrouter', 'claude-agent', 'codex-cli'] as AiProvider[]).map((provider) => (
                <button
                  key={provider}
                  onClick={() => updateProvider(provider)}
                  className={`p-2.5 rounded-lg border text-sm font-medium transition-all ${
                    settings.provider === provider
                      ? provider === 'gemini'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : provider === 'openrouter'
                          ? 'bg-purple-600 border-purple-500 text-white'
                          : provider === 'claude-agent'
                            ? 'bg-amber-600 border-amber-500 text-white'
                            : 'bg-emerald-600 border-emerald-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                  }`}
                >
                  {PROVIDER_LABEL[provider]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-pink-400" />
              Configuration
            </label>
            <div className="space-y-4 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
              {settings.provider === 'gemini' && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-medium uppercase">Gemini API Key Optional</label>
                  <div className="relative">
                    <Key className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                    <input
                      type="password"
                      value={settings.customApiKey}
                      onChange={(e) => onSettingsChange({ ...settings, customApiKey: e.target.value })}
                      placeholder="Prefer local gateway or default key"
                      className="w-full bg-[#0d1117] border border-gray-600 rounded-lg py-2 pl-9 pr-3 text-sm text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Leave empty to use the local gateway first, then fall back to the default Gemini setup.
                  </p>
                </div>
              )}

              {settings.provider === 'openrouter' && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-medium uppercase">OpenRouter API Key Required</label>
                  <div className="relative">
                    <Key className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                    <input
                      type="password"
                      value={settings.openRouterApiKey}
                      onChange={(e) => onSettingsChange({ ...settings, openRouterApiKey: e.target.value })}
                      placeholder="sk-or-..."
                      className="w-full bg-[#0d1117] border border-gray-600 rounded-lg py-2 pl-9 pr-3 text-sm text-gray-200 placeholder-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                    />
                  </div>
                  <p className="text-[10px] text-gray-500">
                    Key is stored locally in your browser.{' '}
                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-purple-400 hover:underline"
                    >
                      Get a key
                    </a>
                  </p>
                </div>
              )}

              {settings.provider === 'claude-agent' && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-medium uppercase">Claude Code SDK</label>
                  <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-3 text-sm text-amber-100">
                    Uses your local Claude Code login and the local AI gateway. No browser API key is required.
                  </div>
                </div>
              )}

              {settings.provider === 'codex-cli' && (
                <div className="space-y-2">
                  <label className="text-xs text-gray-400 font-medium uppercase">Codex CLI</label>
                  <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100">
                    Uses your local Codex CLI login and the local AI gateway. Browser API keys are not required.
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-xs text-gray-400 font-medium uppercase">Model</label>
                <select
                  value={settings.model}
                  onChange={(e) => onSettingsChange({ ...settings, model: e.target.value })}
                  className="w-full bg-[#0d1117] border border-gray-600 rounded-lg py-2 px-3 text-sm text-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  {availableModels.map((model) => (
                    <option key={model.id} value={model.id}>
                      {model.name}
                    </option>
                  ))}
                  {settings.provider === 'openrouter' && <option value="custom">Type a custom model...</option>}
                </select>

                {settings.provider === 'openrouter' && settings.model === 'custom' && (
                  <input
                    type="text"
                    placeholder="e.g. meta-llama/llama-3-70b-instruct"
                    className="mt-2 w-full bg-[#0d1117] border border-gray-600 rounded-lg py-2 px-3 text-sm text-gray-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                    onChange={(e) => onSettingsChange({ ...settings, model: e.target.value })}
                  />
                )}

                {(settings.provider === 'claude-agent' || settings.provider === 'codex-cli') && (
                  <p className="text-[10px] text-gray-500">
                    {isLoadingRemoteModels
                      ? `Loading available ${PROVIDER_LABEL[settings.provider]} models from the local agent...`
                      : `Model list is loaded from the local ${PROVIDER_LABEL[settings.provider]} channel when available.`}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="h-px bg-gray-800" />

          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Zap className="w-4 h-4 text-yellow-500" />
              Generation Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onSettingsChange({ ...settings, quality: 'exact' })}
                className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                  settings.quality === 'exact'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:bg-gray-750'
                }`}
              >
                Exact Match
                <div className="text-[10px] opacity-70 mt-1 font-normal">Strictly follow the image</div>
              </button>
              <button
                onClick={() => onSettingsChange({ ...settings, quality: 'creative' })}
                className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                  settings.quality === 'creative'
                    ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                    : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600 hover:bg-gray-750'
                }`}
              >
                Creative Polish
                <div className="text-[10px] opacity-70 mt-1 font-normal">Enhance design and fix issues</div>
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-300">AI Creativity Temperature</label>
              <span className="text-xs font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">
                {settings.temperature}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.temperature}
              onChange={(e) => onSettingsChange({ ...settings, temperature: parseFloat(e.target.value) })}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="flex justify-between text-[10px] text-gray-500 uppercase font-semibold tracking-wider">
              <span>Precise</span>
              <span>Balanced</span>
              <span>Creative</span>
            </div>
          </div>

          <div className="h-px bg-gray-800" />

          <div className="space-y-3">
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-gray-400" />
              Editor Preferences
            </label>
            <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg border border-gray-700">
              <span className="text-sm text-gray-300">Show Line Numbers</span>
              <button
                onClick={() => onSettingsChange({ ...settings, showLineNumbers: !settings.showLineNumbers })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#161b22] ${
                  settings.showLineNumbers ? 'bg-indigo-600' : 'bg-gray-700'
                }`}
              >
                <span
                  className={`${
                    settings.showLineNumbers ? 'translate-x-6' : 'translate-x-1'
                  } inline-block h-4 w-4 transform rounded-full bg-white transition-transform`}
                />
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors border border-gray-700"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
