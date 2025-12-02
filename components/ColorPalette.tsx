import React, { useState } from 'react';
import { Copy, Check, Palette } from 'lucide-react';

interface ColorPaletteProps {
  colors: string[];
  onColorSelect?: (color: string) => void;
}

const ColorPalette: React.FC<ColorPaletteProps> = ({ colors, onColorSelect }) => {
  const [copiedColor, setCopiedColor] = useState<string | null>(null);

  const handleCopy = (color: string) => {
    navigator.clipboard.writeText(color);
    setCopiedColor(color);
    if (onColorSelect) onColorSelect(color);
    setTimeout(() => setCopiedColor(null), 1500);
  };

  if (colors.length === 0) return null;

  return (
    <div className="bg-[#161b22] border border-gray-800 rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center gap-2 mb-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
        <Palette className="w-3.5 h-3.5" />
        Extracted Palette
      </div>
      <div className="flex gap-3 flex-wrap">
        {colors.map((color) => (
          <button
            key={color}
            onClick={() => handleCopy(color)}
            className="group relative flex flex-col items-center gap-2"
            title="Click to copy hex"
          >
            <div 
              className="w-10 h-10 rounded-full border-2 border-gray-700 shadow-lg transition-transform transform group-hover:scale-110 group-hover:border-white"
              style={{ backgroundColor: color }}
            />
            <span className="text-[10px] text-gray-500 font-mono opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-4 bg-black px-1 rounded">
              {copiedColor === color ? 'Copied!' : color}
            </span>
            {copiedColor === color && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Check className="w-4 h-4 text-white drop-shadow-md" />
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default ColorPalette;