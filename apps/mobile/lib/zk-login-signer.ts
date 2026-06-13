import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { getZkLoginSignature } from '@mysten/zklogin';
import { Transaction } from '@mysten/sui/transactions';
import { getSuiClient } from './sui-client';
import { getSession, clearSession } from './zk-login-store';

export async function signAndExecuteWithZkLogin(
  tx: Transaction,
): Promise<{ digest: string; objectChanges: any[] }> {
  const session = await getSession();
  if (!session) throw new Error('No ZK Login session — please sign in again');

  const suiClient = getSuiClient();
  const { epoch } = await suiClient.getLatestSuiSystemState();
  if (Number(epoch) >= session.maxEpoch) {
    await clearSession();
    throw new Error('ZK Login session expired — please sign in again');
  }

  const privateKeyBytes = Buffer.from(session.ephemeralPrivateKey, 'base64');
  const ephemeralKeypair = Ed25519Keypair.fromSecretKey(
    // fromSecretKey expects the 32-byte seed (private key without public key suffix)
    privateKeyBytes.length === 64 ? privateKeyBytes.subarray(0, 32) : privateKeyBytes,
  );

  tx.setSender(session.suiAddress);
  const bytes = await tx.build({ client: suiClient.core });
  const { signature: ephemeralSig } = await ephemeralKeypair.signTransaction(bytes);

  const zkSignature = getZkLoginSignature({
    inputs: JSON.parse(session.zkProof),
    maxEpoch: session.maxEpoch,
    userSignature: ephemeralSig,
  });

  const result = await suiClient.executeTransactionBlock({
    transactionBlock: bytes,
    signature: zkSignature,
    options: { showEffects: true, showObjectChanges: true },
  });

  return { digest: result.digest, objectChanges: result.objectChanges ?? [] };
}
