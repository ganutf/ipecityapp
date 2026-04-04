import { PrivyClient } from '@privy-io/node';
import { config } from 'dotenv';
import { resolve } from 'path';

// Ensure env vars are loaded before reading them
config({ path: resolve(process.cwd(), '.env') });

const appId = process.env.PRIVY_APP_ID;
const appSecret = process.env.PRIVY_APP_SECRET;

if (!appId || !appSecret) {
  console.warn('PRIVY_APP_ID or PRIVY_APP_SECRET not set - Privy auth disabled');
}

export const privy = appId && appSecret
  ? new PrivyClient({
      appId,
      appSecret,
    })
  : null;
