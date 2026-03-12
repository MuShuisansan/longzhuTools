import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { PALETTES, PaletteName, BeadColor } from './lib/palettes';
import { processImage, ProcessedImage, drawProcessedImage, drawBlueprint } from './lib/imageProcessor';
import { Download, Settings, Grid, Palette, RefreshCw, FileText, Sparkles, Heart, Maximize, Languages, ChevronDown } from 'lucide-react';
import { cn } from './lib/utils';

const translations = {
  zh: {
    title: "PixelBeads",
    exportList: "清单导出",
    saveBlueprint: "保存图纸",
    ready: "图片已就绪",
    upload: "上传图片",
    changeImage: "更换图片",
    tryExamples: "或者试试这个示例：",
    currentRef: "当前参考图",
    settings: "参数设置",
    gridSize: "拼豆尺寸 (格数)",
    width: "宽",
    height: "高",
    paletteBrand: "色卡品牌",
    colorReduction: "色彩精简",
    fullColor: "全色",
    showGrid: "显示辅助网格",
    showLabels: "显示色号标识",
    generating: "魔法生成中...",
    generate: "生成像素图纸",
    preview: "拼豆图纸预览",
    processing: "魔法施展中...",
    brush: "画笔",
    autoFit: "自适应",
    materialList: "详细材料清单",
    exportText: "导出文本清单",
    beads: "颗",
    ctrlZoom: "Ctrl + 滚轮缩放",
    dragMove: "按住左键拖拽",
    selectColor: "选择颜色",
    example: "哆啦A梦",
  },
  en: {
    title: "PixelBeads",
    exportList: "Export List",
    saveBlueprint: "Save Blueprint",
    ready: "Image Ready",
    upload: "Upload Image",
    changeImage: "Change Image",
    tryExamples: "Or try this example:",
    currentRef: "Current Reference",
    settings: "Settings",
    gridSize: "Grid Size (Beads)",
    width: "Width",
    height: "Height",
    paletteBrand: "Palette Brand",
    colorReduction: "Color Reduction",
    fullColor: "Full",
    showGrid: "Show Grid",
    showLabels: "Show Labels",
    generating: "Generating...",
    generate: "Generate Blueprint",
    preview: "Blueprint Preview",
    processing: "Processing...",
    brush: "Brush",
    autoFit: "Auto Fit",
    materialList: "Material List",
    exportText: "Export Text List",
    beads: "pcs",
    ctrlZoom: "Ctrl + Scroll to Zoom",
    dragMove: "Drag to Move",
    selectColor: "Select Color",
    example: "Doraemon",
  }
};

