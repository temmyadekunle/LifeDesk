import { useCallback, useEffect, useRef, useState } from "react";

import { Icon } from "./Icons";
import { Sheet } from "./ui";

type CropRect = { x: number; y: number; width: number; height: number };

type AspectRatioOption =
  | { label: string; value: "original" }
  | { label: string; value: number };

const ASPECT_RATIOS: AspectRatioOption[] = [
  { label: "Original", value: "original" },
  { label: "Square (1:1)", value: 1 },
  { label: "Portrait (4:5)", value: 4 / 5 },
  { label: "Landscape (16:9)", value: 16 / 9 },
];

interface Props {
  /** The image source (object URL or data URL) to crop. */
  src: string;
  /** Called with the cropped blob when the user confirms. */
  onCrop: (blob: Blob) => void;
  /** Called when the user cancels. */
  onCancel: () => void;
  /** Default aspect ratio (width / height). Default 1 (square). */
  defaultAspectRatio?: number;
}

export function CropSheet({ src, onCrop, onCancel, defaultAspectRatio = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const [drag, setDrag] = useState<{
    type: "move" | "resize" | "zoom";
    startX: number;
    startY: number;
    startCrop: CropRect;
    startScale?: number;
    startRotation?: number;
  } | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [scale, setScale] = useState(1); // zoom level
  const [aspectRatio, setAspectRatio] = useState<AspectRatioOption["value"]>(defaultAspectRatio);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const naturalSize = useRef({ width: 0, height: 0 });

  // Initialize natural size when image loads
  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    naturalSize.current = { width: img.naturalWidth, height: img.naturalHeight };
  }, [imgLoaded]);

  // Initialize/reset crop when image loads or aspect ratio changes
  useEffect(() => {
    const { width: nw, height: nh } = naturalSize.current;
    if (!nw) return;

    let ar: number;
    if (aspectRatio === "original") {
      ar = nw / nh;
    } else {
      ar = aspectRatio;
    }

    let cw = nw;
    let ch = nw / ar;
    if (ch > nh) {
      ch = nh;
      cw = nh * ar;
    }
    const cx = (nw - cw) / 2;
    const cy = (nh - ch) / 2;
    setCrop({ x: cx, y: cy, width: cw, height: ch });
    setScale(1);
    setRotation(0);
  }, [imgLoaded, aspectRatio]);

  // Draw image + crop overlay
  useEffect(() => {
    const canvas = canvasRef.current;
    const img = imgRef.current;
    if (!canvas || !img || !imgLoaded) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth;
    const cssHeight = canvas.clientHeight;
    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    ctx.scale(dpr, dpr);

    // Apply rotation and scale for display
    const { width: iw, height: ih } = naturalSize.current;
    const rotated = rotation === 90 || rotation === 270;
    const displayW = rotated ? ih : iw;
    const displayH = rotated ? iw : ih;

    // Fit to canvas with scale
    const baseScale = Math.min(cssWidth / displayW, cssHeight / displayH) * scale;
    const drawW = displayW * baseScale;
    const drawH = displayH * baseScale;
    const offsetX = (cssWidth - drawW) / 2;
    const offsetY = (cssHeight - drawH) / 2;

    ctx.save();
    ctx.translate(offsetX + drawW / 2, offsetY + drawH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Dimmed overlay
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Clear crop area (in display coordinates)
    const cropScaleX = drawW / displayW;
    const cropScaleY = drawH / displayH;
    const cropX = offsetX + crop.x * cropScaleX;
    const cropY = offsetY + crop.y * cropScaleY;
    const cropW = crop.width * cropScaleX;
    const cropH = crop.height * cropScaleY;
    ctx.clearRect(cropX, cropY, cropW, cropH);

    // Crop border
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2 / dpr;
    ctx.strokeRect(cropX, cropY, cropW, cropH);

    // Corner handles
    const handleSize = 16 / dpr;
    const handles = [
      [cropX, cropY],
      [cropX + cropW, cropY],
      [cropX, cropY + cropH],
      [cropX + cropW, cropY + cropH],
    ] as const;
    ctx.fillStyle = "#fff";
    for (const [hx, hy] of handles) {
      ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    }
  }, [crop, imgLoaded, scale, rotation]);

  function getCanvasPoint(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function onPointerDown(e: React.MouseEvent | React.TouchEvent, type: "move" | "resize" | "zoom") {
    if (type === "resize" || type === "zoom") e.stopPropagation();
    const pt = getCanvasPoint(e);
    setDrag({ type, startX: pt.x, startY: pt.y, startCrop: crop, startScale: scale });
  }

  function onPointerMove(e: React.MouseEvent | React.TouchEvent) {
    if (!drag) return;
    const pt = getCanvasPoint(e);
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    const dx = (pt.x - drag.startX) * (canvas.width / dpr / canvas.clientWidth);
    const dy = (pt.y - drag.startY) * (canvas.height / dpr / canvas.clientHeight);

    if (drag.type === "zoom") {
      // Pinch zoom: scale based on vertical movement
      const newScale = Math.max(0.5, Math.min(5, (drag.startScale ?? 1) - dy * 0.01));
      setScale(newScale);
      return;
    }

    const nc = { ...drag.startCrop };
    const { width: maxW, height: maxH } = naturalSize.current;

    if (drag.type === "move") {
      nc.x = Math.max(0, Math.min(maxW - nc.width, drag.startCrop.x + dx));
      nc.y = Math.max(0, Math.min(maxH - nc.height, drag.startCrop.y + dy));
    } else if (drag.type === "resize") {
      // Resize from bottom-right corner, maintain aspect ratio
      const ar = aspectRatio === "original" ? maxW / maxH : aspectRatio;
      let nw = Math.max(40, Math.min(maxW, drag.startCrop.width + dx));
      let nh = nw / ar;
      if (drag.startCrop.y + nh > maxH) {
        nh = maxH - drag.startCrop.y;
        nw = nh * ar;
      }
      if (drag.startCrop.x + nw > maxW) {
        nw = maxW - drag.startCrop.x;
        nh = nw / ar;
      }
      nc.width = nw;
      nc.height = nh;
    }
    setCrop(nc);
  }

  function onPointerUp() {
    setDrag(null);
  }

  function rotateRight() {
    setRotation((r) => (r + 90) % 360);
  }

  function resetCrop() {
    const { width: nw, height: nh } = naturalSize.current;
    if (!nw) return;

    let ar: number;
    if (aspectRatio === "original") {
      ar = nw / nh;
    } else {
      ar = aspectRatio;
    }

    let cw = nw;
    let ch = nw / ar;
    if (ch > nh) {
      ch = nh;
      cw = nh * ar;
    }
    const cx = (nw - cw) / 2;
    const cy = (nh - ch) / 2;
    setCrop({ x: cx, y: cy, width: cw, height: ch });
    setScale(1);
    setRotation(0);
  }

  const updatePreview = useCallback(() => {
    const previewCanvas = previewCanvasRef.current;
    const img = imgRef.current;
    if (!previewCanvas || !img) return;
    const ctx = previewCanvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;

    // Calculate preview size maintaining aspect ratio
    const maxW = 300;
    const maxH = 200;
    const scale = Math.min(maxW / crop.width, maxH / crop.height, 1);
    const outW = Math.round(crop.width * scale);
    const outH = Math.round(crop.height * scale);
    previewCanvas.width = outW * dpr;
    previewCanvas.height = outH * dpr;
    previewCanvas.style.width = `${outW}px`;
    previewCanvas.style.height = `${outH}px`;
    ctx.scale(dpr, dpr);

    ctx.save();
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.drawImage(
      img,
      crop.x, crop.y, crop.width, crop.height,
      -outW / 2, -outH / 2, outW, outH
    );
    ctx.restore();
  }, [crop, rotation]);

  // Update preview when crop, rotation, or image changes
  useEffect(() => {
    if (imgLoaded) updatePreview();
  }, [imgLoaded, updatePreview]);

  async function confirm() {
    setProcessing(true);
    setError(null);
    try {
      const img = imgRef.current!;

      // Calculate output size based on crop
      const outCanvas = document.createElement("canvas");
      const outW = Math.round(crop.width);
      const outH = Math.round(crop.height);
      outCanvas.width = outW;
      outCanvas.height = outH;
      const octx = outCanvas.getContext("2d")!;

      // Apply rotation transform
      octx.translate(outW / 2, outH / 2);
      octx.rotate((rotation * Math.PI) / 180);
      octx.drawImage(
        img,
        crop.x, crop.y, crop.width, crop.height,
        -outW / 2, -outH / 2, outW, outH
      );

      const blob = await new Promise<Blob>((res, rej) => {
        outCanvas.toBlob((b) => (b ? res(b) : rej(new Error("Failed to create blob"))), "image/webp", 0.92);
      });
      onCrop(blob);
    } catch {
      setError("Something went wrong while editing your photo. Please try again.");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Sheet
      title="Edit photo"
      onClose={onCancel}
      footer={
        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", width: "100%" }}>
          <button className="btn btn--ghost" onClick={onCancel} disabled={processing}>Cancel</button>
          <button className="btn btn--primary" onClick={confirm} disabled={processing}>
            {processing ? "Saving…" : "Save Photo"}
          </button>
        </div>
      }
    >
      {error && (
        <div style={{ marginBottom: "0.75rem", padding: "0.75rem", borderRadius: "var(--radius-sm)", background: "var(--danger-50)", border: "1px solid #f3d3d3", color: "#a92f2f", fontSize: "0.875rem" }}>
          {error}
        </div>
      )}

      {/* Aspect ratio selector */}
      <div style={{ display: "flex", gap: "0.375rem", overflowX: "auto", paddingBottom: "0.25rem", marginBottom: "0.75rem", scrollbarWidth: "none" }}>
        {ASPECT_RATIOS.map((ratio) => (
          <button
            key={ratio.label}
            type="button"
            className={`btn btn--sm ${aspectRatio === ratio.value ? "btn--primary" : "btn--soft"}`}
            onClick={() => setAspectRatio(ratio.value)}
            style={{ flexShrink: 0, minWidth: "96px" }}
          >
            {ratio.label}
          </button>
        ))}
      </div>

      {/* Main canvas area */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", maxHeight: "65vh", overflow: "hidden", borderRadius: "var(--radius)", background: "var(--surface-2)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={src} alt="" style={{ display: "none" }} onLoad={() => setImgLoaded(true)} />
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height: "100%", touchAction: "none", display: "block" }}
          onMouseDown={(e) => onPointerDown(e, "move")}
          onTouchStart={(e) => onPointerDown(e, "move")}
          onMouseMove={onPointerMove}
          onTouchMove={onPointerMove}
          onMouseUp={onPointerUp}
          onTouchEnd={onPointerUp}
          onMouseLeave={onPointerUp}
        />

        {/* Zoom controls (mobile-friendly) */}
        <div style={{ position: "absolute", right: 8, bottom: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setScale((s) => Math.min(5, s + 0.25))}
            aria-label="Zoom in"
            disabled={scale >= 5}
          >
            <Icon name="plus" size={20} />
          </button>
          <button
            type="button"
            className="iconbtn"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            aria-label="Zoom out"
            disabled={scale <= 0.5}
          >
            <Icon name="minus" size={20} />
          </button>
        </div>

        {/* Rotate button */}
        <button
          type="button"
          className="iconbtn"
          style={{ position: "absolute", left: 8, bottom: 8 }}
          onClick={rotateRight}
          aria-label="Rotate 90° clockwise"
        >
          <Icon name="repeat" size={20} />
        </button>

        {/* Reset button */}
        <button
          type="button"
          className="btn btn--ghost btn--sm"
          style={{ position: "absolute", left: 8, top: 8, minWidth: "auto", padding: "0.375rem 0.625rem" }}
          onClick={resetCrop}
          aria-label="Reset crop"
        >
          <Icon name="refresh" size={16} />
          Reset
        </button>
      </div>

      <p className="card-meta" style={{ marginTop: "0.5rem", textAlign: "center" }}>
        Drag to reposition. Pinch or use +/- to zoom. Drag corners to resize.
      </p>

      {/* Preview section */}
      <details style={{ marginTop: "1rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: 600, color: "var(--ink-700)" }}>
          Preview final result
        </summary>
        <div style={{ marginTop: "0.5rem", borderRadius: "var(--radius)", overflow: "hidden", background: "var(--surface)", border: "1px solid var(--line)" }}>
          <canvas
            ref={previewCanvasRef}
            style={{ width: "100%", height: "auto", display: "block", maxHeight: "200px" }}
          />
        </div>
      </details>
    </Sheet>
  );
}