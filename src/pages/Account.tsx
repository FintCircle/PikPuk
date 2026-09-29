import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { DbPhoto } from "@/types/db";
import { toast } from "sonner";
import { Camera, LogOut, ArrowLeft, Eye, Clock, CheckCircle, XCircle, Upload, Loader2 } from "lucide-react";

type Tab = "submissions" | "views";

const STATUS_LABEL: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending: { label: "Pending Review", color: "#b89040", icon: <Clock size={12} /> },
  approved: { label: "Published", color: "#8ab870", icon: <CheckCircle size={12} /> },
  rejected: { label: "Not Approved", color: "#c05040", icon: <XCircle size={12} /> },
};

export default function Account() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("submissions");
  const [submissions, setSubmissions] = useState<DbPhoto[]>([]);
  const [viewedPhotos, setViewedPhotos] = useState<DbPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    const [subRes, viewRes] = await Promise.all([
      supabase.from("photos").select("*").eq("submitted_by", user!.id).order("created_at", { ascending: false }),
      supabase.from("photo_views").select("photo_id").eq("user_id", user!.id).order("viewed_at", { ascending: false }).limit(50),
    ]);

    if (subRes.data) setSubmissions(subRes.data as DbPhoto[]);

    if (viewRes.data && viewRes.data.length > 0) {
      const ids = viewRes.data.map(v => v.photo_id);
      const { data: photos } = await supabase.from("photos").select("*").in("id", ids).eq("is_published", true);
      if (photos) {
        const ordered = ids.map(id => photos.find(p => p.id === id)).filter(Boolean) as DbPhoto[];
        setViewedPhotos(ordered);
      }
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    logout();
    navigate("/");
  };

  const totalViews = submissions.reduce((acc, p) => acc + (p.view_count || 0), 0);
  const approvedCount = submissions.filter(p => p.status === "approved").length;
  const pendingCount = submissions.filter(p => p.status === "pending").length;
  const rejectedCount = submissions.filter(p => p.status === "rejected").length;

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(28 28% 9%) 0%, #080402 100%)" }}>
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E")`,
        mixBlendMode: "multiply", zIndex: 0,
      }} />

      <div className="relative z-10 max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center justify-center w-8 h-8 rounded-full"
              style={{ background: "rgba(196,168,130,0.08)", border: "1px solid rgba(196,168,130,0.15)", color: "#9a7c5a" }}>
              <ArrowLeft size={14} />
            </Link>
            <div>
              <h1 className="font-playfair text-lg font-semibold" style={{ color: "#e8d8c0" }}>
                {user?.username || "My Account"}
              </h1>
              <p className="text-xs font-crimson mt-0.5" style={{ color: "#6a5438" }}>{user?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {user?.isAdmin && (
              <Link to="/admin" className="px-3 py-1.5 text-xs font-crimson rounded-sm"
                style={{ color: "#c4a882", border: "1px solid rgba(196,168,130,0.25)", background: "rgba(196,168,130,0.08)" }}>
                Admin Panel
              </Link>
            )}
            <Link to="/submit" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-crimson rounded-sm"
              style={{ background: "rgba(196,168,130,0.12)", border: "1px solid rgba(196,168,130,0.2)", color: "#d4b896" }}>
              <Upload size={11} /> Submit Photo
            </Link>
            <button onClick={handleLogout} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-crimson rounded-sm"
              style={{ color: "#9a7c5a", border: "1px solid rgba(196,168,130,0.12)" }}>
              <LogOut size={12} /> Sign Out
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Submitted", value: submissions.length },
            { label: "Published", value: approvedCount, color: "#8ab870" },
            { label: "Pending", value: pendingCount, color: "#b89040" },
            { label: "Total Views", value: totalViews },
          ].map(s => (
            <div key={s.label} className="px-4 py-3 rounded-sm"
              style={{ background: "rgba(196,168,130,0.05)", border: "1px solid rgba(196,168,130,0.1)" }}>
              <p className="text-xs font-crimson" style={{ color: "#6a5438", letterSpacing: "0.06em" }}>{s.label.toUpperCase()}</p>
              <p className="font-playfair text-2xl font-semibold mt-0.5" style={{ color: s.color ?? "#d4b896" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-sm w-fit"
          style={{ background: "rgba(196,168,130,0.06)", border: "1px solid rgba(196,168,130,0.12)" }}>
          {([["submissions", "My Submissions"], ["views", "Viewing History"]] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-1.5 text-sm font-crimson rounded-sm transition-all"
              style={{
                background: tab === t ? "rgba(196,168,130,0.18)" : "transparent",
                border: tab === t ? "1px solid rgba(196,168,130,0.25)" : "1px solid transparent",
                color: tab === t ? "#d4b896" : "#6a5438",
              }}>
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin" style={{ color: "#9a7c5a" }} />
          </div>
        ) : tab === "submissions" ? (
          <div>
            {submissions.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3"
                style={{ border: "1px solid rgba(196,168,130,0.1)", borderRadius: "2px" }}>
                <Camera size={32} style={{ color: "#3a2a1a" }} />
                <p className="font-crimson text-sm" style={{ color: "#6a5438" }}>No submissions yet.</p>
                <Link to="/submit" className="flex items-center gap-1.5 px-4 py-2 text-sm font-crimson rounded-sm"
                  style={{ background: "rgba(196,168,130,0.12)", border: "1px solid rgba(196,168,130,0.25)", color: "#c4a882" }}>
                  <Upload size={13} /> Submit Your First Photo
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {submissions.map(photo => {
                  const status = STATUS_LABEL[photo.status] ?? STATUS_LABEL.pending;
                  return (
                    <div key={photo.id} className="flex items-start gap-3 px-4 py-3 rounded-sm"
                      style={{ background: "rgba(196,168,130,0.04)", border: "1px solid rgba(196,168,130,0.1)" }}>
                      <div className="w-16 h-12 rounded-sm overflow-hidden flex-shrink-0"
                        style={{ border: "1px solid rgba(196,168,130,0.15)" }}>
                        <img src={photo.image_url} alt={photo.caption} className="w-full h-full object-cover"
                          style={{ filter: "sepia(20%)" }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-playfair text-sm font-semibold" style={{ color: "#c0a880" }}>{photo.caption}</p>
                            <p className="text-xs font-crimson mt-0.5" style={{ color: "#6a5438" }}>{photo.location} · {photo.year}</p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="flex items-center gap-1 text-xs font-crimson" style={{ color: "#6a5438" }}>
                              <Eye size={11} /> {photo.view_count}
                            </div>
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-crimson"
                              style={{ background: `${status.color}18`, border: `1px solid ${status.color}40`, color: status.color }}>
                              {status.icon} {status.label}
                            </span>
                          </div>
                        </div>
                        {photo.status === "rejected" && photo.rejection_reason && (
                          <p className="text-xs font-crimson mt-1.5 italic" style={{ color: "#8a5040" }}>
                            Reason: {photo.rejection_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div>
            {viewedPhotos.length === 0 ? (
              <div className="flex flex-col items-center py-16 gap-3"
                style={{ border: "1px solid rgba(196,168,130,0.1)", borderRadius: "2px" }}>
                <Eye size={32} style={{ color: "#3a2a1a" }} />
                <p className="font-crimson text-sm" style={{ color: "#6a5438" }}>No viewing history yet. Start browsing!</p>
                <Link to="/" className="px-4 py-2 text-sm font-crimson rounded-sm"
                  style={{ background: "rgba(196,168,130,0.12)", border: "1px solid rgba(196,168,130,0.25)", color: "#c4a882" }}>
                  Browse Archive
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {viewedPhotos.map(photo => (
                  <div key={photo.id} className="rounded-sm overflow-hidden"
                    style={{ border: "1px solid rgba(196,168,130,0.1)" }}>
                    <div className="aspect-square overflow-hidden">
                      <img src={photo.image_url} alt={photo.caption} className="w-full h-full object-cover"
                        style={{ filter: "sepia(25%)" }} />
                    </div>
                    <div className="px-2 py-1.5">
                      <p className="font-playfair text-xs font-semibold leading-tight" style={{ color: "#c0a880" }}>{photo.caption}</p>
                      <p className="text-xs font-crimson mt-0.5" style={{ color: "#5a4030" }}>{photo.year}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