export default function App() {
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const t = translations[lang];

  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [gridWidth, setGridWidth] = useState<number>(50);
  const [gridHeight, setGridHeight] = useState<number>(50);
  const [paletteName, setPaletteName] = useState<PaletteName>('MARD');
  const [maxColors, setMaxColors] = useState<number>(0); // 0 means unlimited
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processedData, setProcessedData] = useState<ProcessedImage | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [selectedColorForEdit, setSelectedColorForEdit] = useState<BeadColor | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleAutoFit = useCallback(() => {
    if (!containerRef.current || !processedData) return;

    const container = containerRef.current;
    const padding = 64; // Total padding (p-8 on both sides)
    const availableWidth = container.clientWidth - padding;
    const availableHeight = container.clientHeight - padding;

    if (availableWidth <= 0 || availableHeight <= 0) return;

    const baseCellSize = 30;
    const gap = 48; // gap-12
    
    // In 1:1 mode, we always fit to the container's square bounds
    const contentWidth = processedData.width * baseCellSize;
    const contentHeight = processedData.height * baseCellSize;

    const scaleX = availableWidth / contentWidth;
    const scaleY = availableHeight / contentHeight;
    
    // Fit to the smaller dimension to ensure full visibility
    const newZoom = Math.min(scaleX, scaleY);
    setZoom(Math.min(Math.max(newZoom, 0.05), 5));
    setOffset({ x: 0, y: 0 });
  }, [processedData]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(prev => Math.min(Math.max(prev * factor, 0.05), 10));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (selectedColorForEdit) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    setOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleImageUpload = (file: File, url: string) => {
    setImageUrl(url);
    setProcessedData(null);
    setSelectedColorForEdit(null);
  };

  const prevDimensions = useRef({ w: 0, h: 0 });

  useEffect(() => {
    if (processedData) {
      if (processedData.width !== prevDimensions.current.w || processedData.height !== prevDimensions.current.h) {
        prevDimensions.current = { w: processedData.width, h: processedData.height };
        const timer = setTimeout(handleAutoFit, 100);
        return () => clearTimeout(timer);
      }
    } else {
      prevDimensions.current = { w: 0, h: 0 };
    }
  }, [processedData, handleAutoFit]);

  useEffect(() => {
    window.addEventListener('resize', handleAutoFit);
    return () => window.removeEventListener('resize', handleAutoFit);
  }, [handleAutoFit]);

  const handleGenerate = useCallback(async () => {
    if (!imageUrl) return;
    setIsProcessing(true);
    try {
      const result = await processImage(imageUrl, gridWidth, gridHeight, PALETTES[paletteName], maxColors);
      setProcessedData(result);
      setSelectedColorForEdit(null);
    } catch (error) {
      console.error('Failed to process image:', error);
      alert('Failed to process image. Please try another one.');
    } finally {
      setIsProcessing(false);
    }
  }, [imageUrl, gridWidth, gridHeight, paletteName, maxColors]);

  useEffect(() => {
    if (!imageUrl) {
      setProcessedData(null);
    }
  }, [imageUrl]);

  useEffect(() => {
    if (processedData && canvasRef.current) {
      const baseCellSize = 30;
      drawProcessedImage(canvasRef.current, processedData, baseCellSize, showGrid, 'transparent', showLabels ? paletteName : undefined);
    }
  }, [processedData, showGrid, showLabels, paletteName]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!processedData || !selectedColorForEdit || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;

    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    const baseCellSize = 30;
    const gridX = Math.floor(x / baseCellSize);
    const gridY = Math.floor(y / baseCellSize);

    // Find the pixel and update it
    const newPixels = [...processedData.pixels];
    const pixelIndex = newPixels.findIndex(p => p.x === gridX && p.y === gridY);
    
    if (pixelIndex !== -1) {
      const oldColor = newPixels[pixelIndex].color;
      if (oldColor.id === selectedColorForEdit.id) return; // No change

      newPixels[pixelIndex] = { ...newPixels[pixelIndex], color: selectedColorForEdit };

      // Update color counts
      const newColorCounts = { ...processedData.colorCounts };
      
      // Decrement old color
      if (newColorCounts[oldColor.name]) {
        newColorCounts[oldColor.name].count--;
        if (newColorCounts[oldColor.name].count === 0) {
          delete newColorCounts[oldColor.name];
        }
      }

      // Increment new color
      if (!newColorCounts[selectedColorForEdit.name]) {
        newColorCounts[selectedColorForEdit.name] = { color: selectedColorForEdit, count: 0 };
      }
      newColorCounts[selectedColorForEdit.name].count++;

      const newData = {
        ...processedData,
        pixels: newPixels,
        colorCounts: newColorCounts
      };
      
      setProcessedData(newData);
    }
  };

  const handleExportImage = () => {
    if (!canvasRef.current || !processedData) return;
    
    // Create a high-res canvas for export
    const exportCanvas = document.createElement('canvas');
    drawBlueprint(exportCanvas, processedData, 30, paletteName); // 30px per cell for high res, includes legend and coordinates
    
    const link = document.createElement('a');
    link.download = `pixel-beads-blueprint-${Date.now()}.png`;
    link.href = exportCanvas.toDataURL('image/png');
    link.click();
  };

  const handleExportList = () => {
    if (!processedData) return;
    
    const colors = (Object.values(processedData.colorCounts) as { color: BeadColor; count: number }[]).sort((a, b) => b.count - a.count);
    
    let content = 'Pixel Beads Material List\n';
    content += '=========================\n\n';
    content += `Grid Size: ${gridWidth} x ${gridHeight}\n`;
    content += `Palette: ${paletteName}\n\n`;
    content += 'Color Name\tHex\tCount\n';
    content += '----------------------------------------\n';
    
    colors.forEach(({ color, count }) => {
      content += `${color.name}\t${color.hex}\t${count}\n`;
    });
    
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `beads-list-${Date.now()}.txt`;
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 text-slate-800 font-sans flex flex-col selection:bg-pink-200 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]">
      <header className="bg-white/90 backdrop-blur-md border-b-2 border-pink-200 py-3 px-6 flex items-center justify-between sticky top-0 z-30 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-400 to-purple-500 flex items-center justify-center text-white shadow-md transform rotate-3 hover:rotate-6 transition-transform">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600">
            {t.title}
          </h1>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => setLang(l => l === 'zh' ? 'en' : 'zh')}
            className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-all"
          >
            <Languages className="w-4 h-4" />
            {lang === 'zh' ? 'English' : '中文'}
          </button>

          {processedData && (
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportList}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-pink-600 bg-pink-50 border-2 border-pink-200 rounded-xl hover:bg-pink-100 hover:border-pink-300 transition-all active:scale-95"
              >
                <FileText className="w-4 h-4" />
                {t.exportList}
              </button>
              <button
                onClick={handleExportImage}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl hover:from-pink-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg active:scale-95"
              >
                <Download className="w-4 h-4" />
                {t.saveBlueprint}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 max-w-[1400px] w-full mx-auto p-4 sm:p-6 flex flex-col gap-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          {/* Top Section: Upload & Preview (Single Block) */}
          <section className="bg-white p-6 rounded-3xl shadow-sm border-2 border-pink-100 flex flex-col">
            <div className="flex-1 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-500 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pink-500" />
                {imageUrl ? t.ready : t.upload}
              </h2>
              {imageUrl && (
                <button 
                  onClick={() => setImageUrl(null)}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold text-pink-600 bg-pink-50 rounded-xl hover:bg-pink-100 transition-colors"
                >
                  <RefreshCw className="w-3 h-3" />
                  {t.changeImage}
                </button>
              )}
            </div>

            <div className="relative min-h-[200px] flex flex-col items-center justify-center">
              {!imageUrl ? (
                <div className="w-full space-y-6">
                  <ImageUploader 
                    onImageUpload={handleImageUpload} 
                    className="border-pink-200 hover:border-pink-400 hover:bg-pink-50/50 rounded-2xl py-12 transition-all" 
                  />
                  <div className="flex flex-col items-center gap-3">
                    <h3 className="text-xs font-bold text-slate-400 flex items-center gap-2">
                      {t.tryExamples}
                    </h3>
                    <div className="flex gap-3">
                      {[
                        { name: t.example, url: '/static/demo.jpg' }
                      ].map(example => (
                        <button
                          key={example.name}
                          onClick={() => handleImageUpload(new File([], 'example.jpg'), example.url)}
                          className="group relative w-16 h-16 rounded-xl overflow-hidden border-2 border-pink-100 hover:border-pink-400 transition-all shadow-sm hover:shadow-md"
                        >
                          <img src={example.url} alt={example.name} className="w-full h-full object-cover" crossOrigin="anonymous" />
                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="w-full max-w-md mx-auto relative group">
                  <div className="w-full aspect-square rounded-2xl overflow-hidden border-4 border-pink-100 shadow-lg ring-4 ring-white bg-slate-50 flex items-center justify-center">
                    <img src={imageUrl} alt="Original" className="max-w-full max-h-full object-contain" />
                  </div>
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-2xl">
                    <p className="text-white font-black text-sm flex items-center gap-2">
                      <Heart className="w-4 h-4 fill-pink-500 text-pink-500" />
                      {t.currentRef}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Middle Section: Settings */}
        <section className={cn("bg-white p-6 rounded-3xl shadow-sm border-2 border-pink-100 transition-opacity duration-300 flex flex-col", !imageUrl && "opacity-50 pointer-events-none")}>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-6">
              <Settings className="w-6 h-6 text-purple-600 animate-[spin_4s_linear_infinite]" />
              <h2 className="text-xl font-black text-slate-800">{t.settings}</h2>
            </div>
            
            <div className="grid grid-cols-1 gap-8">
            {/* Basic Settings */}
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                  <Grid className="w-4 h-4 text-purple-400" />
                  {t.gridSize}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    min="10"
                    max="200"
                    value={gridWidth}
                    onChange={(e) => setGridWidth(Number(e.target.value) || 50)}
                    className="w-full px-3 py-2 border-2 border-pink-100 rounded-xl text-sm font-bold focus:ring-4 focus:ring-pink-100 focus:border-pink-400 transition-all outline-none"
                    placeholder={t.width}
                  />
                  <input
                    type="number"
                    min="10"
                    max="200"
                    value={gridHeight}
                    onChange={(e) => setGridHeight(Number(e.target.value) || 50)}
                    className="w-full px-3 py-2 border-2 border-pink-100 rounded-xl text-sm font-bold focus:ring-4 focus:ring-pink-100 focus:border-pink-400 transition-all outline-none"
                    placeholder={t.height}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {[30, 50, 80, 100].map(size => (
                    <button
                      key={size}
                      onClick={() => { setGridWidth(size); setGridHeight(size); }}
                      className={cn(
                        "px-3 py-1.5 text-[10px] rounded-lg border-2 transition-all font-bold",
                        gridWidth === size && gridHeight === size 
                          ? "bg-pink-100 border-pink-400 text-pink-700" 
                          : "bg-white border-pink-50 text-slate-400 hover:border-pink-200"
                      )}
                    >
                      {size}x{size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                  <Palette className="w-4 h-4 text-pink-400" />
                  {t.paletteBrand}
                </label>
                <select
                  value={paletteName}
                  onChange={(e) => setPaletteName(e.target.value as PaletteName)}
                  className="w-full px-3 py-2 border-2 border-pink-100 rounded-xl text-sm font-bold focus:ring-4 focus:ring-pink-100 focus:border-pink-400 transition-all outline-none bg-white"
                >
                  <option value="MARD">MARD {lang === 'zh' ? '色卡' : 'Palette'}</option>
                  <option value="DMC">DMC {lang === 'zh' ? '色卡' : 'Palette'}</option>
                </select>
              </div>
            </div>

            {/* Advanced Settings */}
            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-sm font-bold text-slate-600 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-pink-400" />
                  {t.colorReduction}
                </label>
                <div className="grid grid-cols-5 gap-1.5">
                  {[8, 16, 32, 64, 0].map((count) => (
                    <button
                      key={count}
                      onClick={() => setMaxColors(count)}
                      className={cn(
                        "py-2 rounded-xl text-[10px] font-black transition-all border-2",
                        maxColors === count
                          ? "bg-pink-500 border-pink-500 text-white shadow-md"
                          : "bg-white border-pink-50 text-slate-400 hover:border-pink-200"
                      )}
                    >
                      {count === 0 ? t.fullColor : `${count}${lang === 'zh' ? '色' : ' Colors'}`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} className="sr-only" />
                    <div className={cn("w-10 h-6 rounded-full transition-colors", showGrid ? "bg-pink-400" : "bg-slate-200")}></div>
                    <div className={cn("absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm", showGrid ? "translate-x-4" : "translate-x-0")}></div>
                  </div>
                  <span className="text-sm font-bold text-slate-600 group-hover:text-pink-500 transition-colors">{t.showGrid}</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} className="sr-only" />
                    <div className={cn("w-10 h-6 rounded-full transition-colors", showLabels ? "bg-purple-400" : "bg-slate-200")}></div>
                    <div className={cn("absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm", showLabels ? "translate-x-4" : "translate-x-0")}></div>
                  </div>
                  <span className="text-sm font-bold text-slate-600 group-hover:text-purple-500 transition-colors">{t.showLabels}</span>
                </label>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 flex justify-center">
            <button
              onClick={handleGenerate}
              disabled={!imageUrl || isProcessing}
              className={cn(
                "group relative flex items-center gap-3 px-12 py-4 text-lg font-black text-white rounded-2xl transition-all shadow-xl active:scale-95",
                imageUrl && !isProcessing 
                  ? "bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 hover:shadow-pink-200/50 hover:-translate-y-1" 
                  : "bg-slate-200 cursor-not-allowed shadow-none"
              )}
            >
              <Sparkles className={cn("w-6 h-6", isProcessing && "animate-spin")} />
              {isProcessing ? t.generating : t.generate}
              {imageUrl && !isProcessing && (
                <div className="absolute inset-0 rounded-2xl bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
          </div>
        </section>
      </div>

      {/* Bottom Section: Result */}
        <section className={cn("space-y-6 transition-all duration-500", !processedData ? "hidden" : "block opacity-100 translate-y-0")}>
          <div className="bg-white rounded-3xl shadow-xl border-2 border-pink-100 overflow-hidden flex flex-col">
            {/* Toolbar */}
            <div className="bg-white/90 backdrop-blur-sm border-b-2 border-pink-100 p-4 flex flex-col sm:flex-row items-center justify-between gap-4 z-20">
              <div className="flex items-center gap-4">
                <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-purple-600 flex items-center gap-2">
                  <Sparkles className="w-6 h-6 text-pink-500" />
                  {t.preview}
                </span>
                {isProcessing && (
                  <span className="flex items-center gap-2 text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-full border border-purple-100 animate-pulse">
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    {t.processing}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                {processedData && (
                  <div className="relative">
                    <button
                      onClick={() => setShowColorPicker(!showColorPicker)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl border-2 transition-all active:scale-95",
                        selectedColorForEdit 
                          ? "bg-purple-50 border-purple-400 text-purple-600" 
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:border-purple-200"
                      )}
                    >
                      <Palette className="w-4 h-4" />
                      {t.brush}
                      {selectedColorForEdit && (
                        <div className="w-3 h-3 rounded-full border border-white shadow-sm" style={{ backgroundColor: selectedColorForEdit.hex }} />
                      )}
                      <ChevronDown className={cn("w-4 h-4 transition-transform", showColorPicker && "rotate-180")} />
                    </button>

                    {showColorPicker && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setShowColorPicker(false)} />
                        <div className="absolute top-full mt-2 right-0 w-[280px] bg-white rounded-2xl shadow-2xl border-2 border-purple-100 p-4 z-20 animate-in fade-in zoom-in duration-200">
                          <h4 className="text-xs font-black text-slate-400 mb-3 uppercase tracking-wider">{t.selectColor}</h4>
                          <div className="grid grid-cols-4 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                            {PALETTES[paletteName].map(color => (
                              <button
                                key={color.id}
                                onClick={() => {
                                  setSelectedColorForEdit(selectedColorForEdit?.id === color.id ? null : color);
                                  setShowColorPicker(false);
                                }}
                                className={cn(
                                  "flex flex-col items-center gap-1 p-1 rounded-lg border-2 transition-all hover:bg-slate-50",
                                  selectedColorForEdit?.id === color.id 
                                    ? "border-purple-500 bg-purple-50/50" 
                                    : "border-transparent hover:border-slate-200"
                                )}
                                title={color.name}
                              >
                                <div 
                                  className="w-full aspect-square rounded-md border shadow-sm"
                                  style={{ backgroundColor: color.hex }}
                                />
                                <span className="text-[9px] font-black text-slate-600 truncate w-full text-center">
                                  {paletteName === 'MARD' ? color.mard : color.dmc}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                  <button 
                    onClick={handleAutoFit}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-pink-50 hover:text-pink-600 transition-colors shadow-sm"
                    title={t.autoFit}
                  >
                    <Maximize className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-slate-200" />
                  <button onClick={() => setZoom(z => Math.max(0.05, z * 0.9))} className="w-8 h-8 font-bold text-slate-600 hover:text-pink-600">-</button>
                  <span className="text-xs font-black font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={() => setZoom(z => Math.min(5, z * 1.1))} className="w-8 h-8 font-bold text-slate-600 hover:text-pink-600">+</button>
                </div>
                
                <button
                  onClick={handleExportImage}
                  className="flex items-center gap-2 px-6 py-2 text-sm font-black text-white bg-gradient-to-r from-pink-500 to-purple-500 rounded-xl hover:from-pink-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg active:scale-95"
                >
                  <Download className="w-4 h-4" />
                  {t.saveBlueprint}
                </button>
              </div>
            </div>

            {/* Canvas Container - Fixed 1:1 Aspect Ratio */}
            <div className="w-full aspect-square max-h-[800px] relative">
              <div 
                ref={containerRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                className={cn(
                  "absolute inset-0 overflow-hidden bg-pink-50/30 p-8 touch-none",
                  !selectedColorForEdit && "cursor-grab active:cursor-grabbing"
                )}
              >
                {/* Operation Hints */}
                <div className="absolute top-4 right-4 z-20 flex flex-col gap-1 pointer-events-none">
                  <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 flex items-center gap-2">
                    <kbd className="bg-white/20 px-1.5 py-0.5 rounded text-[10px] font-bold text-white">Ctrl</kbd>
                    <span className="text-white/80 text-[10px] font-bold">+ {t.ctrlZoom.split('+ ')[1]}</span>
                  </div>
                  <div className="bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/20 flex items-center gap-2">
                    <span className="text-white/80 text-[10px] font-bold">{t.dragMove}</span>
                  </div>
                </div>

                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div 
                    className="relative bg-white shadow-2xl rounded-sm ring-8 ring-white border-4 border-purple-100 transition-transform duration-200 ease-out pointer-events-auto"
                    style={{ 
                      transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
                    }}
                  >
                    <canvas 
                      ref={canvasRef} 
                      onClick={handleCanvasClick}
                      className={cn("block", selectedColorForEdit ? "cursor-crosshair" : "cursor-default")}
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Legend (Detailed) */}
          {processedData && (
            <div className="bg-white p-8 rounded-3xl shadow-sm border-2 border-pink-100">
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                  <FileText className="w-6 h-6 text-pink-500" />
                  {t.materialList}
                </h3>
                <button 
                  onClick={handleExportList}
                  className="px-6 py-2 bg-pink-50 text-pink-600 rounded-xl font-black text-sm border-2 border-pink-100 hover:bg-pink-100 transition-all"
                >
                  {t.exportText}
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {(Object.values(processedData.colorCounts) as { color: BeadColor; count: number }[])
                  .sort((a, b) => b.count - a.count)
                  .map(({ color, count }) => (
                    <div key={color.id} className="flex items-center justify-between p-4 rounded-2xl border-2 border-slate-100 hover:border-pink-200 transition-all group">
                      <div className="flex items-center gap-4">
                        <div 
                          className="w-10 h-10 rounded-full border-4 border-white shadow-md group-hover:scale-110 transition-transform"
                          style={{ backgroundColor: color.hex }}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-700">{paletteName === 'MARD' ? color.mard : color.dmc}</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                            {paletteName === 'MARD' ? `DMC: ${color.dmc}` : `MARD: ${color.mard}`}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-lg font-black text-pink-500">x{count}</span>
                        <p className="text-[8px] font-bold text-slate-300">{t.beads}</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

