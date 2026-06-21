import { stocks, themes } from './seed-data';

const MIN_GROUP_SIZE = 5;
const MAX_GROUP_SIZE = 7;

const errors: string[] = [];
const stockTickers = new Set<string>();

for (const stock of stocks) {
  if (stockTickers.has(stock.ticker)) {
    errors.push(`Duplicate stock ticker: ${stock.ticker}`);
  }
  stockTickers.add(stock.ticker);
}

for (const theme of themes) {
  for (const group of theme.groups) {
    const label = `${theme.name} / ${group.name}`;
    if (
      group.tickers.length < MIN_GROUP_SIZE ||
      group.tickers.length > MAX_GROUP_SIZE
    ) {
      errors.push(
        `${label} has ${group.tickers.length} tickers; expected ${MIN_GROUP_SIZE}-${MAX_GROUP_SIZE}`,
      );
    }

    const groupTickers = new Set<string>();
    for (const ticker of group.tickers) {
      if (!stockTickers.has(ticker)) {
        errors.push(`${label} references unknown ticker: ${ticker}`);
      }
      if (groupTickers.has(ticker)) {
        errors.push(`${label} contains duplicate ticker: ${ticker}`);
      }
      groupTickers.add(ticker);
    }
  }
}

if (errors.length > 0) {
  console.error('Seed data validation failed:');
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `Seed data validation passed: ${stocks.length} stocks, ${themes.length} themes.`,
);
