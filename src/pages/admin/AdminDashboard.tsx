import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getImageUrl } from "@/lib/image-url";
import { useAuth } from "@/contexts/AuthContext";
import { DbPhoto } from "@/types/db";
import { toast } from "sonner";
import { Plus, LogOut, Eye, EyeOff, Pencil, Trash2, ImageIcon, GripVertical, Loader2, ArrowUpDown, Users, Inbox, Music, Upload, X } from "lucide-react";
import { FunctionsHttpError } from "@supabase/supabase-js";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState<DbPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Music upload state
  const [musicUrl, setMusicUrl] = useState<string>("");
  const [musicFile, setMusicFile] = useState<File | null>(null);
  const [uploadingMusic, setUploadingMusic] = useState(false);
  const musicInputRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = async () => {
    const [photosRes, pendingRes, musicRes] = await Promise.all([
      supabase.from("photos").select("*").order("sort_order", { ascending: true }).order("created_at", { ascending: false }),
      supabase.from("photos").select("id", { count: "exact" }).eq("status", "pending"),
      supabase.from("app_settings").select("value").eq("key", "music_url").single(),
    ]);

    if (photosRes.error) { toast.error("Failed to load photos"); console.error(photosRes.error); }
    else setPhotos((photosRes.data ?? []) as DbPhoto[]);

    setPendingCount(pendingRes.count ?? 0);
    if (musicRes.data?.value) setMusicUrl(musicRes.data.value);
    setLoading(false);
  };

  useEffect(() => { fetchPhotos(); }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut(); logout(); navigate("/admin/login");
  };

  const handleTogglePublish = async (photo: DbPhoto) => {
    setTogglingId(photo.id);
    const { error } = await supabase.from("photos").update({ is_published: !photo.is_published }).eq("id", photo.id);
    if (error) toast.error("Failed to update photo");
    else {
      toast.success(photo.is_published ? "Photo unpublished" : "Photo published");
      setPhotos(prev => prev.map(p => p.id === photo.id ? { ...p, is_published: !p.is_published } : p));
    }
    setTogglingId(null);
  };

  const handleDelete = async (photo: DbPhoto) => {
    if (!window.confirm(`Delete "${photo.caption}"? This cannot be undone.`)) return;
    setDeletingId(photo.id);
    if (photo.r2_key) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const { error: fnError } = await supabase.functions.invoke("delete-from-r2", {
          body: { r2Key: photo.r2_key },
          headers: { Authorization: `Bearer ${session?.access_token}` },
        });
        if (fnError) {
          let msg = fnError.message;
          if (fnError instanceof FunctionsHttpError) { try { msg = await fnError.context.text(); } catch { } }
          console.error("R2 delete error:", msg);
        }
      } catch (err) { console.error("R2 delete failed:", err); }
    }
    const { error } = await supabase.from("photos").delete().eq("id", photo.id);
    if (error) toast.error("Failed to delete photo");
    else { toast.success("Photo deleted"); setPhotos(prev => prev.filter(p => p.id !== photo.id)); }
    setDeletingId(null);
  };

  const handleMusicUpload = async () => {
    if (!musicFile) return;
    setUploadingMusic(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const formData = new FormData();
      formData.append("file", musicFile);
      formData.append("folder", "audio");
      const { data, error } = await supabase.functions.invoke("upload-to-r2", {
        body: formData,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) { try { msg = await error.context.text(); } catch { } }
        throw new Error(msg);
      }
      const url = data.imageUrl; // same field, it's the public URL
      await supabase.from("app_settings").upsert({ key: "music_url", value: url });
      setMusicUrl(url);
      setMusicFile(null);
      toast.success("Music uploaded and saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
    setUploadingMusic(false);
  };

  const handleSaveMusicUrl = async () => {
    if (!musicUrl.trim()) return;
    await supabase.from("app_settings").upsert({ key: "music_url", value: musicUrl.trim() });
    toast.success("Music URL saved");
  };

  const totalPhotos = photos.filter(p => p.status === "approved" || !p.submitted_by).length;
  const publishedCount = photos.filter(p => p.is_published && (p.status === "approved" || !p.submitted_by)).length;

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(28 28% 9%) 0%, #080402 100%)" }}>
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E")`,
        mixBlendMode: "multiply", zIndex: 0,
      }} />

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: "rgba(20,12,4,0.8)", border: "1px solid rgba(196,168,130,0.3)" }}>
              <span className="font-playfair font-bold text-base" style={{ color: "#d4b896" }}>P</span>
            </div>
            <div>
              <h1 className="font-playfair text-lg font-semibold leading-none" style={{ color: "#e8d8c0" }}>PikPuk Admin</h1>
              <p className="text-xs font-crimson mt-0.5" style={{ color: "#6a5438" }}>{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/" className="px-3 py-1.5 text-xs font-crimson rounded-sm" style={{ color: "#9a7c5a", border: "1px solid rgba(196,168,130,0.15)" }}>View Site</Link>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-crimson rounded-sm" style={{ color: "#9a7c5a", border: "1px solid rgba(196,168,130,0.15)" }}>
              <LogOut size={12} /> Sign Out
            </button>
          </div>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Link to="/admin/submissions"
            className="px-4 py-3 rounded-sm flex items-center gap-2 transition-all"
            style={{ background: pendingCount > 0 ? "rgba(196,168,130,0.1)" : "rgba(196,168,130,0.05)", border: `1px solid ${pendingCount > 0 ? "rgba(196,168,130,0.25)" : "rgba(196,168,130,0.1)"}` }}>
            <Inbox size={16} style={{ color: pendingCount > 0 ? "#d4b896" : "#6a5438" }} />
            <div>
              <p className="text-xs font-crimson" style={{ color: "#6a5438", letterSpacing: "0.06em" }}>SUBMISSIONS</p>
              <p className="font-playfair text-2xl font-semibold" style={{ color: pendingCount > 0 ? "#d4b896" : "#6a5438" }}>{pendingCount}</p>
            </div>
          </Link>
          <Link to="/admin/users"
            className="px-4 py-3 rounded-sm flex items-center gap-2"
            style={{ background: "rgba(196,168,130,0.05)", border: "1px solid rgba(196,168,130,0.1)" }}>
            <Users size={16} style={{ color: "#6a5438" }} />
            <div>
              <p className="text-xs font-crimson" style={{ color: "#6a5438", letterSpacing: "0.06em" }}>USERS</p>
              <p className="font-playfair text-sm font-semibold mt-0.5" style={{ color: "#9a7c5a" }}>Manage</p>
            </div>
          </Link>
          <div className="px-4 py-3 rounded-sm" style={{ background: "rgba(196,168,130,0.05)", border: "1px solid rgba(196,168,130,0.1)" }}>
            <p className="text-xs font-crimson" style={{ color: "#6a5438", letterSpacing: "0.06em" }}>PUBLISHED</p>
            <p className="font-playfair text-2xl font-semibold mt-0.5" style={{ color: "#d4b896" }}>{publishedCount}</p>
          </div>
          <div className="px-4 py-3 rounded-sm" style={{ background: "rgba(196,168,130,0.05)", border: "1px solid rgba(196,168,130,0.1)" }}>
            <p className="text-xs font-crimson" style={{ color: "#6a5438", letterSpacing: "0.06em" }}>ARCHIVE</p>
            <p className="font-playfair text-2xl font-semibold mt-0.5" style={{ color: "#d4b896" }}>{totalPhotos}</p>
          </div>
        </div>

        {/* Music settings */}
        <div className="rounded-sm p-4 mb-6" style={{ background: "rgba(196,168,130,0.04)", border: "1px solid rgba(196,168,130,0.12)" }}>
          <div className="flex items-center gap-2 mb-3">
            <Music size={14} style={{ color: "#9a7c5a" }} />
            <p className="text-xs font-crimson" style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}>BACKGROUND MUSIC</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {/* Upload file */}
            <div className="flex items-center gap-2">
              <input ref={musicInputRef} type="file" accept="audio/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) setMusicFile(f); }} />
              {musicFile ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-crimson" style={{ color: "#c4a882" }}>{musicFile.name}</span>
                  <button type="button" onClick={() => setMusicFile(null)} className="w-5 h-5 flex items-center justify-center" style={{ color: "#6a5438" }}>
                    <X size={12} />
                  </button>
                  <button type="button" onClick={handleMusicUpload} disabled={uploadingMusic}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-crimson rounded-sm"
                    style={{ background: "rgba(196,168,130,0.15)", border: "1px solid rgba(196,168,130,0.3)", color: "#d4b896" }}>
                    {uploadingMusic ? <Loader2 size={12} className="animate-spin" /> : <><Upload size={12} /> Upload</>}
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => musicInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-crimson rounded-sm"
                  style={{ background: "rgba(196,168,130,0.08)", border: "1px solid rgba(196,168,130,0.2)", color: "#9a7c5a" }}>
                  <Upload size={12} /> Upload Audio File
                </button>
              )}
            </div>
            {/* Or paste URL */}
            <div className="flex-1 flex items-center gap-2 min-w-[220px]">
              <input type="url" value={musicUrl} onChange={e => setMusicUrl(e.target.value)}
                placeholder="…or paste a music URL (MP3, OGG)"
                className="flex-1 px-3 py-1.5 text-xs font-crimson rounded-sm outline-none"
                style={{ background: "rgba(196,168,130,0.06)", border: "1px solid rgba(196,168,130,0.2)", color: "#e8d8c0" }} />
              <button type="button" onClick={handleSaveMusicUrl}
                className="px-3 py-1.5 text-xs font-crimson rounded-sm whitespace-nowrap"
                style={{ background: "rgba(196,168,130,0.12)", border: "1px solid rgba(196,168,130,0.25)", color: "#d4b896" }}>
                Save URL
              </button>
            </div>
          </div>
          {musicUrl && <p className="mt-2 text-xs font-crimson truncate" style={{ color: "#5a4030" }}>Current: {musicUrl}</p>}
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-playfair text-base font-semibold" style={{ color: "#c0a880" }}>Photograph Archive</h2>
          <Link to="/admin/photos/new" className="flex items-center gap-1.5 px-4 py-2 text-sm font-crimson rounded-sm transition-all"
            style={{ background: "rgba(196,168,130,0.15)", border: "1px solid rgba(196,168,130,0.3)", color: "#d4b896" }}>
            <Plus size={14} /> Add Photograph
          </Link>
        </div>

        {/* Table */}
        <div className="rounded-sm overflow-hidden" style={{ border: "1px solid rgba(196,168,130,0.12)" }}>
          {loading ? (
            <div className="flex items-center justify-center py-16"><Loader2 size={20} className="animate-spin" style={{ color: "#9a7c5a" }} /></div>
          ) : photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <ImageIcon size={32} style={{ color: "#3a2a1a" }} />
              <p className="font-crimson text-sm" style={{ color: "#6a5438" }}>No photographs yet. Add your first one.</p>
              <Link to="/admin/photos/new" className="flex items-center gap-1.5 px-4 py-2 text-sm font-crimson rounded-sm"
                style={{ background: "rgba(196,168,130,0.12)", border: "1px solid rgba(196,168,130,0.25)", color: "#c4a882" }}>
                <Plus size={13} /> Add Photograph
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(196,168,130,0.1)", background: "rgba(196,168,130,0.04)" }}>
                  <th className="px-4 py-3 text-left text-xs font-crimson" style={{ color: "#6a5438", letterSpacing: "0.07em" }}><div className="flex items-center gap-1"><ArrowUpDown size={10} /> ORDER</div></th>
                  <th className="px-4 py-3 text-left text-xs font-crimson" style={{ color: "#6a5438", letterSpacing: "0.07em" }}>PHOTOGRAPH</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-crimson" style={{ color: "#6a5438", letterSpacing: "0.07em" }}>LOCATION · YEAR</th>
                  <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-crimson" style={{ color: "#6a5438", letterSpacing: "0.07em" }}>STATUS</th>
                  <th className="px-4 py-3 text-right text-xs font-crimson" style={{ color: "#6a5438", letterSpacing: "0.07em" }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {photos.map((photo, idx) => (
                  <tr key={photo.id} style={{ borderBottom: idx < photos.length - 1 ? "1px solid rgba(196,168,130,0.07)" : "none", background: idx % 2 === 0 ? "transparent" : "rgba(196,168,130,0.02)" }}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <GripVertical size={12} style={{ color: "#3a2a1a" }} />
                        <span className="font-crimson text-sm" style={{ color: "#6a5438" }}>{photo.sort_order}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-9 rounded-sm overflow-hidden flex-shrink-0" style={{ border: "1px solid rgba(196,168,130,0.15)" }}>
                          <img src={getImageUrl(photo.image_url)} alt={photo.caption} className="w-full h-full object-cover" style={{ filter: "sepia(20%) contrast(1.02)" }} />
                        </div>
                        <div>
                          <p className="font-playfair text-sm font-semibold leading-snug" style={{ color: "#c0a880" }}>{photo.caption}</p>
                          {photo.submitted_by && <p className="text-xs font-crimson italic mt-0.5" style={{ color: "#4a3a28" }}>Community</p>}
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3">
                      <p className="text-sm font-crimson" style={{ color: "#9a7c5a" }}>{photo.location}</p>
                      <p className="text-xs font-crimson italic mt-0.5" style={{ color: "#5a4030" }}>{photo.year}</p>
                    </td>
                    <td className="hidden md:table-cell px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-crimson"
                        style={{
                          background: photo.is_published ? "rgba(100,150,80,0.12)" : "rgba(196,168,130,0.08)",
                          border: `1px solid ${photo.is_published ? "rgba(100,150,80,0.25)" : "rgba(196,168,130,0.15)"}`,
                          color: photo.is_published ? "#8ab870" : "#6a5438",
                        }}>
                        {photo.is_published ? <Eye size={10} /> : <EyeOff size={10} />}
                        {photo.is_published ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => handleTogglePublish(photo)} disabled={togglingId === photo.id} title={photo.is_published ? "Unpublish" : "Publish"}
                          className="w-7 h-7 flex items-center justify-center rounded-sm" style={{ color: "#6a5438" }}
                          onMouseEnter={e => e.currentTarget.style.color = "#c4a882"} onMouseLeave={e => e.currentTarget.style.color = "#6a5438"}>
                          {togglingId === photo.id ? <Loader2 size={13} className="animate-spin" /> : photo.is_published ? <EyeOff size={13} /> : <Eye size={13} />}
                        </button>
                        <Link to={`/admin/photos/${photo.id}/edit`} className="w-7 h-7 flex items-center justify-center rounded-sm" style={{ color: "#6a5438" }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#c4a882"} onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#6a5438"}>
                          <Pencil size={13} />
                        </Link>
                        <button onClick={() => handleDelete(photo)} disabled={deletingId === photo.id} title="Delete"
                          className="w-7 h-7 flex items-center justify-center rounded-sm" style={{ color: "#6a5438" }}
                          onMouseEnter={e => e.currentTarget.style.color = "#c05040"} onMouseLeave={e => e.currentTarget.style.color = "#6a5438"}>
                          {deletingId === photo.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <p className="text-center mt-6 text-xs font-crimson" style={{ color: "#2a1a0a" }}>PikPuk · Photograph Archive Management</p>
      </div>
    </div>
  );
}
