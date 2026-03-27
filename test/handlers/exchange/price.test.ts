import { afterEach, describe, expect, it, mock, spyOn } from 'bun:test';
import type { ApiContext } from '../../../src/context';
import { ExchangeDecorator } from '../../../src/decorators/exchange';
import { exchangePrice } from '../../../src/handlers/exchange/price';

describe('handlers > exchange > price', () => {
	const mockTickerPrice = { symbol: 'ICPUSDT', price: '2.23800000' };

	const mockExchangeTickerPrice = {
		price: mockTickerPrice,
		fetchedAt: new Date().toISOString()
	};

	afterEach(() => {
		mock.clearAllMocks();
	});

	it('should return price for supported ledger ID', async () => {
		const exchange = new ExchangeDecorator();
		spyOn(exchange, 'fetchPrice').mockResolvedValueOnce(mockExchangeTickerPrice);

		const context = {
			exchange,
			params: { ledgerId: 'ryjl3-tyaaa-aaaaa-aaaba-cai' }
		} as unknown as ApiContext<{ params: { ledgerId: string } }>;

		const result = await exchangePrice(context);

		expect(result.price).toEqual(mockExchangeTickerPrice);
		expect(exchange.fetchPrice).toHaveBeenCalledWith({ symbol: 'ICPUSDT' });
	});

	it('should throw for unsupported ledger ID', async () => {
		const exchange = new ExchangeDecorator();

		const context = {
			exchange,
			params: { ledgerId: 'unknown-ledger-id' }
		} as unknown as ApiContext<{ params: { ledgerId: string } }>;

		expect(exchangePrice(context)).rejects.toThrow('Ledger ID not supported');
	});
});
