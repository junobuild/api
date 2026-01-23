import { t } from 'elysia';
import { z } from 'zod';
import type { ApiContext } from '../../context';
import { GitHubAuthUnauthorizedError } from '../../errors';
import { assertNonNullish } from '../../utils/assert';

export const GitHubAuthInitSchema = t.Object({
	nonce: t.String({ minLength: 32 })
});

type GitHubAuthInit = (typeof GitHubAuthInitSchema)['static'];

const GitHubOAuthStateSchema = z.strictObject({
	provider: z.literal('github'),
	token: z.hex().length(64),
	nonce: z.string()
});

type GitHubOAuthState = z.infer<typeof GitHubOAuthStateSchema>;

export const githubAuthInit = async ({
	jwt,
	cookie: { auth },
	query
}: ApiContext<{ query: GitHubAuthInit }>) => {
	const { nonce } = query;

	const { randomBytes } = await import('node:crypto');

	const stateData: GitHubOAuthState = {
		provider: 'github',
		token: randomBytes(32).toString('hex'),
		nonce
	};

	const state = await jwt.signOAuthJwt({ payload: stateData });

	const production = Bun.env.NODE_ENV === 'production';
	const cookieDomain = Bun.env.COOKIE_DOMAIN?.trim();
	const cookieSameSite = Bun.env.COOKIE_SAME_SITE?.trim();

	auth.set({
		value: state,
		httpOnly: true,
		maxAge: 10 * 60, // 10 minutes, similar as the GitHub OAuth authorization code which least 10 minutes
		path: '/v1/auth/finalize/github',
		...(production && {
			...(cookieDomain !== undefined && cookieDomain !== '' && { domain: cookieDomain }),
			...(cookieSameSite !== undefined &&
				cookieSameSite !== '' &&
				['strict', 'lax', 'none'].includes(cookieSameSite) && {
					sameSite: cookieSameSite as 'strict' | 'lax' | 'none'
				}),
			secure: true
		})
	});

	return { state };
};

export const GitHubAuthFinalizeSchema = t.Object({
	code: t.String(),
	state: t.String()
});

type GitHubAuthFinalize = (typeof GitHubAuthFinalizeSchema)['static'];

export const githubAuthFinalize = async ({
	body,
	jwt,
	cookie: { auth },
	github: { fetchGitHubUser, exchangeGitHubCodeForAccessToken }
}: ApiContext<{ body: GitHubAuthFinalize }>) => {
	const { code, state } = body;

	const issuer = process.env.GITHUB_AUTH_ISSUER;
	assertNonNullish(issuer, 'GitHub Issuer undefined');

	const clientId = process.env.GITHUB_CLIENT_ID;
	assertNonNullish(clientId, 'GitHub Client ID undefined');

	// Assert cookie is defined
	if (auth?.value === undefined || auth?.value === null) {
		throw new GitHubAuthUnauthorizedError('Authentication flow not initialized');
	}

	const { value } = auth;

	if (typeof value !== 'string') {
		throw new GitHubAuthUnauthorizedError('Invalid authentication cookie value');
	}

	// Verify state from URL matches cookie - i.e. frontend caller is the same as the initiator of the process
	if (state !== value) {
		throw new GitHubAuthUnauthorizedError('State mismatch');
	}

	// Verify and decode JWT state
	const verified = await jwt.verify(value);

	if (!verified.valid) {
		throw new GitHubAuthUnauthorizedError('Authentication state is invalid');
	}

	const {
		payload: { provider, nonce }
	} = verified;

	// Validate provider
	if (provider !== 'github') {
		throw new GitHubAuthUnauthorizedError('Authentication cookie provider mismatch');
	}

	// Clear the auth cookie
	auth.remove();

	const { access_token: accessToken } = await exchangeGitHubCodeForAccessToken({ code });

	const user = await fetchGitHubUser({ accessToken });

	// 3. Sign JWT for Juno (your own authentication token)
	const junoToken = await jwt.signOpenIdJwt({
		payload: {
			email: user.email, // Might be null
			name: user.name, // Might be null
			given_name: null, // GitHub doesn't provide this field
			family_name: null, // GitHub doesn't provide this field
			preferred_username: user.login,
			picture: user.avatar_url,
			locale: null, // GitHub doesn't provide this field
			nonce
		},
		subject: user.id.toString(),
		// The issue is a unique identifier used by the backend to find
		// what provider to use for the authentication.
		issuer,
		// The backend expected the audience to be the client ID.
		// @see verify_openid_jwt
		audience: clientId
	});

	return { token: junoToken };
};
