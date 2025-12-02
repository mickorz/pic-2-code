
import React, { useEffect } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
}

const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, imageUrl }) => {
  const [scale, setScale] = React.useState(1);
  const [isDragging, setIsDragging] = React.useState(false);
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = React.useState({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setScale(1);
      setPosition({ x: 0, y: 0 });
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = e.deltaY * -0.01;
    setScale(Math.min(Math.max(0.5, scale + delta), 4));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({ x: e.clientX - startPos.x, y: e.clientY - startPos.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        <div className="bg-gray-800 rounded-lg flex overflow-hidden border border-gray-700">
          <button 
            onClick={() => setScale(Math.max(0.5, scale - 0.25))}
            className="p-2 hover:bg-gray-700 text-white transition-colors"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          <div className="w-px bg-gray-700"></div>
          <button 
            onClick={() => setScale(Math.min(4, scale + 0.25))}
            className="p-2 hover:bg-gray-700 text-white transition-colors"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
        </div>
        <button 
          onClick={onClose}
          className="p-2 bg-gray-800 hover:bg-red-500/80 rounded-lg text-white transition-colors border border-gray-700"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
      
      <div 
        className="w-full h-full flex items-center justify-center overflow-hidden cursor-move"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img 
          src={imageUrl} 
          alt="Full size preview"
          style={{ 
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out'
          }}
          className="max-w-[90vw] max-h-[90vh] object-contain select-none"
          draggable={false}
        />
      </div>
    </div>
  );
};

export default ImageModal;
