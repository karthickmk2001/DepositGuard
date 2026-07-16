/**
 * SHA-256 hash of a File using the Web Crypto API (browser-side, no backend needed).
 */
export async function hashFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return bufferToHex(hashBuffer);
}

/**
 * SHA-256 hash of an arbitrary string.
 */
export async function hashString(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
  return bufferToHex(hashBuffer);
}

/**
 * Combined hash: SHA-256 of the concatenated individual hashes.
 * Stores a single fingerprint for a set of files on-chain.
 */
export async function combinedHash(hashes: string[]): Promise<string> {
  return hashString(hashes.join(""));
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
