import { Transaction } from "@mysten/sui/transactions";

const PACKAGE_ID  = process.env.NEXT_PUBLIC_SUI_PACKAGE_ID  ?? "";
const REGISTRY_ID = process.env.NEXT_PUBLIC_SUI_REGISTRY_ID ?? "";
const ADMIN_CAP   = process.env.NEXT_PUBLIC_SUI_ADMIN_CAP_ID ?? "";

export interface MintBadgeParams {
  recipientAddress: string;
  badgeType: string;
  title: string;
  description: string;
  imageUrl: string;
}

export function buildMintBadgeTx(p: MintBadgeParams): Transaction {
  const tx = new Transaction();

  tx.moveCall({
    target: `${PACKAGE_ID}::badge::mint_badge`,
    arguments: [
      tx.object(ADMIN_CAP),
      tx.object(REGISTRY_ID),
      tx.pure.address(p.recipientAddress),
      tx.pure.vector("u8", Array.from(Buffer.from(p.badgeType))),
      tx.pure.vector("u8", Array.from(Buffer.from(p.title))),
      tx.pure.vector("u8", Array.from(Buffer.from(p.description))),
      tx.pure.vector("u8", Array.from(Buffer.from(p.imageUrl))),
      tx.object("0x6"), // Sui Clock system object
    ],
  });

  return tx;
}

export function buildIssueVoucherTx(p: {
  recipientAddress: string;
  badgeType: string;
  title: string;
  description: string;
  imageUrl: string;
}): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::badge::issue_voucher`,
    arguments: [
      tx.object(ADMIN_CAP),
      tx.object(REGISTRY_ID),
      tx.pure.address(p.recipientAddress),
      tx.pure.vector("u8", Array.from(Buffer.from(p.badgeType))),
      tx.pure.vector("u8", Array.from(Buffer.from(p.title))),
      tx.pure.vector("u8", Array.from(Buffer.from(p.description))),
      tx.pure.vector("u8", Array.from(Buffer.from(p.imageUrl))),
    ],
  });
  return tx;
}

export function buildClaimBadgeTx(voucherObjectId: string): Transaction {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::badge::claim_badge`,
    arguments: [
      tx.object(voucherObjectId),
      tx.object(REGISTRY_ID),
      tx.object("0x6"), // Sui Clock system object
    ],
  });
  return tx;
}

export function isSuiConfigured(): boolean {
  return Boolean(PACKAGE_ID && REGISTRY_ID && ADMIN_CAP);
}
