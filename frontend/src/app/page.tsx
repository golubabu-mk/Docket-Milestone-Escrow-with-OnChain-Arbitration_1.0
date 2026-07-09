"use client";

import { useCallback, useMemo, useState } from "react";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { ActivityTicker } from "@/components/ActivityTicker";
import { BountyBoardGrid } from "@/components/BountyBoardGrid";
import { PostBountyModal } from "@/components/PostBountyModal";
import { ClaimBountyModal } from "@/components/ClaimBountyModal";
import { ReputationPanel } from "@/components/ReputationPanel";
import { ToastStack, Toast } from "@/components/Toast";
import { useWallet } from "@/hooks/useWallet";
import { useBounties } from "@/hooks/useBounties";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { Bounty } from "@/lib/types";
import { stroopsToXlm, xlmToStroops, formatAddress } from "@/lib/format";
import { postBounty, submitWork, approveAndPay, disputeSubmission } from "@/lib/soroban";

export default function HomePage() {
  const wallet = useWallet();
  const { bounties, isLoading, error, refresh } = useBounties();
  const { events, pushEvent } = useActivityFeed();

  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [claimTarget, setClaimTarget] = useState<Bounty | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, "id">) => {
    setToasts((prev) => [...prev, { ...toast, id: `${Date.now()}-${Math.random()}` }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const stats = useMemo(() => {
    const open = bounties.filter((b) => b.status === "Open");
    const paid = bounties.filter((b) => b.status === "Paid");
    const escrowed = bounties
      .filter((b) => b.status === "Open" || b.status === "Submitted" || b.status === "Disputed")
      .reduce((sum, b) => sum + BigInt(b.reward), 0n);
    return {
      openCount: open.length,
      paidCount: paid.length,
      totalEscrowed: stroopsToXlm(escrowed.toString()),
    };
  }, [bounties]);

  const handlePostBounty = async (title: string, description: string, rewardXlm: string) => {
    if (!wallet.address) {
      addToast({ type: "error", message: "Connect your wallet first to post a bounty." });
      return;
    }
    try {
      const rewardStroops = xlmToStroops(rewardXlm);
      const txHash = await postBounty(wallet.address, title, description, rewardStroops);
      addToast({
        type: "success",
        message: `Bounty posted — ${rewardXlm} XLM escrowed.`,
        txHash,
      });
      pushEvent({
        kind: "BountyPosted",
        bountyId: -1,
        actor: wallet.address,
        detail: `Posted "${title}" for ${rewardXlm} XLM`,
        timestamp: Math.floor(Date.now() / 1000),
        txHash,
      });
      refresh();
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "Couldn't post this bounty.",
      });
      throw err;
    }
  };

  const handleClaimSubmit = async (bounty: Bounty, note: string) => {
    if (!wallet.address) return;
    setBusyAction(`${bounty.id}-claim`);
    try {
      const txHash = await submitWork(bounty.id, wallet.address, note);
      addToast({ type: "success", message: `Claimed "${bounty.title}".`, txHash });
      pushEvent({
        kind: "SubmissionMade",
        bountyId: bounty.id,
        actor: wallet.address,
        detail: `Claimed "${bounty.title}"`,
        timestamp: Math.floor(Date.now() / 1000),
        txHash,
      });
      refresh();
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "Couldn't submit your claim.",
      });
      throw err;
    } finally {
      setBusyAction(null);
    }
  };

  const handleApprove = async (bounty: Bounty) => {
    if (!wallet.address) return;
    setBusyAction(`${bounty.id}-approve`);
    try {
      const txHash = await approveAndPay(bounty.id, wallet.address);
      addToast({
        type: "success",
        message: `Paid ${stroopsToXlm(bounty.reward)} XLM to ${formatAddress(bounty.contributor ?? "")}.`,
        txHash,
      });
      pushEvent({
        kind: "BountyPaid",
        bountyId: bounty.id,
        actor: wallet.address,
        detail: `Approved & paid "${bounty.title}"`,
        timestamp: Math.floor(Date.now() / 1000),
        txHash,
      });
      refresh();
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "Couldn't approve this bounty.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDispute = async (bounty: Bounty) => {
    if (!wallet.address) return;
    setBusyAction(`${bounty.id}-dispute`);
    try {
      const txHash = await disputeSubmission(bounty.id, wallet.address);
      addToast({ type: "success", message: `Marked "${bounty.title}" as disputed.`, txHash });
      pushEvent({
        kind: "BountyDisputed",
        bountyId: bounty.id,
        actor: wallet.address,
        detail: `Disputed "${bounty.title}"`,
        timestamp: Math.floor(Date.now() / 1000),
        txHash,
      });
      refresh();
    } catch (err) {
      addToast({
        type: "error",
        message: err instanceof Error ? err.message : "Couldn't dispute this bounty.",
      });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <main className="min-h-screen">
      <Header
        address={wallet.address}
        isConnecting={wallet.isConnecting}
        onConnect={wallet.connect}
        onDisconnect={wallet.disconnect}
      />

      <Hero
        openCount={stats.openCount}
        totalEscrowed={stats.totalEscrowed}
        paidCount={stats.paidCount}
      />

      <section className="mx-auto max-w-6xl px-5 sm:px-8 py-8 sm:py-10">
        <div className="grid lg:grid-cols-[1fr,320px] gap-8">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl">The board</h2>
              <button
                onClick={() => setIsPostModalOpen(true)}
                disabled={!wallet.address}
                title={!wallet.address ? "Connect your wallet to post a bounty" : undefined}
                className="rounded-card bg-brass text-white px-4 py-2 text-sm font-medium hover:bg-brass/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Post a bounty
              </button>
            </div>

            <BountyBoardGrid
              bounties={bounties}
              isLoading={isLoading}
              error={error}
              currentAddress={wallet.address}
              onClaim={setClaimTarget}
              onApprove={handleApprove}
              onDispute={handleDispute}
              busyAction={busyAction}
              onRetry={refresh}
            />
          </div>

          <div className="flex flex-col gap-5">
            {wallet.address && <ReputationPanel address={wallet.address} />}
            <ActivityTicker events={events} />
          </div>
        </div>
      </section>

      <PostBountyModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onSubmit={handlePostBounty}
      />
      <ClaimBountyModal
        bounty={claimTarget}
        onClose={() => setClaimTarget(null)}
        onSubmit={handleClaimSubmit}
      />
      <ToastStack toasts={toasts} onDismiss={dismissToast} />

      {wallet.error && (
        <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:w-80 z-50">
          <div className="rounded-card border border-rust/30 bg-white px-4 py-3 shadow-lg flex items-start gap-2">
            <span className="text-rust text-lg leading-none mt-0.5">!</span>
            <div className="flex-1">
              <p className="text-sm text-ink">{wallet.error}</p>
            </div>
            <button
              onClick={wallet.dismissError}
              className="text-ink-soft/40 hover:text-ink text-sm"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
