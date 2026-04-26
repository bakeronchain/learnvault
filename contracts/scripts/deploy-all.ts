import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const NETWORK = process.env.NETWORK || "testnet";

const CONTRACTS = [
  "vault",
  "governance",
  "token",
  "registry",
  "treasury",
  "staking",
  "rewards",
  "oracle",
  "bridge",
] as const;

type Deployed = Record<string, string>;

function deployWasm(contractName: string): string {
  console.log(`📦 Deploying ${contractName}...`);

  const wasmPath = path.join(
    process.cwd(),
    `target/wasm32-unknown-unknown/release/${contractName}.wasm`,
  );

  if (!fs.existsSync(wasmPath)) {
    throw new Error(`WASM not found for ${contractName}: ${wasmPath}`);
  }

  const cmd = `
    stellar contract deploy \
    --wasm ${wasmPath} \
    --network ${NETWORK} \
    --source-account default
  `;

  const output = execSync(cmd).toString().trim();

  console.log(`✅ ${contractName} deployed: ${output}`);

  return output;
}

async function verifyContract(address: string): Promise<boolean> {
  try {
    const result = execSync(`
      stellar contract invoke \
      --id ${address} \
      --network ${NETWORK} \
      --source-account default \
      -- \
      is_initialized
    `)
      .toString()
      .trim();

    return result === "true" || result === "1";
  } catch (e) {
    console.warn(`⚠️ Verification failed for ${address}`);
    return false;
  }
}

async function main() {
  console.log(`🚀 Deploying contracts on ${NETWORK}\n`);

  const results: Deployed = {};

  for (const contract of CONTRACTS) {
    try {
      const address = deployWasm(contract);

      results[contract] = address;

      const ok = await verifyContract(address);

      if (!ok) {
        throw new Error(`${contract} failed initialization check`);
      }

      console.log(`🔍 Verified ${contract}\n`);
    } catch (err) {
      console.error(`❌ ${contract} failed:`, err);
      process.exit(1);
    }
  }

  // Save addresses
  fs.writeFileSync(
    "deployed-addresses.json",
    JSON.stringify(results, null, 2),
  );

  console.log("💾 Saved deployed-addresses.json");

  // Update frontend
  fs.writeFileSync(
    "frontend/src/constants/contracts.ts",
    `export const CONTRACT_ADDRESSES = ${JSON.stringify(results, null, 2)} as const;`,
  );

  console.log("🧩 Updated frontend constants");

  console.log("\n🎉 Deployment complete");
}

main().catch((err) => {
  console.error("🔥 Fatal error:", err);
  process.exit(1);
});