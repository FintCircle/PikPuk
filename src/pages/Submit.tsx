import { useState, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Upload, X, Loader2, ArrowLeft, ImageIcon, Camera } from "lucide-react";
import { FunctionsHttpError } from "@supabase/supabase-js";

export default function Submit() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [permissionConfirmed, setPermissionConfirmed] = useState(false);

  const [form, setForm] = useState({
    title: "",
    caption: "",
    story: "",
    year: "",
    location: "",
    photographer: "",
    source_info: "",
    relationship_to_photo: "",
    source_link: "",
    credit_name: "",
    contact_email: user?.email ?? "",
  });

  const set = (key: keyof typeof form, val: string) => setForm(prev => ({ ...prev, [key]: val }));

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Please select an image file"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10 MB"); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { navigate("/login"); return; }
    if (user.isBanned) { toast.error("Your account has been suspended."); return; }
    if (!imageFile) { toast.error("Please select a photograph to submit"); return; }
    if (!form.caption.trim()) { toast.error("Caption is required"); return; }
    if (!form.location.trim()) { toast.error("Location is required"); return; }
    if (!permissionConfirmed) { toast.error("Please confirm you have permission to share this photograph"); return; }

    setUploading(true);
    let imageUrl = "";
    let r2Key = "";
    let imageHash = "";

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const formData = new FormData();
      formData.append("file", imageFile);
      formData.append("folder", "submissions");

      const { data, error } = await supabase.functions.invoke("upload-to-r2", {
        body: formData,
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try { msg = await error.context.text(); } catch { /* ignore */ }
        }
        throw new Error(msg);
      }

      imageUrl = data.imageUrl;
      r2Key = data.r2Key;
      imageHash = data.imageHash ?? "";
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
      setUploading(false);
      return;
    }
    setUploading(false);
    setSaving(true);

    const { error } = await supabase.from("photos").insert({
      caption: form.caption.trim(),
      title: form.title.trim() || null,
      location: form.location.trim(),
      year: form.year.trim() || "Unknown",
      photographer: form.photographer.trim() || null,
      story: form.story.trim() || "",
      image_url: imageUrl,
      r2_key: r2Key,
      image_hash: imageHash || null,
      source_info: form.source_info.trim() || null,
      relationship_to_photo: form.relationship_to_photo.trim() || null,
      source_link: form.source_link.trim() || null,
      permission_confirmed: permissionConfirmed,
      credit_name: form.credit_name.trim() || null,
      contact_email: form.contact_email.trim() || null,
      submitted_by: user.id,
      is_published: false,
      status: "pending",
      sort_order: 0,
    });

    setSaving(false);
    if (error) {
      toast.error("Failed to submit photograph. Please try again.");
      console.error(error);
      return;
    }

    toast.success("Photograph submitted! It will appear in the archive after admin review.");
    navigate("/account");
  };

  if (!user) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#080402" }}>
        <div className="text-center space-y-3">
          <Camera size={32} style={{ color: "#6a5438", margin: "0 auto" }} />
          <p className="font-crimson text-sm" style={{ color: "#9a7c5a" }}>Sign in to submit photographs</p>
          <Link to="/login" className="block px-6 py-2 text-sm font-crimson rounded-sm"
            style={{ background: "rgba(196,168,130,0.15)", border: "1px solid rgba(196,168,130,0.3)", color: "#d4b896" }}>
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const inputCls = "w-full px-3 py-2.5 text-sm font-crimson rounded-sm outline-none transition-colors";
  const inputStyle = { background: "rgba(196,168,130,0.06)", border: "1px solid rgba(196,168,130,0.2)", color: "#e8d8c0" };
  const onFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => e.currentTarget.style.borderColor = "rgba(196,168,130,0.45)";
  const onBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => e.currentTarget.style.borderColor = "rgba(196,168,130,0.2)";

  const Field = ({ label, name, req, placeholder, type }: { label: string; name: keyof typeof form; req?: boolean; placeholder?: string; type?: string }) => (
    <div>
      <label className="block text-xs font-crimson mb-1.5" style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}>
        {label.toUpperCase()}{req && <span style={{ color: "#c05040" }}> *</span>}
      </label>
      <input type={type ?? "text"} value={form[name]} onChange={e => set(name, e.target.value)} placeholder={placeholder} required={req}
        className={inputCls} style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
    </div>
  );

  const TextArea = ({ label, name, req, placeholder, rows }: { label: string; name: keyof typeof form; req?: boolean; placeholder?: string; rows?: number }) => (
    <div>
      <label className="block text-xs font-crimson mb-1.5" style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}>
        {label.toUpperCase()}{req && <span style={{ color: "#c05040" }}> *</span>}
      </label>
      <textarea value={form[name]} onChange={e => set(name, e.target.value)} placeholder={placeholder} rows={rows ?? 4} required={req}
        className={inputCls + " resize-y"} style={{ ...inputStyle, minHeight: "90px" }} onFocus={onFocus} onBlur={onBlur} />
    </div>
  );

  const sectionStyle = { background: "rgba(196,168,130,0.04)", border: "1px solid rgba(196,168,130,0.12)" };

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(28 28% 9%) 0%, #080402 100%)" }}>
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E")`,
        mixBlendMode: "multiply", zIndex: 0,
      }} />

      <div className="relative z-10 max-w-2xl mx-auto px-4 py-6 pb-16">
        <div className="flex items-center gap-3 mb-8">
          <Link to="/" className="flex items-center justify-center w-8 h-8 rounded-full"
            style={{ background: "rgba(196,168,130,0.08)", border: "1px solid rgba(196,168,130,0.15)", color: "#9a7c5a" }}>
            <ArrowLeft size={14} />
          </Link>
          <div>
            <h1 className="font-playfair text-lg font-semibold" style={{ color: "#e8d8c0" }}>Submit a Photograph</h1>
            <p className="text-xs font-crimson mt-0.5" style={{ color: "#6a5438" }}>Share history with the archive — reviewed before publishing</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Image upload */}
          <div className="rounded-sm p-5" style={sectionStyle}>
            <p className="text-xs font-crimson mb-3" style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}>PHOTOGRAPH <span style={{ color: "#c05040" }}>*</span></p>
            <div
              className="relative rounded-sm cursor-pointer transition-colors"
              style={{
                border: `2px dashed ${dragOver ? "rgba(196,168,130,0.5)" : "rgba(196,168,130,0.2)"}`,
                background: dragOver ? "rgba(196,168,130,0.08)" : "transparent",
                minHeight: imagePreview ? "auto" : "140px",
              }}
              onClick={() => !imagePreview && fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="w-full rounded-sm object-cover" style={{ maxHeight: "280px", filter: "sepia(15%)" }} />
                  <button type="button" onClick={e => { e.stopPropagation(); setImageFile(null); setImagePreview(""); }}
                    className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full"
                    style={{ background: "rgba(4,2,0,0.7)", color: "#c4a882", border: "1px solid rgba(196,168,130,0.3)" }}>
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 gap-2" onClick={() => fileInputRef.current?.click()}>
                  <ImageIcon size={28} style={{ color: "#4a3a28" }} />
                  <p className="text-sm font-crimson" style={{ color: "#9a7c5a" }}>Drop photograph here or click to browse</p>
                  <p className="text-xs font-crimson" style={{ color: "#4a3a28" }}>JPG, PNG, WebP · max 10 MB</p>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); }} className="hidden" />
          </div>

          {/* Core details */}
          <div className="rounded-sm p-5 space-y-4" style={sectionStyle}>
            <p className="text-xs font-crimson" style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}>PHOTOGRAPH DETAILS</p>
            <Field label="Short Caption" name="caption" req placeholder="e.g. Fifth Avenue, New York City" />
            <Field label="Title (optional)" name="title" placeholder="A longer descriptive title" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Approximate Date" name="year" placeholder="c. 1908, 1920s, Unknown" />
              <Field label="Location" name="location" req placeholder="City, Country" />
            </div>
            <Field label="Photographer or Creator" name="photographer" placeholder="Name or 'Unknown'" />
            <TextArea label="Full Story or Additional Information" name="story" rows={5}
              placeholder="Share what you know about this photograph, its context, the people in it, or the moment it captures. Even a few sentences help." />
          </div>

          {/* Provenance */}
          <div className="rounded-sm p-5 space-y-4" style={sectionStyle}>
            <p className="text-xs font-crimson" style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}>PROVENANCE & SOURCE</p>
            <TextArea label="Where did you obtain this photograph?" name="source_info" rows={2}
              placeholder="Family album, estate sale, library archive, personal collection…" />
            <TextArea label="Your relationship to this photograph" name="relationship_to_photo" rows={2}
              placeholder="Family heirloom, found in grandmother's attic, purchased from collector…" />
            <Field label="Source link (if available)" name="source_link" type="url" placeholder="https://" />
          </div>

          {/* Credit & contact */}
          <div className="rounded-sm p-5 space-y-4" style={sectionStyle}>
            <p className="text-xs font-crimson" style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}>CREDIT & CONTACT</p>
            <Field label="Preferred public credit name" name="credit_name" placeholder="e.g. From the Collection of J. Smith" />
            <Field label="Contact email" name="contact_email" type="email" placeholder="you@example.com" />
          </div>

          {/* Permission */}
          <div className="rounded-sm p-5" style={sectionStyle}>
            <p className="text-xs font-crimson mb-3" style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}>PERMISSION <span style={{ color: "#c05040" }}>*</span></p>
            <label className="flex items-start gap-3 cursor-pointer">
              <button type="button" onClick={() => setPermissionConfirmed(p => !p)}
                className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-sm flex items-center justify-center transition-all"
                style={{
                  background: permissionConfirmed ? "rgba(138,184,112,0.25)" : "rgba(196,168,130,0.08)",
                  border: `1px solid ${permissionConfirmed ? "rgba(138,184,112,0.5)" : "rgba(196,168,130,0.25)"}`,
                }}>
                {permissionConfirmed && <span style={{ color: "#8ab870", fontSize: "11px", fontWeight: 700 }}>✓</span>}
              </button>
              <span className="font-crimson text-sm leading-relaxed" style={{ color: "#9a7c5a" }}>
                I own this photograph, have permission to share it, or believe it is in the public domain.
                I give PikPuk permission to display it.
              </span>
            </label>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <Link to="/" className="flex-1 flex items-center justify-center py-3 text-sm font-crimson rounded-sm"
              style={{ border: "1px solid rgba(196,168,130,0.15)", color: "#6a5438" }}>Cancel</Link>
            <button type="submit" disabled={uploading || saving}
              className="flex-[2] flex items-center justify-center gap-2 py-3 text-sm font-crimson rounded-sm transition-all"
              style={{
                background: uploading || saving ? "rgba(196,168,130,0.08)" : "rgba(196,168,130,0.18)",
                border: "1px solid rgba(196,168,130,0.3)",
                color: uploading || saving ? "#6a5438" : "#d4b896",
              }}>
              {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                : saving ? <><Loader2 size={14} className="animate-spin" /> Submitting…</>
                  : <><Upload size={14} /> Submit for Review</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
