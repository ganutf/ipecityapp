import { neynar } from './neynarClient';
import { mnemonicToAccount } from "viem/accounts";
import { getSecureEnvironmentVariable } from "./keyManagement";

export const getFid = async () => {
  const mnemonic = await getSecureEnvironmentVariable('farcaster_developer_mnemonic', 'FARCASTER_DEVELOPER_MNEMONIC');
  if (!mnemonic) {
    throw new Error("FARCASTER_DEVELOPER_MNEMONIC is not available in secure storage or environment variables.");
  }

  const account = mnemonicToAccount(mnemonic);

  // Lookup user details using the custody address.
  const { user: farcasterDeveloper } =
    await neynar.lookupUserByCustodyAddress({
      custodyAddress: account.address,
    });

  return Number(farcasterDeveloper.fid);
};