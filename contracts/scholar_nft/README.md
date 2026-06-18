# ScholarNFT Contract

## Purpose and Role

`scholar_nft` issues soulbound scholarship credentials as NFTs. Each token
stores ownership, metadata, issue time, and revocation status for an earned
credential.

## Key Functions

| Function | Parameters | Access | Description |
| --- | --- | --- | --- |
| `initialize` | `admin` | `admin` auth | Sets the admin and starts token counters at zero. |
| `mint` | `to`, `metadata_uri` | stored admin | Mints the next token ID and stores metadata. |
| `revoke` | `token_id`, `reason` | stored admin | Marks a credential revoked with a reason string. |
| `transfer_admin` | `new_admin` | stored admin | Rotates admin control. |
| `transfer` | `from`, `to`, `token_id` | always rejects | Emits a transfer-attempt event and reverts because the NFT is soulbound. |
| `owner_of` | `token_id` | public read | Returns the owner of a valid, non-revoked token. |
| `token_uri`, `get_metadata_uri` | `token_id` | public read | Returns metadata URI. |
| `get_metadata` | `token_id` | public read | Returns `ScholarMetadata { owner, metadata_uri, issued_at }`. |
| `token_counter` | none | public read | Returns the next token counter state. |
| `get_all_scholars` | none | public read | Returns the stored scholar list view. |
| `has_credential`, `is_revoked`, `get_revocation_reason` | token args | public read | Credential and revocation queries. |
| `upgrade` | `new_wasm_hash` | stored admin | Upgrades the contract WASM through the shared helper. |

## Authorization Model

- `initialize` requires the provided admin address to authorize once.
- Stored admin can mint, revoke, rotate admin, and upgrade.
- No holder can transfer the NFT because transfers always revert.
- Read methods are public.

## State Variables

| Storage Key | Meaning |
| --- | --- |
| `ADMIN` / `DataKey::Admin` | Administrator address. |
| `TCOUNTER` / `DataKey::Counter` | Token ID counter used for sequential minting. |
| `Owner(token_id)` | Credential owner for a token. |
| `TokenUri(token_id)` | Off-chain metadata URI. |
| `Metadata(token_id)` | Full `ScholarMetadata` snapshot. |
| `Revoked(token_id)` | Revocation reason for a revoked token. |
| `WASMHASH` | Last tracked managed upgrade hash from the shared helper. |

## Events Emitted

- `init` with `InitializedEventData { admin }`
- `minted` with `MintEventData { token_id, owner }`
- `revoked` with `RevokedEventData { token_id, reason }`
- `adm_chng` with `AdminChangedEventData { old_admin, new_admin }`
- `xfer_att` with `TransferAttemptEventData { from, to, token_id }`
- `contract_upgraded` from the shared upgrade helper

## Deploy with Stellar CLI

From the repository root:

```bash
stellar contract build --package scholar-nft
stellar contract deploy \
  --wasm target/wasm32v1-none/release/scholar_nft.wasm \
  --source <IDENTITY> \
  --network <NETWORK>
```

Initialize after deploy by invoking `initialize(admin)`.

## Run Tests

From the repository root:

```bash
cargo test -p scholar-nft
```
