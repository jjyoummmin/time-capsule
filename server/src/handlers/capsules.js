import { nanoid } from "nanoid";
import { getCapsule, insertCapsule } from "../db.js";

/**
 * @typedef {object} CreateCapsuleInput
 * @property {string} ciphertext
 * @property {string} openAtIso
 * @property {number} targetRound
 * @property {boolean} hasPassword
 */

/**
 * @param {unknown} body
 * @returns {{ ok: true, value: CreateCapsuleInput } | { ok: false, error: string }}
 */
function parseCreateCapsuleBody(body) {
  const raw = body && typeof body === "object" ? body : {};
  const ciphertext = "ciphertext" in raw ? raw.ciphertext : undefined;
  const openAtIso = "openAtIso" in raw ? raw.openAtIso : undefined;
  const targetRound = "targetRound" in raw ? raw.targetRound : undefined;
  const hasPassword = "hasPassword" in raw ? raw.hasPassword : undefined;

  if (typeof ciphertext !== "string" || ciphertext.length === 0) {
    return { ok: false, error: "ciphertext required" };
  }
  if (typeof openAtIso !== "string") {
    return { ok: false, error: "openAtIso required" };
  }
  if (typeof targetRound !== "number" || !Number.isFinite(targetRound) || targetRound < 1) {
    return { ok: false, error: "targetRound invalid" };
  }

  return {
    ok: true,
    value: {
      ciphertext,
      openAtIso,
      targetRound: Math.floor(targetRound),
      hasPassword: Boolean(hasPassword),
    },
  };
}

/**
 * @param {import("pg").Pool} pool
 */
export function createCapsuleHandlers(pool) {
  async function postCapsule(req, res) {
    const parsed = parseCreateCapsuleBody(req.body);
    if (!parsed.ok) {
      return res.status(400).json({ error: parsed.error });
    }
    const { ciphertext, openAtIso, targetRound, hasPassword } = parsed.value;

    const id = nanoid(12);
    const createdAt = Date.now();
    try {
      await insertCapsule(pool, {
        id,
        ciphertext,
        open_at_iso: openAtIso,
        target_round: targetRound,
        has_password: hasPassword,
        created_at: createdAt,
      });
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "db insert failed" });
    }
    return res.status(201).json({ id, path: `/c/${id}` });
  }

  async function getCapsuleById(req, res) {
    let row;
    try {
      row = await getCapsule(pool, req.params.id);
    } catch (e) {
      console.error(e);
      return res.status(500).json({ error: "db error" });
    }
    if (!row) {
      return res.status(404).json({ error: "not found" });
    }
    return res.json({
      id: row.id,
      ciphertext: row.ciphertext,
      openAtIso: row.openAtIso,
      targetRound: row.targetRound,
      hasPassword: row.hasPassword,
      createdAt: row.createdAt,
    });
  }

  return { postCapsule, getCapsuleById };
}
