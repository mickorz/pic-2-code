export const extractColors = (imageSrc: string): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = imageSrc;

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject('Could not get canvas context');
        return;
      }

      // Resize for faster processing
      const width = 100;
      const height = (img.height / img.width) * width;
      canvas.width = width;
      canvas.height = height;

      ctx.drawImage(img, 0, 0, width, height);

      const imageData = ctx.getImageData(0, 0, width, height).data;
      const colorCounts: Record<string, number> = {};

      for (let i = 0; i < imageData.length; i += 4) {
        const r = imageData[i];
        const g = imageData[i + 1];
        const b = imageData[i + 2];
        const a = imageData[i + 3];

        if (a < 128) continue; // Skip transparent pixels

        // Quantize colors to reduce noise (round to nearest 32)
        const qR = Math.round(r / 32) * 32;
        const qG = Math.round(g / 32) * 32;
        const qB = Math.round(b / 32) * 32;

        const hex = `#${((1 << 24) + (qR << 16) + (qG << 8) + qB).toString(16).slice(1).toUpperCase()}`;
        colorCounts[hex] = (colorCounts[hex] || 0) + 1;
      }

      // Sort by frequency
      const sortedColors = Object.entries(colorCounts)
        .sort(([, a], [, b]) => b - a)
        .map(([hex]) => hex)
        .slice(0, 5); // Top 5 colors

      resolve(sortedColors);
    };

    img.onerror = (err) => reject(err);
  });
};