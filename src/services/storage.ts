import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { mkdir, writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";

interface StorageAdapter {
  upload(id: string, data: Buffer, mimeType: string): Promise<void>;
  download(id: string): Promise<Buffer | null>;
  delete(id: string): Promise<void>;
}

const UPLOADS_DIR = join(process.cwd(), "uploads");

const localStorageAdapter: StorageAdapter = {
  async upload(id: string, data: Buffer): Promise<void> {
    await mkdir(UPLOADS_DIR, { recursive: true });
    await writeFile(join(UPLOADS_DIR, id), data);
  },

  async download(id: string): Promise<Buffer | null> {
    try {
      return await readFile(join(UPLOADS_DIR, id));
    } catch {
      return null;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      await unlink(join(UPLOADS_DIR, id));
    } catch {}
  },
};

const createR2Adapter = (): StorageAdapter => {
  const s3 = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT!,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  const bucket = process.env.R2_BUCKET!;
  const prefix = "temp/";

  return {
    async upload(id: string, data: Buffer, mimeType: string): Promise<void> {
      await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: `${prefix}${id}`,
        Body: data,
        ContentType: mimeType,
      }));
    },

    async download(id: string): Promise<Buffer | null> {
      try {
        const response = await s3.send(new GetObjectCommand({
          Bucket: bucket,
          Key: `${prefix}${id}`,
        }));
        return Buffer.from(await response.Body!.transformToByteArray());
      } catch {
        return null;
      }
    },

    async delete(id: string): Promise<void> {
      await s3.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: `${prefix}${id}`,
      }));
    },
  };
};

const isR2Configured = (): boolean =>
  !!(process.env.R2_ENDPOINT && 
     process.env.R2_ACCESS_KEY_ID && 
     process.env.R2_SECRET_ACCESS_KEY && 
     process.env.R2_BUCKET);

export const storage: StorageAdapter = isR2Configured() 
  ? createR2Adapter() 
  : localStorageAdapter;
