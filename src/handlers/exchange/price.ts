import { t } from 'elysia';
import type { ApiContext } from '../../context';
import { assertNonNullish } from '../../utils/assert';

export const ExchangePriceSchema = t.Object({
	ledgerId: t.String()
});

type ExchangePrice = (typeof ExchangePriceSchema)['static'];

export const LEDGER_TO_SYMBOL: Record<string, string> = {
	'ryjl3-tyaaa-aaaaa-aaaba-cai': 'ICPUSDT'
};

export const exchangePrice = async ({ query, exchange }: ApiContext<{ query: ExchangePrice }>) => {
	const { ledgerId } = query;

	const symbol = LEDGER_TO_SYMBOL[ledgerId];
	assertNonNullish(symbol, 'Ledger ID not supported');

	const price = await exchange.fetchTickerPrice({ symbol });
	return { price };
};
