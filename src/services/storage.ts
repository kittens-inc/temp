import {
	S3Client,
	PutObjectCommand,
	GetObjectCommand,
	DeleteObjectCommand,
} from "@aws-sdk/client-s3";

function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} environment variable is required`);
	}
	return value;
}

const R2_ENDPOINT = getRequiredEnv("R2_ENDPOINT");
const R2_ACCESS_KEY_ID = getRequiredEnv("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = getRequiredEnv("R2_SECRET_ACCESS_KEY");
const BUCKET = getRequiredEnv("R2_BUCKET");

const s3 = new S3Client({
	region: "auto",
	endpoint: R2_ENDPOINT,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY,
	},
});
const PREFIX = "temp/";

export const storage = {
	async upload(id: string, data: Buffer, mimeType: string): Promise<void> {
		await s3.send(
			new PutObjectCommand({
				Bucket: BUCKET,
				Key: `${PREFIX}${id}`,
				Body: data,
				ContentType: mimeType,
			})
		);
	},

	async download(id: string): Promise<Buffer | null> {
		try {
			const response = await s3.send(
				new GetObjectCommand({
					Bucket: BUCKET,
					Key: `${PREFIX}${id}`,
				})
			);
			if (!response.Body) {
				return null;
			}
			return Buffer.from(await response.Body.transformToByteArray());
		} catch {
			return null;
		}
	},

	async delete(id: string): Promise<void> {
		await s3.send(
			new DeleteObjectCommand({
				Bucket: BUCKET,
				Key: `${PREFIX}${id}`,
			})
		);
	},
};
