const R2_PUBLIC_BASE_URL = "https://media.pikpuk.net/";

export function getImageUrl(value: string | null | undefined): string {
  if (!value) return "";

  const trimmedValue = value.trim();
  if (!trimmedValue) return "";

  try {
    const parsedUrl = new URL(trimmedValue);
    if (parsedUrl.origin === "https://media.pikpuk.net") {
      return parsedUrl.toString();
    }
    return trimmedValue;
  } catch {
    return `${R2_PUBLIC_BASE_URL}${trimmedValue.replace(/^\/+/, "")}`;
  }
}
