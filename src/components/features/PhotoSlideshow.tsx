import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Info, Camera, UserCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { DbPhoto } from "@/types/db";
import { Photo } from "@/types/photo";
import { PHOTOS as FALLBACK_PHOTOS } from "@/constants/photos";
import { StoryPanel } from "@/components/features/StoryPanel";
import { MusicPlayer } from "@/components/features/MusicPlayer";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "react-router-dom";

// ─── Controlled Shuffle ───────────────────────────────────────────────────────
// Priority: unseen > new (recently published) > anything
// Constraint: avoid repeating same location or year consecutively
// Visitors: localStorage, signed-in: DB photo_views

const LS_KEY = "pikpuk_viewed";

function getLocalViewed(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function addLocalViewed(id: string) {
  const set = getLocalViewed();
  set.add(id);
  // Keep last 200 to avoid unbounded growth
  const arr = Array.from(set).slice(-200);
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
}

function weightedShuffle(photos: Photo[], viewedIds: Set<string>): Photo[] {
  if (photos.length === 0) return [];

  const now = Date.now();
  const threeDays = 3 * 24 * 60 * 60 * 1000;

  // Assign weights: unseen new = 10, unseen old = 6, seen recent = 1
  const weighted = photos.map(p => {
    const seen = viewedIds.has(p.id);
    // Treat photos with recent IDs (uuid v4 time-ordered via created_at) as "new"
    const weight = seen ? 1 : 6;
    return { photo: p, weight };
  });

  // Fisher-Yates with weight influence: build sequence
  const result: Photo[] = [];
  const pool = [...weighted];

  while (pool.length > 0) {
    const totalWeight = pool.reduce((s, x) => s + x.weight, 0);
    let rand = Math.random() * totalWeight;
    let chosen = 0;
    for (let i = 0; i < pool.length; i++) {
      rand -= pool[i].weight;
      if (rand <= 0) { chosen = i; break; }
    }

    const candidate = pool[chosen];

    // Avoid repeating same location or year as last added
    if (result.length > 0) {
      const last = result[result.length - 1];
      if (
        pool.length > 2 &&
        (candidate.photo.location === last.location || candidate.photo.year === last.year)
      ) {
        // Try to pick another
        const altIdx = pool.findIndex((p, i) =>
          i !== chosen &&
          p.photo.location !== last.location &&
          p.photo.year !== last.year
        );
        if (altIdx !== -1) {
          result.push(pool[altIdx].photo);
          pool.splice(altIdx, 1);
          continue;
        }
      }
    }

    result.push(candidate.photo);
    pool.splice(chosen, 1);
  }

  return result;
}

function dbToPhoto(p: DbPhoto): Photo {
  return {
    id: p.id,
    imageUrl: p.image_url,
    caption: p.caption,
    location: p.location,
    year: p.year,
    photographer: p.photographer,
    story: p.story,
  };
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.innerWidth >= 1024);
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isDesktop;
}

