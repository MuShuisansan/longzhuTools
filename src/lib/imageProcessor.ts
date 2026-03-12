import { BeadColor } from './palettes';

// Calculate color distance using Euclidean distance in RGB space
function colorDistance(rgb1: [number, number, number], rgb2: [number, number, number]): number {
  return Math.sqrt(
    Math.pow(rgb1[0] - rgb2[0], 2) +
    Math.pow(rgb1[1] - rgb2[1], 2) +
    Math.pow(rgb1[2] - rgb2[2], 2)
  );
}

// Find the closest bead color from a palette
function findClosestColor(r: number, g: number, b: number, palette: BeadColor[]): BeadColor {
  let minDistance = Infinity;
  let closestColor = palette[0];

  for (const color of palette) {
    const dist = colorDistance([r, g, b], color.rgb);
    if (dist < minDistance) {
      minDistance = dist;
      closestColor = color;
    }
  }

  return closestColor;
}

export type PixelData = {
  x: number;
  y: number;
  color: BeadColor;
};

export type ProcessedImage = {
  width: number;
  height: number;
  pixels: PixelData[];
  colorCounts: Record<string, { color: BeadColor; count: number }>;
};

export async function processImage(
  imageUrl: string,
  targetWidth: number,
  targetHeight: number,
  palette: BeadColor[],
  maxColors: number = 0
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Failed to get canvas context'));
        return;
      }

      // Calculate crop dimensions to maintain aspect ratio
      const imgAspect = img.width / img.height;
      const targetAspect = targetWidth / targetHeight;
      
      let sx = 0, sy = 0, sWidth = img.width, sHeight = img.height;
      
      if (imgAspect > targetAspect) {
        // Image is wider than target, crop horizontally
        sWidth = img.height * targetAspect;
        sx = (img.width - sWidth) / 2;
      } else {
        // Image is taller than target, crop vertically
        sHeight = img.width / targetAspect;
        sy = (img.height - sHeight) / 2;
      }

      // Draw image scaled down to target grid size, cropping to center
      ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetWidth, targetHeight);

      const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const data = imageData.data;

      const pixels: PixelData[] = [];
      let colorCounts: Record<string, { color: BeadColor; count: number }> = {};

      // First pass: map to full palette
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        let closestColor: BeadColor;
        if (a < 128) {
          closestColor = findClosestColor(255, 255, 255, palette);
        } else {
          closestColor = findClosestColor(r, g, b, palette);
        }

        const pixelIndex = i / 4;
        const x = pixelIndex % targetWidth;
        const y = Math.floor(pixelIndex / targetWidth);

        pixels.push({ x, y, color: closestColor });

        if (!colorCounts[closestColor.name]) {
          colorCounts[closestColor.name] = { color: closestColor, count: 0 };
        }
        colorCounts[closestColor.name].count++;
      }

      // Second pass: reduce colors if needed
      const uniqueColors = Object.values(colorCounts);
      if (maxColors > 0 && uniqueColors.length > maxColors) {
        // Sort by frequency descending
        uniqueColors.sort((a, b) => b.count - a.count);
        
        // Keep top N colors
        const keptColors = uniqueColors.slice(0, maxColors).map(c => c.color);
        const discardedColors = uniqueColors.slice(maxColors).map(c => c.color);
        
        // Create a mapping from discarded to closest kept color
        const colorMapping: Record<string, BeadColor> = {};
        for (const discarded of discardedColors) {
          colorMapping[discarded.id] = findClosestColor(discarded.rgb[0], discarded.rgb[1], discarded.rgb[2], keptColors);
        }

        // Reset counts
        colorCounts = {};
        for (const kept of keptColors) {
          colorCounts[kept.name] = { color: kept, count: 0 };
        }

        // Remap pixels
        for (const pixel of pixels) {
          if (colorMapping[pixel.color.id]) {
            pixel.color = colorMapping[pixel.color.id];
          }
          colorCounts[pixel.color.name].count++;
        }
      }

      resolve({
        width: targetWidth,
        height: targetHeight,
        pixels,
        colorCounts
      });
    };
    img.onerror = reject;
    img.src = imageUrl;
  });
}

// Helper to draw the processed image to a canvas (for preview)
export function drawProcessedImage(
  canvas: HTMLCanvasElement,
  processed: ProcessedImage,
  cellSize: number = 10,
  showGrid: boolean = false,
  backgroundColor: string = 'transparent',
  labelType?: 'MARD' | 'DMC'
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.imageSmoothingEnabled = false;

  canvas.width = processed.width * cellSize;
  canvas.height = processed.height * cellSize;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  if (backgroundColor !== 'transparent') {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // Draw pixels
  for (const pixel of processed.pixels) {
    ctx.fillStyle = pixel.color.hex;
    ctx.fillRect(pixel.x * cellSize, pixel.y * cellSize, cellSize, cellSize);
  }

  // Draw labels if requested and cellSize is large enough
  if (labelType && cellSize >= 12) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${Math.max(6, cellSize * 0.35)}px sans-serif`;
    
    for (const pixel of processed.pixels) {
      const label = labelType === 'MARD' ? pixel.color.mard : pixel.color.dmc;
      
      // Calculate contrast color (white or black)
      const [r, g, b] = pixel.color.rgb;
      const brightness = (r * 299 + g * 587 + b * 114) / 1000;
      ctx.fillStyle = brightness > 128 ? '#000000' : '#FFFFFF';
      
      ctx.fillText(
        label,
        pixel.x * cellSize + cellSize / 2,
        pixel.y * cellSize + cellSize / 2
      );
    }
  }

  // Draw grid
  if (showGrid) {
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.font = `bold ${Math.max(10, cellSize * 0.5)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let x = 0; x <= processed.width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * cellSize, 0);
      ctx.lineTo(x * cellSize, canvas.height);
      ctx.stroke();
      
      // Draw X coordinates every 5 cells
      if (x > 0 && x % 5 === 0 && x < processed.width) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.strokeText(x.toString(), x * cellSize, 10);
        ctx.fillText(x.toString(), x * cellSize, 10);
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
      }
    }
    for (let y = 0; y <= processed.height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * cellSize);
      ctx.lineTo(canvas.width, y * cellSize);
      ctx.stroke();

      // Draw Y coordinates every 5 cells
      if (y > 0 && y % 5 === 0 && y < processed.height) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.strokeText(y.toString(), 10, y * cellSize);
        ctx.fillText(y.toString(), 10, y * cellSize);
        ctx.strokeStyle = 'rgba(0,0,0,0.2)';
        ctx.lineWidth = 1;
      }
    }
  }
}

