"use client";

import { useState, FormEvent } from "react";

interface PostBountyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string, description: string, rewardXlm: string) => Promise<void>;
}

export function PostBountyModal({ isOpen, onClose, onSubmit }: PostBountyModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [reward, setReward] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const validate = (): string | null => {
    if (title.trim().length < 4) return "Give it a title with at least 4 characters.";
    if (description.trim().length < 10)
      return "Add a bit more detail so contributors know what's expected.";
    const rewardNum = Number(reward);
    if (!reward || Number.isNaN(rewardNum) || rewardNum <= 0)
      return "Reward must be a positive number of XLM.";
    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await onSubmit(title.trim(), description.trim(), reward.trim());
      setTitle("");
      setDescription("");
      setReward("");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post this bounty. Try again.");
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
            <h2 className="font-display text-2xl">Post a bounty</h2>
            <p className="text-sm text-ink-soft/70 mt-1">
              Your reward is escrowed the moment you post it.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-ink-soft/40 hover:text-ink text-xl leading-none px-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Build a mobile nav component"
              maxLength={80}
              className="input"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does done look like? Link specs if you have them."
              rows={4}
              maxLength={600}
              className="input resize-none"
            />
          </Field>

          <Field label="Reward (XLM)">
            <input
              value={reward}
              onChange={(e) => setReward(e.target.value)}
              placeholder="500"
              inputMode="decimal"
              className="input font-mono"
            />
          </Field>

          {error && (
            <p className="text-sm text-rust bg-rust/5 border border-rust/20 rounded-card px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-card bg-ink text-paper py-2.5 text-sm font-medium hover:bg-ledger transition-colors disabled:opacity-50 disabled:cursor-wait mt-1"
          >
            {isSubmitting ? "Escrowing funds…" : "Post & escrow reward"}
          </button>
        </form>
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          border-radius: 3px;
          border: 1px solid #d8d0be;
          background: white;
          padding: 0.6rem 0.75rem;
          font-size: 0.875rem;
        }
        .input:focus {
          outline: 2px solid #b4483a;
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-mono uppercase tracking-wide text-ink-soft/60 mb-1.5 block">
        {label}
      </span>
      {children}
    </label>
  );
}
