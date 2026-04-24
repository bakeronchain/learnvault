export const config = {
  network: process.env.NETWORK || "testnet",
  sourceAccount: process.env.STELLAR_SOURCE_ACCOUNT || "default",
  wasmDir: "target/wasm32-unknown-unknown/release",
};