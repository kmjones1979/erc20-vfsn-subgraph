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

## Deployment

An example deployment of this subgraph along with a GraphQL playground can be found [here](https://thegraph.com/studio/subgraph/vfsn/).

### How to use the playground

1. Visit [The Graph Explorer](https://thegraph.com/explorer/subgraph/vfsn)
2. Click on the "Playground" tab in the top navigation
3. You'll see a split-screen interface:
    - Left side: Query editor
    - Right side: Results display
4. Example queries are available in the "Example Queries" section below
5. To run a query:
    - Paste your GraphQL query into the editor
    - Click the "Play" button (▶️) or press Cmd/Ctrl + Enter
    - Results will appear on the right side
6. Use the "Schema" tab to explore available entities and fields
7. The "Docs" tab provides detailed documentation about the subgraph's schema

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
    tokens {
        dailyTokenSnapshot(
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
    accounts(first: 10) {
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
            id
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

## Architecture

### 1. Schema (schema.graphql)

The schema is organized into four main sections:

#### Token Metadata

```graphql
type Token @entity {
    id: Bytes! # Contract address
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
    id: Bytes! # {Token Address}-{Day ID}
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
    id: Bytes! # {Token ID}-{Tx Hash}-{Log Index}
    hash: Bytes! # Transaction hash
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
    id: Bytes! # Account address
    transferTo: [TransferEvent!]! @derivedFrom(field: "to")
    transferFrom: [TransferEvent!]! @derivedFrom(field: "from")
    balances: [AccountBalance!]! @derivedFrom(field: "account")
}

type AccountBalance @entity {
    id: Bytes! # {Account}-{Token}
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
    let token = Token.load(address);
    if (token === null) {
        token = new Token(address);
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
function getOrCreateAccount(address: Address): Account {
    let account = Account.load(address);
    if (account === null) {
        account = new Account(address);
    }
    return account;
}

// Balance management
function getOrCreateAccountBalance(
    account: Account,
    token: Token
): AccountBalance {
    let balanceId = account.id.concat(token.id);
    let balance = AccountBalance.load(balanceId);
    if (balance === null) {
        balance = new AccountBalance(balanceId);
        balance.account = account.id;
        balance.token = token.id;
        balance.amount = ZERO_BI;
        balance.blockNumber = ZERO_BI;
    }
    return balance;
}

// Snapshot management
function updateDailySnapshot(
    token: Token,
    blockNumber: BigInt,
    timestamp: BigInt,
    isMint: boolean,
    isBurn: boolean,
    transferAmount: BigInt
): void {
    let dayID = timestamp.toI32() / 86400;
    let snapshotId = token.id.concat(Bytes.fromI32(dayID));
    let snapshot = TokenDailySnapshot.load(snapshotId);

    if (snapshot === null) {
        snapshot = new TokenDailySnapshot(snapshotId);
        snapshot.token = token.id;
        snapshot.dailyTotalSupply = token.totalSupply;
        snapshot.currentHolderCount = token.currentHolderCount;
        snapshot.cumulativeHolderCount = token.cumulativeHolderCount;
        snapshot.dailyEventCount = 0;
        snapshot.dailyTransferCount = 0;
        snapshot.dailyTransferAmount = ZERO_BI;
        snapshot.dailyMintCount = 0;
        snapshot.dailyMintAmount = ZERO_BI;
        snapshot.dailyBurnCount = 0;
        snapshot.dailyBurnAmount = ZERO_BI;
    }

    // Update daily counts and amounts
    snapshot.dailyEventCount += 1;
    snapshot.dailyTransferCount += 1;
    snapshot.dailyTransferAmount =
        snapshot.dailyTransferAmount.plus(transferAmount);

    if (isMint) {
        snapshot.dailyMintCount += 1;
        snapshot.dailyMintAmount =
            snapshot.dailyMintAmount.plus(transferAmount);
    }
    if (isBurn) {
        snapshot.dailyBurnCount += 1;
        snapshot.dailyBurnAmount =
            snapshot.dailyBurnAmount.plus(transferAmount);
    }

    // Always update current values
    snapshot.dailyTotalSupply = token.totalSupply;
    snapshot.currentHolderCount = token.currentHolderCount;
    snapshot.cumulativeHolderCount = token.cumulativeHolderCount;

    snapshot.blockNumber = blockNumber;
    snapshot.timestamp = timestamp;
    snapshot.save();
}
```

#### Event Handlers

The mapping file includes handlers for all token events:

- `handleTransfer`: Processes token transfers, updates balances, and maintains holder counts
- `handleApproval`: Tracks token approvals
- `handleAddressBlocked`: Records blocked addresses
- `handleAddressUnblocked`: Records unblocked addresses
- `handleAdminChanged`: Tracks admin changes
- `handleDelegateChanged`: Records delegation changes
- `handleDelegateVotesChanged`: Tracks voting power changes
- `handleEIP712DomainChanged`: Records EIP712 domain changes
- `handleMintBlocked`: Records mint blocking events
- `handleOwnershipTransferStarted`: Tracks ownership transfer initiation
- `handleOwnershipTransferred`: Records completed ownership transfers

## Recent Changes

1. Updated all entity IDs to use `Bytes!` instead of `ID!` for better blockchain data handling
2. Changed event hash fields to use `Bytes!` instead of `String!`
3. Improved holder count tracking logic
4. Enhanced daily snapshot updates with proper value capture
5. Fixed balance tracking for mints and burns
6. Updated transfer event ID generation to use transaction hash and log index
7. Optimized ID generation for account balances and daily snapshots
8. Fixed daily total supply tracking in snapshots

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

## Querying

## Notes

- The subgraph implements the Messari standard for ERC20 tokens
- All amounts are stored as BigInt to handle large numbers
- Daily snapshots provide historical data for analysis
- Event tracking includes both standard ERC20 and VFSN-specific events
- Account balances are updated on every transfer
- Holder counts are maintained for both current and cumulative metrics
