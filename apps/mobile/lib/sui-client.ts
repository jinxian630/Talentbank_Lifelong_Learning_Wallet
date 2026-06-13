import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

let _client: SuiJsonRpcClient | null = null;

export function getSuiClient(): SuiJsonRpcClient {
  if (!_client) {
    _client = new SuiJsonRpcClient({
      url: 'https://fullnode.testnet.sui.io:443',
      network: 'testnet',
    });
  }
  return _client;
}
