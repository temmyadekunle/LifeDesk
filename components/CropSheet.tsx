import { useEffect, useRef, useState } from "react";

import { Icon } from "./Icons";
import { Sheet } from "./ui";

type CropRect = { x: number; y: number; width: number; height: number };

interface Props {
  /** The image source (object URL or data URL) to crop. */
  src: string;
  /** Called with the cropped blob when the user confirms. */
  onCrop: (blob: Blob) => void;
  /** Called when the user cancels. */
  onCancel: () => void;
  /** Aspect ratio of the crop box (width / height). Default 1 (square). */
  aspectRatio?: number;
}

export function CropSheet({ src, onCrop, onCancel, aspectRatio = 1 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const [drag, setDrag] = useState<{ type: "move" | "resize"; startX: number; startY: number; startCrop: CropRect } | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const naturalSize = useRef({ width: 0, height: 0 });

  useEffect(() => {
    const img = imgRef.current;
    if (!img) return;
    naturalSize.current = { width: img.naturalWidth, height: img.naturalHeight };
  }, [imgLoaded]);

  // Initialize crop to largest centered box matching aspect ratio
  useEffect(() => {
    const { width: nw, height: nh } = naturalSize.current;
    if (!nw) return;
    let cw = nw;
    let ch = nw / aspectRatio;
    if (ch > nh) {
      ch = nh;
      cw = nh * aspectRatio;
    }
    const cx = (nw - cw) / 2;
    const cy = (nh - ch) / 2;
    setCrop({ x: cx, y: cy, width: cw, height: ch });
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

    // Draw image fitted to canvas (contain)
    const scale = Math.min(cssWidth / img.naturalWidth, cssHeight / img.naturalHeight);
    const drawW = img.naturalWidth * scale;
    const drawH = img.naturalHeight * scale;
    const offsetX = (cssWidth - drawW) / 2;
    const offsetY = (cssHeight - drawH) / 2;
    ctx.drawImage(img, offsetX, offsetY, drawW, drawH);

    // Dimmed overlay
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(0, 0, cssWidth, cssHeight);

    // Clear crop area
    const cropScaleX = drawW / img.naturalWidth;
    const cropScaleY = drawH / img.naturalHeight;
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
  }, [crop, imgLoaded]);

  function getCanvasPoint(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function onPointerDown(e: React.MouseEvent | React.TouchEvent, type: "move" | "resize") {
    if (type === "resize") e.stopPropagation();
    const pt = getCanvasPoint(e);
    setDrag({ type, startX: pt.x, startY: pt.y, startCrop: crop });
  }

  function onPointerMove(e: React.MouseEvent | React.TouchEvent) {
    if (!drag) return;
    const pt = getCanvasPoint(e);
    const canvas = canvasRef.current!;
    const dpr = window.devicePixelRatio || 1;
    const dx = (pt.x - drag.startX) * (canvas.width / dpr / canvas.clientWidth);
    const dy = (pt.y - drag.startY) * (canvas.height / dpr / canvas.clientHeight);

    const nc = { ...drag.startCrop };
    const { width: maxW, height: maxH } = naturalSize.current;
    if (drag.type === "move") {
      nc.x = Math.max(0, Math.min(maxW - nc.width, drag.startCrop.x + dx));
      nc.y = Math.max(0, Math.min(maxH - nc.height, drag.startCrop.y + dy));
    } else {
      // Resize from bottom-right corner, maintain aspect ratio
      let nw = Math.max(40, Math.min(maxW, drag.startCrop.width + dx));
      let nh = nw / aspectRatio;
      if (drag.startCrop.y + nh > maxH) {
        nh = maxH - drag.startCrop.y;
        nw = nh * aspectRatio;
      }
      if (drag.startCrop.x + nw > maxW) {
        nw = maxW - drag.startCrop.x;
        nh = nw / aspectRatio;
      }
      nc.width = nw;
      nc.height = nh;
}
  setCrop(nc);
}

function onPointerUp() {
    setDrag(null);
  }

  // Produce the cropped blob
  async function confirm() {
    const img = imgRef.current!;
    // Draw from the original image at full resolution
    const outCanvas = document.createElement("canvas");
    const outSize = Math.min(crop.width, crop.height); // square output
    outCanvas.width = outSize;
    outCanvas.height = outSize;
    const octx = outCanvas.getContext("2d")!;
    octx.drawImage(
      img,
      crop.x, crop.y, crop.width, crop.height,
      0, 0, outSize, outSize
    );
    const blob = await new Promise<Blob>((res) => outCanvas.toBlob((b) => res(b!), "image/webp", 0.92));
    onCrop(blob);
  }

  return (
    <Sheet title="Crop photo" onClose={onCancel} footer={
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", width: "100%" }}>
        <button className="btn btn--ghost" onClick={onCancel}>Cancel</button>
        <button className="btn btn--primary" onClick={confirm}>Save</button>
      </div>
    }>
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", maxHeight: "60vh", overflow: "hidden", borderRadius: "var(--radius)", background: "var(--surface-2)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={src} alt="" style={{ display: "none" }} onLoad={() => setImgLoaded(true)} />
        <canvas ref={canvasRef} style={{ width: "100%", height: "100%", touchAction: "none", display: "block" }}
          onMouseDown={(e) => onPointerDown(e, "move")}
          onTouchStart={(e) => onPointerDown(e, "move")}
          onMouseMove={onPointerMove}
          onTouchMove={onPointerMove}
          onMouseUp={onPointerUp}
          onTouchEnd={onPointerUp}
          onMouseLeave={onPointerUp}
        />
        {/* Bottom-right resize handle */}
        <div style={{
          position: "absolute", right: -8, bottom: -8, width: 24, height: 24,
          borderRadius: "50%", background: "#fff", border: "2px solid var(--brand-600)",
          cursor: "se-resize", touchAction: "none", display: "grid", placeItems: "center",
          boxShadow: "0 2px 6px rgba(0,0,0,0.2)", transform: "rotate(45deg)"
        }}
          onMouseDown={(e) => onPointerDown(e, "resize")}
          onTouchStart={(e) => onPointerDown(e, "resize")}
        >
          <Icon name="chevronRight" size={12} />
        </div>
      </div>
      <p className="card-meta" style={{ marginTop: "0.5rem", textAlign: "center" }}>
        Drag to reposition. Drag the corner to resize.
      </p>
    </Sheet>
  );
}