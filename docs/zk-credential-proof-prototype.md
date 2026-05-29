# ZK Credential Proof Prototype (Issue #756)

This prototype endpoint is available at:

- `POST /api/credentials/zk/verify`

Request payload:

```json
{
  "proof": "serialized-proof-payload",
  "publicSignals": {
    "credentialHash": "0xabc123...",
    "thresholdMet": "1",
    "nullifierHash": "0xdef456..."
  }
}
```

The current verifier validates:

- Proof payload hash shape (prototype integrity guard)
- Threshold flag format (`0` or `1`)
- Deterministic nullifier hash derivation (`sha256(credentialHash:thresholdMet)`)

This is a stepping stone for replacing the verifier with full Groth16 proof checks in V3.
