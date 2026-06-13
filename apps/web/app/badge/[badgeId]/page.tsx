"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useCurrentAccount, useSignAndExecuteTransaction, ConnectButton } from "@mysten/dapp-kit";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@talentbank/firebase-config";
import { updateBadgeOnChain } from "@talentbank/firebase-config";
import { buildClaimBadgeTx, isSuiConfigured } from "@/lib/mintBadge";
import { ExternalLink, Loader2, Award, CheckCircle2 } from "lucide-react";

interface BadgeData {
  eventTitle: string;
  emoji: string;
  color: string;
  onChain?: {
    voucherObjectId?: string;
    voucherTxHash?: string;
    txHash?: string;
    objectId?: string;
  };
}

export default function BadgeClaimPage() {
  const { badgeId } = useParams<{ badgeId: string }>();
  const account = useCurrentAccount();
  const { mutate: signAndExecute, isPending } = useSignAndExecuteTransaction();

  const [badge, setBadge] = useState<BadgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [claimTxHash, setClaimTxHash] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!badgeId) return;
    getDoc(doc(db, "badges", badgeId as string)).then((snap) => {
      if (!snap.exists()) {
        setNotFound(true);
      } else {
        const data = snap.data();
        setBadge({
          eventTitle: data.eventTitle ?? data.title ?? "Badge",
          emoji: data.emoji ?? "🏆",
          color: data.color ?? "#FBBF24",
          onChain: data.onChain,
        });
        if (data.onChain?.txHash) setClaimTxHash(data.onChain.txHash);
      }
      setLoading(false);
    });
  }, [badgeId]);

  const handleClaim = () => {
    setError(null);
    const voucherObjectId = badge?.onChain?.voucherObjectId;
    if (!voucherObjectId) { setError("Voucher not found."); return; }

    const tx = buildClaimBadgeTx(voucherObjectId);
    signAndExecute(
      { transaction: tx as any },
      {
        onSuccess: async (result: any) => {
          const digest: string = result.digest;
          const created = (result.objectChanges ?? []).find(
            (c: any) => c.type === "created" && c.objectType?.includes("AchievementBadge"),
          );
          await updateBadgeOnChain(badgeId as string, digest, created?.objectId ?? "");
          setClaimTxHash(digest);
        },
        onError: (err: any) => setError(err?.message ?? "Transaction failed"),
      },
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0F0E17] flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !badge) {
    return (
      <div className="min-h-screen bg-[#0F0E17] flex items-center justify-center p-6">
        <p className="text-white/40 text-sm">Badge not found.</p>
      </div>
    );
  }

  const voucherIssued = Boolean(badge.onChain?.voucherObjectId);
  const alreadyClaimed = Boolean(claimTxHash);

  return (
    <div className="min-h-screen bg-[#0F0E17] flex flex-col items-center justify-center p-6">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@700;900&family=DM+Sans:wght@400;600&display=swap');
        * { font-family: 'DM Sans', sans-serif; }
        h1 { font-family: 'Outfit', sans-serif; }
      `}</style>

      <div className="w-full max-w-sm space-y-6">
        {/* Badge preview */}
        <div className="bg-[#1A1825] border border-white/8 rounded-3xl p-8 flex flex-col items-center gap-4">
          <div
            className="w-24 h-24 rounded-2xl flex items-center justify-center text-5xl"
            style={{ backgroundColor: badge.color + "30", border: `2px solid ${badge.color}40` }}
          >
            {badge.emoji}
          </div>
          <div className="text-center">
            <h1 className="text-white font-black text-xl">{badge.eventTitle}</h1>
            <p className="text-white/40 text-xs mt-1">Achievement Badge · Talentbank</p>
          </div>

          {/* Chain status */}
          {alreadyClaimed ? (
            <div className="w-full bg-emerald-400/10 border border-emerald-400/20 rounded-2xl p-4 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                <CheckCircle2 size={16} />
                Already on-chain
              </div>
              <a
                href={`https://testnet.suivision.xyz/txblock/${claimTxHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition"
              >
                <ExternalLink size={11} /> View on Sui Vision
              </a>
            </div>
          ) : !voucherIssued ? (
            <div className="w-full bg-amber-400/5 border border-amber-400/15 rounded-2xl p-4 text-center">
              <p className="text-white/40 text-sm">Voucher not issued yet.</p>
              <p className="text-white/25 text-xs mt-1">Ask your admin to issue the on-chain voucher.</p>
            </div>
          ) : (
            <div className="w-full space-y-3">
              {!account ? (
                <div className="flex flex-col items-center gap-2">
                  <p className="text-white/40 text-xs">Connect your Slush Wallet to claim</p>
                  <ConnectButton />
                </div>
              ) : (
                <>
                  <p className="text-white/40 text-xs text-center">
                    Connected: {account.address.slice(0, 8)}…{account.address.slice(-4)}
                  </p>
                  {error && (
                    <p className="text-red-400 text-xs text-center">{error}</p>
                  )}
                  <button
                    type="button"
                    onClick={handleClaim}
                    disabled={isPending || !isSuiConfigured()}
                    className="w-full flex items-center justify-center gap-2 bg-amber-400/15 hover:bg-amber-400/25 disabled:opacity-40 disabled:cursor-not-allowed text-amber-400 font-bold py-3 rounded-2xl border border-amber-400/20 transition text-sm"
                  >
                    {isPending ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <Award size={15} />
                    )}
                    {isPending ? "Claiming…" : "Claim Badge"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <p className="text-center text-white/20 text-xs">
          Powered by Talentbank · Sui Testnet
        </p>
      </div>
    </div>
  );
}
