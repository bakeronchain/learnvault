# ScholarNFT Contract

Soulbound credential NFT contract for scholarship completion credentials.

## Authority and Trust Assumptions

- `initialize(admin)` requires `admin` authorization and can run once.
- Stored `ADMIN` mints, revokes, transfers admin authority, and upgrades.
- Metadata URIs are off-chain content pointers and are not validated by the
  contract.

## Functions

| Function | Access | Notes |
| --- | --- | --- |
| `initialize(admin)` | Admin auth | Stores admin, counters, scholars collection, and upgrade hash tracking. |
| `mint(to, metadata_uri)` | Stored admin | Mints next checked token ID and stores owner/metadata. |
| `revoke(token_id, reason)` | Stored admin | Marks existing token revoked once. |
| `transfer_admin(new_admin)` | Stored admin | Transfers admin authority. |
| `upgrade(new_wasm_hash)` | Stored admin | Replaces current WASM through shared upgrade helper. |
| `transfer(from, to, token_id)` | Always rejected | Emits attempted transfer event and reverts as soulbound. |
| `owner_of(token_id)` | Public read | Returns owner unless token is missing or revoked. |
| `token_uri`, `get_metadata_uri`, `get_metadata` | Public read | Metadata views. |
| `token_counter`, `get_all_scholars`, `has_credential`, `is_revoked`, `get_revocation_reason` | Public read | Credential and revocation views. |

## Audit Focus

- Soulbound transfer behavior cannot be bypassed.
- Token ID counter cannot wrap.
- Revocation status is consistently enforced by ownership/credential views.
- Admin transfer and upgrade authority are protected.
