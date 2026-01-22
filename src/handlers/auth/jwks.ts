import type { ApiContext } from '../../context';

export const authJwks = async ({ jwt: { jwks } }: ApiContext) => {
	return jwks();
};
