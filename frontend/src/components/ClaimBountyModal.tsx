"use client";

import { useState, FormEvent } from "react";
import { Bounty } from "@/lib/types";
import { stroopsToXlm } from "@/lib/format";

interface ClaimBountyModalProps {
  bounty: Bounty | null;
  onClose: () => void;
  onSubmit: (bounty: Bounty, note: string) => Promise<void>;
}

export function ClaimBountyModal({ bounty, onClose, onSubmit }: ClaimBountyModalProps) {
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!bounty) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (note.trim().length < 5) {
      setError("Add a short note describing your submission or where to find it.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(bounty, note.trim());
      setNote("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit your claim. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 backdrop-blur-sm px-0 sm:px-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-paper rounded-t-2xl sm:rounded-card border border-line shadow-xl p-6 sm:p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="font-display text-2xl">Claim &amp; submit</h2>
            <p className="text-sm text-ink-soft/70 mt-1">{bounty.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-soft/40 hover:text-ink text-xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="rounded-card bg-brass/10 border border-brass/20 px-3 py-2 mb-4">
          <p className="text-sm text-brass font-mono">
            {stroopsToXlm(bounty.reward)} XLM held in escrow, released the moment the sponsor
            approves.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="block">
            <span className="text-xs font-mono uppercase tracking-wide text-ink-soft/60 mb-1.5 block">
              Submission note
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Link your PR, deployed preview, or design file, plus anything the sponsor should know."
              rows={4}
              maxLength={500}
              className="w-full rounded-card border border-line bg-white px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-rust/40"
            />
          </label>

          {error && (
            <p className="text-sm text-rust bg-rust/5 border border-rust/20 rounded-card px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-card bg-ink text-paper py-2.5 text-sm font-medium hover:bg-ledger transition-colors disabled:opacity-50 disabled:cursor-wait"
          >
            {isSubmitting ? "Recording your claim…" : "Submit claim"}
          </button>
        </form>
      </div>
    </div>
  );
}
