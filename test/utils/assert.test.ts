import { describe, expect, it } from 'bun:test';
import { NullishError } from '../../src/errors';
import { assertNonNullish } from '../../src/utils/assert';

describe('utils > assert', () => {
	describe('assertNonNullish', () => {
		it('should throw an exception if undefined', () => {
			const call = () => assertNonNullish(undefined);

			expect(call).toThrowError();
		});

		it('should throw an exception if null', () => {
			const call = () => assertNonNullish(null);

			expect(call).toThrowError();
		});

		it('should throw an exception with particular message', () => {
			const call = () => assertNonNullish(undefined, 'Test error');

			expect(call).toThrowError(new NullishError('Test error'));
		});

		it('should not throw an exception if valid primitive type', () => {
			const call = () => assertNonNullish(1);

			expect(call).not.toThrowError();
		});

		it('should not throw an exception if valid object', () => {
			const call = () => assertNonNullish({});

			expect(call).not.toThrowError();
		});

		it('should make value of non-nullable type', () => {
			const getStringOrNull = (): string | null => 'test';
			const value: string | null = getStringOrNull();
			const call = () => assertNonNullish(value);

			expect(call).not.toThrowError();
		});
	});
});
