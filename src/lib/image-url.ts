const R2_PUBLIC_BASE_URL = "https://media.pikpuk.net/";
const R2_HOST = "media.pikpuk.net";

export function getImageUrl(value: string | null | undefined): string {
  if (!value) return "";

  const clean = value.trim();
  if (!clean) return "";

  if (/^https?:\/\//i.test(clean)) {
    const normalized = clean.replace(
      /^(https?:\/\/media\.pikpuk\.net\/)(?:media\.pikpuk\.net\/)+/i,
      "$1",
    );
    return normalized;
  }

  if (clean.toLowerCase().startsWith(`${R2_HOST}/`)) {
    return `https://${clean}`;
  }

  return `${R2_PUBLIC_BASE_URL}${clean.replace(/^\/+/, "")}`;
}

export function getR2ObjectKey(value: string | null | undefined): string {
  if (!value) return "";

  const clean = value.trim();
  if (!clean) return "";

  if (/^https?:\/\//i.test(clean)) {
    const parsed = new URL(clean);
    return parsed.hostname.toLowerCase() === R2_HOST
      ? parsed.pathname.replace(/^\/+/, "")
      : clean;
  }

  return clean
    .replace(/^\/+/, "")
    .replace(/^media\.pikpuk\.net\//i, "");
}
