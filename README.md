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

## Querying the Subgraph

The subgraph can be queried using various methods depending on your frontend framework and requirements. Here's how to implement queries in different environments:

### 1. Using Apollo Client (React)

```typescript
import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

// Initialize Apollo Client
const client = new ApolloClient({
  uri: 'YOUR_SUBGRAPH_URL',
  cache: new InMemoryCache(),
});

// Define the query
const TOP_HOLDERS_QUERY = gql`
  query GetTopHolders {
    accountBalances(
      first: 10,
      orderBy: amount,
      orderDirection: desc
    ) {
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
`;

// React component using the query
function TopHoldersTable() {
  const { loading, error, data } = useQuery(TOP_HOLDERS_QUERY);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error :(</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>Address</th>
          <th>Balance</th>
          <th>Token</th>
        </tr>
      </thead>
      <tbody>
        {data.accountBalances.map((holder: any) => (
          <tr key={holder.account.id}>
            <td>{holder.account.id}</td>
            <td>{formatAmount(holder.amount, holder.token.decimals)}</td>
            <td>{holder.token.symbol}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 2. Using urql (React)

```typescript
import { createClient, dedupExchange, cacheExchange, fetchExchange } from 'urql';

// Initialize urql client
const client = createClient({
  url: 'YOUR_SUBGRAPH_URL',
  exchanges: [dedupExchange, cacheExchange, fetchExchange],
});

// Define the query
const TOP_HOLDERS_QUERY = `
  query GetTopHolders {
    accountBalances(
      first: 10,
      orderBy: amount,
      orderDirection: desc
    ) {
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
`;

// React component using the query
function TopHoldersTable() {
  const [result] = useQuery({
    query: TOP_HOLDERS_QUERY,
  });

  const { data, fetching, error } = result;

  if (fetching) return <p>Loading...</p>;
  if (error) return <p>Error :(</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>Address</th>
          <th>Balance</th>
          <th>Token</th>
        </tr>
      </thead>
      <tbody>
        {data.accountBalances.map((holder: any) => (
          <tr key={holder.account.id}>
            <td>{holder.account.id}</td>
            <td>{formatAmount(holder.amount, holder.token.decimals)}</td>
            <td>{holder.token.symbol}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 3. Using React Query

```typescript
import { useQuery } from '@tanstack/react-query';

// Define the query function
const fetchTopHolders = async () => {
  const response = await fetch('YOUR_SUBGRAPH_URL', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: `
        query GetTopHolders {
          accountBalances(
            first: 10,
            orderBy: amount,
            orderDirection: desc
          ) {
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
      `,
    }),
  });
  return response.json();
};

// React component using React Query
function TopHoldersTable() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['topHolders'],
    queryFn: fetchTopHolders,
  });

  if (isLoading) return <p>Loading...</p>;
  if (error) return <p>Error :(</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>Address</th>
          <th>Balance</th>
          <th>Token</th>
        </tr>
      </thead>
      <tbody>
        {data.data.accountBalances.map((holder: any) => (
          <tr key={holder.account.id}>
            <td>{holder.account.id}</td>
            <td>{formatAmount(holder.amount, holder.token.decimals)}</td>
            <td>{holder.token.symbol}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 4. Using Simple Fetch (Vanilla JavaScript)

```typescript
async function fetchTopHolders() {
    const response = await fetch("YOUR_SUBGRAPH_URL", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            query: `
        query GetTopHolders {
          accountBalances(
            first: 10,
            orderBy: amount,
            orderDirection: desc
          ) {
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
      `,
        }),
    });

    const data = await response.json();
    return data;
}

// Usage in HTML
async function displayTopHolders() {
    const data = await fetchTopHolders();
    const table = document.getElementById("holders-table");

    data.data.accountBalances.forEach((holder) => {
        const row = document.createElement("tr");
        row.innerHTML = `
      <td>${holder.account.id}</td>
      <td>${formatAmount(holder.amount, holder.token.decimals)}</td>
      <td>${holder.token.symbol}</td>
    `;
        table.appendChild(row);
    });
}
```

### Helper Functions

```typescript
// Format amount with decimals
function formatAmount(amount: string, decimals: number): string {
    const value = BigInt(amount);
    const divisor = BigInt(10 ** decimals);
    const whole = value / divisor;
    const remainder = value % divisor;
    return `${whole}.${remainder.toString().padStart(decimals, "0")}`;
}

// Format address to show only first and last 4 characters
function formatAddress(address: string): string {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
```

### Best Practices

1. **Error Handling**:

    - Always implement proper error handling
    - Show user-friendly error messages
    - Implement retry logic for failed requests

2. **Loading States**:

    - Show loading indicators while data is being fetched
    - Consider implementing skeleton loading states

3. **Caching**:

    - Use appropriate caching strategies based on your framework
    - Consider implementing local storage for frequently accessed data

4. **Pagination**:

    - Implement pagination for large datasets
    - Use cursor-based pagination when available

5. **Real-time Updates**:

    - Consider implementing WebSocket connections for real-time data
    - Use polling for periodic updates if WebSocket is not available

6. **Performance**:
    - Implement proper memoization
    - Use appropriate data structures for efficient rendering
    - Consider implementing virtual scrolling for large lists

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