// Helper to draw the full blueprint for export
export function drawBlueprint(
  canvas: HTMLCanvasElement,
  processed: ProcessedImage,
  cellSize: number = 30,
  labelType: 'MARD' | 'DMC' = 'MARD'
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const margin = cellSize * 2;
  const legendItemWidth = cellSize * 3;
  const legendItemHeight = cellSize * 3;
  const itemsPerRow = Math.floor((processed.width * cellSize) / legendItemWidth);
  const colorCounts = (Object.values(processed.colorCounts) as { color: BeadColor; count: number }[])
    .sort((a, b) => b.count - a.count);
  
  const legendRows = Math.ceil(colorCounts.length / itemsPerRow);
  const legendHeight = legendRows * legendItemHeight + cellSize * 4;

  canvas.width = processed.width * cellSize + margin * 2;
  canvas.height = processed.height * cellSize + margin * 2 + legendHeight;

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(margin, margin);

  // Draw pixels and labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${cellSize * 0.35}px sans-serif`;

  for (const pixel of processed.pixels) {
    // Pixel
    ctx.fillStyle = pixel.color.hex;
    ctx.fillRect(pixel.x * cellSize, pixel.y * cellSize, cellSize, cellSize);

    // Label
    const label = labelType === 'MARD' ? pixel.color.mard : pixel.color.dmc;
    const [r, g, b] = pixel.color.rgb;
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    ctx.fillStyle = brightness > 128 ? '#000000' : '#FFFFFF';
    ctx.fillText(
      label,
      pixel.x * cellSize + cellSize / 2,
      pixel.y * cellSize + cellSize / 2
    );
  }

  // Draw Grid
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  for (let x = 0; x <= processed.width; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cellSize, 0);
    ctx.lineTo(x * cellSize, processed.height * cellSize);
    ctx.stroke();
  }
  for (let y = 0; y <= processed.height; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellSize);
    ctx.lineTo(processed.width * cellSize, y * cellSize);
    ctx.stroke();
  }

  // Draw Coordinates
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${cellSize * 0.4}px sans-serif`;

  // Top (1 to W)
  for (let x = 0; x < processed.width; x++) {
    ctx.fillText((x + 1).toString(), x * cellSize + cellSize / 2, -cellSize / 2);
  }
  // Left (1 to H)
  for (let y = 0; y < processed.height; y++) {
    ctx.fillText((y + 1).toString(), -cellSize / 2, y * cellSize + cellSize / 2);
  }
  // Right (H to 1)
  for (let y = 0; y < processed.height; y++) {
    ctx.fillText((processed.height - y).toString(), processed.width * cellSize + cellSize / 2, y * cellSize + cellSize / 2);
  }
  // Bottom (W to 1)
  for (let x = 0; x < processed.width; x++) {
    ctx.fillText((processed.width - x).toString(), x * cellSize + cellSize / 2, processed.height * cellSize + cellSize / 2);
  }

  ctx.restore();

  // Draw Legend
  const legendStartY = margin + processed.height * cellSize + margin;
  ctx.save();
  ctx.translate(margin, legendStartY);

  colorCounts.forEach((item, index) => {
    const row = Math.floor(index / itemsPerRow);
    const col = index % itemsPerRow;
    const x = col * legendItemWidth;
    const y = row * legendItemHeight;

    // Color Box
    ctx.fillStyle = item.color.hex;
    const boxSize = cellSize * 1.5;
    const boxX = x + (legendItemWidth - boxSize) / 2;
    const boxY = y + cellSize * 0.5;
    
    // Rounded rect for color box
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxSize, boxSize, 8);
    ctx.fill();
    ctx.strokeStyle = '#E5E7EB';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Label on top
    ctx.fillStyle = '#000000';
    ctx.font = `bold ${cellSize * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(labelType === 'MARD' ? item.color.mard : item.color.dmc, x + legendItemWidth / 2, y + cellSize * 0.3);

    // Count below
    ctx.font = `${cellSize * 0.5}px sans-serif`;
    ctx.fillText(item.count.toString(), x + legendItemWidth / 2, y + legendItemHeight - cellSize * 0.5);
  });

  // Total Count
  const total = processed.pixels.length;
  ctx.fillStyle = '#6B7280';
  ctx.font = `bold ${cellSize * 0.8}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(`- 总量: ${total} -`, canvas.width / 2, legendHeight - cellSize);

  ctx.restore();
}
