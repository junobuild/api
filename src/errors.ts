export class GitHubApiError extends Error {
	constructor(
		readonly statusCode: number,
		readonly message: string
	) {
		super(message);
	}
}

export class GitHubAuthUnauthorizedError extends Error {}

export class NullishError extends Error {}
