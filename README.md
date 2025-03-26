# VFSN Token Subgraph

This subgraph tracks the VFSN token on the Vana network, implementing the Messari standard for ERC20 tokens while maintaining additional event tracking specific to the VFSN token contract.

## Overview

The subgraph tracks:

- Token metadata and supply dynamics
- Holder statistics and distributions
- Daily snapshots of token metrics
- All token events (transfers, approvals, mints, burns)
- Special VFSN token events (blocking, admin changes, etc.)
- Account balances and transfer history

## Architecture

### 1. Schema (schema.graphql)

The schema is organized into four main sections:

#### Token Metadata

```graphql
type Token @entity {
    id: ID! # Contract address
    name: String! # Token name (dFusion)
    symbol: String! # Token symbol (VFSN)
    decimals: Int! # Token decimals
    currentHolderCount: BigInt! # Current unique holders
    cumulativeHolderCount: BigInt! # All-time unique holders
    transferCount: BigInt! # Total transfers
    mintCount: BigInt! # Total mints
    burnCount: BigInt! # Total burns
    totalSupply: BigInt! # Current supply
    totalBurned: BigInt! # Total burned
    totalMinted: BigInt! # Total minted
    transfers: [TransferEvent!]! @derivedFrom(field: "token")
    holdersBalance: [AccountBalance!]! @derivedFrom(field: "token")
    dailyTokenSnapshot: [TokenDailySnapshot!]! @derivedFrom(field: "token")
}
```

#### Token Timeseries

```graphql
type TokenDailySnapshot @entity {
    id: ID! # {Token Address}-{Day ID}
    token: Token! # Reference to token
    dailyTotalSupply: BigInt! # Daily supply
    currentHolderCount: BigInt! # Daily holder count
    cumulativeHolderCount: BigInt! # Cumulative holders
    dailyEventCount: Int! # Daily events
    dailyTransferCount: Int! # Daily transfers
    dailyTransferAmount: BigInt! # Daily transfer volume
    dailyMintCount: Int! # Daily mints
    dailyMintAmount: BigInt! # Daily mint volume
    dailyBurnCount: Int! # Daily burns
    dailyBurnAmount: BigInt! # Daily burn volume
    blockNumber: BigInt! # Block number
    timestamp: BigInt! # Timestamp
}
```

#### Event-Level Data

```graphql
interface Event {
    id: ID! # {Token ID}-{Tx Hash}-{Log Index}
    hash: String! # Transaction hash
    logIndex: Int! # Event log index
    token: Token! # Token reference
    nonce: BigInt! # Transaction nonce
    to: Account! # Recipient
    from: Account! # Sender
    blockNumber: BigInt! # Block number
    timestamp: BigInt! # Timestamp
}

type TransferEvent implements Event @entity {
    amount: BigInt! # Transfer amount
}
```

#### Account Metadata

```graphql
type Account @entity {
    id: ID! # Account address
    transferTo: [TransferEvent!]! @derivedFrom(field: "to")
    transferFrom: [TransferEvent!]! @derivedFrom(field: "from")
    balances: [AccountBalance!]! @derivedFrom(field: "account")
}

type AccountBalance @entity {
    id: ID! # {Account}-{Token}
    account: Account! # Account reference
    token: Token! # Token reference
    amount: BigInt! # Balance amount
    blockNumber: BigInt! # Last update block
}
```

### 2. Mapping (dat.ts)

The mapping file contains handlers for all events and helper functions:

#### Helper Functions

```typescript
// Token management
function getOrCreateToken(address: Address): Token {
    let token = Token.load(address.toHexString());
    if (token === null) {
        token = new Token(address.toHexString());
        token.name = "dFusion";
        token.symbol = "VFSN";
        token.decimals = 18;
        token.currentHolderCount = ZERO_BI;
        token.cumulativeHolderCount = ZERO_BI;
        token.transferCount = ZERO_BI;
        token.mintCount = ZERO_BI;
        token.burnCount = ZERO_BI;
        token.totalSupply = ZERO_BI;
        token.totalBurned = ZERO_BI;
        token.totalMinted = ZERO_BI;
    }
    return token;
}
// Account management
function getOrCreateAccount(address: Address): Account;
// Balance management
function getOrCreateAccountBalance(
    account: Account,
    token: Token
): AccountBalance;
// Daily snapshot management
function updateDailySnapshot(
    token: Token,
    blockNumber: BigInt,
    timestamp: BigInt
): void;
```

#### Event Handlers

- `handleTransfer`: Processes token transfers, updates balances, and maintains metrics
- `handleApproval`: Tracks token approvals
- `handleDelegateChanged`: Records delegation changes
- `handleDelegateVotesChanged`: Tracks voting power changes
- `handleAdminChanged`: Records admin changes
- `handleMintBlocked`: Tracks mint blocking events
- `handleAddressBlocked`: Records blocked addresses
- `handleAddressUnblocked`: Records unblocked addresses
- `handleOwnershipTransferStarted`: Tracks ownership transfer initiation
- `handleOwnershipTransferred`: Records completed ownership transfers

### 3. Configuration (subgraph.yaml)

The subgraph configuration defines:

- Network: Vana
- Contract address: 0x0CC1Bc0131DD9782e65ca0319Cd3a60eBA3a932d
- Start block: 0
- Event handlers and their mappings
- Entity definitions

## Example Queries

### 1. Token Holder Distribution

```graphql
{
    accountBalances(first: 1000, orderBy: amount, orderDirection: desc) {
        account {
            id
        }
        amount
        token {
            id
            name
            symbol
            decimals
        }
    }
}
```

### 2. Daily Token Metrics

```graphql
{
    token(id: "0x0CC1Bc0131DD9782e65ca0319Cd3a60eBA3a932d") {
        dailyTokenSnapshots(
            first: 30
            orderBy: timestamp
            orderDirection: desc
        ) {
            timestamp
            dailyTotalSupply
            currentHolderCount
            cumulativeHolderCount
            dailyEventCount
            dailyTransferCount
            dailyTransferAmount
            dailyMintCount
            dailyMintAmount
            dailyBurnCount
            dailyBurnAmount
        }
    }
}
```

### 3. Transfer History

```graphql
{
    transferEvents(first: 100, orderBy: timestamp, orderDirection: desc) {
        amount
        timestamp
        from {
            id
        }
        to {
            id
        }
        token {
            id
            name
            symbol
        }
    }
}
```

### 4. Account Activity

```graphql
{
    account(id: "0x...") {
        transferTo {
            amount
            timestamp
        }
        transferFrom {
            amount
            timestamp
        }
        balances {
            amount
            token {
                id
                name
                symbol
            }
        }
    }
}
```

### 5. Special Events

```graphql
{
    addressBlockedEvents: addressBlockeds(
        first: 100
        orderBy: blockTimestamp
        orderDirection: desc
    ) {
        blockedAddress
        blockTimestamp
    }

    adminChanges: adminChangeds(
        first: 100
        orderBy: blockTimestamp
        orderDirection: desc
    ) {
        oldAdmin
        newAdmin
        blockTimestamp
    }
}
```

## Development

1. Install dependencies:

```bash
npm install
```

2. Generate types:

```bash
graph codegen
```

3. Build the subgraph:

```bash
graph build
```

4. Deploy the subgraph:

```bash
graph deploy
```

## Notes

- The subgraph implements the Messari standard for ERC20 tokens
- All amounts are stored as BigInt to handle large numbers
- Daily snapshots provide historical data for analysis
- Event tracking includes both standard ERC20 and VFSN-specific events
- Account balances are updated on every transfer
- Holder counts are maintained for both current and cumulative metrics
