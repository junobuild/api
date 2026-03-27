import { z } from 'zod';
import { FetchApiError } from '../errors';

const BinanceTickerPriceSchema = z.strictObject({
	symbol: z.string(),
	price: z.string()
});

type BinanceTickerPrice = z.infer<typeof BinanceTickerPriceSchema>;

const ExchangePriceSchema = z.strictObject({
	...BinanceTickerPriceSchema.shape,
	fetchedAt: z.iso.datetime()
});

type ExchangePrice = z.infer<typeof ExchangePriceSchema>;

const CACHE_TTL = 60_000;

export class ExchangeDecorator {
	#priceCache = new Map<BinanceTickerPrice['symbol'], ExchangePrice>();

	fetchPrice = async ({ symbol }: { symbol: string }): Promise<ExchangePrice> => {
		const cached = this.#priceCache.get(symbol);

		if (cached !== undefined && Date.now() < new Date(cached.fetchedAt).getTime() + CACHE_TTL) {
			return cached;
		}

		const price = await this.#fetchBinanceTickerPrice({ symbol });

		const tickerPrice = { ...price, fetchedAt: new Date().toISOString() };

		this.#priceCache.set(symbol, tickerPrice);

		return tickerPrice;
	};

	#fetchBinanceTickerPrice = async ({
		symbol
	}: {
		symbol: string;
	}): Promise<BinanceTickerPrice> => {
		// Market data only URL do not require an API key or attribution.
		// Reference: https://developers.binance.com/docs/binance-spot-api-docs/faqs/market_data_only
		const response = await fetch(
			`https://data-api.binance.vision/api/v3/ticker/price?symbol=${symbol}`
		);

		if (!response.ok) {
			throw new FetchApiError(response.status, `Binance API error: ${response.status}`);
		}

		const data = await response.json();

		return BinanceTickerPriceSchema.parse(data);
	};
}
