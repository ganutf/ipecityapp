import { useWallets } from "@privy-io/react-auth";

/**
 * Returns the active wallet, preferring external wallets over Privy's embedded wallet.
 * When a user connects an external wallet (MetaMask, WalletConnect, etc.),
 * it takes priority over the auto-created embedded wallet.
 *
 * Also exposes the embedded wallet and a disconnect function for the external wallet.
 */
export function useActiveWallet() {
  const { wallets } = useWallets();

  const embeddedWallet = wallets.find(w => w.walletClientType === 'privy') ?? null;
  const externalWallet = wallets.find(w => w.walletClientType !== 'privy') ?? null;
  const activeWallet = externalWallet ?? embeddedWallet;

  const disconnectExternalWallet = externalWallet
    ? () => externalWallet.disconnect()
    : null;

  return {
    activeWallet,
    embeddedWallet,
    externalWallet,
    disconnectExternalWallet,
    isExternalWallet: !!externalWallet && activeWallet === externalWallet,
  };
}
