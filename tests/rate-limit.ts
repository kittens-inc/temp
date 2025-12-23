const BASE_URL = "http://localhost:3000";

async function testRateLimit() {
	console.log("Testing rate limiting (10 uploads/minute per IP)...\n");

	const testFile = Bun.file("tests/test.png");
	const results: { attempt: number; status: number; ok: boolean }[] = [];

	// Attempt 15 uploads rapidly to trigger rate limit
	for (let i = 1; i <= 15; i++) {
		const formData = new FormData();
		formData.append("file", testFile);

		const response = await fetch(BASE_URL, {
			method: "POST",
			body: formData,
		});

		const result = {
			attempt: i,
			status: response.status,
			ok: response.ok,
		};
		results.push(result);

		const body = await response.json();
		console.log(`Attempt ${i}: ${response.status} - ${response.ok ? "OK" : "RATE LIMITED"}`, body);
	}

	// Verify results
	const successCount = results.filter((r) => r.ok).length;
	const rateLimitedCount = results.filter((r) => r.status === 429).length;

	console.log("\n--- Summary ---");
	console.log(`Successful uploads: ${successCount}`);
	console.log(`Rate limited: ${rateLimitedCount}`);

	if (successCount <= 10 && rateLimitedCount >= 5) {
		console.log("\n✅ Rate limiting is working correctly!");
	} else {
		console.log("\n❌ Rate limiting may not be configured correctly");
		console.log("Expected: ~10 successful, ~5 rate limited (429 status)");
	}
}

testRateLimit().catch(console.error);
