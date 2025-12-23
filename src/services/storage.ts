import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT!,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET!;
const PREFIX = "temp/";

export const storage = {
  async upload(id: string, data: Buffer, mimeType: string): Promise<void> {
    await s3.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: `${PREFIX}${id}`,
      Body: data,
      ContentType: mimeType,
    }));
  },

  async download(id: string): Promise<Buffer | null> {
    try {
      const response = await s3.send(new GetObjectCommand({
        Bucket: BUCKET,
        Key: `${PREFIX}${id}`,
      }));
      return Buffer.from(await response.Body!.transformToByteArray());
    } catch {
      return null;
    }
  },

  async delete(id: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: `${PREFIX}${id}`,
    }));
  },
};
