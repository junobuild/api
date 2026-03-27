import { describe, expect, it } from 'bun:test';
import type { ApiContext } from '../../../src/context';
import { JwtDecorator } from '../../../src/decorators/jwt';
import { authJwks } from '../../../src/handlers/auth/jwks';

describe('handlers > auth > jwks', () => {
	it('should return JWKS', async () => {
		const jwt = new JwtDecorator();

		const context = {
			jwt
		} as ApiContext;

		const result = await authJwks(context);

		expect(result.keys).toBeArray();
		expect(result.keys).toHaveLength(1);

		const key = result.keys[0];
		expect(key.kid).toBe('juno-key-1');
		expect(key.alg).toBe('RS256');
		expect(key.use).toBe('sig');
		expect(key.kty).toBe('RSA');
		expect(key.n).toBeString();
		expect(key.e).toBeString();
	});
});
