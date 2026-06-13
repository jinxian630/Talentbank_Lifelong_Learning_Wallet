import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { generateNonce, generateRandomness, jwtToAddress } from '@mysten/zklogin';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getSuiClient } from './sui-client';
import { saveSession } from './zk-login-store';
import { app } from './firebase';

const ZK_PROVER_URL = 'https://prover-dev.mystenlabs.com/v1';

export interface ZkPrep {
  nonce: string;
  ephemeralKeypair: Ed25519Keypair;
  maxEpoch: number;
  randomness: string;
}

export async function prepareZkLogin(): Promise<ZkPrep> {
  const { epoch } = await getSuiClient().getLatestSuiSystemState();
  const maxEpoch = Number(epoch) + 10;

  const ephemeralKeypair = new Ed25519Keypair();
  const randomness = generateRandomness();
  const nonce = generateNonce(ephemeralKeypair.getPublicKey(), maxEpoch, randomness);

  return { nonce, ephemeralKeypair, maxEpoch, randomness };
}

export async function completeZkLogin(
  idToken: string,
  ephemeralKeypair: Ed25519Keypair,
  maxEpoch: number,
  randomness: string,
): Promise<{ suiAddress: string }> {
  // Phase 1 (critical): derive Sui address from salt + JWT
  // This always works as long as the Cloud Function is reachable.
  const functions = getFunctions(app);
  const getSuiSalt = httpsCallable<object, { salt: string }>(functions, 'getSuiSalt');
  const { data } = await getSuiSalt({});
  const salt = data.salt;
  const suiAddress = jwtToAddress(idToken, salt);

  // Phase 2 (best-effort): get ZK proof for transaction signing.
  // If the prover is down or rate-limited, we still return suiAddress so the
  // caller can write it to Firestore. Tx signing won't work until next login.
  try {
    const proofResponse = await fetch(ZK_PROVER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jwt: idToken,
        extendedEphemeralPublicKey: ephemeralKeypair.getPublicKey().toSuiPublicKey(),
        maxEpoch,
        jwtRandomness: randomness.toString(),
        salt,
        keyClaimName: 'sub',
      }),
    });

    if (!proofResponse.ok) {
      throw new Error(`Prover returned ${proofResponse.status}: ${await proofResponse.text()}`);
    }
    const zkProof = await proofResponse.json();

    const secretKey = ephemeralKeypair.getSecretKey();
    const privateKeyBytes =
      typeof secretKey === 'string'
        ? Buffer.from(secretKey, 'base64')
        : Buffer.from(secretKey as Uint8Array);

    await saveSession({
      ephemeralPrivateKey: privateKeyBytes.toString('base64'),
      ephemeralPublicKey: ephemeralKeypair.getPublicKey().toBase64(),
      suiAddress,
      maxEpoch,
      randomness: randomness.toString(),
      zkProof: JSON.stringify(zkProof),
    });
  } catch (proofErr) {
    console.warn('ZK proof generation failed — wallet address saved but tx signing unavailable:', proofErr);
  }

  return { suiAddress };
}

// No-op on native — the real implementation lives in zk-login.web.ts (web path only)
export async function deriveAddressOnly(_idToken: string): Promise<string> {
  return '';
}
