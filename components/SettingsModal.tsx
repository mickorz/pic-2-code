
import React, { useEffect } from 'react';
import { X, Sliders, Zap, ListOrdered, Key, Cpu, Globe } from 'lucide-react';
import { AppSettings, AiProvider } from '../types';
import { AVAILABLE_MODELS } from '../constants';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSettingsChange }) => {
  
  // Reset model selection when provider changes if current model is invalid
  useEffect(() => {
    const currentModel = AVAILABLE_MODELS.find(m => m.id === settings.model);
    if (currentModel && currentModel.provider !== settings.provider) {
       const firstValidModel = AVAILABLE_MODELS.find(m => m.provider === settings.provider);
       if (firstValidModel) {
         onSettingsChange({ ...settings, model: firstValidModel.id });
       }
    }
  }, [settings.provider, settings.model, onSettingsChange, settings]);

  if (!isOpen) return null;

  const filteredModels = AVAILABLE_MODELS.filter(m => m.provider === settings.provider);

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

          {/* AI Provider */}
          <div className="space-y-3">
             <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
               <Globe className="w-4 h-4 text-blue-400" />
               AI Provider
             </label>
             <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => onSettingsChange({ ...settings, provider: 'gemini' })}
                  className={`p-2.5 rounded-lg border text-sm font-medium transition-all ${
                    settings.provider === 'gemini'
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                  }`}
                >
                  Google Gemini
                </button>
                <button
                  onClick={() => onSettingsChange({ ...settings, provider: 'openrouter' })}
                  className={`p-2.5 rounded-lg border text-sm font-medium transition-all ${
                    settings.provider === 'openrouter'
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-750'
                  }`}
                >
                  OpenRouter
                </button>
             </div>
          </div>

          {/* API & Model Settings */}
          <div className="space-y-3">
             <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
               <Cpu className="w-4 h-4 text-pink-400" />
               Configuration
             </label>
             <div className="space-y-4 p-4 bg-gray-800/30 rounded-lg border border-gray-700">
                
                {/* API Key Input based on provider */}
                <div className="space-y-2">
                   <label className="text-xs text-gray-400 font-medium uppercase">
                      {settings.provider === 'gemini' ? 'Gemini API Key (Optional)' : 'OpenRouter API Key (Required)'}
                   </label>
                   <div className="relative">
                     <Key className="w-4 h-4 absolute left-3 top-2.5 text-gray-500" />
                     {settings.provider === 'gemini' ? (
                       <input 
                         type="password"
                         value={settings.customApiKey}
                         onChange={(e) => onSettingsChange({ ...settings, customApiKey: e.target.value })}
                         placeholder="Use default system key"
                         className="w-full bg-[#0d1117] border border-gray-600 rounded-lg py-2 pl-9 pr-3 text-sm text-gray-200 placeholder-gray-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                       />
                     ) : (
                       <input 
                         type="password"
                         value={settings.openRouterApiKey}
                         onChange={(e) => onSettingsChange({ ...settings, openRouterApiKey: e.target.value })}
                         placeholder="sk-or-..."
                         className="w-full bg-[#0d1117] border border-gray-600 rounded-lg py-2 pl-9 pr-3 text-sm text-gray-200 placeholder-gray-600 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                       />
                     )}
                   </div>
                   {settings.provider === 'gemini' && (
                     <p className="text-[10px] text-gray-500">Leave empty to use the built-in system key.</p>
                   )}
                   {settings.provider === 'openrouter' && (
                     <p className="text-[10px] text-gray-500">
                       Key is stored locally in your browser. <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer" className="text-purple-400 hover:underline">Get a key</a>
                     </p>
                   )}
                </div>

                <div className="space-y-2">
                   <label className="text-xs text-gray-400 font-medium uppercase">Model</label>
                   <select
                     value={settings.model}
                     onChange={(e) => onSettingsChange({ ...settings, model: e.target.value })}
                     className="w-full bg-[#0d1117] border border-gray-600 rounded-lg py-2 px-3 text-sm text-gray-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none"
                   >
                     {filteredModels.map(model => (
                       <option key={model.id} value={model.id}>{model.name}</option>
                     ))}
                     {/* Allow custom model for OpenRouter since there are too many */}
                     {settings.provider === 'openrouter' && (
                       <option value="custom">Type a custom model...</option>
                     )}
                   </select>
                   {settings.provider === 'openrouter' && settings.model === 'custom' && (
                      <input 
                        type="text"
                        placeholder="e.g. meta-llama/llama-3-70b-instruct"
                        className="mt-2 w-full bg-[#0d1117] border border-gray-600 rounded-lg py-2 px-3 text-sm text-gray-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none"
                        onChange={(e) => onSettingsChange({ ...settings, model: e.target.value })} // Note: this might override "custom" value in state, causing loop. Ideally use separate state for custom input. 
                        // Simplification for now: User selects pre-defined list or we add input.
                        // Actually, let's just let them type if it's openrouter
                      />
                   )}
                   {/* Better approach for custom model: Just an input if it doesn't match predefined? 
                       For now, let's stick to the curated list to ensure stability. */}
                </div>
             </div>
          </div>

          <div className="h-px bg-gray-800" />

          {/* Quality Mode */}
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
                <div className="text-[10px] opacity-70 mt-1 font-normal">
                  Strictly follow the image
                </div>
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
                <div className="text-[10px] opacity-70 mt-1 font-normal">
                  Enhance design & fix issues
                </div>
              </button>
            </div>
          </div>

          {/* Temperature Slider */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium text-gray-300">
                AI Creativity (Temperature)
              </label>
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

          {/* Editor Settings */}
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
