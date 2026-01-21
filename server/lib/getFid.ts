import { neynar } from './neynarClient';
import { mnemonicToAccount } from "viem/accounts";

export const getFid = async () => {
  const mnemonic = process.env.FARCASTER_DEVELOPER_MNEMONIC;
  if (!mnemonic) {
    throw new Error("FARCASTER_DEVELOPER_MNEMONIC must be set in environment variables");
  }

  const account = mnemonicToAccount(mnemonic);

  // Lookup user details using the custody address.
  const { user: farcasterDeveloper } =
    await neynar.lookupUserByCustodyAddress({
      custodyAddress: account.address,
    });

  return Number(farcasterDeveloper.fid);
};