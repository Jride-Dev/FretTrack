import { useEffect, useMemo, useRef, useState } from 'react';

const tools = [
  ['select', 'Select/move'],
  ['pen', 'Pen'],
  ['arrow', 'Arrow'],
  ['circle', 'Circle'],
  ['rectangle', 'Rectangle'],
  ['text', 'Text'],
  ['crop', 'Crop'],
  ['magic', 'Magic wand'],
  ['erase', 'Erase'],
  ['restore', 'Restore']
];

const drawColors = ['#facc15', '#ef4444', '#22c55e', '#38bdf8', '#ffffff', '#111827'];

export default function PhotoEditorModal({
  image,
  isOpen,
  isSaving = false,
  onClose,
  onSaveCopy,
  onOverwrite
}) {
  const canvasRef = useRef(null);
  const baseCanvasRef = useRef(null);
  const originalCanvasRef = useRef(null);
  const dragRef = useRef(null);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#facc15');
  const [lineWidth, setLineWidth] = useState(6);
  const [captionText, setCaptionText] = useState('Damage noted');
  const [brightness, setBrightness] = useState(0);
  const [tolerance, setTolerance] = useState(32);
  const [feather, setFeather] = useState(1);
  const [brushSize, setBrushSize] = useState(28);
  const [annotations, setAnnotations] = useState([]);
  const [cropRect, setCropRect] = useState(null);
  const [selection, setSelection] = useState(null);
  const [history, setHistory] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [toolsUsed, setToolsUsed] = useState([]);
  const [loadError, setLoadError] = useState('');

  const canSave = Boolean(image?.url) && !loadError && !isSaving;
  const selectionCount = useMemo(() => selection?.mask?.reduce((count, selected) => count + (selected ? 1 : 0), 0) || 0, [selection]);

  useEffect(() => {
    if (!isOpen || !image?.url) {
      return;
    }

    let cancelled = false;
    setLoadError('');
    setAnnotations([]);
    setCropRect(null);
    setSelection(null);
    setHistory([]);
    setRedoStack([]);
    setToolsUsed([]);
    setBrightness(0);

    const source = new Image();
    source.crossOrigin = 'anonymous';
    source.onload = () => {
      if (cancelled) {
        return;
      }
      const width = Math.max(1, source.naturalWidth || source.width);
      const height = Math.max(1, source.naturalHeight || source.height);
      const baseCanvas = document.createElement('canvas');
      const originalCanvas = document.createElement('canvas');
      baseCanvas.width = width;
      baseCanvas.height = height;
      originalCanvas.width = width;
      originalCanvas.height = height;
      baseCanvas.getContext('2d').drawImage(source, 0, 0, width, height);
      originalCanvas.getContext('2d').drawImage(source, 0, 0, width, height);
      baseCanvasRef.current = baseCanvas;
      originalCanvasRef.current = originalCanvas;
      renderCanvas(baseCanvas, [], null, null);
    };
    source.onerror = () => {
      if (!cancelled) {
        setLoadError('This image could not be opened in the editor.');
      }
    };
    source.src = image.url;

    return () => {
      cancelled = true;
    };
  }, [image?.id, image?.url, isOpen]);

  useEffect(() => {
    renderCanvas(baseCanvasRef.current, annotations, cropRect, selection);
  }, [annotations, cropRect, selection]);

  if (!isOpen || !image) {
    return null;
  }

  function pushHistory() {
    const baseCanvas = baseCanvasRef.current;
    if (!baseCanvas) {
      return;
    }
    setHistory((current) => [
      ...current.slice(-24),
      {
        baseDataUrl: baseCanvas.toDataURL('image/png'),
        annotations,
        cropRect,
        selection
      }
    ]);
    setRedoStack([]);
  }

  async function restoreSnapshot(snapshot) {
    if (!snapshot) {
      return;
    }
    const baseCanvas = await canvasFromDataUrl(snapshot.baseDataUrl);
    baseCanvasRef.current = baseCanvas;
    if (!originalCanvasRef.current || originalCanvasRef.current.width !== baseCanvas.width || originalCanvasRef.current.height !== baseCanvas.height) {
      originalCanvasRef.current = await canvasFromDataUrl(snapshot.baseDataUrl);
    }
    setAnnotations(snapshot.annotations || []);
    setCropRect(snapshot.cropRect || null);
    setSelection(snapshot.selection || null);
    renderCanvas(baseCanvas, snapshot.annotations || [], snapshot.cropRect || null, snapshot.selection || null);
  }

  async function undo() {
    const previous = history[history.length - 1];
    if (!previous) {
      return;
    }
    const currentSnapshot = snapshotCurrent();
    setHistory((current) => current.slice(0, -1));
    setRedoStack((current) => [...current, currentSnapshot]);
    await restoreSnapshot(previous);
  }

  async function redo() {
    const next = redoStack[redoStack.length - 1];
    if (!next) {
      return;
    }
    const currentSnapshot = snapshotCurrent();
    setRedoStack((current) => current.slice(0, -1));
    setHistory((current) => [...current, currentSnapshot]);
    await restoreSnapshot(next);
  }

  function snapshotCurrent() {
    return {
      baseDataUrl: baseCanvasRef.current?.toDataURL('image/png') || '',
      annotations,
      cropRect,
      selection
    };
  }

  async function resetEditor() {
    if (!window.confirm('Reset all edits for this photo?')) {
      return;
    }
    const originalCanvas = originalCanvasRef.current;
    if (!originalCanvas) {
      return;
    }
    pushHistory();
    const baseCanvas = cloneCanvas(originalCanvas);
    baseCanvasRef.current = baseCanvas;
    setAnnotations([]);
    setCropRect(null);
    setSelection(null);
    setBrightness(0);
    setToolsUsed([]);
    renderCanvas(baseCanvas, [], null, null);
  }

  function markToolUsed(toolName) {
    setToolsUsed((current) => current.includes(toolName) ? current : [...current, toolName]);
  }

  function handlePointerDown(event) {
    const point = getCanvasPoint(event);
    if (!point || !baseCanvasRef.current) {
      return;
    }

    if (tool === 'magic') {
      pushHistory();
      const nextSelection = buildColorSelection(baseCanvasRef.current, point.x, point.y, tolerance);
      setSelection(featherSelection(nextSelection, feather));
      markToolUsed('background');
      return;
    }

    if (tool === 'text') {
      const text = captionText.trim();
      if (!text) {
        return;
      }
      pushHistory();
      setAnnotations((current) => [
        ...current,
        { id: crypto.randomUUID(), type: 'text', x: point.x, y: point.y, text, color, fontSize: 34 }
      ]);
      markToolUsed('text');
      return;
    }

    if (tool === 'select') {
      const textHit = findTextAnnotation(point, annotations);
      if (textHit) {
        pushHistory();
        dragRef.current = { mode: 'move-text', id: textHit.id, offsetX: point.x - textHit.x, offsetY: point.y - textHit.y };
      }
      return;
    }

    if (tool === 'erase' || tool === 'restore') {
      pushHistory();
      applyBrush(point, tool);
      dragRef.current = { mode: 'brush', tool };
      markToolUsed('background');
      return;
    }

    if (tool === 'pen') {
      dragRef.current = { mode: 'pen', points: [point] };
      return;
    }

    if (tool === 'crop') {
      dragRef.current = { mode: 'crop', start: point };
      setCropRect({ x: point.x, y: point.y, width: 1, height: 1 });
      return;
    }

    if (['arrow', 'circle', 'rectangle'].includes(tool)) {
      dragRef.current = { mode: 'shape', type: tool, start: point };
      return;
    }
  }

  function handlePointerMove(event) {
    const point = getCanvasPoint(event);
    const drag = dragRef.current;
    if (!point || !drag) {
      return;
    }

    if (drag.mode === 'move-text') {
      setAnnotations((current) => current.map((item) => (
        item.id === drag.id ? { ...item, x: point.x - drag.offsetX, y: point.y - drag.offsetY } : item
      )));
      markToolUsed('text');
      return;
    }

    if (drag.mode === 'brush') {
      applyBrush(point, drag.tool);
      return;
    }

    if (drag.mode === 'pen') {
      drag.points = [...drag.points, point];
      renderCanvas(baseCanvasRef.current, [...annotations, {
        id: 'draft-pen',
        type: 'pen',
        points: drag.points,
        color,
        lineWidth
      }], cropRect, selection);
      return;
    }

    if (drag.mode === 'crop') {
      setCropRect(normalizeRect(drag.start, point));
      return;
    }

    if (drag.mode === 'shape') {
      renderCanvas(baseCanvasRef.current, [...annotations, {
        id: 'draft-shape',
        type: drag.type,
        start: drag.start,
        end: point,
        color,
        lineWidth
      }], cropRect, selection);
    }
  }

  function handlePointerUp(event) {
    const point = getCanvasPoint(event);
    const drag = dragRef.current;
    dragRef.current = null;
    if (!point || !drag) {
      return;
    }

    if (drag.mode === 'pen' && drag.points.length > 1) {
      pushHistory();
      setAnnotations((current) => [...current, {
        id: crypto.randomUUID(),
        type: 'pen',
        points: drag.points,
        color,
        lineWidth
      }]);
      markToolUsed('pen');
      return;
    }

    if (drag.mode === 'shape') {
      pushHistory();
      setAnnotations((current) => [...current, {
        id: crypto.randomUUID(),
        type: drag.type,
        start: drag.start,
        end: point,
        color,
        lineWidth
      }]);
      markToolUsed(drag.type);
    }
  }

  function applyBrush(point, brushTool) {
    const baseCanvas = baseCanvasRef.current;
    const originalCanvas = originalCanvasRef.current;
    if (!baseCanvas || !originalCanvas) {
      return;
    }
    const context = baseCanvas.getContext('2d');
    const originalContext = originalCanvas.getContext('2d');
    const radius = Math.max(2, Number(brushSize || 2)) / 2;
    const x0 = Math.max(0, Math.floor(point.x - radius));
    const y0 = Math.max(0, Math.floor(point.y - radius));
    const x1 = Math.min(baseCanvas.width, Math.ceil(point.x + radius));
    const y1 = Math.min(baseCanvas.height, Math.ceil(point.y + radius));
    const imageData = context.getImageData(x0, y0, x1 - x0, y1 - y0);
    const originalData = originalContext.getImageData(x0, y0, x1 - x0, y1 - y0);

    for (let y = 0; y < imageData.height; y += 1) {
      for (let x = 0; x < imageData.width; x += 1) {
        const dx = x + x0 - point.x;
        const dy = y + y0 - point.y;
        if (Math.sqrt(dx * dx + dy * dy) > radius) {
          continue;
        }
        const index = (y * imageData.width + x) * 4;
        if (brushTool === 'erase') {
          imageData.data[index + 3] = 0;
        } else {
          imageData.data[index] = originalData.data[index];
          imageData.data[index + 1] = originalData.data[index + 1];
          imageData.data[index + 2] = originalData.data[index + 2];
          imageData.data[index + 3] = originalData.data[index + 3];
        }
      }
    }

    context.putImageData(imageData, x0, y0);
    renderCanvas(baseCanvas, annotations, cropRect, selection);
  }

  function applySelectionTransparency() {
    if (!selection || !baseCanvasRef.current) {
      return;
    }
    pushHistory();
    const canvas = baseCanvasRef.current;
    const context = canvas.getContext('2d');
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    selection.mask.forEach((selected, pixelIndex) => {
      if (selected) {
        imageData.data[pixelIndex * 4 + 3] = 0;
      }
    });
    context.putImageData(imageData, 0, 0);
    setSelection(null);
    markToolUsed('background');
    renderCanvas(canvas, annotations, cropRect, null);
  }

  function invertSelection() {
    if (!selection) {
      return;
    }
    setSelection({
      ...selection,
      mask: selection.mask.map((selected) => !selected)
    });
  }

  function applyBrightness() {
    const amount = Number(brightness || 0);
    if (!amount || !baseCanvasRef.current) {
      return;
    }
    pushHistory();
    const canvas = baseCanvasRef.current;
    const context = canvas.getContext('2d');
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    for (let index = 0; index < imageData.data.length; index += 4) {
      imageData.data[index] = clamp(imageData.data[index] + amount, 0, 255);
      imageData.data[index + 1] = clamp(imageData.data[index + 1] + amount, 0, 255);
      imageData.data[index + 2] = clamp(imageData.data[index + 2] + amount, 0, 255);
    }
    context.putImageData(imageData, 0, 0);
    originalCanvasRef.current = cloneCanvas(canvas);
    setBrightness(0);
    markToolUsed('brightness');
    renderCanvas(canvas, annotations, cropRect, selection);
  }

  function applyCrop() {
    if (!cropRect || !baseCanvasRef.current || cropRect.width < 12 || cropRect.height < 12) {
      return;
    }
    pushHistory();
    const rect = {
      x: Math.max(0, Math.round(cropRect.x)),
      y: Math.max(0, Math.round(cropRect.y)),
      width: Math.min(baseCanvasRef.current.width - cropRect.x, Math.round(cropRect.width)),
      height: Math.min(baseCanvasRef.current.height - cropRect.y, Math.round(cropRect.height))
    };
    const cropped = document.createElement('canvas');
    cropped.width = rect.width;
    cropped.height = rect.height;
    cropped.getContext('2d').drawImage(baseCanvasRef.current, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
    baseCanvasRef.current = cropped;
    originalCanvasRef.current = cloneCanvas(cropped);
    setAnnotations((current) => current.map((item) => shiftAnnotation(item, -rect.x, -rect.y)));
    setCropRect(null);
    setSelection(null);
    markToolUsed('crop');
    renderCanvas(cropped, annotations.map((item) => shiftAnnotation(item, -rect.x, -rect.y)), null, null);
  }

  async function handleSave(mode) {
    const canvas = renderExportCanvas();
    const blob = await canvasToBlob(canvas, 'image/png');
    if (!blob) {
      window.alert('The edited image could not be rendered.');
      return;
    }
    const file = new File([blob], `${fileBaseName(image.fileName || image.name || 'photo')}-edited.png`, {
      type: 'image/png',
      lastModified: Date.now()
    });
    const metadata = {
      sourcePhotoId: image.id,
      sourceFileName: image.fileName || image.name || '',
      width: canvas.width,
      height: canvas.height,
      toolsUsed,
      captions: annotations.filter((item) => item.type === 'text').map(({ text, x, y, color, fontSize }) => ({ text, x, y, color, fontSize })),
      saveMode: mode,
      backgroundRemoval: toolsUsed.includes('background') ? 'manual background cleanup' : ''
    };

    if (mode === 'overwrite') {
      const confirmed = window.confirm('This will replace the original uploaded photo. This cannot be undone unless a backup copy exists.');
      if (!confirmed) {
        return;
      }
      await onOverwrite(file, metadata);
      return;
    }

    await onSaveCopy(file, metadata);
  }

  return (
    <div className="modal-backdrop photo-editor-backdrop" role="dialog" aria-modal="true" aria-label="Photo editor">
      <div className="photo-editor-modal">
        <header className="photo-editor-header">
          <div>
            <h2>Edit Photo</h2>
            <p className="muted-text">Manual markup and background cleanup. Save as copy is the default.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving}>Close</button>
        </header>

        <div className="photo-editor-layout">
          <aside className="photo-editor-tools">
            <div className="photo-tool-grid" aria-label="Photo editor tools">
              {tools.map(([toolId, label]) => (
                <button
                  key={toolId}
                  type="button"
                  className={tool === toolId ? 'active' : ''}
                  onClick={() => setTool(toolId)}
                  title={label}
                >
                  {label}
                </button>
              ))}
            </div>

            <label>
              Color
              <div className="photo-color-row">
                {drawColors.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={color === value ? 'selected' : ''}
                    style={{ backgroundColor: value }}
                    onClick={() => setColor(value)}
                    aria-label={`Use ${value}`}
                  />
                ))}
              </div>
            </label>

            <label>
              Line width
              <input type="range" min="2" max="18" value={lineWidth} onChange={(event) => setLineWidth(Number(event.target.value))} />
            </label>

            <label>
              Caption
              <input value={captionText} onChange={(event) => setCaptionText(event.target.value)} maxLength="80" />
            </label>

            <label>
              Brightness
              <input type="range" min="-80" max="100" value={brightness} onChange={(event) => setBrightness(Number(event.target.value))} />
              <button type="button" onClick={applyBrightness}>Apply Brightness</button>
            </label>

            <div className="photo-tool-panel">
              <strong>Background cleanup</strong>
              <p>Manual background removal works best on simple, high-contrast backgrounds.</p>
              <label>
                Tolerance
                <input type="range" min="4" max="120" value={tolerance} onChange={(event) => setTolerance(Number(event.target.value))} />
              </label>
              <label>
                Feather
                <input type="range" min="0" max="4" value={feather} onChange={(event) => setFeather(Number(event.target.value))} />
              </label>
              <label>
                Brush
                <input type="range" min="8" max="90" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
              </label>
              <button type="button" onClick={invertSelection} disabled={!selection}>Invert Selection</button>
              <button type="button" onClick={applySelectionTransparency} disabled={!selection}>Remove Selected</button>
              <small>{selection ? `${selectionCount} pixels selected` : 'Click a background color with Magic wand.'}</small>
            </div>

            <div className="photo-editor-actions">
              <button type="button" onClick={undo} disabled={!history.length || isSaving}>Undo</button>
              <button type="button" onClick={redo} disabled={!redoStack.length || isSaving}>Redo</button>
              <button type="button" onClick={applyCrop} disabled={!cropRect || isSaving}>Crop</button>
              <button type="button" onClick={resetEditor} disabled={isSaving}>Reset</button>
            </div>
          </aside>

          <main className="photo-editor-stage">
            {loadError ? (
              <div className="photo-editor-error">{loadError}</div>
            ) : (
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
            )}
          </main>
        </div>

        <footer className="photo-editor-footer">
          <span>Transparent PNG output. Busy backgrounds may need erase/restore brush cleanup.</span>
          <div>
            <button type="button" className="primary-action" onClick={() => handleSave('copy')} disabled={!canSave}>
              {isSaving ? 'Saving...' : 'Save Copy'}
            </button>
            {onOverwrite && (
              <button type="button" className="danger-action" onClick={() => handleSave('overwrite')} disabled={!canSave}>
                Overwrite Original
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );

  function getCanvasPoint(event) {
    const canvas = canvasRef.current;
    const baseCanvas = baseCanvasRef.current;
    if (!canvas || !baseCanvas) {
      return null;
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - rect.left) / rect.width) * baseCanvas.width, 0, baseCanvas.width),
      y: clamp(((event.clientY - rect.top) / rect.height) * baseCanvas.height, 0, baseCanvas.height)
    };
  }

  function renderExportCanvas() {
    const baseCanvas = baseCanvasRef.current;
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = baseCanvas.width;
    exportCanvas.height = baseCanvas.height;
    const context = exportCanvas.getContext('2d');
    context.clearRect(0, 0, exportCanvas.width, exportCanvas.height);
    context.drawImage(baseCanvas, 0, 0);
    drawAnnotations(context, annotations);
    return exportCanvas;
  }

  function renderCanvas(baseCanvas, nextAnnotations, nextCropRect, nextSelection) {
    const canvas = canvasRef.current;
    if (!canvas || !baseCanvas) {
      return;
    }
    canvas.width = baseCanvas.width;
    canvas.height = baseCanvas.height;
    const context = canvas.getContext('2d');
    drawCheckerboard(context, canvas.width, canvas.height);
    context.drawImage(baseCanvas, 0, 0);
    drawAnnotations(context, nextAnnotations || []);
    drawSelection(context, nextSelection);
    drawCrop(context, nextCropRect);
  }
}

