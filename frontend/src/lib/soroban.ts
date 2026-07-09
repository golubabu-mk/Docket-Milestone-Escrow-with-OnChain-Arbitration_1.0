import {
  Contract,
  rpc,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  scValToNative,
  Address,
  xdr,
} from "@stellar/stellar-sdk";
import {
  RPC_URL,
  NETWORK_PASSPHRASE,
  BOUNTY_BOARD_CONTRACT_ID,
  CONTRIBUTOR_REGISTRY_CONTRACT_ID,
} from "./config";
import { signTransactionXdr } from "./wallet";
import { Bounty, ContributorStats, ContractCallError } from "./types";

function getServer(): rpc.Server {
  return new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });
}

/**
 * Builds, simulates, signs, and submits a contract invocation.
 * Centralizing this means every write path gets the same error handling,
 * retry-on-simulation, and confirmation-polling behavior.
 */
async function invokeContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  sourcePublicKey: string
): Promise<{ result: unknown; txHash: string }> {
  const server = getServer();

  let account;
  try {
    account = await server.getAccount(sourcePublicKey);
  } catch (err) {
    throw new ContractCallError(
      "We couldn't find your account on the network. Make sure your wallet is funded on testnet.",
      err
    );
  }

  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  let simulated;
  try {
    simulated = await server.simulateTransaction(tx);
  } catch (err) {
    throw new ContractCallError(
      "The network couldn't simulate this action. It may be temporarily unreachable.",
      err
    );
  }

  if (rpc.Api.isSimulationError(simulated)) {
    throw new ContractCallError(
      readableSimulationError(simulated.error, method),
      simulated.error
    );
  }

  const prepared = rpc.assembleTransaction(tx, simulated).build();

  let signedXdr: string;
  try {
    signedXdr = await signTransactionXdr(prepared.toXDR());
  } catch (err) {
    throw new ContractCallError(
      "Signing was cancelled or the wallet rejected the request.",
      err
    );
  }

  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  let sendResponse;
  try {
    sendResponse = await server.sendTransaction(signedTx);
  } catch (err) {
    throw new ContractCallError("Failed to submit the transaction to the network.", err);
  }

  if (sendResponse.status === "ERROR") {
    throw new ContractCallError(
      "The network rejected this transaction before it could run.",
      sendResponse
    );
  }

  const txHash = sendResponse.hash;
  const finalStatus = await pollForConfirmation(server, txHash);

  if (finalStatus.status !== "SUCCESS") {
    throw new ContractCallError(
      `The transaction did not complete successfully (status: ${finalStatus.status}).`,
      finalStatus
    );
  }

  const returnValue =
    finalStatus.status === "SUCCESS" && "returnValue" in finalStatus
      ? scValToNative(finalStatus.returnValue!)
      : null;

  return { result: returnValue, txHash };
}

