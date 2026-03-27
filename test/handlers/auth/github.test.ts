import { afterEach, describe, expect, it, mock } from 'bun:test';
import type { ApiContext } from '../../../src/context';
import { JwtDecorator } from '../../../src/decorators/jwt';
import { githubAuthInit } from '../../../src/handlers/auth/github';

describe('handlers > auth > github', () => {
	afterEach(() => {
		mock.clearAllMocks();
	});

	describe('githubAuthInit', () => {
		it('should initialize GitHub auth flow', async () => {
			const jwt = new JwtDecorator();
			const mockSetCookie = mock(() => {});

			const context = {
				jwt,
				cookie: {
					auth: {
						set: mockSetCookie
					}
				},
				query: {
					nonce: 'a'.repeat(32)
				}
			} as unknown as ApiContext<{ query: { nonce: string } }>;

			const result = await githubAuthInit(context);

			expect(result.state).toBeString();

			expect(mockSetCookie).toHaveBeenCalledWith({
				value: result.state,
				httpOnly: true,
				maxAge: 600,
				path: '/v1/auth/finalize/github'
			});

			// Verify the JWT can be decoded
			const verified = await jwt.verify(result.state);
			expect(verified.valid).toBe(true);

			if (!verified.valid) {
				expect(true).toBeFalsy();
				return;
			}

			expect(verified.payload.provider).toBe('github');
			expect(verified.payload.nonce).toBe('a'.repeat(32));
			expect(verified.payload.token).toBeString();
			expect(verified.payload.token).toHaveLength(64);
		});

		it('should set production cookie settings when not in development', async () => {
			const originalEnv = Bun.env.NODE_ENV;
			const originalDomain = Bun.env.COOKIE_DOMAIN;
			const originalSameSite = Bun.env.COOKIE_SAME_SITE;

			try {
				Bun.env.NODE_ENV = 'production';
				Bun.env.COOKIE_DOMAIN = '.hello.com';
				Bun.env.COOKIE_SAME_SITE = 'lax';

				const jwt = new JwtDecorator();
				const mockSetCookie = mock(() => {});

				const context = {
					jwt,
					cookie: { auth: { set: mockSetCookie } },
					query: { nonce: 'a'.repeat(32) }
				} as unknown as ApiContext<{ query: { nonce: string } }>;

				await githubAuthInit(context);

				expect(mockSetCookie).toHaveBeenCalledWith({
					value: expect.any(String),
					httpOnly: true,
					maxAge: 600,
					path: '/v1/auth/finalize/github',
					domain: '.hello.com',
					sameSite: 'lax',
					secure: true
				});
			} finally {
				Bun.env.NODE_ENV = originalEnv;
				Bun.env.COOKIE_DOMAIN = originalDomain;
				Bun.env.COOKIE_SAME_SITE = originalSameSite;
			}
		});

		it('should not set production settings in development mode', async () => {
			const originalEnv = Bun.env.NODE_ENV;
			const originalDomain = Bun.env.COOKIE_DOMAIN;
			const originalSameSite = Bun.env.COOKIE_SAME_SITE;

			try {
				Bun.env.NODE_ENV = 'development';
				Bun.env.COOKIE_DOMAIN = '.juno.build';
				Bun.env.COOKIE_SAME_SITE = 'lax';

				const jwt = new JwtDecorator();
				const mockSetCookie = mock(() => {});

				const context = {
					jwt,
					cookie: { auth: { set: mockSetCookie } },
					query: { nonce: 'a'.repeat(32) }
				} as unknown as ApiContext<{ query: { nonce: string } }>;

				await githubAuthInit(context);

				// Should NOT include domain, sameSite, or secure in development
				expect(mockSetCookie).toHaveBeenCalledWith({
					value: expect.any(String),
					httpOnly: true,
					maxAge: 600,
					path: '/v1/auth/finalize/github'
				});
			} finally {
				Bun.env.NODE_ENV = originalEnv;
				Bun.env.COOKIE_DOMAIN = originalDomain;
				Bun.env.COOKIE_SAME_SITE = originalSameSite;
			}
		});

		it('should ignore invalid sameSite values', async () => {
			const originalEnv = Bun.env.NODE_ENV;
			const originalDomain = Bun.env.COOKIE_DOMAIN;
			const originalSameSite = Bun.env.COOKIE_SAME_SITE;

			try {
				Bun.env.NODE_ENV = 'production';
				Bun.env.COOKIE_DOMAIN = '.juno.build';
				Bun.env.COOKIE_SAME_SITE = 'invalid';

				const jwt = new JwtDecorator();
				const mockSetCookie = mock(() => {});

				const context = {
					jwt,
					cookie: { auth: { set: mockSetCookie } },
					query: { nonce: 'a'.repeat(32) }
				} as unknown as ApiContext<{ query: { nonce: string } }>;

				await githubAuthInit(context);

				// Should NOT include sameSite when value is invalid
				expect(mockSetCookie).toHaveBeenCalledWith({
					value: expect.any(String),
					httpOnly: true,
					maxAge: 600,
					path: '/v1/auth/finalize/github',
					domain: '.juno.build',
					secure: true
				});
			} finally {
				Bun.env.NODE_ENV = originalEnv;
				Bun.env.COOKIE_DOMAIN = originalDomain;
				Bun.env.COOKIE_SAME_SITE = originalSameSite;
			}
		});

		it('should generate random tokens', async () => {
			const jwt = new JwtDecorator();
			const tokens: string[] = [];

			for (let i = 0; i < 3; i++) {
				const context = {
					jwt,
					cookie: { auth: { set: mock(() => {}) } },
					query: { nonce: 'a'.repeat(32) }
				} as unknown as ApiContext<{ query: { nonce: string } }>;

				const result = await githubAuthInit(context);
				const verified = await jwt.verify(result.state);

				if (verified.valid) {
					tokens.push(verified.payload.token as string);
				}
			}

			// All tokens should be unique
			expect(new Set(tokens).size).toBe(3);
		});
	});

	// ... rest of the tests remain the same
});