function drawAnnotations(context, annotations) {
  annotations.forEach((item) => {
    context.save();
    context.strokeStyle = item.color || '#facc15';
    context.fillStyle = item.color || '#facc15';
    context.lineWidth = item.lineWidth || 6;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    if (item.type === 'pen') {
      context.beginPath();
      item.points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.stroke();
    }

    if (item.type === 'rectangle') {
      const rect = normalizeRect(item.start, item.end);
      context.strokeRect(rect.x, rect.y, rect.width, rect.height);
    }

    if (item.type === 'circle') {
      const rect = normalizeRect(item.start, item.end);
      context.beginPath();
      context.ellipse(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width / 2, rect.height / 2, 0, 0, Math.PI * 2);
      context.stroke();
    }

    if (item.type === 'arrow') {
      drawArrow(context, item.start, item.end);
    }

    if (item.type === 'text') {
      context.font = `700 ${item.fontSize || 34}px Arial, sans-serif`;
      context.lineWidth = 5;
      context.strokeStyle = 'rgba(17, 24, 39, 0.82)';
      context.strokeText(item.text, item.x, item.y);
      context.fillStyle = item.color || '#ffffff';
      context.fillText(item.text, item.x, item.y);
    }
    context.restore();
  });
}

function drawArrow(context, start, end) {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headLength = Math.max(18, context.lineWidth * 4);
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
  context.beginPath();
  context.moveTo(end.x, end.y);
  context.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 6), end.y - headLength * Math.sin(angle - Math.PI / 6));
  context.lineTo(end.x - headLength * Math.cos(angle + Math.PI / 6), end.y - headLength * Math.sin(angle + Math.PI / 6));
  context.closePath();
  context.fill();
}

