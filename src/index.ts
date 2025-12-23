import { Elysia, t } from "elysia";
import { db } from "./services/database";
import { cache } from "./services/cache";
import { storage } from "./services/storage";
import { calculateRetention, getRetentionDays } from "./services/retention";
import { generateId } from "./utils/id";
import { hashPassword, verifyPassword } from "./utils/crypto";

const MAX_FILE_SIZE = 512 * 1024 * 1024;

const app = new Elysia()
  .post("/", async ({ body, set }) => {
    const file = body.file;
    const password = body.password as string | undefined;

    if (!file) {
      set.status = 400;
      return { error: "No file provided" };
    }

    if (file.size > MAX_FILE_SIZE) {
      set.status = 413;
      return { error: "File too large" };
    }

    const id = generateId();
    const buffer = Buffer.from(await file.arrayBuffer());
    const expiresAt = calculateRetention(file.size);
    const passwordHash = password ? await hashPassword(password) : null;

    await storage.upload(id, buffer, file.type);
    await db.createFile({
      id,
      filename: file.name,
      size: file.size,
      mime_type: file.type,
      expires_at: expiresAt,
      password_hash: passwordHash,
    });

    const retentionDays = getRetentionDays(file.size);
    return {
      id,
      url: `${process.env.BASE_URL}/${id}`,
      expires_at: expiresAt.toISOString(),
      retention_days: retentionDays,
    };
  }, {
    body: t.Object({
      file: t.File(),
      password: t.Optional(t.String()),
    }),
  })

  .get("/:id", async ({ params, set }) => {
    const { id } = params;

    let file = await cache.getFile(id);
    if (!file) {
      file = await db.getFile(id);
      if (file) await cache.setFile(file);
    }

    if (!file) {
      set.status = 404;
      return { error: "File not found" };
    }

    const data = await storage.download(id);
    if (!data) {
      set.status = 404;
      return { error: "File not found" };
    }

    set.headers["content-type"] = file.mime_type;
    set.headers["content-disposition"] = `inline; filename="${file.filename}"`;
    return new Response(data);
  })

  .get("/:id/info", async ({ params, set }) => {
    const { id } = params;

    let file = await cache.getFile(id);
    if (!file) {
      file = await db.getFile(id);
      if (file) await cache.setFile(file);
    }

    if (!file) {
      set.status = 404;
      return { error: "File not found" };
    }

    return {
      id: file.id,
      filename: file.filename,
      size: file.size,
      mime_type: file.mime_type,
      uploaded_at: file.uploaded_at,
      expires_at: file.expires_at,
      has_password: !!file.password_hash,
    };
  })

  .delete("/:id", async ({ params, body, set }) => {
    const { id } = params;
    const password = body?.password as string | undefined;

    const file = await db.getFile(id);
    if (!file) {
      set.status = 404;
      return { error: "File not found" };
    }

    if (file.password_hash) {
      if (!password) {
        set.status = 401;
        return { error: "Password required" };
      }
      if (!await verifyPassword(password, file.password_hash)) {
        set.status = 403;
        return { error: "Invalid password" };
      }
    }

    await storage.delete(id);
    await db.deleteFile(id);
    await cache.deleteFile(id);

    return { success: true };
  }, {
    body: t.Optional(t.Object({
      password: t.Optional(t.String()),
    })),
  })

  .get("/", () => Bun.file("public/index.html"))
  .get("/app.js", () => Bun.file("public/app.js"))
  .get("/style.css", () => Bun.file("public/style.css"))

  .listen(3000);

console.log(`Server running at http://localhost:${app.server?.port}`);

setInterval(async () => {
  const count = await db.cleanupExpired();
  if (count > 0) console.log(`Cleaned up ${count} expired files`);
}, 60000);
