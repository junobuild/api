import { z } from 'zod';

const BinanceTickerPriceSchema = z.strictObject({
	symbol: z.string(),
	price: z.string()
});

type BinanceTickerPrice = z.infer<typeof BinanceTickerPriceSchema>;

const ExchangeTickerPriceSchema = z.strictObject({
	price: BinanceTickerPriceSchema,
	fetchedAt: z.iso.datetime()
});

type ExchangeTickerPrice = z.infer<typeof ExchangeTickerPriceSchema>;

const CACHE_TTL = 60_000;

export class ExchangeDecorator {
	#tickerPriceCache = new Map<BinanceTickerPrice['symbol'], ExchangeTickerPrice>();

	fetchTickerPrice = async ({
		symbol
	}: {
		symbol: string;
	}): Promise<ExchangeTickerPrice> => {
		const cached = this.#tickerPriceCache.get(symbol);

		if (cached !== undefined && Date.now() < new Date(cached.fetchedAt).getTime() + CACHE_TTL) {
			return cached;
		}

		const price = await this.#fetchBinanceTickerPrice({ symbol });

		const tickerPrice = { price, fetchedAt: new Date().toISOString() };

		this.#tickerPriceCache.set(symbol, tickerPrice);

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
			throw new Error(`Binance API error: ${response.status}`);
		}

		const data = await response.json();

		return BinanceTickerPriceSchema.parse(data);
	};
}
