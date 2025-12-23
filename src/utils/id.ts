const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";
const ID_LENGTH = 8;

export function generateId(): string {
  let id = "";
  const bytes = crypto.getRandomValues(new Uint8Array(ID_LENGTH));
  for (const byte of bytes) {
    id += ALPHABET[byte % ALPHABET.length];
  }
  return id;
}
