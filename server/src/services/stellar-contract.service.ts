/**
 * Stellar contract service for triggering on-chain milestone verification.
 *
 * In production this calls the CourseMilestone contract via the Stellar SDK.
 * When STELLAR_SECRET_KEY is not configured it falls back to a simulation
 * so the rest of the API remains functional in dev/test environments.
 */

const STELLAR_NETWORK = process.env.STELLAR_NETWORK ?? "testnet";
const STELLAR_SECRET_KEY = process.env.STELLAR_SECRET_KEY ?? "";
const COURSE_MILESTONE_CONTRACT_ID = process.env.COURSE_MILESTONE_CONTRACT_ID ?? "";

export interface ContractCallResult {
  txHash: string | null;
  simulated: boolean;
}

async function callVerifyMilestone(
  scholarAddress: string,
  courseId: string,
  milestoneId: number
): Promise<ContractCallResult> {
  if (!STELLAR_SECRET_KEY || !COURSE_MILESTONE_CONTRACT_ID) {
    console.warn(
      "[stellar] STELLAR_SECRET_KEY or COURSE_MILESTONE_CONTRACT_ID not set — simulating contract call"
    );
    return {
      txHash: `sim_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      simulated: true,
    };
  }

  try {
    // Dynamic import so the SDK is only loaded when actually needed
    const { Keypair, Contract, TransactionBuilder, Networks, BASE_FEE, rpc } =
      await import("@stellar/stellar-sdk");

    const server = new rpc.Server(
      STELLAR_NETWORK === "mainnet"
        ? "https://soroban-rpc.stellar.org"
        : "https://soroban-testnet.stellar.org"
    );

    const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY);
    const account = await server.getAccount(keypair.publicKey());
    const contract = new Contract(COURSE_MILESTONE_CONTRACT_ID);

    const { xdr } = await import("@stellar/stellar-sdk");

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase:
        STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
    })
      .addOperation(
        contract.call(
          "verify_milestone",
          xdr.ScVal.scvString(scholarAddress),
          xdr.ScVal.scvString(courseId),
          xdr.ScVal.scvU32(milestoneId)
        )
      )
      .setTimeout(30)
      .build();

    const prepared = await server.prepareTransaction(tx);
    prepared.sign(keypair);

    const result = await server.sendTransaction(prepared);
    return { txHash: result.hash, simulated: false };
  } catch (err) {
    console.error("[stellar] Contract call failed:", err);
    throw new Error("Contract call failed: " + (err instanceof Error ? err.message : String(err)));
  }
}

async function emitRejectionEvent(
  scholarAddress: string,
  courseId: string,
  milestoneId: number,
  reason: string
): Promise<ContractCallResult> {
  if (!STELLAR_SECRET_KEY || !COURSE_MILESTONE_CONTRACT_ID) {
    console.warn("[stellar] Simulating rejection event emission");
    return {
      txHash: `sim_reject_${Date.now()}`,
      simulated: true,
    };
  }

  try {
    const { Keypair, Contract, TransactionBuilder, Networks, BASE_FEE, rpc, xdr } =
      await import("@stellar/stellar-sdk");

    const server = new rpc.Server(
      STELLAR_NETWORK === "mainnet"
        ? "https://soroban-rpc.stellar.org"
        : "https://soroban-testnet.stellar.org"
    );

    const keypair = Keypair.fromSecret(STELLAR_SECRET_KEY);
    const account = await server.getAccount(keypair.publicKey());
    const contract = new Contract(COURSE_MILESTONE_CONTRACT_ID);

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase:
        STELLAR_NETWORK === "mainnet" ? Networks.PUBLIC : Networks.TESTNET,
    })
      .addOperation(
        contract.call(
          "reject_milestone",
          xdr.ScVal.scvString(scholarAddress),
          xdr.ScVal.scvString(courseId),
          xdr.ScVal.scvU32(milestoneId),
          xdr.ScVal.scvString(reason)
        )
      )
      .setTimeout(30)
      .build();

    const prepared = await server.prepareTransaction(tx);
    prepared.sign(keypair);

    const result = await server.sendTransaction(prepared);
    return { txHash: result.hash, simulated: false };
  } catch (err) {
    console.error("[stellar] Rejection event failed:", err);
    throw new Error("Rejection event failed: " + (err instanceof Error ? err.message : String(err)));
  }
}

export const stellarContractService = {
  callVerifyMilestone,
  emitRejectionEvent,
};
