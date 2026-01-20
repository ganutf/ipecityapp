import { useReadContract } from 'wagmi';
import { base } from 'wagmi/chains';
import { formatUnits } from 'viem';

const IPE_TOKEN_ADDRESS = '0x5d48b042d4c479a5A9c25410fe0D66b742DC47dE' as const;

// ERC20 ABI for balanceOf and decimals
const ERC20_ABI = [
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const;

export function useTokenBalance(address: `0x${string}` | undefined) {
  // Get token decimals
  const { data: decimals } = useReadContract({
    address: IPE_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'decimals',
    chainId: base.id,
    query: {
      staleTime: 1000 * 60 * 60, // 1 hour - decimals don't change
    },
  });

  // Get token balance
  const {
    data: balance,
    isLoading,
    isError,
    error,
    refetch,
  } = useReadContract({
    address: IPE_TOKEN_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: base.id,
    query: {
      enabled: Boolean(address),
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchInterval: 1000 * 60, // Refetch every minute
    },
  });

  // Format balance for display
  const formattedBalance = balance && decimals !== undefined
    ? formatUnits(balance, decimals)
    : '0';

  // Format with thousands separators
  const displayBalance = formattedBalance
    ? parseFloat(formattedBalance).toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    : '0';

  return {
    balance: formattedBalance,
    displayBalance,
    isLoading,
    isError,
    error,
    refetch,
    decimals,
  };
}
