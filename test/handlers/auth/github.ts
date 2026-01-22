import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import type { ApiContext } from '../../../src/context';
import { GitHubDecorator } from '../../../src/decorators/github';
import { JwtDecorator } from '../../../src/decorators/jwt';
import { githubAuthFinalize, githubAuthInit } from '../../../src/handlers/auth/github';

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

	describe('githubAuthFinalize', () => {
		it('should finalize GitHub auth successfully', async () => {
			const jwt = new JwtDecorator();
			const github = new GitHubDecorator();

			spyOn(global, 'fetch').mockImplementation((async (url) => {
				if (url === 'https://github.com/login/oauth/access_token') {
					return Response.json({ access_token: 'gho_github_token' });
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

			const stateToken = await jwt.signOAuthJwt({
				payload: {
					provider: 'github',
					token: 'a'.repeat(64),
					nonce: 'test-nonce'
				}
			});

			const mockRemoveCookie = mock(() => {});

			const context = {
				body: {
					code: 'github-code-123',
					state: stateToken
				},
				jwt,
				cookie: {
					auth: {
						value: stateToken,
						remove: mockRemoveCookie
					}
				},
				github
			} as unknown as ApiContext<{ body: { code: string; state: string } }>;

			const result = await githubAuthFinalize(context);

			expect(result.token).toBeString();
			expect(mockRemoveCookie).toHaveBeenCalledTimes(1);

			// Verify the returned token is valid
			const verified = await jwt.verify(result.token);
			expect(verified.valid).toBe(true);

			if (!verified.valid) {
				expect(true).toBeFalsy();
				return;
			}

			expect(verified.payload.sub).toBe('12345');
			expect(verified.payload.email).toBe('test@example.com');
			expect(verified.payload.preferred_username).toBe('testuser');
			expect(verified.payload.iss).toBe(process.env.GITHUB_AUTH_ISSUER);
			expect(verified.payload.aud).toBe(process.env.GITHUB_CLIENT_ID);
			expect(verified.payload.nonce).toBe('test-nonce');
		});

		it('should handle null user fields', async () => {
			const jwt = new JwtDecorator();
			const github = new GitHubDecorator();

			spyOn(global, 'fetch').mockImplementation((async (url) => {
				if (url === 'https://github.com/login/oauth/access_token') {
					return Response.json({ access_token: 'gho_token' });
				}
				if (url === 'https://api.github.com/user') {
					return Response.json({
						id: 12345,
						login: 'testuser',
						email: null,
						name: null,
						avatar_url: null
					});
				}
				return new Response('Not found', { status: 404 });
			}) as typeof fetch);

			const stateToken = await jwt.signOAuthJwt({
				payload: { provider: 'github', token: 'a'.repeat(64), nonce: 'nonce' }
			});

			const context = {
				body: { code: 'code', state: stateToken },
				jwt,
				cookie: { auth: { value: stateToken, remove: mock(() => {}) } },
				github
			} as unknown as ApiContext<{ body: { code: string; state: string } }>;

			const result = await githubAuthFinalize(context);

			const verified = await jwt.verify(result.token);

			if (!verified.valid) {
				expect(true).toBeFalsy();
				return;
			}

			expect(verified.payload.email).toBeNull();
			expect(verified.payload.name).toBeNull();
			expect(verified.payload.picture).toBeNull();
		});

		it('should throw if cookie is undefined', async () => {
			const context = {
				body: { code: 'code', state: 'state' },
				jwt: new JwtDecorator(),
				cookie: { auth: { value: undefined } },
				github: new GitHubDecorator()
			} as unknown as ApiContext<{ body: { code: string; state: string } }>;

			expect(githubAuthFinalize(context)).rejects.toThrow('Authentication flow not initialized');
		});

		it('should throw on state mismatch', async () => {
			const jwt = new JwtDecorator();
			const cookieState = await jwt.signOAuthJwt({
				payload: { provider: 'github', token: 'a'.repeat(64), nonce: 'nonce' }
			});

			const context = {
				body: { code: 'code', state: 'different-state' },
				jwt,
				cookie: { auth: { value: cookieState } },
				github: new GitHubDecorator()
			} as unknown as ApiContext<{ body: { code: string; state: string } }>;

			expect(githubAuthFinalize(context)).rejects.toThrow('State mismatch');
		});

		it('should throw if JWT verification fails', async () => {
			const context = {
				body: { code: 'code', state: 'invalid-jwt-token' },
				jwt: new JwtDecorator(),
				cookie: { auth: { value: 'invalid-jwt-token' } },
				github: new GitHubDecorator()
			} as unknown as ApiContext<{ body: { code: string; state: string } }>;

			expect(githubAuthFinalize(context)).rejects.toThrow('Authentication state is invalid');
		});

		it('should throw on provider mismatch', async () => {
			const jwt = new JwtDecorator();
			const stateToken = await jwt.signOAuthJwt({
				payload: { provider: 'google', token: 'a'.repeat(64), nonce: 'nonce' }
			});

			const context = {
				body: { code: 'code', state: stateToken },
				jwt,
				cookie: { auth: { value: stateToken } },
				github: new GitHubDecorator()
			} as unknown as ApiContext<{ body: { code: string; state: string } }>;

			expect(githubAuthFinalize(context)).rejects.toThrow(
				'Authentication cookie provider mismatch'
			);
		});

		it('should remove cookie before exchanging code', async () => {
			const jwt = new JwtDecorator();
			const github = new GitHubDecorator();
			const callOrder: string[] = [];

			spyOn(global, 'fetch').mockImplementation((async (url) => {
				if (url === 'https://github.com/login/oauth/access_token') {
					callOrder.push('exchange');
					return Response.json({ access_token: 'token' });
				}
				if (url === 'https://api.github.com/user') {
					return Response.json({
						id: 1,
						login: 'user',
						email: null,
						name: null,
						avatar_url: null
					});
				}
				return new Response('Not found', { status: 404 });
			}) as typeof fetch);

			const mockRemove = mock(() => {
				callOrder.push('remove');
			});

			const stateToken = await jwt.signOAuthJwt({
				payload: { provider: 'github', token: 'a'.repeat(64), nonce: 'nonce' }
			});

			const context = {
				body: { code: 'code', state: stateToken },
				jwt,
				cookie: { auth: { value: stateToken, remove: mockRemove } },
				github
			} as unknown as ApiContext<{ body: { code: string; state: string } }>;

			await githubAuthFinalize(context);

			expect(callOrder).toEqual(['remove', 'exchange']);
		});
	});
});
