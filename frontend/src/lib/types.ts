export type BountyStatus = "Open" | "Submitted" | "Disputed" | "Paid" | "Cancelled";

export interface Bounty {
  id: number;
  sponsor: string;
  title: string;
  description: string;
  reward: string; // stroops, as string to avoid bigint/JSON issues
  status: BountyStatus;
  contributor: string | null;
  submissionNote: string | null;
  createdAt: number;
}

export interface ContributorStats {
  completedBounties: number;
  totalEarned: string;
  reputationScore: number;
  disputesLost: number;
  tier: "New" | "Trusted" | "Veteran" | "Elite";
}

export type ActivityEventKind =
  | "BountyPosted"
  | "SubmissionMade"
  | "BountyDisputed"
  | "BountyPaid"
  | "BountyCancelled"
  | "ReputationUpdated";

export interface ActivityEvent {
  id: string;
  kind: ActivityEventKind;
  bountyId: number;
  actor: string;
  detail: string;
  timestamp: number;
  txHash?: string;
}

export class ContractCallError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = "ContractCallError";
  }
}
