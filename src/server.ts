import { cors } from '@elysiajs/cors';
import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';
import packageJson from '../package.json';
import { GitHubDecorator } from './decorators/auth/github';
import { JwtDecorator } from './decorators/auth/jwt';
import { BinanceDecorator } from './decorators/exchange/binance';
import { GitHubApiError, GitHubAuthUnauthorizedError, NullishError } from './errors';
import {
	githubAuthFinalize,
	GitHubAuthFinalizeSchema,
	githubAuthInit,
	GitHubAuthInitSchema
} from './handlers/auth/github';
import { authJwks } from './handlers/auth/jwks';
import { exchangePrice, ExchangePriceSchema } from './handlers/exchange/price';

const { version: appVersion, name: appName, description: appDescription } = packageJson;

export const app = new Elysia()
	.error({
		GitHubApiError,
		NullishError,
		GitHubAuthNotInitializedError: GitHubAuthUnauthorizedError
	})
	.onError(({ code, error, status }) => {
		switch (code) {
			case 'GitHubApiError':
				return status(error.statusCode, error.message);
			case 'GitHubAuthNotInitializedError':
				return status(401, error.message);
			case 'NullishError':
				return status(500, error.message);
		}
	})
	.use(
		openapi({
			documentation: {
				info: {
					title: appName,
					version: appVersion,
					description: appDescription
				}
			}
		})
	)
	.use(cors())
	.decorate('github', new GitHubDecorator())
	.decorate('jwt', new JwtDecorator())
	.decorate('binance', new BinanceDecorator())
	.group('/v1', (app) =>
		app
			.group('/auth', (app) =>
				app
					.get('/certs', authJwks)
					.group('/finalize', (app) =>
						app.post('/github', githubAuthFinalize, {
							body: GitHubAuthFinalizeSchema
						})
					)
					.group('/init', (app) =>
						app.get('/github', githubAuthInit, { query: GitHubAuthInitSchema })
					)
			)
			.group('/exchange', (app) => app.get('/price', exchangePrice, { query: ExchangePriceSchema }))
	)
	.listen(3000);

console.log(
	`🛰️  Juno API (v${appVersion}) is running at ${app.server?.hostname}:${app.server?.port}`
);
