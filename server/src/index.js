import cors from "cors";
import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createPool, ensureSchema } from "./db.js";
import { createCapsuleHandlers } from "./handlers/capsules.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 8787);
/** Render 등 PaaS에서는 0.0.0.0 바인딩이 필요할 때가 많음 */
const HOST = process.env.HOST || "0.0.0.0";

function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL;
  if (!url || typeof url !== "string") {
    throw new Error("DATABASE_URL is required (Neon connection string)");
  }
  return url;
}

async function main() {
  const pool = createPool(requireDatabaseUrl());
  await ensureSchema(pool);

  const app = express();

  app.use(cors({ origin: true }));
  app.use(express.json({ limit: "1mb" }));

  const { postCapsule, getCapsuleById } = createCapsuleHandlers(pool);
  app.post("/api/capsules", postCapsule);
  app.get("/api/capsules/:id", getCapsuleById);

  const webDist = process.env.WEB_DIST
    ? path.resolve(process.env.WEB_DIST)
    : path.join(__dirname, "..", "..", "web", "dist");
  if (fs.existsSync(webDist)) {
    app.use(express.static(webDist));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      res.sendFile(path.join(webDist, "index.html"), (err) => {
        if (err) {
          next(err);
        }
      });
    });
  }

  app.listen(PORT, HOST, () => {
    const publicUrl =
      process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL || null;
    if (publicUrl) {
      console.error(`capsule server listening on ${HOST}:${PORT} (${publicUrl})`);
    } else {
      console.error(
        `capsule server listening on http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}`,
      );
    }
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