function drawCrop(context, cropRect) {
  if (!cropRect) {
    return;
  }
  context.save();
  context.fillStyle = 'rgba(17, 24, 39, 0.45)';
  context.fillRect(0, 0, context.canvas.width, context.canvas.height);
  context.clearRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
  context.strokeStyle = '#ffffff';
  context.lineWidth = 3;
  context.strokeRect(cropRect.x, cropRect.y, cropRect.width, cropRect.height);
  context.restore();
}

function drawSelection(context, selection) {
  if (!selection) {
    return;
  }
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = selection.width;
  overlayCanvas.height = selection.height;
  const overlayContext = overlayCanvas.getContext('2d');
  const overlay = overlayContext.createImageData(selection.width, selection.height);
  selection.mask.forEach((selected, index) => {
    if (!selected) {
      return;
    }
    overlay.data[index * 4] = 56;
    overlay.data[index * 4 + 1] = 189;
    overlay.data[index * 4 + 2] = 248;
    overlay.data[index * 4 + 3] = 95;
  });
  overlayContext.putImageData(overlay, 0, 0);
  context.drawImage(overlayCanvas, 0, 0);
}

function drawCheckerboard(context, width, height) {
  const size = 18;
  for (let y = 0; y < height; y += size) {
    for (let x = 0; x < width; x += size) {
      context.fillStyle = ((x / size + y / size) % 2 === 0) ? '#f8fafc' : '#cbd5e1';
      context.fillRect(x, y, size, size);
    }
  }
}

