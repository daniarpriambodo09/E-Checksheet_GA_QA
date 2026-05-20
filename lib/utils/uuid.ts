// lib/utils/uuid.ts
// UUID generator yang aman untuk semua environment termasuk
// Android WebView lama (TC21, Zebra, dsb) yang tidak punya crypto.randomUUID.
//
// Prioritas:
//   1. crypto.randomUUID()      — tersedia di Chrome 92+, Node 14.17+
//   2. crypto.getRandomValues() — tersedia di hampir semua WebView modern
//   3. Math.random() fallback   — last resort, cukup unik untuk IndexedDB local key

export function generateUUID(): string {
  // Prioritas 1: native crypto.randomUUID
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  // Prioritas 2: crypto.getRandomValues (tersedia lebih luas)
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);

    // Set version 4 (bits 12-15 dari byte ke-6 = 0100)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    // Set variant bits (bits 6-7 dari byte ke-8 = 10)
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0"));
    return [
      hex.slice(0, 4).join(""),
      hex.slice(4, 6).join(""),
      hex.slice(6, 8).join(""),
      hex.slice(8, 10).join(""),
      hex.slice(10, 16).join(""),
    ].join("-");
  }

  // Prioritas 3: Math.random fallback — cukup unik untuk local IndexedDB key
  // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}