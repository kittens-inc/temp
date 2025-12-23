import { readFileSync, writeFileSync } from "fs";

const BASE_URL = process.env.BASE_URL || "http://localhost:3067";

function toBase64(buffer: ArrayBuffer | Uint8Array): string {
	const arrayBuffer =
		buffer instanceof Uint8Array
			? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
			: buffer;
	return Buffer.from(arrayBuffer).toString("base64");
}

async function encrypt(data: Uint8Array): Promise<{ encrypted: Uint8Array; key: CryptoKey }> {
	// Generate key
	const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
		"encrypt",
		"decrypt",
	]);

	// Generate IV
	const iv = crypto.getRandomValues(new Uint8Array(12));

	// Encrypt
	const encryptedData = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer
	);

	// Combine IV + encrypted data (same format as frontend)
	const combined = new Uint8Array(iv.length + encryptedData.byteLength);
	combined.set(iv);
	combined.set(new Uint8Array(encryptedData), iv.length);

	return { encrypted: combined, key };
}

async function decrypt(data: Uint8Array, key: CryptoKey): Promise<Uint8Array> {
	// Extract IV from the beginning
	const iv = data.slice(0, 12);
	const encrypted = data.slice(12);

	const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);

	return new Uint8Array(decrypted);
}

async function exportKey(key: CryptoKey): Promise<string> {
	const raw = await crypto.subtle.exportKey("raw", key);
	// Use standard base64 (same as frontend)
	return toBase64(raw);
}

async function main() {
	console.log("=== Kittens Upload/Download Test ===\n");

	// 1. Read test image
	console.log("1. Reading test image...");
	const imagePath = "tests/test.png";
	const imageData = readFileSync(imagePath);
	console.log(`   Read ${imageData.length} bytes from ${imagePath}`);

	// 2. Encrypt the image
	console.log("\n2. Encrypting image...");
	const { encrypted, key } = await encrypt(new Uint8Array(imageData));
	const exportedKey = await exportKey(key);
	console.log(`   Encrypted size: ${encrypted.length} bytes (includes 12-byte IV)`);
	console.log(`   Key (base64): ${exportedKey}`);

	// 3. Upload encrypted blob as a file (keeping original filename and mime type for browser preview)
	console.log("\n3. Uploading encrypted blob...");
	const formData = new FormData();
	const blob = new Blob([encrypted], { type: "image/png" });
	formData.append("file", blob, "test.png");

	const uploadResponse = await fetch(`${BASE_URL}/`, {
		method: "POST",
		body: formData,
	});
	console.log(`   Upload status: ${uploadResponse.status}`);
	if (!uploadResponse.ok) {
		const error = await uploadResponse.text();
		console.error(`   Upload failed: ${error}`);
		process.exit(1);
	}
	const uploadResult = (await uploadResponse.json()) as {
		id: string;
		expires_at: string;
		retention_days: number;
	};
	const id = uploadResult.id;
	console.log(`   Upload successful!`);
	console.log(`   File ID: ${id}`);
	console.log(`   Expires at: ${uploadResult.expires_at}`);
	console.log(`   Retention days: ${uploadResult.retention_days}`);

	// Build the URL (key in fragment, same format as frontend)
	const fullUrl = `${BASE_URL}/${id}#${exportedKey}`;
	console.log(`   Full URL: ${fullUrl}`);

	// 4. Download encrypted blob
	console.log("\n4. Downloading encrypted blob...");
	const downloadResponse = await fetch(`${BASE_URL}/${id}/raw`);
	console.log(`   Download status: ${downloadResponse.status}`);
	if (!downloadResponse.ok) {
		const error = await downloadResponse.text();
		console.error(`   Download failed: ${error}`);
		process.exit(1);
	}
	const downloadedEncrypted = new Uint8Array(await downloadResponse.arrayBuffer());
	console.log(`   Downloaded ${downloadedEncrypted.length} bytes`);

	// 5. Decrypt the downloaded blob
	console.log("\n5. Decrypting downloaded blob...");
	const decrypted = await decrypt(downloadedEncrypted, key);
	console.log(`   Decrypted size: ${decrypted.length} bytes`);

	// 6. Verify the decrypted data matches original
	console.log("\n6. Verifying data integrity...");
	const originalArray = new Uint8Array(imageData);
	if (decrypted.length !== originalArray.length) {
		console.error(`   FAILED: Size mismatch (${decrypted.length} vs ${originalArray.length})`);
		process.exit(1);
	}

	let match = true;
	for (let i = 0; i < decrypted.length; i++) {
		if (decrypted[i] !== originalArray[i]) {
			match = false;
			break;
		}
	}

	if (match) {
		console.log("   SUCCESS: Decrypted data matches original!");
	} else {
		console.error("   FAILED: Decrypted data does not match original!");
		process.exit(1);
	}

	// 7. Save decrypted file for manual verification
	const outputPath = "tests/test-decrypted.png";
	writeFileSync(outputPath, decrypted);
	console.log(`\n7. Saved decrypted file to ${outputPath}`);

	console.log("\n=== Test completed successfully! ===");
	console.log(`\nOpen in browser to test preview: ${fullUrl}`);
}

main().catch((err) => {
	console.error("Test failed:", err);
	process.exit(1);
});
