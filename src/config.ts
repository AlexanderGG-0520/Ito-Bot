import process from 'node:process';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AppConfig {
  token: string;
  clientId: string;
  guildId?: string;
  port: number;
  host: string;
  nodeEnv: string;
  logLevel: LogLevel;
  dataDir: string;
  termsUrl?: string;
  privacyUrl?: string;
  supportUrl?: string;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function optionalUrl(name: string): string | undefined {
  const value = process.env[name]?.trim();
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') throw new Error('HTTPS required');
    return url.toString();
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL`);
  }
}

export function loadConfig(): AppConfig {
  const portValue = process.env.PORT?.trim() || '8080';
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1-65535');
  const level = process.env.LOG_LEVEL?.trim().toLowerCase() || 'info';
  if (!['debug', 'info', 'warn', 'error'].includes(level)) throw new Error('LOG_LEVEL is invalid');
  const guildId = process.env.DISCORD_GUILD_ID?.trim() || undefined;
  const result: AppConfig = {
    token: required('DISCORD_TOKEN'),
    clientId: required('DISCORD_CLIENT_ID'),
    port,
    host: process.env.HOST?.trim() || '0.0.0.0',
    nodeEnv: process.env.NODE_ENV?.trim() || 'development',
    logLevel: level as LogLevel,
    dataDir: process.env.DATA_DIR?.trim() || '/tmp/ito-bot',
  };
  if (guildId) result.guildId = guildId;
  const termsUrl = optionalUrl('TERMS_URL');
  const privacyUrl = optionalUrl('PRIVACY_URL');
  const supportUrl = optionalUrl('SUPPORT_URL');
  if (termsUrl) result.termsUrl = termsUrl;
  if (privacyUrl) result.privacyUrl = privacyUrl;
  if (supportUrl) result.supportUrl = supportUrl;
  return result;
}

export function loadRegistrationConfig(): Pick<AppConfig, 'token' | 'clientId' | 'guildId'> {
  const token = required('DISCORD_TOKEN');
  const clientId = required('DISCORD_CLIENT_ID');
  const guildId = process.env.DISCORD_GUILD_ID?.trim() || undefined;
  return guildId ? { token, clientId, guildId } : { token, clientId };
}
