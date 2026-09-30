import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { getImageUrl, getR2ObjectKey } from "@/lib/image-url";
import { DbPhoto } from "@/types/db";
import { toast } from "sonner";
import {
  Upload,
  X,
  Loader2,
  ArrowLeft,
  ImageIcon,
  Link2,
  HardDrive,
} from "lucide-react";
import { FunctionsHttpError } from "@supabase/supabase-js";

type ImageSource = "upload" | "url";

export default function PhotoForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(isEdit);
  const [imageSource, setImageSource] = useState<ImageSource>("upload");
  const [imagePreview, setImagePreview] = useState<string>("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [existingR2Key, setExistingR2Key] = useState<string | undefined>();
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    caption: "",
    location: "",
    year: "",
    photographer: "",
    story: "",
    image_url: "",
    sort_order: 0,
    is_published: true,
  });

  useEffect(() => {
    if (!isEdit || !id) return;
    const fetch = async () => {
      const { data, error } = await supabase
        .from("photos")
        .select("*")
        .eq("id", id)
        .single();
      if (error || !data) {
        toast.error("Photo not found");
        navigate("/admin");
        return;
      }
      const p = data as DbPhoto;
      setForm({
        caption: p.caption,
        location: p.location,
        year: p.year,
        photographer: p.photographer ?? "",
        story: p.story,
        image_url: p.image_url,
        sort_order: p.sort_order,
        is_published: p.is_published,
      });
      setImagePreview(getImageUrl(p.image_url));
      setExistingR2Key(p.r2_key);
      setImageSource(p.r2_key ? "upload" : "url");
      setFetchLoading(false);
    };
    fetch();
  }, [id, isEdit, navigate]);

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      toast.error("Image must be under 20MB");
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImagePreview(url);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const uploadToR2 = async (file: File): Promise<{ imageUrl: string; r2Key: string }> => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");

    const formData = new FormData();
    formData.append("file", file);

    const { data, error } = await supabase.functions.invoke("upload-to-r2", {
      body: formData,
      headers: { Authorization: `Bearer ${session.access_token}` },
    });

    if (error) {
      let msg = error.message;
      if (error instanceof FunctionsHttpError) {
        try { msg = await error.context.text(); } catch { /* ignore */ }
      }
      throw new Error(`Upload failed: ${msg}`);
    }

    return { imageUrl: data.imageUrl, r2Key: data.r2Key };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.caption.trim() || !form.location.trim() || !form.story.trim()) {
      toast.error("Caption, location, and story are required");
      return;
    }

    let finalImageUrl = form.image_url;
    let finalR2Key = existingR2Key;

    // Upload file if selected
    if (imageSource === "upload" && imageFile) {
      setUploading(true);
      try {
        const result = await uploadToR2(imageFile);
        finalR2Key = getR2ObjectKey(result.r2Key);
        finalImageUrl = finalR2Key;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Upload failed";
        toast.error(message);
        setUploading(false);
        return;
      }
      setUploading(false);
    } else if (imageSource === "url") {
      finalImageUrl = form.image_url;
      finalR2Key = undefined;
    }

    if (!finalImageUrl) {
      toast.error("Please provide an image");
      return;
    }

    setLoading(true);

    const payload = {
      caption: form.caption.trim(),
      location: form.location.trim(),
      year: form.year.trim(),
      photographer: form.photographer.trim() || null,
      story: form.story.trim(),
      image_url: finalImageUrl,
      r2_key: finalR2Key ?? null,
      sort_order: Number(form.sort_order),
      is_published: form.is_published,
    };

    if (isEdit && id) {
      const { error } = await supabase.from("photos").update(payload).eq("id", id);
      if (error) {
        toast.error("Failed to update photo");
        console.error(error);
        setLoading(false);
        return;
      }
      toast.success("Photograph updated");
    } else {
      const { error } = await supabase.from("photos").insert(payload);
      if (error) {
        toast.error("Failed to save photo");
        console.error(error);
        setLoading(false);
        return;
      }
      toast.success("Photograph added to archive");
    }

    navigate("/admin");
  };

  const field = (
    label: string,
    name: keyof typeof form,
    opts?: {
      type?: string;
      placeholder?: string;
      textarea?: boolean;
      rows?: number;
      required?: boolean;
    }
  ) => (
    <div>
      <label
        className="block text-xs font-crimson mb-1.5"
        style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}
      >
        {label.toUpperCase()}{opts?.required && <span style={{ color: "#c05040" }}> *</span>}
      </label>
      {opts?.textarea ? (
        <textarea
          value={String(form[name])}
          onChange={e => setForm(prev => ({ ...prev, [name]: e.target.value }))}
          placeholder={opts.placeholder}
          rows={opts.rows ?? 4}
          required={opts.required}
          className="w-full px-3 py-2.5 text-sm font-crimson rounded-sm outline-none resize-y transition-colors"
          style={{
            background: "rgba(196,168,130,0.06)",
            border: "1px solid rgba(196,168,130,0.2)",
            color: "#e8d8c0",
            minHeight: "100px",
          }}
          onFocus={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.45)"}
          onBlur={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.2)"}
        />
      ) : (
        <input
          type={opts?.type ?? "text"}
          value={String(form[name])}
          onChange={e => setForm(prev => ({ ...prev, [name]: opts?.type === "number" ? Number(e.target.value) : e.target.value }))}
          placeholder={opts?.placeholder}
          required={opts?.required}
          className="w-full px-3 py-2.5 text-sm font-crimson rounded-sm outline-none transition-colors"
          style={{
            background: "rgba(196,168,130,0.06)",
            border: "1px solid rgba(196,168,130,0.2)",
            color: "#e8d8c0",
          }}
          onFocus={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.45)"}
          onBlur={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.2)"}
        />
      )}
    </div>
  );

  if (fetchLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ background: "#080402" }}>
        <Loader2 size={20} className="animate-spin" style={{ color: "#9a7c5a" }} />
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: "radial-gradient(ellipse at 50% 0%, hsl(28 28% 9%) 0%, #080402 100%)" }}
    >
      {/* Film grain */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.06'/%3E%3C/svg%3E")`,
          mixBlendMode: "multiply",
          zIndex: 0,
        }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4 py-6 pb-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            to="/admin"
            className="flex items-center justify-center w-8 h-8 rounded-full"
            style={{ background: "rgba(196,168,130,0.08)", border: "1px solid rgba(196,168,130,0.15)", color: "#9a7c5a" }}
          >
            <ArrowLeft size={14} />
          </Link>
          <div>
            <h1 className="font-playfair text-lg font-semibold" style={{ color: "#e8d8c0" }}>
              {isEdit ? "Edit Photograph" : "Add Photograph"}
            </h1>
            <p className="text-xs font-crimson mt-0.5" style={{ color: "#6a5438" }}>
              {isEdit ? "Update archive entry" : "Add a new entry to the archive"}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Image section */}
          <div
            className="rounded-sm p-5"
            style={{ background: "rgba(196,168,130,0.04)", border: "1px solid rgba(196,168,130,0.12)" }}
          >
            <p className="text-xs font-crimson mb-3" style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}>
              PHOTOGRAPH IMAGE
            </p>

            {/* Source toggle */}
            <div className="flex gap-2 mb-4">
              {(["upload", "url"] as ImageSource[]).map(src => (
                <button
                  key={src}
                  type="button"
                  onClick={() => { setImageSource(src); setImageFile(null); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-crimson rounded-sm transition-all"
                  style={{
                    background: imageSource === src ? "rgba(196,168,130,0.18)" : "rgba(196,168,130,0.06)",
                    border: `1px solid ${imageSource === src ? "rgba(196,168,130,0.35)" : "rgba(196,168,130,0.12)"}`,
                    color: imageSource === src ? "#d4b896" : "#6a5438",
                  }}
                >
                  {src === "upload" ? <HardDrive size={12} /> : <Link2 size={12} />}
                  {src === "upload" ? "Upload File" : "Image URL"}
                </button>
              ))}
            </div>

            {imageSource === "upload" ? (
              <>
                <div
                  className="relative rounded-sm transition-colors cursor-pointer"
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
                  {imagePreview && !imageFile && isEdit ? (
                    <div className="relative">
                      <img
                        src={getImageUrl(imagePreview)}
                        alt="Current"
                        className="w-full rounded-sm object-cover"
                        style={{ maxHeight: "280px", filter: "sepia(15%)" }}
                      />
                      <div
                        className="absolute inset-0 flex items-center justify-center rounded-sm opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                        style={{ background: "rgba(4,2,0,0.6)" }}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="text-center">
                          <Upload size={20} style={{ color: "#c4a882", margin: "0 auto 6px" }} />
                          <p className="text-sm font-crimson" style={{ color: "#c4a882" }}>Replace image</p>
                        </div>
                      </div>
                    </div>
                  ) : imageFile && imagePreview ? (
                    <div className="relative">
                      <img
                        src={getImageUrl(imagePreview)}
                        alt="Preview"
                        className="w-full rounded-sm object-cover"
                        style={{ maxHeight: "280px", filter: "sepia(15%)" }}
                      />
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); setImageFile(null); setImagePreview(isEdit ? form.image_url : ""); }}
                        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-full"
                        style={{ background: "rgba(4,2,0,0.7)", color: "#c4a882", border: "1px solid rgba(196,168,130,0.3)" }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="flex flex-col items-center justify-center py-10 gap-2 cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <ImageIcon size={28} style={{ color: "#4a3a28" }} />
                      <p className="text-sm font-crimson" style={{ color: "#9a7c5a" }}>
                        Drop image here or click to browse
                      </p>
                      <p className="text-xs font-crimson" style={{ color: "#4a3a28" }}>
                        JPG, PNG, WebP · max 20MB
                      </p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </>
            ) : (
              <div>
                <input
                  type="url"
                  value={form.image_url}
                  onChange={e => {
                    setForm(prev => ({ ...prev, image_url: e.target.value }));
                    setImagePreview(e.target.value);
                  }}
                  placeholder="https://example.com/photo.jpg"
                  className="w-full px-3 py-2.5 text-sm font-crimson rounded-sm outline-none transition-colors"
                  style={{
                    background: "rgba(196,168,130,0.06)",
                    border: "1px solid rgba(196,168,130,0.2)",
                    color: "#e8d8c0",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.45)"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(196,168,130,0.2)"}
                />
                {imagePreview && (
                  <img
                    src={getImageUrl(imagePreview)}
                    alt="Preview"
                    className="mt-3 w-full rounded-sm object-cover"
                    style={{ maxHeight: "220px", filter: "sepia(15%)", border: "1px solid rgba(196,168,130,0.15)" }}
                    onError={() => setImagePreview("")}
                  />
                )}
              </div>
            )}
          </div>

          {/* Metadata */}
          <div
            className="rounded-sm p-5 space-y-4"
            style={{ background: "rgba(196,168,130,0.04)", border: "1px solid rgba(196,168,130,0.12)" }}
          >
            <p className="text-xs font-crimson" style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}>
              PHOTOGRAPH DETAILS
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {field("Caption", "caption", { placeholder: "Fifth Avenue", required: true })}
              {field("Location", "location", { placeholder: "New York City", required: true })}
              {field("Year", "year", { placeholder: "c. 1908" })}
              {field("Photographer", "photographer", { placeholder: "Unknown" })}
            </div>
            {field("Story", "story", {
              textarea: true,
              rows: 8,
              placeholder: "Write the story behind this photograph...\n\nSeparate paragraphs with a blank line.",
              required: true,
            })}
          </div>

          {/* Publishing */}
          <div
            className="rounded-sm p-5"
            style={{ background: "rgba(196,168,130,0.04)", border: "1px solid rgba(196,168,130,0.12)" }}
          >
            <p className="text-xs font-crimson mb-4" style={{ color: "#9a7c5a", letterSpacing: "0.07em" }}>
              PUBLISHING OPTIONS
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[140px]">
                {field("Sort Order", "sort_order", { type: "number", placeholder: "0" })}
              </div>
              <div className="flex items-end gap-3 pb-0.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setForm(prev => ({ ...prev, is_published: !prev.is_published }))}
                    className="relative w-10 h-5 rounded-full transition-all"
                    style={{
                      background: form.is_published ? "rgba(100,150,80,0.45)" : "rgba(196,168,130,0.12)",
                      border: `1px solid ${form.is_published ? "rgba(100,150,80,0.4)" : "rgba(196,168,130,0.2)"}`,
                    }}
                  >
                    <div
                      className="absolute top-0.5 w-4 h-4 rounded-full transition-all"
                      style={{
                        left: form.is_published ? "calc(100% - 18px)" : "2px",
                        background: form.is_published ? "#8ab870" : "#6a5438",
                      }}
                    />
                  </button>
                  <span className="text-sm font-crimson" style={{ color: form.is_published ? "#8ab870" : "#9a7c5a" }}>
                    {form.is_published ? "Published" : "Draft"}
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3">
            <Link
              to="/admin"
              className="flex-1 flex items-center justify-center py-3 text-sm font-crimson rounded-sm"
              style={{ border: "1px solid rgba(196,168,130,0.15)", color: "#6a5438" }}
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || uploading}
              className="flex-[2] flex items-center justify-center gap-2 py-3 text-sm font-crimson rounded-sm transition-all"
              style={{
                background: loading || uploading ? "rgba(196,168,130,0.1)" : "rgba(196,168,130,0.18)",
                border: "1px solid rgba(196,168,130,0.3)",
                color: loading || uploading ? "#6a5438" : "#d4b896",
              }}
            >
              {uploading ? (
                <><Loader2 size={14} className="animate-spin" /> Uploading to R2…</>
              ) : loading ? (
                <><Loader2 size={14} className="animate-spin" /> Saving…</>
              ) : (
                isEdit ? "Save Changes" : "Add to Archive"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