function buildColorSelection(canvas, startX, startY, tolerance) {
  const context = canvas.getContext('2d');
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const width = canvas.width;
  const height = canvas.height;
  const start = (Math.floor(startY) * width + Math.floor(startX)) * 4;
  const target = [imageData.data[start], imageData.data[start + 1], imageData.data[start + 2], imageData.data[start + 3]];
  const mask = new Array(width * height).fill(false);
  const visited = new Array(width * height).fill(false);
  const queue = [{ x: Math.floor(startX), y: Math.floor(startY) }];

  while (queue.length) {
    const point = queue.pop();
    if (point.x < 0 || point.y < 0 || point.x >= width || point.y >= height) {
      continue;
    }
    const pixel = point.y * width + point.x;
    if (visited[pixel]) {
      continue;
    }
    visited[pixel] = true;
    const index = pixel * 4;
    if (colorDistance(target, imageData.data, index) > tolerance) {
      continue;
    }
    mask[pixel] = true;
    queue.push({ x: point.x + 1, y: point.y });
    queue.push({ x: point.x - 1, y: point.y });
    queue.push({ x: point.x, y: point.y + 1 });
    queue.push({ x: point.x, y: point.y - 1 });
  }

  return { width, height, mask };
}

function featherSelection(selection, feather) {
  const amount = Number(feather || 0);
  if (!selection || amount <= 0) {
    return selection;
  }
  let mask = selection.mask;
  for (let step = 0; step < amount; step += 1) {
    const next = [...mask];
    for (let y = 1; y < selection.height - 1; y += 1) {
      for (let x = 1; x < selection.width - 1; x += 1) {
        const index = y * selection.width + x;
        if (mask[index]) {
          next[index - 1] = true;
          next[index + 1] = true;
          next[index - selection.width] = true;
          next[index + selection.width] = true;
        }
      }
    }
    mask = next;
  }
  return { ...selection, mask };
}

