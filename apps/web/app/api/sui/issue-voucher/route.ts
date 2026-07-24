import { NextRequest, NextResponse } from "next/server";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { buildIssueVoucherTx } from "@/lib/mintBadge";

export async function POST(req: NextRequest) {
  try {
    const adminKey = process.env.SUI_ADMIN_PRIVATE_KEY;
    if (!adminKey) return NextResponse.json({ error: "SUI_ADMIN_PRIVATE_KEY not configured" }, { status: 500 });

    const rpcUrl = process.env.SUI_RPC_URL ?? "https://fullnode.testnet.sui.io:443";
    const client = new SuiJsonRpcClient({ url: rpcUrl, network: "testnet" });

    const { recipientAddress, badgeType, title, description, imageUrl } = await req.json();
    if (!recipientAddress || !badgeType || !title || !description)
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });

    const { secretKey } = decodeSuiPrivateKey(adminKey);
    const keypair = Ed25519Keypair.fromSecretKey(secretKey);

    const tx = buildIssueVoucherTx({ recipientAddress, badgeType, title, description, imageUrl: imageUrl ?? "" });
    tx.setSender(keypair.toSuiAddress());

    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showObjectChanges: true },
    });

    return NextResponse.json({ digest: result.digest, objectChanges: result.objectChanges });
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    const isRpcDown = msg.includes("status code") || msg.includes("ECONNREFUSED") || msg.includes("fetch");
    console.error("[issue-voucher]", msg);
    return NextResponse.json(
      { error: isRpcDown ? `Sui RPC unreachable (${msg}) — check SUI_RPC_URL in .env.local` : msg },
      { status: 500 }
    );
  }
}
