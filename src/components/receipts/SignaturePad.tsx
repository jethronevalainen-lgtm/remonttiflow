import { useCallback, useEffect, useRef } from 'react';
import { Eraser } from 'lucide-react';

import { Button } from '@/components/ui/button';

interface SignaturePadProps {
  onChange: (signature: Blob | null) => void;
}

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 260;

export default function SignaturePad({ onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const emptyRef = useRef(true);

  const resetCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = '#0f172a';
    context.lineWidth = 5;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    emptyRef.current = true;
    onChange(null);
  }, [onChange]);

  useEffect(() => {
    resetCanvas();
  }, [resetCanvas]);

  const pointFromEvent = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const point = pointFromEvent(event);
    event.currentTarget.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(point.x, point.y);
    drawingRef.current = true;
    emptyRef.current = false;
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = event.currentTarget.getContext('2d');
    if (!context) return;
    const point = pointFromEvent(event);
    context.lineTo(point.x, point.y);
    context.stroke();
  };

  const finishDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (emptyRef.current) {
      onChange(null);
      return;
    }
    event.currentTarget.toBlob((blob) => onChange(blob), 'image/png');
  };

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-lg border border-slate-300 bg-white">
        <canvas
          ref={canvasRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          aria-label="Allekirjoituskenttä"
          className="h-40 w-full cursor-crosshair touch-none bg-white sm:h-44"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerUp={finishDrawing}
          onPointerCancel={finishDrawing}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-text-muted">Allekirjoita sormella, hiirellä tai kosketuskynällä.</p>
        <Button type="button" variant="outline" size="sm" onClick={resetCanvas} className="gap-1.5">
          <Eraser size={14} /> Tyhjennä
        </Button>
      </div>
    </div>
  );
}
