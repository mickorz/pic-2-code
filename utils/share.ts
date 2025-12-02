import LZString from 'lz-string';

export const generateShareUrl = (code: string, prompt: string) => {
  const data = JSON.stringify({ code, prompt });
  const compressed = LZString.compressToEncodedURIComponent(data);
  const url = new URL(window.location.href);
  url.hash = `share=${compressed}`;
  return url.toString();
};

export const loadFromShareUrl = () => {
  const hash = window.location.hash;
  if (hash.includes('share=')) {
    try {
      const compressed = hash.split('share=')[1];
      const decompressed = LZString.decompressFromEncodedURIComponent(compressed);
      if (decompressed) {
        return JSON.parse(decompressed) as { code: string; prompt: string };
      }
    } catch (e) {
      console.error("Failed to load from share URL", e);
    }
  }
  return null;
};
