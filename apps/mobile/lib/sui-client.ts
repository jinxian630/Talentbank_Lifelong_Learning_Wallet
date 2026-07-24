import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

let _client: SuiJsonRpcClient | null = null;

export function getSuiClient(): SuiJsonRpcClient {
  if (!_client) {
    _client = new SuiJsonRpcClient({
      url: process.env.EXPO_PUBLIC_SUI_RPC_URL ?? 'https://rpc-testnet.suiscan.xyz',
      network: 'testnet',
    });
  }
  return _client;
}
