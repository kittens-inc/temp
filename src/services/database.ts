import postgres from "postgres";

if (!process.env.DATABASE_URL) {
	throw new Error("DATABASE_URL environment variable is required");
}

const sql = postgres(process.env.DATABASE_URL);

export interface FileRecord {
	id: string;
	filename: string;
	size: number;
	mime_type: string;
	uploaded_at: Date;
	expires_at: Date;
	password_hash: string | null;
}

export const db = {
	async createFile(file: Omit<FileRecord, "uploaded_at">): Promise<void> {
		await sql`
      INSERT INTO files (id, filename, size, mime_type, expires_at, password_hash)
      VALUES (${file.id}, ${file.filename}, ${file.size}, ${file.mime_type}, ${file.expires_at}, ${file.password_hash})
    `;
	},

	async getFile(id: string): Promise<FileRecord | null> {
		const [file] = await sql<FileRecord[]>`
      SELECT * FROM files WHERE id = ${id} AND expires_at > NOW()
    `;
		return file || null;
	},

	async deleteFile(id: string): Promise<boolean> {
		const result = await sql`DELETE FROM files WHERE id = ${id}`;
		return result.count > 0;
	},

	async cleanupExpired(): Promise<number> {
		const result = await sql`DELETE FROM files WHERE expires_at <= NOW()`;
		return result.count;
	},
};
