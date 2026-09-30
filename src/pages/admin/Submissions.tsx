import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getImageUrl } from "@/lib/image-url";
import { DbPhoto } from "@/types/db";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, XCircle, Eye, Loader2, ExternalLink, User } from "lucide-react";

export default function Submissions() {
  const [photos, setPhotos] = useState<DbPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [submitterMap, setSubmitterMap] = useState<Record<string, string>>({});

  const fetchPhotos = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("photos")
      .select("*")
      .eq("status", filter)
      .order("created_at", { ascending: true });
    if (error) { toast.error("Failed to load submissions"); console.error(error); }
    else {
      const list = (data ?? []) as DbPhoto[];
      setPhotos(list);
      // Fetch submitter names
      const ids = [...new Set(list.map(p => p.submitted_by).filter(Boolean))] as string[];
      if (ids.length > 0) {
        const { data: profiles } = await supabase.from("user_profiles").select("id, email, display_name, username").in("id", ids);
        if (profiles) {
          const map: Record<string, string> = {};
          profiles.forEach(p => { map[p.id] = p.display_name || p.username || p.email; });
          setSubmitterMap(map);
        }
      }
    }
    setLoading(false);
  };

  useEffect(() => { fetchPhotos(); }, [filter]);

  const handleApprove = async (photo: DbPhoto) => {
    setActionId(photo.id);
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("photos").update({
      status: "approved",
      is_published: true,
      approved_by: session?.user?.id,
    }).eq("id", photo.id);
    if (error) toast.error("Failed to approve");
    else { toast.success("Photograph approved and published"); setPhotos(prev => prev.filter(p => p.id !== photo.id)); }
    setActionId(null);
  };

  const handleReject = async (photo: DbPhoto) => {
    if (!rejectReason.trim()) { toast.error("Please provide a rejection reason"); return; }
    setActionId(photo.id);
    const { error } = await supabase.from("photos").update({
      status: "rejected",
      is_published: false,
      rejection_reason: rejectReason.trim(),
    }).eq("id", photo.id);
    if (error) toast.error("Failed to reject");
    else { toast.success("Photograph rejected"); setPhotos(prev => prev.filter(p => p.id !== photo.id)); setRejectId(null); setRejectReason(""); }
    setActionId(null);
  };

  const filterTabs: { key: typeof filter; label: string }[] = [
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "rejected", label: "Rejected" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(28 28% 9%) 0%, #080402 100%)" }}>
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E")`,
        mixBlendMode: "multiply", zIndex: 0,
      }} />

      <div className="relative z-10 max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-8">
          <Link to="/admin" className="flex items-center justify-center w-8 h-8 rounded-full"
            style={{ background: "rgba(196,168,130,0.08)", border: "1px solid rgba(196,168,130,0.15)", color: "#9a7c5a" }}>
            <ArrowLeft size={14} />
          </Link>
          <div>
            <h1 className="font-playfair text-lg font-semibold" style={{ color: "#e8d8c0" }}>Community Submissions</h1>
            <p className="text-xs font-crimson mt-0.5" style={{ color: "#6a5438" }}>Review and approve photographs from the community</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-sm w-fit"
          style={{ background: "rgba(196,168,130,0.06)", border: "1px solid rgba(196,168,130,0.12)" }}>
          {filterTabs.map(t => (
            <button key={t.key} onClick={() => setFilter(t.key)}
              className="px-4 py-1.5 text-sm font-crimson rounded-sm transition-all"
              style={{
                background: filter === t.key ? "rgba(196,168,130,0.18)" : "transparent",
                border: filter === t.key ? "1px solid rgba(196,168,130,0.25)" : "1px solid transparent",
                color: filter === t.key ? "#d4b896" : "#6a5438",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={20} className="animate-spin" style={{ color: "#9a7c5a" }} />
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center py-16 gap-2"
            style={{ border: "1px solid rgba(196,168,130,0.1)", borderRadius: "2px" }}>
            <Eye size={28} style={{ color: "#3a2a1a" }} />
            <p className="font-crimson text-sm" style={{ color: "#6a5438" }}>No {filter} submissions.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {photos.map(photo => (
              <div key={photo.id} className="rounded-sm overflow-hidden"
                style={{ background: "rgba(196,168,130,0.04)", border: "1px solid rgba(196,168,130,0.12)" }}>
                <div className="flex gap-4 p-4">
                  {/* Thumbnail */}
                  <div className="w-28 h-20 rounded-sm overflow-hidden flex-shrink-0"
                    style={{ border: "1px solid rgba(196,168,130,0.15)" }}>
                    <img src={getImageUrl(photo.image_url)} alt={photo.caption} className="w-full h-full object-cover"
                      style={{ filter: "sepia(20%)" }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-playfair text-sm font-semibold" style={{ color: "#e8d8c0" }}>{photo.caption}</h3>
                        <p className="text-xs font-crimson mt-0.5" style={{ color: "#9a7c5a" }}>{photo.location} · {photo.year}</p>
                        {photo.photographer && <p className="text-xs font-crimson italic mt-0.5" style={{ color: "#6a5438" }}>Photo by: {photo.photographer}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {filter === "pending" && (
                          <>
                            <button onClick={() => { setRejectId(photo.id); setRejectReason(""); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-crimson rounded-sm"
                              style={{ background: "rgba(192,80,64,0.12)", border: "1px solid rgba(192,80,64,0.3)", color: "#c08070" }}>
                              <XCircle size={12} /> Reject
                            </button>
                            <button onClick={() => handleApprove(photo)} disabled={actionId === photo.id}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-crimson rounded-sm"
                              style={{ background: "rgba(138,184,112,0.12)", border: "1px solid rgba(138,184,112,0.3)", color: "#8ab870" }}>
                              {actionId === photo.id ? <Loader2 size={12} className="animate-spin" /> : <><CheckCircle size={12} /> Approve</>}
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {photo.submitted_by && (
                        <span className="flex items-center gap-1 text-xs font-crimson" style={{ color: "#6a5438" }}>
                          <User size={10} /> {submitterMap[photo.submitted_by] || "Unknown user"}
                        </span>
                      )}
                      {photo.contact_email && (
                        <span className="text-xs font-crimson" style={{ color: "#5a4030" }}>{photo.contact_email}</span>
                      )}
                      {photo.source_link && (
                        <a href={photo.source_link} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs font-crimson" style={{ color: "#6a5438" }}>
                          <ExternalLink size={10} /> Source
                        </a>
                      )}
                    </div>
                    {photo.source_info && <p className="mt-1.5 text-xs font-crimson italic" style={{ color: "#6a5438" }}>Source: {photo.source_info}</p>}
                    {photo.relationship_to_photo && <p className="mt-0.5 text-xs font-crimson italic" style={{ color: "#6a5438" }}>Relationship: {photo.relationship_to_photo}</p>}
                    {photo.story && (
                      <p className="mt-1.5 text-xs font-crimson leading-relaxed line-clamp-2" style={{ color: "#7a6048" }}>{photo.story}</p>
                    )}
                    {photo.status === "rejected" && photo.rejection_reason && (
                      <p className="mt-1.5 text-xs font-crimson italic" style={{ color: "#c05040" }}>Rejection reason: {photo.rejection_reason}</p>
                    )}
                  </div>
                </div>

                {/* Reject reason form */}
                {rejectId === photo.id && (
                  <div className="px-4 pb-4 pt-0"
                    style={{ borderTop: "1px solid rgba(196,168,130,0.1)" }}>
                    <div className="mt-3 space-y-2">
                      <label className="text-xs font-crimson" style={{ color: "#9a7c5a", letterSpacing: "0.06em" }}>REJECTION REASON</label>
                      <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2}
                        placeholder="Briefly explain why this photograph is not approved…"
                        className="w-full px-3 py-2 text-sm font-crimson rounded-sm outline-none resize-none"
                        style={{ background: "rgba(196,168,130,0.06)", border: "1px solid rgba(196,168,130,0.2)", color: "#e8d8c0" }} />
                      <div className="flex gap-2">
                        <button onClick={() => setRejectId(null)}
                          className="px-3 py-1.5 text-xs font-crimson rounded-sm"
                          style={{ border: "1px solid rgba(196,168,130,0.15)", color: "#6a5438" }}>Cancel</button>
                        <button onClick={() => handleReject(photo)} disabled={actionId === photo.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-crimson rounded-sm"
                          style={{ background: "rgba(192,80,64,0.15)", border: "1px solid rgba(192,80,64,0.3)", color: "#c08070" }}>
                          {actionId === photo.id ? <Loader2 size={12} className="animate-spin" /> : <><XCircle size={12} /> Confirm Rejection</>}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