function colorDistance(target, data, index) {
  const dr = target[0] - data[index];
  const dg = target[1] - data[index + 1];
  const db = target[2] - data[index + 2];
  const da = target[3] - data[index + 3];
  return Math.sqrt(dr * dr + dg * dg + db * db + da * da * 0.2);
}

function normalizeRect(start, end) {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  return {
    x,
    y,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y)
  };
}

function findTextAnnotation(point, annotations) {
  const context = document.createElement('canvas').getContext('2d');
  for (let index = annotations.length - 1; index >= 0; index -= 1) {
    const item = annotations[index];
    if (item.type !== 'text') {
      continue;
    }
    context.font = `700 ${item.fontSize || 34}px Arial, sans-serif`;
    const width = context.measureText(item.text).width;
    const height = item.fontSize || 34;
    if (point.x >= item.x && point.x <= item.x + width && point.y >= item.y - height && point.y <= item.y + 8) {
      return item;
    }
  }
  return null;
}

function shiftAnnotation(item, dx, dy) {
  if (item.type === 'pen') {
    return { ...item, points: item.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
  }
  if (item.type === 'text') {
    return { ...item, x: item.x + dx, y: item.y + dy };
  }
  return {
    ...item,
    start: { x: item.start.x + dx, y: item.start.y + dy },
    end: { x: item.end.x + dx, y: item.end.y + dy }
  };
}

function cloneCanvas(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  canvas.getContext('2d').drawImage(source, 0, 0);
  return canvas;
}

function canvasFromDataUrl(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      canvas.getContext('2d').drawImage(image, 0, 0);
      resolve(canvas);
    };
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function canvasToBlob(canvas, type) {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type);
  });
}

function fileBaseName(fileName) {
  return String(fileName || 'photo').replace(/\.[^.]+$/, '').replace(/[^a-z0-9._-]+/gi, '-').replace(/-+/g, '-') || 'photo';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
