import { beforeAll, describe, expect, it } from 'bun:test';
import { JwtDecorator } from '../../src/decorators/jwt';

describe('decorators > jwt', () => {
	let jwt: JwtDecorator;

	beforeAll(() => {
		jwt = new JwtDecorator();
	});

	describe('signOpenIdJwt', () => {
		it('should create valid OpenID JWT', async () => {
			const token = await jwt.signOpenIdJwt({
				payload: { email: 'test@example.com' },
				subject: 'user-123',
				issuer: 'https://juno.build',
				audience: 'https://app.juno.build'
			});

			expect(token).toBeString();
			expect(token.split('.')).toHaveLength(3);

			const result = await jwt.verify(token);
			expect(result.valid).toBe(true);

			if (!result.valid) {
				expect(true).toBeFalsy();
				return;
			}

			expect(result.payload.sub).toBe('user-123');
			expect(result.payload.iss).toBe('https://juno.build');
			expect(result.payload.aud).toBe('https://app.juno.build');
			expect(result.payload.email).toBe('test@example.com');
		});

		it('should set expiration to 1 hour', async () => {
			const token = await jwt.signOpenIdJwt({
				payload: {},
				subject: 'user-123',
				issuer: 'test',
				audience: 'test'
			});

			const result = await jwt.verify(token);

			if (!result.valid) {
				expect(true).toBeFalsy();
				return;
			}

			const now = Math.floor(Date.now() / 1000);
			const exp = result.payload.exp ?? Infinity;
			const diff = exp - now;

			expect(diff).toBeGreaterThan(3500); // ~58 minutes
			expect(diff).toBeLessThan(3700); // ~61 minutes
		});
	});

	describe('signOAuthJwt', () => {
		it('should create valid OAuth state JWT', async () => {
			const token = await jwt.signOAuthJwt({
				payload: { state: 'random-state', nonce: 'random-nonce' }
			});

			const result = await jwt.verify(token);
			expect(result.valid).toBe(true);

			if (!result.valid) {
				expect(true).toBeFalsy();
				return;
			}

			expect(result.payload.state).toBe('random-state');
			expect(result.payload.nonce).toBe('random-nonce');
		});

		it('should set expiration to 10 minutes', async () => {
			const token = await jwt.signOAuthJwt({ payload: {} });

			const result = await jwt.verify(token);

			if (!result.valid) {
				expect(true).toBeFalsy();
				return;
			}

			const now = Math.floor(Date.now() / 1000);
			const exp = result.payload.exp ?? Infinity;
			const diff = exp - now;

			expect(diff).toBeGreaterThan(550); // ~9 minutes
			expect(diff).toBeLessThan(650); // ~11 minutes
		});
	});

	describe('verify', () => {
		it('should verify valid token', async () => {
			const token = await jwt.signOAuthJwt({ payload: { test: 'data' } });
			const result = await jwt.verify(token);

			expect(result.valid).toBe(true);

			if (!result.valid) {
				expect(true).toBeFalsy();
				return;
			}

			expect(result.payload.test).toBe('data');
		});

		it('should reject invalid token', async () => {
			const result = await jwt.verify('invalid.token.here');
			expect(result.valid).toBe(false);
		});

		it('should reject tampered token', async () => {
			const token = await jwt.signOAuthJwt({ payload: { test: 'data' } });
			const tampered = `${token.slice(0, -10)}xxxxxxxxxx`;

			const result = await jwt.verify(tampered);
			expect(result.valid).toBe(false);
		});
	});

	describe('jwks', () => {
		it('should return valid JWKS', async () => {
			const jwks = await jwt.jwks();

			expect(jwks.keys).toBeArray();
			expect(jwks.keys).toHaveLength(1);

			const key = jwks.keys[0];
			expect(key.kid).toBe('juno-key-1');
			expect(key.alg).toBe('RS256');
			expect(key.use).toBe('sig');
			expect(key.kty).toBe('RSA');
			expect(key.n).toBeString();
			expect(key.e).toBeString();
		});
	});
});
