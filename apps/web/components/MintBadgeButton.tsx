"use client";

import { useState, useEffect } from "react";
import { isSuiConfigured } from "@/lib/mintBadge";
import { updateBadgeVoucher } from "@talentbank/firebase-config";
import { getDoc, doc } from "firebase/firestore";
import { db } from "@talentbank/firebase-config";
import { ExternalLink, Loader2, Ticket, CheckCircle2 } from "lucide-react";

interface MintBadgeButtonProps {
  badgeId: string;
  participantUid: string;
  participantName: string;
  voucherObjectId?: string;
  voucherTxHash?: string;
  claimTxHash?: string;
  event: {
    id: string;
    title: string;
    badgeEmoji?: string;
    badgeColor?: string;
  };
}

export function MintBadgeButton({
  badgeId,
  participantUid,
  participantName,
  voucherObjectId,
  voucherTxHash,
  claimTxHash,
  event,
}: MintBadgeButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const [recipientAddress, setRecipientAddress] = useState("");
  const [manualEntry, setManualEntry] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issuedVoucherTx, setIssuedVoucherTx] = useState(voucherTxHash ?? "");
  const [issued, setIssued] = useState(Boolean(voucherObjectId));

  // Fetch student's saved Sui wallet address
  useEffect(() => {
    getDoc(doc(db, "users", participantUid)).then((snap) => {
      const addr = snap.data()?.suiAddress as string | undefined;
      if (addr) {
        setRecipientAddress(addr);
      } else {
        setManualEntry(true);
      }
    });
  }, [participantUid]);

  if (!isSuiConfigured()) {
    return <span className="text-xs text-white/20 italic">Sui not configured</span>;
  }

  // Already claimed by student
  if (claimTxHash) {
    return (
      <a
        href={`https://testnet.suivision.xyz/txblock/${claimTxHash}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold hover:text-emerald-300 transition"
      >
        <CheckCircle2 size={12} />
        Claimed
        <ExternalLink size={10} />
      </a>
    );
  }

  // Voucher issued, waiting for student to claim
  if (issued && issuedVoucherTx) {
    return (
      <div className="flex flex-col items-end gap-1">
        <span className="text-xs text-sky-400 font-semibold">Voucher issued</span>
        <a
          href={`https://testnet.suivision.xyz/txblock/${issuedVoucherTx}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-white/30 hover:text-white/60 transition"
        >
          <ExternalLink size={10} /> View tx
        </a>
      </div>
    );
  }

  const handleIssue = async () => {
    setError(null);
    const addr = recipientAddress.trim();
    if (!addr.startsWith("0x") || addr.length < 10) {
      setError("Invalid Sui address");
      return;
    }

    setIsPending(true);
    try {
      const res = await fetch("/api/sui/issue-voucher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientAddress: addr,
          badgeType: "EVENT_ATTENDANCE",
          title: event.title,
          description: `Attended ${event.title} via Talentbank`,
          imageUrl: "",
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }

      const result = await res.json();
      const digest: string = result.digest;
      const createdVoucher = (result.objectChanges ?? []).find(
        (c: any) => c.type === "created" && c.objectType?.includes("MintVoucher"),
      );
      const voucherId: string = createdVoucher?.objectId ?? "";
      await updateBadgeVoucher(badgeId, voucherId, digest);
      setIssuedVoucherTx(digest);
      setIssued(true);
    } catch (err: any) {
      setError(err?.message ?? "Transaction failed");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1.5">
      {manualEntry && (
        <input
          type="text"
          placeholder={`${participantName}'s Sui address (0x…)`}
          value={recipientAddress}
          onChange={(e) => setRecipientAddress(e.target.value)}
          className="text-xs bg-[#0F0E17] border border-white/15 rounded-lg px-2.5 py-1.5 text-white placeholder-white/20 focus:outline-none focus:border-amber-400/50 w-56 font-mono"
        />
      )}
      {!manualEntry && recipientAddress && (
        <span className="text-xs text-white/30 font-mono">
          {recipientAddress.slice(0, 8)}…{recipientAddress.slice(-4)}
          <button
            type="button"
            onClick={() => setManualEntry(true)}
            className="ml-1.5 text-white/20 hover:text-white/50 transition"
          >
            edit
          </button>
        </span>
      )}
      {error && <span className="text-xs text-red-400">{error}</span>}
      <button
        type="button"
        onClick={handleIssue}
        disabled={isPending || !recipientAddress.trim()}
        className="flex items-center gap-1.5 bg-amber-400/10 hover:bg-amber-400/20 disabled:opacity-40 disabled:cursor-not-allowed text-amber-400 text-xs font-bold px-3 py-1.5 rounded-xl border border-amber-400/20 transition"
      >
        {isPending ? <Loader2 size={12} className="animate-spin" /> : <Ticket size={12} />}
        {isPending ? "Issuing…" : "Issue Voucher"}
      </button>
    </div>
  );
}
