import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  environment: process.env.NODE_ENV ?? 'development',
}));

export const polygonConfig = registerAs('polygon', () => ({
  apiKey: process.env.POLYGON_API_KEY ?? '',
  wsUrl: process.env.POLYGON_WS_URL ?? 'wss://socket.polygon.io',
  restUrl: process.env.POLYGON_REST_URL ?? 'https://api.polygon.io',
}));

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL ?? '',
}));