export function PhotoSlideshow() {
  const isDesktop = useIsDesktop();
  const { user } = useAuth();
  const [dbPhotos, setDbPhotos] = useState<Photo[]>([]);
  const [dbLoading, setDbLoading] = useState(true);
  const [dbViewedIds, setDbViewedIds] = useState<Set<string>>(new Set());

  // Fetch published photos from DB
  useEffect(() => {
    supabase
      .from("photos")
      .select("*")
      .eq("is_published", true)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .then(({ data, error }) => {
        if (!error && data && data.length > 0) setDbPhotos(data.map(dbToPhoto));
        setDbLoading(false);
      });
  }, []);

  // Fetch DB view history for signed-in users
  useEffect(() => {
    if (!user) return;
    supabase.from("photo_views").select("photo_id").eq("user_id", user.id)
      .then(({ data }) => {
        if (data) setDbViewedIds(new Set(data.map(v => v.photo_id)));
      });
  }, [user]);

  const viewedIds = useMemo(() => {
    if (user) return dbViewedIds;
    return getLocalViewed();
  }, [user, dbViewedIds]);

  const sourcePhotos = !dbLoading && dbPhotos.length > 0 ? dbPhotos : FALLBACK_PHOTOS;
  const shuffled = useMemo(() => weightedShuffle(sourcePhotos, viewedIds), [sourcePhotos, viewedIds]);

  const [index, setIndex] = useState(0);
  const [storyOpen, setStoryOpen] = useState(false);
  const [direction, setDirection] = useState<"left" | "right" | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const isDragging = useRef(false);
  const [dragOffset, setDragOffset] = useState(0);

  const currentPhoto = shuffled[index] ?? shuffled[0];

  // Record view
  const recordView = useCallback(async (photo: Photo) => {
    if (!photo) return;
    if (user) {
      // Upsert DB view
      await supabase.from("photo_views").upsert(
        { photo_id: photo.id, user_id: user.id, viewed_at: new Date().toISOString() },
        { onConflict: "photo_id,user_id" }
      );
      setDbViewedIds(prev => new Set([...prev, photo.id]));
      // Increment view count
      await supabase.rpc("increment_view_count", { photo_id: photo.id }).catch(() => {
        // fallback: direct update
        supabase.from("photos").select("view_count").eq("id", photo.id).single()
          .then(({ data }) => {
            if (data) supabase.from("photos").update({ view_count: (data.view_count || 0) + 1 }).eq("id", photo.id);
          });
      });
    } else {
      addLocalViewed(photo.id);
    }
  }, [user]);

  // Record view when photo changes
  useEffect(() => {
    if (currentPhoto) recordView(currentPhoto);
  }, [currentPhoto?.id]);

  const goTo = useCallback((newIndex: number, dir: "left" | "right") => {
    if (isTransitioning || storyOpen) return;
    setDirection(dir);
    setIsTransitioning(true);
    setTimeout(() => {
      setIndex(newIndex);
      setDirection(null);
      setIsTransitioning(false);
    }, 320);
  }, [isTransitioning, storyOpen]);

  const goNext = useCallback(() => goTo((index + 1) % shuffled.length, "left"), [index, shuffled.length, goTo]);
  const goPrev = useCallback(() => goTo((index - 1 + shuffled.length) % shuffled.length, "right"), [index, shuffled.length, goTo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (storyOpen) return;
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev, storyOpen]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (storyOpen) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    isDragging.current = false;
  }, [storyOpen]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (storyOpen || touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - (touchStartY.current ?? 0);
    if (!isDragging.current && Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) isDragging.current = true;
    if (isDragging.current) setDragOffset(dx);
  }, [storyOpen]);

  const onTouchEnd = useCallback((e: React.TouchEvent) => {
    if (storyOpen || touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    setDragOffset(0);
    if (isDragging.current && Math.abs(dx) > 60) { if (dx < 0) goNext(); else goPrev(); }
    touchStartX.current = null; touchStartY.current = null; isDragging.current = false;
  }, [storyOpen, goNext, goPrev]);

  const mouseStartX = useRef<number | null>(null);
  const onMouseDown = useCallback((e: React.MouseEvent) => { if (storyOpen) return; mouseStartX.current = e.clientX; }, [storyOpen]);
  const onMouseUp = useCallback((e: React.MouseEvent) => {
    if (storyOpen || mouseStartX.current === null) return;
    const dx = e.clientX - mouseStartX.current;
    if (Math.abs(dx) > 80) { if (dx < 0) goNext(); else goPrev(); }
    mouseStartX.current = null;
  }, [storyOpen, goNext, goPrev]);

  const getSlideTransform = () => {
    if (dragOffset !== 0) return `translateX(${dragOffset}px)`;
    if (isTransitioning) return direction === "left" ? "translateX(-100vw)" : "translateX(100vw)";
    return "translateX(0)";
  };

  if (!currentPhoto) return null;

  return (
    <>
      <div
        className="fixed inset-0 overflow-hidden no-select"
        style={{ background: "#080402", cursor: storyOpen ? "default" : "grab" }}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown} onMouseUp={onMouseUp}
      >
        {/* Photo */}
        <div className="absolute inset-0" style={{
          transform: getSlideTransform(),
          transition: dragOffset !== 0 ? "none" : "transform 0.32s cubic-bezier(0.4, 0, 0.2, 1)",
        }}>
          <img src={currentPhoto.imageUrl} alt={currentPhoto.caption} className="w-full h-full object-cover sepia-photo"
            draggable={false} style={{ userSelect: "none" }} />
          <div className="absolute inset-0 pointer-events-none" style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.085'/%3E%3C/svg%3E")`,
            mixBlendMode: "multiply",
          }} />
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse at center, transparent 40%, rgba(4,2,0,0.6) 100%)" }} />
          <div className="absolute bottom-0 left-0 right-0 pointer-events-none" style={{ height: "45%", background: "linear-gradient(to top, rgba(4,2,0,0.88) 0%, rgba(4,2,0,0.5) 45%, transparent 100%)" }} />
        </div>

        {/* Top chrome — P left, controls right */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-start justify-between px-4 pt-5 pointer-events-none">
          {/* P Logo */}
          <div className="pointer-events-auto flex items-center justify-center w-10 h-10 rounded-full"
            style={{ background: "rgba(20, 12, 4, 0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(196, 168, 130, 0.28)" }}>
            <span className="font-playfair font-bold text-lg leading-none" style={{ color: "#d4b896", letterSpacing: "-0.02em" }}>P</span>
          </div>

          {/* Right controls */}
          <div className="pointer-events-auto flex items-center gap-2">
            <MusicPlayer />
            {/* Account / Sign In */}
            <Link to={user ? "/account" : "/login"}
              className="flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 hover:scale-110"
              style={{ background: "rgba(20, 12, 4, 0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(196, 168, 130, 0.3)" }}
              aria-label={user ? "My account" : "Sign in"}>
              {user ? (
                <div className="w-4 h-4 rounded-full flex items-center justify-center" style={{ background: "rgba(196,168,130,0.3)" }}>
                  <span className="font-playfair font-bold" style={{ fontSize: "9px", color: "#d4b896" }}>{(user.username || user.email)[0].toUpperCase()}</span>
                </div>
              ) : (
                <UserCircle size={15} className="text-[#a08060] hover:text-[#c4a882]" />
              )}
            </Link>
            {/* Camera / Submit icon */}
            <Link to={user ? "/submit" : "/login"}
              className="flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 hover:scale-110"
              style={{ background: "rgba(20, 12, 4, 0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(196, 168, 130, 0.3)" }}
              aria-label="Submit a photograph">
              <Camera size={14} className="text-[#a08060] hover:text-[#c4a882]" />
            </Link>
            {/* Info button */}
            <button onClick={() => setStoryOpen(true)} aria-label="Read the story behind this photograph"
              className="flex items-center justify-center w-9 h-9 rounded-full transition-all duration-200 hover:scale-110"
              style={{ background: "rgba(20, 12, 4, 0.55)", backdropFilter: "blur(8px)", border: "1px solid rgba(196, 168, 130, 0.3)" }}>
              <Info size={15} className="text-[#d4b896]" />
            </button>
          </div>
        </div>

        {/* Bottom caption */}
        <div className="absolute bottom-0 left-0 right-0 z-10 px-6 pb-8 pointer-events-none">
          <div className="max-w-xl">
            <p className="font-fell italic text-sm mb-1" style={{ color: "rgba(196,168,130,0.65)", letterSpacing: "0.06em" }}>
              {currentPhoto.location} · {currentPhoto.year}
            </p>
            <h1 className="font-playfair text-2xl font-semibold leading-snug" style={{ color: "#f0e0c8", textShadow: "0 1px 12px rgba(4,2,0,0.8)" }}>
              {currentPhoto.caption}
            </h1>
          </div>
          <div className="flex items-center gap-1.5 mt-4">
            {shuffled.slice(0, 12).map((_, i) => (
              <div key={i} className="rounded-full transition-all duration-300" style={{
                width: i === index ? "20px" : "5px",
                height: "5px",
                background: i === index ? "rgba(212,184,150,0.9)" : "rgba(212,184,150,0.3)",
              }} />
            ))}
            {shuffled.length > 12 && <span className="font-crimson text-xs" style={{ color: "rgba(196,168,130,0.4)" }}>+{shuffled.length - 12}</span>}
          </div>
        </div>

      </div>

      {storyOpen && <StoryPanel photo={currentPhoto} onClose={() => setStoryOpen(false)} isDesktop={isDesktop} />}
    </>
  );
}
