import { afterAll, beforeAll } from 'bun:test';
import { exportPKCS8, exportSPKI, generateKeyPair } from 'jose';

const PRIVATE_KEY_PEM_PATH = process.env.JWT_PRIVATE_KEY_PEM ?? './test-private-key.pem';
const PUBLIC_KEY_PEM_PATH = process.env.JWT_PUBLIC_KEY_PEM ?? './test-public-key.pem';

beforeAll(async () => {
	const { privateKey, publicKey } = await generateKeyPair('RS256', {
		extractable: true
	});

	const privatePem = await exportPKCS8(privateKey);
	const publicPem = await exportSPKI(publicKey);

	await Bun.write(PRIVATE_KEY_PEM_PATH, privatePem);
	await Bun.write(PUBLIC_KEY_PEM_PATH, publicPem);
});

afterAll(async () => {
	for (const key of [PRIVATE_KEY_PEM_PATH, PUBLIC_KEY_PEM_PATH]) {
		const file = Bun.file(key);
		await file.delete();
	}
});
