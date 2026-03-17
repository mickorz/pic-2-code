
import React from 'react';
import { X, BookOpen, Layers, Palette, MousePointer } from 'lucide-react';
import { CodeExplanation } from '../services/ai';

interface ExplainModalProps {
  isOpen: boolean;
  onClose: () => void;
  explanation: CodeExplanation | null;
  isLoading: boolean;
}

const ExplainModal: React.FC<ExplainModalProps> = ({ isOpen, onClose, explanation, isLoading }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#161b22] border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl p-6 relative animate-in zoom-in-95 duration-200 mx-4 max-h-[85vh] flex flex-col">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6 flex-shrink-0">
          <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <BookOpen className="w-6 h-6 text-indigo-400" />
          </div>
          <h2 className="text-xl font-bold text-white">Code Explanation</h2>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="w-12 h-12 rounded-full border-4 border-indigo-500/30 border-t-indigo-500 animate-spin"></div>
              <p className="text-gray-400 animate-pulse">Analyzing structure and styles...</p>
            </div>
          ) : explanation ? (
            <div className="space-y-8">
              <div className="bg-gray-800/50 p-4 rounded-lg border border-gray-700">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-2">Summary</h3>
                <p className="text-gray-200 leading-relaxed">{explanation.summary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-blue-400 uppercase tracking-wider mb-3">
                    <Layers className="w-4 h-4" /> Structure
                  </h3>
                  <ul className="space-y-2">
                    {explanation.structure.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-300">
                        <span className="text-blue-500/50">•</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-pink-400 uppercase tracking-wider mb-3">
                    <Palette className="w-4 h-4" /> Styling
                  </h3>
                  <ul className="space-y-2">
                    {explanation.styling.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-300">
                        <span className="text-pink-500/50">•</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {explanation.interactivity.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-yellow-400 uppercase tracking-wider mb-3">
                    <MousePointer className="w-4 h-4" /> Interactivity
                  </h3>
                  <ul className="grid grid-cols-1 gap-2">
                    {explanation.interactivity.map((item, i) => (
                      <li key={i} className="flex gap-2 text-sm text-gray-300 bg-gray-800/30 p-2 rounded border border-gray-800">
                        <span className="text-yellow-500">•</span> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-red-400 py-10">
              Failed to load explanation.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExplainModal;
