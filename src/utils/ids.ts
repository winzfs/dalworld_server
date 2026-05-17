export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function shortId(prefix: string): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) {
    out += byte.toString(16).padStart(2, '0');
  }
  return `${prefix}_${out}`;
}
