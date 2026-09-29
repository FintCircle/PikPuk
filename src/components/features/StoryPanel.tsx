import { useRef, useState, useCallback, useEffect } from "react";
import { X, ChevronDown, Maximize2, Minimize2 } from "lucide-react";
import { Photo } from "@/types/photo";

interface StoryPanelProps {
  photo: Photo;
  onClose: () => void;
  isDesktop: boolean;
}

interface ZoomState {
  scale: number;
  x: number;
  y: number;
}

export function StoryPanel({ photo, onClose, isDesktop }: StoryPanelProps) {
  // Mobile split ratio (percentage for image area height)
  const [splitRatio, setSplitRatio] = useState(45);
  const [isDragging, setIsDragging] = useState(false);
  const [isPhotoFullscreen, setIsPhotoFullscreen] = useState(false);
  const [zoom, setZoom] = useState<ZoomState>({ scale: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, imgX: 0, imgY: 0 });
  const lastTapRef = useRef<number>(0);
  const lastPinchDistRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgAreaRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number>(0);
  const dragStartRatio = useRef<number>(45);

  const clampZoom = useCallback((scale: number, x: number, y: number, containerW: number, containerH: number) => {
    const clampedScale = Math.max(1, Math.min(5, scale));
    if (clampedScale === 1) return { scale: 1, x: 0, y: 0 };
    const maxX = (containerW * (clampedScale - 1)) / 2;
    const maxY = (containerH * (clampedScale - 1)) / 2;
    return {
      scale: clampedScale,
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }, []);

  // Double-tap to zoom
  const handleImgTap = useCallback((e: React.TouchEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      e.preventDefault();
      const rect = imgAreaRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (zoom.scale > 1) {
        setZoom({ scale: 1, x: 0, y: 0 });
      } else {
        const tapX = e.touches[0]?.clientX ?? e.changedTouches[0]?.clientX;
        const tapY = e.touches[0]?.clientY ?? e.changedTouches[0]?.clientY;
        const offsetX = (tapX - rect.left - rect.width / 2);
        const offsetY = (tapY - rect.top - rect.height / 2);
        const newScale = 2.5;
        const clamped = clampZoom(newScale, -offsetX * (newScale - 1), -offsetY * (newScale - 1), rect.width, rect.height);
        setZoom(clamped);
      }
    }
    lastTapRef.current = now;
  }, [zoom.scale, clampZoom]);

  // Pinch to zoom
  const handleImgTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      lastPinchDistRef.current = Math.sqrt(dx * dx + dy * dy);
    } else if (e.touches.length === 1 && zoom.scale > 1) {
      setIsPanning(true);
      setPanStart({
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        imgX: zoom.x,
        imgY: zoom.y,
      });
    }
    handleImgTap(e);
  }, [zoom, handleImgTap]);

  const handleImgTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const rect = imgAreaRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const delta = dist / (lastPinchDistRef.current || dist);
      lastPinchDistRef.current = dist;
      setZoom(prev => clampZoom(prev.scale * delta, prev.x, prev.y, rect.width, rect.height));
    } else if (e.touches.length === 1 && isPanning) {
      const dx = e.touches[0].clientX - panStart.x;
      const dy = e.touches[0].clientY - panStart.y;
      setZoom(prev => clampZoom(prev.scale, panStart.imgX + dx, panStart.imgY + dy, rect.width, rect.height));
    }
  }, [isPanning, panStart, clampZoom]);

  const handleImgTouchEnd = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Drag divider (mobile)
  const handleDividerMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    dragStartY.current = clientY;
    dragStartRatio.current = splitRatio;
  }, [splitRatio]);

  useEffect(() => {
    if (!isDragging) return;
    const container = containerRef.current;
    if (!container) return;

    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const rect = container.getBoundingClientRect();
      const totalH = rect.height;
      const deltaY = clientY - dragStartY.current;
      const deltaRatio = (deltaY / totalH) * 100;
      const newRatio = Math.max(25, Math.min(75, dragStartRatio.current + deltaRatio));
      setSplitRatio(newRatio);
    };

    const onEnd = () => setIsDragging(false);

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onEnd);
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd);

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onEnd);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
    };
  }, [isDragging]);

  const resetZoom = () => setZoom({ scale: 1, x: 0, y: 0 });

  const imgTransform = `scale(${zoom.scale}) translate(${zoom.x / zoom.scale}px, ${zoom.y / zoom.scale}px)`;

  // ─── DESKTOP LAYOUT ───────────────────────────────────────────────────────
  if (isDesktop) {
    return (
      <div className="fixed inset-0 z-40 flex" style={{ background: "rgba(8, 4, 2, 0.92)" }}>
        {/* Left: Photo ~65% */}
        <div
          ref={imgAreaRef}
          className="relative overflow-hidden"
          style={{ width: "65%", cursor: zoom.scale > 1 ? "grab" : "default" }}
          onTouchStart={handleImgTouchStart}
          onTouchMove={handleImgTouchMove}
          onTouchEnd={handleImgTouchEnd}
        >
          {isPhotoFullscreen && (
            <div className="absolute inset-0 z-50 bg-black flex items-center justify-center">
              <img
                src={photo.imageUrl}
                alt={photo.caption}
                className="max-w-full max-h-full object-contain sepia-photo"
                style={{ transform: imgTransform, transition: "transform 0.05s" }}
              />
              <button
                onClick={() => { setIsPhotoFullscreen(false); resetZoom(); }}
                className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-crimson"
                style={{ background: "rgba(20,12,4,0.75)", color: "#c4a882", border: "1px solid rgba(196,168,130,0.3)" }}
              >
                <Minimize2 size={12} /> Return to split
              </button>
            </div>
          )}
          <img
            src={photo.imageUrl}
            alt={photo.caption}
            className="w-full h-full object-cover sepia-photo"
            style={{ transform: imgTransform, transformOrigin: "center", transition: isPanning ? "none" : "transform 0.15s ease-out" }}
            draggable={false}
          />
          {/* Film grain */}
          <div className="absolute inset-0 pointer-events-none" style={{ background: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E\")", mixBlendMode: "multiply" }} />
          {/* Expand button */}
          <button
            onClick={() => setIsPhotoFullscreen(true)}
            className="absolute bottom-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-crimson"
            style={{ background: "rgba(20,12,4,0.6)", color: "#c4a882", border: "1px solid rgba(196,168,130,0.25)", backdropFilter: "blur(6px)" }}
          >
            <Maximize2 size={11} /> Expand image
          </button>
        </div>

        {/* Right: Story ~35% */}
        <div
          className="relative flex flex-col story-scroll"
          style={{
            width: "35%",
            background: "linear-gradient(160deg, hsl(36 28% 11%) 0%, hsl(28 32% 8%) 100%)",
            borderLeft: "1px solid rgba(196, 168, 130, 0.12)",
            overflowY: "auto",
          }}
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full transition-colors"
            style={{ background: "rgba(196,168,130,0.12)", color: "#a08060" }}
            aria-label="Close story"
          >
            <X size={16} />
          </button>

          <div className="px-8 pt-10 pb-12">
            {/* Location header */}
            <div className="mb-6 pb-5" style={{ borderBottom: "1px solid rgba(196,168,130,0.15)" }}>
              <h2 className="font-playfair text-2xl font-semibold leading-tight" style={{ color: "#e8d8c0" }}>
                {photo.caption}
              </h2>
              <p className="mt-1.5 text-sm font-crimson italic" style={{ color: "#9a7c5a" }}>
                {photo.location} · {photo.year}
              </p>
              {photo.photographer && (
                <p className="mt-1 text-xs font-crimson" style={{ color: "#6a5438", letterSpacing: "0.05em" }}>
                  Photograph by {photo.photographer}
                </p>
              )}
            </div>

            {/* Story body */}
            <div className="font-crimson text-[17px] leading-relaxed space-y-4" style={{ color: "#c0a880" }}>
              {photo.story.split("\n\n").map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── MOBILE LAYOUT ────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-40 flex flex-col no-select"
      style={{ background: "#080402" }}
    >
      {/* Photo fullscreen overlay */}
      {isPhotoFullscreen && (
        <div className="absolute inset-0 z-50 bg-black flex items-center justify-center">
          <div
            ref={imgAreaRef}
            className="w-full h-full flex items-center justify-center overflow-hidden"
            onTouchStart={handleImgTouchStart}
            onTouchMove={handleImgTouchMove}
            onTouchEnd={handleImgTouchEnd}
          >
            <img
              src={photo.imageUrl}
              alt={photo.caption}
              className="max-w-full max-h-full object-contain sepia-photo"
              style={{ transform: imgTransform, transformOrigin: "center", userSelect: "none" }}
              draggable={false}
            />
          </div>
          <button
            onClick={() => { setIsPhotoFullscreen(false); resetZoom(); }}
            className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-crimson"
            style={{ background: "rgba(20,12,4,0.75)", color: "#c4a882", border: "1px solid rgba(196,168,130,0.3)" }}
          >
            <Minimize2 size={12} /> Return
          </button>
        </div>
      )}

      {/* Upper photo area */}
      <div
        ref={imgAreaRef}
        className="relative overflow-hidden flex-shrink-0"
        style={{
          height: `${splitRatio}%`,
          cursor: zoom.scale > 1 ? "grab" : "default",
          touchAction: "none",
        }}
        onTouchStart={handleImgTouchStart}
        onTouchMove={handleImgTouchMove}
        onTouchEnd={handleImgTouchEnd}
      >
        <img
          src={photo.imageUrl}
          alt={photo.caption}
          className="w-full h-full object-cover sepia-photo"
          style={{
            transform: imgTransform,
            transformOrigin: "center",
            transition: isPanning ? "none" : "transform 0.15s ease-out",
            userSelect: "none",
          }}
          draggable={false}
        />
        {/* Film grain */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.07'/%3E%3C/svg%3E\")", mixBlendMode: "multiply" as const }} />
        {/* Vignette */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(4,2,0,0.45) 100%)" }} />
        {/* Expand */}
        <button
          onClick={() => setIsPhotoFullscreen(true)}
          className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-crimson"
          style={{ background: "rgba(20,12,4,0.65)", color: "#c4a882", border: "1px solid rgba(196,168,130,0.2)", backdropFilter: "blur(4px)" }}
        >
          <Maximize2 size={10} /> Expand
        </button>
      </div>

      {/* Drag handle */}
      <div
        className="relative flex-shrink-0 flex items-center justify-center cursor-row-resize"
        style={{
          height: "24px",
          background: "linear-gradient(0deg, hsl(28 32% 8%) 0%, hsl(28 28% 12%) 100%)",
          borderTop: "1px solid rgba(196,168,130,0.15)",
          borderBottom: "1px solid rgba(196,168,130,0.1)",
          touchAction: "none",
        }}
        onMouseDown={handleDividerMouseDown}
        onTouchStart={handleDividerMouseDown}
      >
        <div className="flex items-center gap-0.5">
          <div className="w-8 h-0.5 rounded-full" style={{ background: "rgba(196,168,130,0.35)" }} />
        </div>
      </div>

      {/* Lower story area */}
      <div
        className="flex-1 overflow-hidden flex flex-col"
        style={{
          background: "linear-gradient(160deg, hsl(36 28% 11%) 0%, hsl(28 32% 8%) 100%)",
          minHeight: 0,
        }}
      >
        {/* Story header with close */}
        <div
          className="flex-shrink-0 flex items-start justify-between px-5 pt-4 pb-3"
          style={{ borderBottom: "1px solid rgba(196,168,130,0.12)" }}
        >
          <div>
            <h2 className="font-playfair text-xl font-semibold leading-tight" style={{ color: "#e8d8c0" }}>
              {photo.caption}
            </h2>
            <p className="mt-0.5 text-sm font-crimson italic" style={{ color: "#9a7c5a" }}>
              {photo.location} · {photo.year}
            </p>
            {photo.photographer && (
              <p className="mt-0.5 text-xs font-crimson" style={{ color: "#6a5438" }}>
                Photograph by {photo.photographer}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 ml-3 mt-0.5 w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: "rgba(196,168,130,0.1)", color: "#a08060" }}
            aria-label="Close story"
          >
            <ChevronDown size={16} />
          </button>
        </div>

        {/* Scrollable text */}
        <div className="flex-1 overflow-y-auto story-scroll px-5 py-4">
          <div className="font-crimson text-[16px] leading-relaxed space-y-4 pb-8" style={{ color: "#c0a880" }}>
            {photo.story.split("\n\n").map((para, i) => (
              <p key={i}>{para}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
