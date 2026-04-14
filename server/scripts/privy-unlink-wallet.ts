#!/usr/bin/env tsx

/**
 * Privy Wallet Unlink Script
 *
 * Unlinks a wallet address from a Privy user account.
 * Use when a wallet was accidentally linked to the wrong Privy user.
 *
 * Usage: tsx server/scripts/privy-unlink-wallet.ts <privy-user-id> <wallet-address>
 * Example: tsx server/scripts/privy-unlink-wallet.ts did:privy:cml5ms0ro03bel00cfpwgr0ju 0xaa3C627475468a36e8F00bceB7BB0c18355E4ee1
 */

import 'dotenv/config';
import { PrivyClient } from '@privy-io/node';

const privyUserId = process.argv[2];
const walletAddress = process.argv[3];

async function main() {
  console.log('Privy Wallet Unlink Script');
  console.log('=========================\n');

  if (!privyUserId || !walletAddress) {
    console.error('Usage: tsx server/scripts/privy-unlink-wallet.ts <privy-user-id> <wallet-address>');
    console.error('Example: tsx server/scripts/privy-unlink-wallet.ts did:privy:abc123 0xaa3C...');
    process.exit(1);
  }

  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appId || !appSecret) {
    console.error('PRIVY_APP_ID and PRIVY_APP_SECRET must be set in .env');
    process.exit(1);
  }

  const privy = new PrivyClient({ appId, appSecret });

  const usersApi = privy.users();

  // First, fetch the user to confirm the wallet is linked
  console.log(`Fetching Privy user: ${privyUserId}`);
  const user = await usersApi._get(privyUserId);

  console.log(`User found. Linked accounts:`);
  for (const account of user.linked_accounts) {
    const label = account.type === 'email' ? (account as any).address
      : account.type === 'wallet' ? (account as any).address
      : account.type;
    console.log(`  - ${account.type}: ${label}`);
  }

  // Check if the wallet is actually linked
  const walletLower = walletAddress.toLowerCase();
  const walletLinked = user.linked_accounts.some(
    (a: any) => a.type === 'wallet' && a.address?.toLowerCase() === walletLower
  );

  if (!walletLinked) {
    console.log(`\nWallet ${walletAddress} is NOT linked to this user. Nothing to do.`);
    process.exit(0);
  }

  console.log(`\nUnlinking wallet ${walletAddress} from user ${privyUserId}...`);

  const updatedUser = await usersApi.unlinkLinkedAccount(privyUserId, {
    type: 'wallet',
    handle: walletAddress,
  });

  console.log('Wallet unlinked successfully.');
  console.log(`\nUpdated linked accounts:`);
  for (const account of updatedUser.linked_accounts) {
    const label = account.type === 'email' ? (account as any).address
      : account.type === 'wallet' ? (account as any).address
      : account.type;
    console.log(`  - ${account.type}: ${label}`);
  }
}

main()
  .then(() => {
    console.log('\nDone.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nError:', error);
    process.exit(1);
  });
