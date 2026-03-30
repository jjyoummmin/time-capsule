const base = import.meta.env.VITE_API_BASE ?? "";

export type CapsuleDTO = {
  id: string;
  ciphertext: string;
  openAtIso: string;
  targetRound: number;
  hasPassword: boolean;
  createdAt: number;
};

export async function createCapsule(body: {
  ciphertext: string;
  openAtIso: string;
  targetRound: number;
  hasPassword: boolean;
}): Promise<{ id: string; path: string }> {
  const r = await fetch(`${base}/api/capsules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `HTTP ${r.status}`);
  }
  return (await r.json()) as { id: string; path: string };
}

export async function getCapsule(id: string): Promise<CapsuleDTO> {
  const r = await fetch(`${base}/api/capsules/${encodeURIComponent(id)}`);
  if (r.status === 404) {
    throw new Error("캡슐을 찾을 수 없습니다.");
  }
  if (!r.ok) {
    throw new Error(`HTTP ${r.status}`);
  }
  return (await r.json()) as CapsuleDTO;
}
