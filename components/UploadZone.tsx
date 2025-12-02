
import React, { useRef, useState, useEffect } from 'react';
import { UploadCloud, Image as ImageIcon, X, Maximize2, Plus } from 'lucide-react';
import { ImageFile } from '../types';

interface UploadZoneProps {
  selectedImage: ImageFile | null;
  onImageSelect: (file: ImageFile | null) => void;
  onImageClick?: () => void;
}

const UploadZone: React.FC<UploadZoneProps> = ({ selectedImage, onImageSelect, onImageClick }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      onImageSelect({
        preview: result,
        base64: base64,
        type: file.type
      });
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.indexOf('image') !== -1) {
            const file = items[i].getAsFile();
            if (file) {
              processFile(file);
            }
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
  };

  if (selectedImage) {
    return (
      <div className="relative rounded-xl overflow-hidden border border-gray-700 bg-gray-900 group">
        <img 
          src={selectedImage.preview} 
          alt="Preview of uploaded UI" 
          className="w-full h-auto max-h-64 object-contain mx-auto cursor-zoom-in"
          onClick={onImageClick}
        />
        
        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
        
        <div className="absolute top-2 right-2 flex gap-2">
          <button 
            onClick={(e) => { e.stopPropagation(); onImageClick?.(); }}
            className="p-2 bg-black/50 hover:bg-black/70 backdrop-blur rounded-full text-white transition-all transform hover:scale-105 opacity-0 group-hover:opacity-100"
            aria-label="View full size"
            title="View full size"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); onImageSelect(null); }}
            className="p-2 bg-black/50 hover:bg-red-500/80 backdrop-blur rounded-full text-white transition-all transform hover:scale-105"
            aria-label="Remove image"
            title="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => fileInputRef.current?.click()}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      aria-label="Upload image area. Drag and drop or click to select."
      className={`
        relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200
        flex flex-col items-center justify-center min-h-[200px] outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900
        ${isDragging 
          ? 'border-indigo-500 bg-indigo-500/5' 
          : 'border-gray-700 hover:border-gray-500 hover:bg-gray-800/30 bg-gray-900/50'
        }
      `}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
        aria-hidden="true"
      />
      <div className="w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center mb-4 shadow-xl shadow-black/20 group-hover:scale-110 transition-transform">
        {isDragging ? (
          <UploadCloud className="w-7 h-7 text-indigo-400" />
        ) : (
          <Plus className="w-7 h-7 text-gray-400" />
        )}
      </div>
      <h3 className="text-lg font-medium text-white mb-1">
        {isDragging ? 'Drop image here' : 'New Project'}
      </h3>
      <p className="text-gray-400 text-sm max-w-xs mx-auto">
        Upload a screenshot <span className="text-gray-500">or</span> just describe what you want below.
      </p>
      <div className="mt-4 flex gap-2 justify-center">
         <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded border border-gray-700">PNG</span>
         <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded border border-gray-700">JPG</span>
         <span className="text-[10px] bg-gray-800 text-gray-400 px-2 py-1 rounded border border-gray-700">Paste (Ctrl+V)</span>
      </div>
    </div>
  );
};

export default UploadZone;
