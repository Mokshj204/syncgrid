import { env } from './env_loader.js';

export const config = {
  port: env.port,
  host: env.host,
  pythonServiceUrl: env.pythonServiceUrl,
  webhookSecret: env.webhookSecret,
  corsOrigin: env.corsOrigin,
  databaseUrl: env.databaseUrl,
  typesafeApiKey: env.typesafeApiKey,
};

export default config;
