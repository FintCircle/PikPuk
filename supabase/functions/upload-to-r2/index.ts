import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { AwsClient } from "https://esm.sh/aws4fetch@1.0.17";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is banned
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );
    const { data: profile } = await supabaseAdmin
      .from("user_profiles")
      .select("is_banned")
      .eq("id", user.id)
      .single();

    if (profile?.is_banned) {
      return new Response(JSON.stringify({ error: "Your account has been suspended from uploading." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const folder = (formData.get("folder") as string | null) ?? "photos";

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 10 MB limit
    if (file.size > 10 * 1024 * 1024) {
      return new Response(JSON.stringify({ error: "File exceeds the 10 MB maximum." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fileBuffer = await file.arrayBuffer();

    // SHA-256 duplicate detection (images only)
    let imageHash: string | null = null;
    if (file.type.startsWith("image/")) {
      const hashBuffer = await crypto.subtle.digest("SHA-256", fileBuffer);
      imageHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

      // Check for existing hash
      const { data: existing } = await supabaseAdmin
        .from("photos")
        .select("id, caption")
        .eq("image_hash", imageHash)
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(
          JSON.stringify({ error: `Duplicate image detected. This photograph already exists in the archive ("${existing[0].caption}").` }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const accountId = Deno.env.get("R2_ACCOUNT_ID") ?? "";
    const bucketName = Deno.env.get("R2_BUCKET_NAME") ?? "";
    const accessKeyId = Deno.env.get("R2_ACCESS_KEY_ID") ?? "";
    const secretAccessKey = Deno.env.get("R2_SECRET_ACCESS_KEY") ?? "";
    const publicUrl = Deno.env.get("R2_PUBLIC_URL") ?? "";
    const r2Endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const key = `${folder}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

    const aws = new AwsClient({
      accessKeyId,
      secretAccessKey,
      service: "s3",
      region: "auto",
    });

    const r2Url = `${r2Endpoint}/${bucketName}/${key}`;
    console.log("Uploading to R2:", r2Url);

    const uploadReq = new Request(r2Url, {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "image/jpeg",
        "Content-Length": fileBuffer.byteLength.toString(),
      },
      body: fileBuffer,
    });

    const signed = await aws.sign(uploadReq);
    const uploadRes = await fetch(signed);

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      console.error("R2 upload error:", uploadRes.status, errText);
      return new Response(JSON.stringify({ error: `R2 upload failed: ${errText}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const imageUrl = publicUrl
      ? `${publicUrl.replace(/\/$/, "")}/${key}`
      : `${r2Endpoint}/${bucketName}/${key}`;

    console.log("Upload successful:", imageUrl);

    return new Response(
      JSON.stringify({ imageUrl, r2Key: key, imageHash }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
