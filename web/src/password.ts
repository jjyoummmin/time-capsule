const SALT_LEN = 16;
const IV_LEN = 12;

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 210_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** Plaintext -> inner bytes consumed by timelock (flag 0 = none, 1 = AES-GCM). */
export async function sealMessage(plain: string, password: string | null): Promise<Uint8Array> {
  const enc = new TextEncoder();
  if (!password) {
    const p = enc.encode(plain);
    const out = new Uint8Array(1 + p.length);
    out[0] = 0;
    out.set(p, 1);
    return out;
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const key = await deriveKey(password, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain)));
  const out = new Uint8Array(1 + SALT_LEN + IV_LEN + ct.length);
  out[0] = 1;
  out.set(salt, 1);
  out.set(iv, 1 + SALT_LEN);
  out.set(ct, 1 + SALT_LEN + IV_LEN);
  return out;
}

export async function openMessage(payload: Uint8Array, password: string | null): Promise<string> {
  if (payload.length === 0) {
    throw new Error("빈 페이로드입니다.");
  }
  const flag = payload[0];
  if (flag === 0) {
    return new TextDecoder().decode(payload.slice(1));
  }
  if (flag !== 1) {
    throw new Error("알 수 없는 형식입니다.");
  }
  if (!password) {
    throw new Error("비밀번호가 필요합니다.");
  }
  const salt = payload.slice(1, 1 + SALT_LEN);
  const iv = payload.slice(1 + SALT_LEN, 1 + SALT_LEN + IV_LEN);
  const ct = payload.slice(1 + SALT_LEN + IV_LEN);
  const key = await deriveKey(password, salt);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(new Uint8Array(pt));
}
