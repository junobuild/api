import type { Context, RouteSchema } from 'elysia';
import type { ExchangeDecorator } from './decorators/exchange';
import type { GitHubDecorator } from './decorators/github';
import type { JwtDecorator } from './decorators/jwt';

export type ApiContext<Route extends RouteSchema = RouteSchema> = Context<Route> & {
	github: GitHubDecorator;
	jwt: JwtDecorator;
	exchange: ExchangeDecorator;
};
