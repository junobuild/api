import { afterEach, describe, expect, it, mock } from 'bun:test';

describe('server > cors', () => {
	afterEach(() => {
		mock.clearAllMocks();
	});

	describe('CORS', () => {
		it('should restrict origin when CORS_ORIGIN is set', async () => {
			const corsOrigin = process.env.CORS_ORIGIN;
			process.env.CORS_ORIGIN = 'https://console.juno.build';

			const { app } = await import('../src/server');

			const response = await app.handle(
				new Request('http://localhost/v1/auth/certs', {
					headers: { Origin: 'https://yolo.com' }
				})
			);

			expect(response.headers.get('access-control-allow-origin')).toBeNull();

			process.env.CORS_ORIGIN = corsOrigin;
		});
	});
});
