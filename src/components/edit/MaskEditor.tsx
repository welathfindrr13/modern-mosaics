'use client'

import React, { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import { Button } from '@/components/ui/button';

interface MaskEditorProps {
  src: string;
  onDone: (maskBlob: Blob) => void;
}

type MaskLine = {
  points: number[];
  brushSize: number;
};

export default function MaskEditor({ src, onDone }: MaskEditorProps) {
  const stageRef = useRef<Konva.Stage>(null);
  const maskLayerRef = useRef<Konva.Layer>(null);
  const [image] = useImage(src, 'anonymous');
  const [brushSize, setBrushSize] = useState(25);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lines, setLines] = useState<MaskLine[]>([]);
  const [hasMask, setHasMask] = useState(false);

  const CANVAS_WIDTH = 512;
  const CANVAS_HEIGHT = 512;

  const getPointerPosition = (e: any) => {
    const stage = e.target?.getStage?.() ?? stageRef.current;
    return stage?.getPointerPosition() ?? null;
  };

  const handleDrawStart = (e: any) => {
    e.evt?.preventDefault?.();
    const pos = getPointerPosition(e);
    if (!pos) return;

    setIsDrawing(true);
    setLines((currentLines) => [
      ...currentLines,
      { points: [pos.x, pos.y], brushSize },
    ]);
    setHasMask(true);
  };

  const handleDrawMove = (e: any) => {
    e.evt?.preventDefault?.();
    if (!isDrawing) return;

    const point = getPointerPosition(e);
    if (!point) return;

    setLines((currentLines) => {
      if (currentLines.length === 0) return currentLines;

      const lastLine = currentLines[currentLines.length - 1];
      const nextLine: MaskLine = {
        ...lastLine,
        points: lastLine.points.concat([point.x, point.y]),
      };

      return [...currentLines.slice(0, -1), nextLine];
    });
  };

  const handleDrawEnd = (e?: any) => {
    e?.evt?.preventDefault?.();
    setIsDrawing(false);
  };

  const clearMask = () => {
    setLines([]);
    setHasMask(false);
  };

  const undoLastStroke = () => {
    if (lines.length > 0) {
      const newLines = lines.slice(0, -1);
      setLines(newLines);
      setHasMask(newLines.length > 0);
    }
  };

  const exportMask = () => {
    if (!stageRef.current || !maskLayerRef.current) return;

    // Create a new stage for the mask only
    const maskStage = new Konva.Stage({
      container: document.createElement('div'),
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    });

    const maskLayer = new Konva.Layer();
    maskStage.add(maskLayer);

    // Fill background with black
    const background = new Konva.Rect({
      x: 0,
      y: 0,
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      fill: 'black',
    });
    maskLayer.add(background);

    // Add white brush strokes
    lines.forEach((line) => {
      const konvaLine = new Konva.Line({
        points: line.points,
        stroke: 'white',
        strokeWidth: line.brushSize,
        tension: 0.5,
        lineCap: 'round',
        lineJoin: 'round',
        globalCompositeOperation: 'source-over',
      });
      maskLayer.add(konvaLine);
    });

    maskLayer.batchDraw();

    // Export as blob
    maskStage.toCanvas().toBlob((blob) => {
      if (blob) {
        onDone(blob);
      }
      maskStage.destroy();
    }, 'image/png');
  };

  return (
    <div className="space-y-4">
      {/* Canvas Container */}
      <div className="relative bg-gray-100 rounded-lg overflow-hidden mx-auto" style={{ width: CANVAS_WIDTH, height: CANVAS_HEIGHT }}>
        <Stage
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onMouseDown={handleDrawStart}
          onMousemove={handleDrawMove}
          onMouseup={handleDrawEnd}
          onTouchStart={handleDrawStart}
          onTouchMove={handleDrawMove}
          onTouchEnd={handleDrawEnd}
          ref={stageRef}
        >
          {/* Image Layer */}
          <Layer>
            {image && (
              <KonvaImage
                image={image}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                listening={false}
              />
            )}
          </Layer>
          
          {/* Mask Layer */}
          <Layer ref={maskLayerRef}>
            {lines.map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke="rgba(255, 20, 147, 0.8)" // Deep pink with transparency
                strokeWidth={line.brushSize}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation="source-over"
              />
            ))}
          </Layer>
        </Stage>
        
        {/* Instructions overlay */}
        {!hasMask && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 text-white pointer-events-none">
            <div className="text-center">
              <p className="text-lg font-medium mb-2">🎨 Start painting!</p>
              <p className="text-sm">Click and drag to mark areas you want to change</p>
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-4">
        {/* Brush Size Control */}
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700 min-w-0 flex-shrink-0">
            Brush Size:
          </label>
          <input
            type="range"
            min="5"
            max="60"
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="flex-1"
          />
          <span className="text-sm text-gray-600 min-w-0 flex-shrink-0">
            {brushSize}px
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <Button
            onClick={undoLastStroke}
            variant="outline"
            disabled={lines.length === 0}
            className="flex-1"
          >
            Undo Last
          </Button>
          <Button
            onClick={clearMask}
            variant="outline"
            disabled={lines.length === 0}
            className="flex-1"
          >
            Clear All
          </Button>
          <Button
            onClick={exportMask}
            disabled={lines.length === 0}
            className="flex-1 bg-pink-600 hover:bg-pink-700"
          >
            Done ✓
          </Button>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="font-medium text-blue-900 mb-2">💡 Tips for better results:</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Paint precisely over the areas you want to change</li>
          <li>• Use a smaller brush for detailed areas like faces</li>
          <li>• Use a larger brush for backgrounds and clothing</li>
          <li>• You can undo individual strokes if you make a mistake</li>
        </ul>
      </div>
    </div>
  );
}
