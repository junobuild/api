import type { Context, RouteSchema } from 'elysia';
import type { GitHubDecorator } from './decorators/auth/github';
import type { JwtDecorator } from './decorators/auth/jwt';

export type ApiContext<Route extends RouteSchema = RouteSchema> = Context<Route> & {
	github: GitHubDecorator;
	jwt: JwtDecorator;
};
