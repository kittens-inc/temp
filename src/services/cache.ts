import { createClient } from "redis";
import type { FileRecord } from "./database";

const client = createClient({ url: process.env.REDIS_URL });
client.connect();

const FILE_TTL = 3600;

export const cache = {
  async getFile(id: string): Promise<FileRecord | null> {
    const data = await client.get(`file:${id}`);
    return data ? JSON.parse(data) : null;
  },

  async setFile(file: FileRecord): Promise<void> {
    const ttl = Math.min(FILE_TTL, Math.floor((file.expires_at.getTime() - Date.now()) / 1000));
    if (ttl > 0) {
      await client.setEx(`file:${file.id}`, ttl, JSON.stringify(file));
    }
  },

  async deleteFile(id: string): Promise<void> {
    await client.del(`file:${id}`);
  },
};
