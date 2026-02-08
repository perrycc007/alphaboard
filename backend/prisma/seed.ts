import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed indices
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

  // Seed themes
  const themes = [
    {
      name: 'AI',
      description: 'Artificial Intelligence and Machine Learning',
      groups: ['Compute/Chips', 'Infrastructure/Hardware', 'Software/SaaS', 'Cloud'],
    },
    {
      name: 'Energy',
      description: 'Oil, Gas, Renewables, and Nuclear',
      groups: ['Oil & Gas', 'Solar/Wind', 'Nuclear', 'Utilities'],
    },
    {
      name: 'EV',
      description: 'Electric Vehicles and Battery Technology',
      groups: ['OEMs', 'Battery/Materials', 'Charging Infra'],
    },
  ];

  for (const theme of themes) {
    const created = await prisma.theme.upsert({
      where: { name: theme.name },
      create: { name: theme.name, description: theme.description },
      update: {},
    });

    for (let i = 0; i < theme.groups.length; i++) {
      await prisma.supplyChainGroup.upsert({
        where: {
          themeId_name: { themeId: created.id, name: theme.groups[i] },
        },
        create: {
          themeId: created.id,
          name: theme.groups[i],
          sortOrder: i,
        },
        update: {},
      });
    }
  }
  console.log(`Seeded ${themes.length} themes`);

  // Seed sample stocks
  const stocks = [
    { ticker: 'NVDA', name: 'NVIDIA Corp', sector: 'Technology', exchange: 'NASDAQ' },
    { ticker: 'AVGO', name: 'Broadcom Inc', sector: 'Technology', exchange: 'NASDAQ' },
    { ticker: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology', exchange: 'NASDAQ' },
    { ticker: 'AAPL', name: 'Apple Inc', sector: 'Technology', exchange: 'NASDAQ' },
    { ticker: 'MSFT', name: 'Microsoft Corp', sector: 'Technology', exchange: 'NASDAQ' },
    { ticker: 'TSLA', name: 'Tesla Inc', sector: 'Consumer Discretionary', exchange: 'NASDAQ' },
    { ticker: 'META', name: 'Meta Platforms', sector: 'Communication Services', exchange: 'NASDAQ' },
    { ticker: 'GOOGL', name: 'Alphabet Inc', sector: 'Communication Services', exchange: 'NASDAQ' },
    { ticker: 'AMZN', name: 'Amazon.com', sector: 'Consumer Discretionary', exchange: 'NASDAQ' },
    { ticker: 'XOM', name: 'Exxon Mobil', sector: 'Energy', exchange: 'NYSE' },
  ];

  for (const stock of stocks) {
    await prisma.stock.upsert({
      where: { ticker: stock.ticker },
      create: stock,
      update: {},
    });
  }
  console.log(`Seeded ${stocks.length} stocks`);

  // Seed a default user
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
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
