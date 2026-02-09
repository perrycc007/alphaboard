import dotenv from 'dotenv';
dotenv.config({ override: true });

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { stocks, themes } from './seed-data';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting seed...\n');

  // ── 1. Indices ──
  const indices = [
    { ticker: 'SPY', name: 'S&P 500 ETF' },
    { ticker: 'QQQ', name: 'Nasdaq 100 ETF' },
    { ticker: 'DIA', name: 'Dow Jones ETF' },
    { ticker: 'IWM', name: 'Russell 2000 ETF' },
  ];

  for (const idx of indices) {
    await prisma.indexEntity.upsert({
      where: { ticker: idx.ticker },
      create: idx,
      update: {},
    });
  }
  console.log(`Seeded ${indices.length} indices`);

  // ── 2. Stocks ──
  const stockMap = new Map<string, string>(); // ticker -> id

  for (const stock of stocks) {
    const created = await prisma.stock.upsert({
      where: { ticker: stock.ticker },
      create: {
        ticker: stock.ticker,
        name: stock.name,
        sector: stock.sector,
        industry: stock.industry,
        exchange: stock.exchange,
        isCurated: true,
      },
      update: {
        name: stock.name,
        sector: stock.sector,
        industry: stock.industry,
        exchange: stock.exchange,
        isCurated: true,
      },
    });
    stockMap.set(stock.ticker, created.id);
  }
  console.log(`Seeded ${stocks.length} stocks`);

  // ── 3. Themes, Groups, and ThemeStock links ──
  let themeCount = 0;
  let groupCount = 0;
  let linkCount = 0;

  for (const theme of themes) {
    const createdTheme = await prisma.theme.upsert({
      where: { name: theme.name },
      create: { name: theme.name, description: theme.description },
      update: { description: theme.description },
    });
    themeCount++;

    for (let i = 0; i < theme.groups.length; i++) {
      const group = theme.groups[i];

      const createdGroup = await prisma.supplyChainGroup.upsert({
        where: {
          themeId_name: { themeId: createdTheme.id, name: group.name },
        },
        create: {
          themeId: createdTheme.id,
          name: group.name,
          sortOrder: i,
        },
        update: { sortOrder: i },
      });
      groupCount++;

      // Link stocks to this group
      for (const ticker of group.tickers) {
        const stockId = stockMap.get(ticker);
        if (!stockId) {
          console.warn(`  WARN: Ticker ${ticker} not found in stock list, skipping`);
          continue;
        }

        await prisma.themeStock.upsert({
          where: {
            stockId_groupId: { stockId, groupId: createdGroup.id },
          },
          create: { stockId, groupId: createdGroup.id },
          update: {},
        });
        linkCount++;
      }
    }
  }
  console.log(`Seeded ${themeCount} themes, ${groupCount} groups, ${linkCount} stock-group links`);

  // ── 4. Default user ──
  await prisma.user.upsert({
    where: { email: 'trader@alphaboard.dev' },
    create: {
      email: 'trader@alphaboard.dev',
      name: 'Default Trader',
      preferences: { create: {} },
    },
    update: {},
  });
  console.log('Seeded default user');

  console.log('\nSeed complete.');
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
