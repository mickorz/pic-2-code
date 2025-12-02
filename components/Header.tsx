import React from 'react';
import { Code2, Github, Moon, Sun, Settings, Share2 } from 'lucide-react';
import Button from './Button';

interface HeaderProps {
  isDarker: boolean;
  toggleTheme: () => void;
  onOpenSettings: () => void;
  onShare?: () => void;
  hasContent?: boolean;
}

const Header: React.FC<HeaderProps> = ({ isDarker, toggleTheme, onOpenSettings, onShare, hasContent }) => {
  return (
    <header className={`border-b border-gray-800 ${isDarker ? 'bg-black/95' : 'bg-[#0d1117]/95'} backdrop-blur sticky top-0 z-50 transition-colors duration-300`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-500/10 p-2 rounded-lg border border-indigo-500/20" aria-hidden="true">
            <Code2 className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Pic2Code</h1>
            <p className="text-xs text-gray-400 font-mono">Image {'->'} HTML + Tailwind {'->'} React or Flutter or React Native</p>
          </div>
        </div>
        <nav className="flex items-center gap-2" aria-label="Main Navigation">
          {hasContent && (
            <Button
              size="sm"
              variant="secondary"
              onClick={onShare}
              icon={<Share2 className="w-4 h-4" />}
              className="mr-2"
            >
              Share
            </Button>
          )}
          <button
            onClick={onOpenSettings}
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-md hover:bg-gray-800"
            aria-label="Settings"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button
            onClick={toggleTheme}
            className="text-gray-400 hover:text-white transition-colors p-2 rounded-md hover:bg-gray-800"
            aria-label={isDarker ? "Switch to Default Theme" : "Switch to Darker Theme"}
          >
            {isDarker ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <a
            href="#"
            className="text-gray-400 hover:text-white transition-colors p-2"
            aria-label="View on GitHub"
          >
            <Github className="w-5 h-5" />
          </a>
        </nav>
      </div>
    </header>
  );
};

export default Header;