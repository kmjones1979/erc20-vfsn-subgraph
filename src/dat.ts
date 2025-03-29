import {
    AddressBlocked as AddressBlockedEvent,
    AddressUnblocked as AddressUnblockedEvent,
    AdminChanged as AdminChangedEvent,
    Approval as ApprovalEvent,
    DelegateChanged as DelegateChangedEvent,
    DelegateVotesChanged as DelegateVotesChangedEvent,
    EIP712DomainChanged as EIP712DomainChangedEvent,
    MintBlocked as MintBlockedEvent,
    OwnershipTransferStarted as OwnershipTransferStartedEvent,
    OwnershipTransferred as OwnershipTransferredEvent,
    Transfer as TransferEvent,
} from "../generated/DAT/DAT";
import {
    AddressBlocked,
    AddressUnblocked,
    AdminChanged,
    Approval,
    DelegateChanged,
    DelegateVotesChanged,
    EIP712DomainChanged,
    MintBlocked,
    OwnershipTransferStarted,
    OwnershipTransferred,
    Token,
    TokenDailySnapshot,
    Account,
    AccountBalance,
    TransferEvent as TransferEventEntity,
} from "../generated/schema";
import { BigInt, Bytes, Address, log } from "@graphprotocol/graph-ts";

// Constants
const ZERO_BI = BigInt.fromI32(0);
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ONE_BI = BigInt.fromI32(1);

// Helper function to get or create token
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

// Helper function to get or create account
function getOrCreateAccount(address: Address): Account {
    let account = Account.load(address);
    if (account === null) {
        account = new Account(address);
    }
    return account;
}

