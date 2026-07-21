# Achievement Badge Contract

Soulbound, non-transferable achievement badges awarded for specific platform milestones.

## Features

- **Soulbound**: Badges cannot be transferred between addresses
- **Admin-mintable**: Only admin can mint badges
- **Duplicate prevention**: Each badge type can only be awarded once per address
- **Metadata support**: IPFS metadata pointers for badge details
- **Query functions**: 
  - `badges_of(address)` - Get all badge token IDs for an address
  - `has_badge(address, badge_type)` - Check if address has a specific badge type
  - `get_badge_token_id(address, badge_type)` - Get token ID for a specific badge type

## Badge Types

- `first_completion` - First course completed
- `streak_30` - 30-day learning streak
- `first_scholarship_funded` - First scholarship funded
- `top_10_leaderboard` - Top-10 leaderboard finish

## Functions

### initialize(admin)
Initializes the contract with an admin address.

### mint(to, badge_type, metadata_uri)
Mints a new badge to an address. Only callable by admin. Prevents duplicate badge types per address.

### badges_of(address)
Returns all badge token IDs owned by an address.

### has_badge(address, badge_type)
Returns true if the address has been awarded the specified badge type.

### get_badge_token_id(address, badge_type)
Returns the token ID for a specific badge type awarded to an address, if it exists.

### transfer(from, to, token_id)
Always fails with `Soulbound` error - badges are non-transferable.

## Events

- `init` - Contract initialized
- `minted` - Badge minted (includes token_id, owner, badge_type)
- `xfer_att` - Transfer attempt (always fails, for monitoring)
- `adm_chng` - Admin changed

## Storage

- Instance storage: Admin, token counter
- Persistent storage: Owner mapping, token URIs, metadata, badge type tracking
