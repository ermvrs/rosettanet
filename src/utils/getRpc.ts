export const mainnetRpc = ['https://starknet-mainnet.public.blastapi.io']
export const testnetRpc = ['https://starknet-sepolia.public.blastapi.io']

export const getRpc = (network?: string): string => {
  //TODO: NETWORK STRING TO TYPE

  if (network === 'testnet') {
    const rpc = testnetRpc[Math.floor(Math.random() * testnetRpc.length)]
    return rpc
  }

  const rpc = mainnetRpc[Math.floor(Math.random() * mainnetRpc.length)]
  return rpc
}
