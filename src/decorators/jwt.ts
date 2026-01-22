import {
	exportJWK,
	importPKCS8,
	importSPKI,
	type JWK,
	type JWTPayload,
	jwtVerify,
	SignJWT
} from 'jose';
import { assertNonNullish } from '../utils/assert';

const PRIVATE_KEY_PEM_PATH = process.env.JWT_PRIVATE_KEY_PATH;
const PUBLIC_KEY_PEM_PATH = process.env.JWT_PUBLIC_KEY_PATH;
const JWT_KEY_ID = process.env.JWT_KEY_ID;

assertNonNullish(PRIVATE_KEY_PEM_PATH, 'Path to JWT private key is not defined');
assertNonNullish(PUBLIC_KEY_PEM_PATH, 'Path to JWT public key is not defined');
assertNonNullish(JWT_KEY_ID, 'JWT key ID is not defined');

const privateKeyPem = await Bun.file(PRIVATE_KEY_PEM_PATH).text();
const publicKeyPem = await Bun.file(PUBLIC_KEY_PEM_PATH).text();

const privateKey = await importPKCS8(privateKeyPem, 'RS256');
const publicKey = await importSPKI(publicKeyPem, 'RS256');

// We cannot use Elysia cors plugin. See issue https://github.com/elysiajs/elysia-jwt/issues/122

export class JwtDecorator {
	// Sign JWT for OpenID authentication - the final token used in the Juno (Satellite or Console) authentication.
	// The one use to ultimately derive an identity.
	signOpenIdJwt = async ({
		payload,
		issuer,
		subject,
		audience
	}: {
		payload: JWTPayload | undefined;
		subject: string;
		issuer: string;
		audience: string;
	}): Promise<string> => {
		return new SignJWT(payload)
			.setProtectedHeader({ alg: 'RS256', kid: JWT_KEY_ID })
			.setSubject(subject)
			.setIssuer(issuer)
			.setAudience(audience)
			.setExpirationTime('1h')
			.setIssuedAt()
			.sign(privateKey);
	};

	// Sign JWT for OAuth state management - used in auth init/finalize flow for CSRF protection
	signOAuthJwt = async ({ payload }: { payload: JWTPayload | undefined }): Promise<string> => {
		return new SignJWT(payload)
			.setProtectedHeader({ alg: 'RS256', kid: 'juno-key-1' })
			.setExpirationTime('10m')
			.setIssuedAt()
			.sign(privateKey);
	};

	verify = async (
		jwt: string
	): Promise<{ valid: true; payload: JWTPayload } | { valid: false }> => {
		try {
			const { payload } = await jwtVerify(jwt, publicKey);
			return { valid: true, payload: payload };
		} catch {
			return { valid: false };
		}
	};

	jwks = async (): Promise<{ keys: JWK[] }> => {
		const jwk = await exportJWK(publicKey);

		return {
			keys: [
				{
					...jwk,
					kid: JWT_KEY_ID,
					alg: 'RS256',
					use: 'sig'
				}
			]
		};
	};
}