// Helper function to get or create account balance
function getOrCreateAccountBalance(
    account: Account,
    token: Token
): AccountBalance {
    let balanceId = account.id.concat(Bytes.fromUTF8("-")).concat(token.id);
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

// Helper function to update daily snapshot
function updateDailySnapshot(
    token: Token,
    blockNumber: BigInt,
    timestamp: BigInt,
    isMint: boolean,
    isBurn: boolean,
    transferAmount: BigInt
): void {
    let dayID = timestamp.toI32() / 86400;
    let snapshotId = Bytes.fromUTF8(
        token.id.toHexString() + "-" + dayID.toString()
    );
    let snapshot = TokenDailySnapshot.load(snapshotId);

    // Always create a new snapshot if it doesn't exist
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

export function handleAddressBlocked(event: AddressBlockedEvent): void {
    let entity = new AddressBlocked(
        event.transaction.hash.concatI32(event.logIndex.toI32())
    );
    entity.blockedAddress = event.params.blockedAddress;
    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleAddressUnblocked(event: AddressUnblockedEvent): void {
    let entity = new AddressUnblocked(
        event.transaction.hash.concatI32(event.logIndex.toI32())
    );
    entity.unblockedAddress = event.params.unblockedAddress;
    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleAdminChanged(event: AdminChangedEvent): void {
    let entity = new AdminChanged(
        event.transaction.hash.concatI32(event.logIndex.toI32())
    );
    entity.oldAdmin = event.params.oldAdmin;
    entity.newAdmin = event.params.newAdmin;
    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleApproval(event: ApprovalEvent): void {
    let entity = new Approval(
        event.transaction.hash.concatI32(event.logIndex.toI32())
    );
    entity.owner = event.params.owner;
    entity.spender = event.params.spender;
    entity.value = event.params.value;
    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleDelegateChanged(event: DelegateChangedEvent): void {
    let entity = new DelegateChanged(
        event.transaction.hash.concatI32(event.logIndex.toI32())
    );
    entity.delegator = event.params.delegator;
    entity.fromDelegate = event.params.fromDelegate;
    entity.toDelegate = event.params.toDelegate;
    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleDelegateVotesChanged(
    event: DelegateVotesChangedEvent
): void {
    let entity = new DelegateVotesChanged(
        event.transaction.hash.concatI32(event.logIndex.toI32())
    );
    entity.delegate = event.params.delegate;
    entity.previousVotes = event.params.previousVotes;
    entity.newVotes = event.params.newVotes;
    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleEIP712DomainChanged(
    event: EIP712DomainChangedEvent
): void {
    let entity = new EIP712DomainChanged(
        event.transaction.hash.concatI32(event.logIndex.toI32())
    );
    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleMintBlocked(event: MintBlockedEvent): void {
    let entity = new MintBlocked(
        event.transaction.hash.concatI32(event.logIndex.toI32())
    );
    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleOwnershipTransferStarted(
    event: OwnershipTransferStartedEvent
): void {
    let entity = new OwnershipTransferStarted(
        event.transaction.hash.concatI32(event.logIndex.toI32())
    );
    entity.previousOwner = event.params.previousOwner;
    entity.newOwner = event.params.newOwner;
    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleOwnershipTransferred(
    event: OwnershipTransferredEvent
): void {
    let entity = new OwnershipTransferred(
        event.transaction.hash.concatI32(event.logIndex.toI32())
    );
    entity.previousOwner = event.params.previousOwner;
    entity.newOwner = event.params.newOwner;
    entity.blockNumber = event.block.number;
    entity.blockTimestamp = event.block.timestamp;
    entity.transactionHash = event.transaction.hash;
    entity.save();
}

export function handleTransfer(event: TransferEvent): void {
    let token = getOrCreateToken(event.address);
    let fromAccount = getOrCreateAccount(event.params.from);
    let toAccount = getOrCreateAccount(event.params.to);
    let fromBalance = getOrCreateAccountBalance(fromAccount, token);
    let toBalance = getOrCreateAccountBalance(toAccount, token);

    // Check balances before updating them
    let fromHadBalance = !fromBalance.amount.equals(ZERO_BI);
    let toHadBalance = !toBalance.amount.equals(ZERO_BI);

    // Update token stats
    token.transferCount = token.transferCount.plus(ONE_BI);

    // Handle mints and burns
    let isMint = event.params.from.toHexString() == ZERO_ADDRESS;
    let isBurn = event.params.to.toHexString() == ZERO_ADDRESS;

    if (isMint) {
        token.mintCount = token.mintCount.plus(ONE_BI);
        token.totalMinted = token.totalMinted.plus(event.params.value);
        token.totalSupply = token.totalSupply.plus(event.params.value);
    }
    if (isBurn) {
        token.burnCount = token.burnCount.plus(ONE_BI);
        token.totalBurned = token.totalBurned.plus(event.params.value);
        token.totalSupply = token.totalSupply.minus(event.params.value);
    }

    // Update balances
    fromBalance.amount = fromBalance.amount.minus(event.params.value);
    toBalance.amount = toBalance.amount.plus(event.params.value);
    fromBalance.blockNumber = event.block.number;
    toBalance.blockNumber = event.block.number;

    // Update holder counts
    if (fromBalance.amount.equals(ZERO_BI) && fromHadBalance) {
        token.currentHolderCount = token.currentHolderCount.minus(ONE_BI);
    }
    if (!toBalance.amount.equals(ZERO_BI) && !toHadBalance) {
        token.currentHolderCount = token.currentHolderCount.plus(ONE_BI);
        token.cumulativeHolderCount = token.cumulativeHolderCount.plus(ONE_BI);
    }

    // Create transfer event with unique ID
    let transferEventId = event.transaction.hash.concatI32(
        event.logIndex.toI32()
    );
    let transferEvent = new TransferEventEntity(transferEventId);
    transferEvent.hash = event.transaction.hash;
    transferEvent.logIndex = event.logIndex.toI32();
    transferEvent.token = token.id;
    transferEvent.nonce = event.transaction.nonce;
    transferEvent.amount = event.params.value;
    transferEvent.from = fromAccount.id;
    transferEvent.to = toAccount.id;
    transferEvent.blockNumber = event.block.number;
    transferEvent.timestamp = event.block.timestamp;

    // Save entities
    token.save();
    fromAccount.save();
    toAccount.save();
    fromBalance.save();
    toBalance.save();
    transferEvent.save();

    // Update daily snapshot with event details
    updateDailySnapshot(
        token,
        event.block.number,
        event.block.timestamp,
        isMint,
        isBurn,
        event.params.value
    );
}
