import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { GitHubDecorator } from '../../src/decorators/github';
import { GitHubApiError } from '../../src/errors';

describe('decorators > github', () => {
	let github: GitHubDecorator;

	beforeEach(() => {
		github = new GitHubDecorator();
	});

	afterEach(() => {
		mock.clearAllMocks();
	});

	describe('exchangeGitHubCodeForAccessToken', () => {
		it('should exchange code for access token', async () => {
			spyOn(global, 'fetch').mockResolvedValue(Response.json({ access_token: 'gho_test123' }));

			const result = await github.exchangeGitHubCodeForAccessToken({
				code: 'test-code'
			});

			expect(result.access_token).toBe('gho_test123');

			expect(global.fetch).toHaveBeenCalledWith(
				'https://github.com/login/oauth/access_token',
				expect.objectContaining({
					method: 'POST',
					headers: {
						Accept: 'application/json',
						'Content-Type': 'application/json'
					}
				})
			);
		});

		it('should throw if client ID is missing', async () => {
			const originalClientId = process.env.GITHUB_CLIENT_ID;
			process.env.GITHUB_CLIENT_ID = undefined;

			expect(github.exchangeGitHubCodeForAccessToken({ code: 'test-code' })).rejects.toThrow(
				'GitHub client ID environment variable not defined'
			);

			process.env.GITHUB_CLIENT_ID = originalClientId;
		});

		it('should throw if client secret is missing', async () => {
			const originalClientSecret = process.env.GITHUB_CLIENT_SECRET;
			process.env.GITHUB_CLIENT_SECRET = undefined;

			expect(github.exchangeGitHubCodeForAccessToken({ code: 'test-code' })).rejects.toThrow(
				'GitHub client secret environment variable not defined'
			);

			process.env.GITHUB_CLIENT_SECRET = originalClientSecret;
		});

		it('should throw GitHubApiError on non-200 response', async () => {
			spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));

			expect(github.exchangeGitHubCodeForAccessToken({ code: 'bad-code' })).rejects.toThrow(
				GitHubApiError
			);
		});

		it('should throw on invalid response schema', async () => {
			spyOn(global, 'fetch').mockResolvedValue(Response.json({ error: 'bad_verification_code' }));

			expect(github.exchangeGitHubCodeForAccessToken({ code: 'test-code' })).rejects.toThrow();
		});

		it('should send correct request body', async () => {
			const fetchSpy = spyOn(global, 'fetch').mockResolvedValue(
				Response.json({ access_token: 'gho_test' })
			);

			await github.exchangeGitHubCodeForAccessToken({ code: 'my-code' });

			const callArgs = fetchSpy.mock.calls[0];
			const body = JSON.parse(callArgs[1]?.body as string);

			expect(body).toEqual({
				client_id: 'test-client-id',
				client_secret: 'test-client-secret',
				code: 'my-code'
			});
		});
	});

	describe('fetchGitHubUser', () => {
		it('should fetch GitHub user', async () => {
			const mockUser = {
				id: 12345,
				login: 'testuser',
				email: 'test@example.com',
				name: 'Test User',
				avatar_url: 'https://avatars.githubusercontent.com/u/12345'
			};

			spyOn(global, 'fetch').mockResolvedValue(Response.json(mockUser));

			const result = await github.fetchGitHubUser({
				accessToken: 'gho_test123'
			});

			expect(result).toEqual(mockUser);

			expect(global.fetch).toHaveBeenCalledWith(
				'https://api.github.com/user',
				expect.objectContaining({
					headers: {
						Authorization: 'Bearer gho_test123',
						Accept: 'application/vnd.github+json'
					}
				})
			);
		});

		it('should handle nullable fields', async () => {
			const mockUser = {
				id: 12345,
				login: 'testuser',
				email: null,
				name: null,
				avatar_url: null
			};

			spyOn(global, 'fetch').mockResolvedValue(Response.json(mockUser));

			const result = await github.fetchGitHubUser({
				accessToken: 'gho_test123'
			});

			expect(result.email).toBeNull();
			expect(result.name).toBeNull();
			expect(result.avatar_url).toBeNull();
		});

		it('should throw GitHubApiError on 401', async () => {
			spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 401 }));

			expect(github.fetchGitHubUser({ accessToken: 'invalid-token' })).rejects.toThrow(
				GitHubApiError
			);
		});

		it('should throw GitHubApiError on 403', async () => {
			spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 403 }));

			const error = await github.fetchGitHubUser({ accessToken: 'expired-token' }).catch((e) => e);

			expect(error).toBeInstanceOf(GitHubApiError);
			expect(error.statusCode).toBe(403);
		});

		it('should throw on invalid user schema', async () => {
			spyOn(global, 'fetch').mockResolvedValue(Response.json({ id: 'not-a-number' }));

			expect(github.fetchGitHubUser({ accessToken: 'gho_test' })).rejects.toThrow(); // Zod validation error
		});

		it('should reject non-https avatar URLs', async () => {
			const mockUser = {
				id: 12345,
				login: 'testuser',
				email: 'test@example.com',
				name: 'Test User',
				avatar_url: 'http://insecure.com/avatar.jpg'
			};

			spyOn(global, 'fetch').mockResolvedValue(Response.json(mockUser));

			expect(github.fetchGitHubUser({ accessToken: 'gho_test' })).rejects.toThrow();
		});
	});
});
