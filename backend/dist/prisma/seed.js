"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ override: true });
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const seed_data_1 = require("./seed-data");
const adapter = new adapter_pg_1.PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new client_1.PrismaClient({ adapter });
async function main() {
    console.log('Starting seed...\n');
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
    const stockMap = new Map();
    for (const stock of seed_data_1.stocks) {
        const created = await prisma.stock.upsert({
            where: { ticker: stock.ticker },
            create: {
                ticker: stock.ticker,
                name: stock.name,
                sector: stock.sector,
                industry: stock.industry,
                exchange: stock.exchange,
            },
            update: {
                name: stock.name,
                sector: stock.sector,
                industry: stock.industry,
                exchange: stock.exchange,
            },
        });
        stockMap.set(stock.ticker, created.id);
    }
    console.log(`Seeded ${seed_data_1.stocks.length} stocks`);
    let themeCount = 0;
    let groupCount = 0;
    let linkCount = 0;
    for (const theme of seed_data_1.themes) {
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
//# sourceMappingURL=seed.js.map