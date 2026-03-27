import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from 'bun:test';
import { ExchangeDecorator } from '../../src/decorators/exchange';
import { FetchApiError } from '../../src/errors';

describe('decorators > exchange', () => {
	const mockTickerPrice = { symbol: 'ICPUSDT', price: '2.23800000' };

	let exchange: ExchangeDecorator;

	beforeEach(() => {
		exchange = new ExchangeDecorator();
	});

	afterEach(() => {
		mock.clearAllMocks();
	});

	describe('fetchTickerPrice', () => {
		it('should fetch and return ticker price', async () => {
			spyOn(global, 'fetch').mockResolvedValueOnce(Response.json(mockTickerPrice));

			const result = await exchange.fetchTickerPrice({ symbol: 'ICPUSDT' });

			expect(result.price).toEqual(mockTickerPrice);
			expect(result.fetchedAt).toBeString();
			expect(new Date(result.fetchedAt).toISOString()).toBe(result.fetchedAt);
		});

		it('should call Binance API with correct URL', async () => {
			spyOn(global, 'fetch').mockResolvedValueOnce(Response.json(mockTickerPrice));

			await exchange.fetchTickerPrice({ symbol: 'ICPUSDT' });

			expect(global.fetch).toHaveBeenCalledWith(
				'https://data-api.binance.vision/api/v3/ticker/price?symbol=ICPUSDT'
			);
		});

		it('should return cached value within TTL', async () => {
			const fetchSpy = spyOn(global, 'fetch').mockResolvedValueOnce(Response.json(mockTickerPrice));

			await exchange.fetchTickerPrice({ symbol: 'ICPUSDT' });
			await exchange.fetchTickerPrice({ symbol: 'ICPUSDT' });

			expect(fetchSpy).toHaveBeenCalledTimes(1);
		});

		it('should refetch after TTL expires', async () => {
			const fetchSpy = spyOn(global, 'fetch')
				.mockResolvedValueOnce(Response.json(mockTickerPrice))
				.mockResolvedValueOnce(Response.json(mockTickerPrice));

			await exchange.fetchTickerPrice({ symbol: 'ICPUSDT' });

			spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);

			await exchange.fetchTickerPrice({ symbol: 'ICPUSDT' });

			expect(fetchSpy).toHaveBeenCalledTimes(2);
		});

		it('should cache different symbols independently', async () => {
			const fetchSpy = spyOn(global, 'fetch')
				.mockResolvedValueOnce(Response.json({ symbol: 'ICPUSDT', price: '2.23800000' }))
				.mockResolvedValueOnce(Response.json({ symbol: 'BTCUSDT', price: '50000.00' }));

			await exchange.fetchTickerPrice({ symbol: 'ICPUSDT' });
			await exchange.fetchTickerPrice({ symbol: 'BTCUSDT' });

			expect(fetchSpy).toHaveBeenCalledTimes(2);
		});

		it('should throw on Binance API error', async () => {
			spyOn(global, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 500 }));

			expect(exchange.fetchTickerPrice({ symbol: 'ICPUSDT' })).rejects.toThrow(FetchApiError);
		});

		it('should throw on invalid response schema', async () => {
			spyOn(global, 'fetch').mockResolvedValueOnce(Response.json({ unexpected: 'data' }));

			expect(exchange.fetchTickerPrice({ symbol: 'ICPUSDT' })).rejects.toThrow();
		});
	});
});
