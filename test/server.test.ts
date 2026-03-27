import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';

describe('server', () => {
	afterEach(() => {
		mock.clearAllMocks();
	});

	describe('GET /v1/auth/certs', () => {
		it('should return JWKS', async () => {
			const { app } = await import('../src/server');
			const response = await app.handle(new Request('http://localhost/v1/auth/certs'));
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.keys).toBeArray();
			expect(data.keys).toHaveLength(1);
			expect(data.keys[0].kid).toBe('juno-key-1');
			expect(data.keys[0].alg).toBe('RS256');
		});
	});

	describe('GET /v1/auth/init/github', () => {
		it('should initialize GitHub auth', async () => {
			const nonce = 'a'.repeat(32);

			const { app } = await import('../src/server');
			const response = await app.handle(
				new Request(`http://localhost/v1/auth/init/github?nonce=${nonce}`)
			);
			const data = await response.json();

			expect(response.status).toBe(200);
			expect(data.state).toBeString();

			// Verify the state JWT is valid
			const { JwtDecorator } = await import('../src/decorators/jwt');
			const jwt = new JwtDecorator();
			const verified = await jwt.verify(data.state);
			expect(verified.valid).toBe(true);

			if (!verified.valid) {
				expect(true).toBeFalsy();
				return;
			}

			expect(verified.payload.provider).toBe('github');
			expect(verified.payload.nonce).toBe(nonce);

			// Check cookie was set
			const setCookie = response.headers.get('set-cookie');
			expect(setCookie).toContain('auth=');
			expect(setCookie).toContain('HttpOnly');
			expect(setCookie).toContain('Path=/v1/auth/finalize/github');
		});

		it('should reject nonce that is too short', async () => {
			const { app } = await import('../src/server');
			const response = await app.handle(
				new Request('http://localhost/v1/auth/init/github?nonce=short')
			);

			expect(response.status).toBe(422);
		});
	});

	describe('POST /v1/auth/finalize/github', () => {
		it('should finalize GitHub auth', async () => {
			spyOn(global, 'fetch').mockImplementation((async (url) => {
				if (url === 'https://github.com/login/oauth/access_token') {
					return Response.json({ access_token: 'gho_test_token' });
				}
				if (url === 'https://api.github.com/user') {
					return Response.json({
						id: 12345,
						login: 'testuser',
						email: 'test@example.com',
						name: 'Test User',
						avatar_url: 'https://avatars.githubusercontent.com/u/12345'
					});
				}
				return new Response('Not found', { status: 404 });
			}) as typeof fetch);

			// Create valid state token
			const { JwtDecorator } = await import('../src/decorators/jwt');
			const jwt = new JwtDecorator();
			const stateToken = await jwt.signOAuthJwt({
				payload: {
					provider: 'github',
					token: 'a'.repeat(64),
					nonce: 'test-nonce'
				}
			});

			const { app } = await import('../src/server');
			const response = await app.handle(
				new Request('http://localhost/v1/auth/finalize/github', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Cookie: `auth=${stateToken}`
					},
					body: JSON.stringify({
						code: 'github-code-123',
						state: stateToken
					})
				})
			);

			expect(response.status).toBe(200);

			const data = await response.json();
			expect(data.token).toBeString();

			// Verify the returned token
			const verified = await jwt.verify(data.token);
			expect(verified.valid).toBe(true);

			if (!verified.valid) {
				expect(true).toBeFalsy();
				return;
			}

			expect(verified.payload.sub).toBe('12345');
			expect(verified.payload.preferred_username).toBe('testuser');
		});

		it('should return 401 when cookie is missing', async () => {
			const { app } = await import('../src/server');
			const response = await app.handle(
				new Request('http://localhost/v1/auth/finalize/github', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json'
					},
					body: JSON.stringify({
						code: 'code',
						state: 'state'
					})
				})
			);

			expect(response.status).toBe(401);
		});

		it('should return 401 on state mismatch', async () => {
			const { JwtDecorator } = await import('../src/decorators/jwt');
			const jwt = new JwtDecorator();
			const stateToken = await jwt.signOAuthJwt({
				payload: { provider: 'github', token: 'a'.repeat(64), nonce: 'nonce' }
			});

			const { app } = await import('../src/server');
			const response = await app.handle(
				new Request('http://localhost/v1/auth/finalize/github', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Cookie: `auth=${stateToken}`
					},
					body: JSON.stringify({
						code: 'code',
						state: 'different-state'
					})
				})
			);

			expect(response.status).toBe(401);
		});
	});

	describe('Error handling', () => {
		it('should return 404 for unknown routes', async () => {
			const { app } = await import('../src/server');
			const response = await app.handle(new Request('http://localhost/unknown'));
			expect(response.status).toBe(404);
		});
	});
});