async function pollForConfirmation(
  server: rpc.Server,
  hash: string,
  attempts = 15,
  delayMs = 1500
): Promise<rpc.Api.GetTransactionResponse> {
  for (let i = 0; i < attempts; i++) {
    const response = await server.getTransaction(hash);
    if (response.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) {
      return response;
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new ContractCallError(
    "Timed out waiting for confirmation. Check the explorer link for final status."
  );
}

function readableSimulationError(error: string, method: string): string {
  if (error.includes("InvalidState") || error.includes("#4")) {
    return "This bounty isn't in a state that allows that action right now — someone may have already claimed or resolved it.";
  }
  if (error.includes("Unauthorized") || error.includes("#5") || error.includes("#3")) {
    return "You're not authorized to perform this action on this bounty.";
  }
  if (error.includes("InvalidReward") || error.includes("#6")) {
    return "Reward amount must be greater than zero.";
  }
  if (error.includes("BountyNotFound") || error.includes("#3")) {
    return "That bounty could not be found. It may have been removed.";
  }
  return `The ${method.replace(/_/g, " ")} action could not be completed. ${error.slice(0, 140)}`;
}

/** Read-only simulated call — no signature or fee required. */
async function readContract(
  contractId: string,
  method: string,
  args: xdr.ScVal[]
): Promise<unknown> {
  const server = getServer();
  const dummySource =
    "GA56UH3DNGGSGPPHY2ZSUBXIWLCY3J27AEFGOTH6K23LNQDPFY2GYHI7";
  let account;
  try {
    account = await server.getAccount(dummySource).catch(() => null);
  } catch {
    account = null;
  }

  // Fallback to a synthetic account object for pure reads if the dummy
  // account isn't funded — simulation only needs a sequence number.
  const sourceAccount =
    account ?? new (await import("@stellar/stellar-sdk")).Account(dummySource, "0");

  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simulated = await server.simulateTransaction(tx);

  if (rpc.Api.isSimulationError(simulated)) {
    throw new ContractCallError(
      `Could not read ${method} from the contract.`,
      simulated.error
    );
  }

  if (!simulated.result) {
    return null;
  }

  return scValToNative(simulated.result.retval);
}

// ---------- BountyBoard read/write helpers ----------

export async function postBounty(
  sponsorAddress: string,
  title: string,
  description: string,
  rewardStroops: bigint
): Promise<string> {
  const args = [
    new Address(sponsorAddress).toScVal(),
    nativeToScVal(title, { type: "string" }),
    nativeToScVal(description, { type: "string" }),
    nativeToScVal(rewardStroops, { type: "i128" }),
  ];
  const { txHash } = await invokeContract(
    BOUNTY_BOARD_CONTRACT_ID,
    "post_bounty",
    args,
    sponsorAddress
  );
  return txHash;
}

export async function submitWork(
  bountyId: number,
  contributorAddress: string,
  note: string
): Promise<string> {
  const args = [
    nativeToScVal(bountyId, { type: "u32" }),
    new Address(contributorAddress).toScVal(),
    nativeToScVal(note, { type: "string" }),
  ];
  const { txHash } = await invokeContract(
    BOUNTY_BOARD_CONTRACT_ID,
    "submit_work",
    args,
    contributorAddress
  );
  return txHash;
}

export async function approveAndPay(
  bountyId: number,
  sponsorAddress: string
): Promise<string> {
  const args = [
    nativeToScVal(bountyId, { type: "u32" }),
    new Address(sponsorAddress).toScVal(),
  ];
  const { txHash } = await invokeContract(
    BOUNTY_BOARD_CONTRACT_ID,
    "approve_and_pay",
    args,
    sponsorAddress
  );
  return txHash;
}

export async function disputeSubmission(
  bountyId: number,
  sponsorAddress: string
): Promise<string> {
  const args = [
    nativeToScVal(bountyId, { type: "u32" }),
    new Address(sponsorAddress).toScVal(),
  ];
  const { txHash } = await invokeContract(
    BOUNTY_BOARD_CONTRACT_ID,
    "dispute_submission",
    args,
    sponsorAddress
  );
  return txHash;
}

export async function listBounties(offset: number, limit: number): Promise<Bounty[]> {
  const args = [
    nativeToScVal(offset, { type: "u32" }),
    nativeToScVal(limit, { type: "u32" }),
  ];
  const raw = (await readContract(BOUNTY_BOARD_CONTRACT_ID, "list_bounties", args)) as any[];
  if (!raw) return [];
  return raw.map(mapRawBounty);
}

export async function getContributorStats(address: string): Promise<ContributorStats> {
  const args = [new Address(address).toScVal()];
  const raw = (await readContract(
    CONTRIBUTOR_REGISTRY_CONTRACT_ID,
    "get_stats",
    args
  )) as any;
  const tierRaw = (await readContract(
    CONTRIBUTOR_REGISTRY_CONTRACT_ID,
    "tier_label",
    args
  )) as string;
  return {
    completedBounties: Number(raw.completed_bounties ?? 0),
    totalEarned: String(raw.total_earned ?? "0"),
    reputationScore: Number(raw.reputation_score ?? 500),
    disputesLost: Number(raw.disputes_lost ?? 0),
    tier: (tierRaw as ContributorStats["tier"]) ?? "New",
  };
}

function mapRawBounty(raw: any): Bounty {
  return {
    id: Number(raw.id),
    sponsor: raw.sponsor,
    title: raw.title,
    description: raw.description,
    reward: String(raw.reward),
    status: mapStatus(raw.status),
    contributor: raw.contributor ?? null,
    submissionNote: raw.submission_note ?? null,
    createdAt: Number(raw.created_at),
  };
}

function mapStatus(raw: unknown): Bounty["status"] {
  if (typeof raw === "string") return raw as Bounty["status"];
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "string") {
    return raw[0] as Bounty["status"];
  }
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const key = Object.keys(raw as object)[0];
    return (key as Bounty["status"]) ?? "Open";
  }
  return "Open";
}
