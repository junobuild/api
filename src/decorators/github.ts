import { z } from 'zod';
import { GitHubApiError } from '../errors';
import { assertNonNullish } from '../utils/assert';

const GitHubUserSchema = z.object({
	id: z.number(),
	login: z.string(),
	email: z.string().nullable(),
	name: z.string().nullable(),
	avatar_url: z.url({ protocol: /^https$/ }).nullable()
});

type GitHubUser = z.infer<typeof GitHubUserSchema>;

const GitHubAccessTokenSchema = z.object({
	access_token: z.string()
});

type GitHubAccessToken = z.infer<typeof GitHubAccessTokenSchema>;

export class GitHubDecorator {
	exchangeGitHubCodeForAccessToken = async ({
		code
	}: {
		code: string;
	}): Promise<GitHubAccessToken> => {
		const clientId = process.env.GITHUB_CLIENT_ID;
		const clientSecret = process.env.GITHUB_CLIENT_SECRET;

		assertNonNullish(clientId, 'GitHub client ID environment variable not defined');
		assertNonNullish(clientSecret, 'GitHub client secret environment variable not defined');

		const accessTokenResponse = await fetch('https://github.com/login/oauth/access_token', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				client_id: clientId,
				client_secret: clientSecret,
				code
			})
		});

		if (!accessTokenResponse.ok) {
			throw new GitHubApiError(
				accessTokenResponse.status,
				`GitHub access token error: ${accessTokenResponse.status}`
			);
		}

		const data = await accessTokenResponse.json();

		return GitHubAccessTokenSchema.parse(data);
	};

	fetchGitHubUser = async ({ accessToken }: { accessToken: string }): Promise<GitHubUser> => {
		const userResponse = await fetch('https://api.github.com/user', {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: 'application/vnd.github+json'
			}
		});

		if (!userResponse.ok) {
			throw new GitHubApiError(userResponse.status, `GitHub API error: ${userResponse.status}`);
		}

		const data = await userResponse.json();

		return GitHubUserSchema.parse(data);
	};
}
