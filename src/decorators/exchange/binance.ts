import { z } from 'zod';

const BinanceTickerPriceSchema = z.object({
	symbol: z.string(),
	price: z.string()
});

type BinanceTickerPrice = z.infer<typeof BinanceTickerPriceSchema>;

const CACHE_TTL = 60_000;

export class BinanceDecorator {
	#tickerPricecache = new Map<
		BinanceTickerPrice['symbol'],
		{ price: BinanceTickerPrice; fetchedAt: number }
	>();

	fetchTickerPriceWithCache = async ({ symbol }: { symbol: string }): Promise<BinanceTickerPrice> => {
		const cached = this.#tickerPricecache.get(symbol);

		if (cached !== undefined && Date.now() < cached.fetchedAt + CACHE_TTL) {
			return cached.price;
		}

		const price = await this.fetchTickerPrice({symbol});

		this.#tickerPricecache.set(symbol, { price, fetchedAt: Date.now() });

		return price;
	}

	fetchTickerPrice = async ({ symbol }: { symbol: string }): Promise<BinanceTickerPrice> => {
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
