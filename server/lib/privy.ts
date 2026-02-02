import { PrivyClient } from '@privy-io/node';

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
