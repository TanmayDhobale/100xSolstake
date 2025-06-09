import { Connection, PublicKey, SystemProgram, LAMPORTS_PER_SOL, Transaction, VersionedTransaction } from '@solana/web3.js';
import * as anchor from '@project-serum/anchor';
import { Program, AnchorProvider, BN, IdlAccounts } from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import { PROGRAM_ID, HUNDRED_X_MINT } from '../config';
import { AnchorWallet, WalletContextState } from '@solana/wallet-adapter-react';
import { HundredXStakingIDL } from '../types/hundred_x_staking_new';
import idl from '../idl/hundred_x_staking.json';
import { Keypair } from '@solana/web3.js';
import { createAccount } from '@solana/spl-token';

// Helper function to safely convert BN to number
const bnToNumber = (bn: BN): number => {
    try {
        return bn.toNumber();
    } catch (e) {
        console.warn('Error converting BN to number:', e);
        return 0;
    }
};

type HundredXStaking = {
    "version": "0.1.0",
    "name": "hundred_x_staking",
    "instructions": [],
    "accounts": [{
        "name": "stakingPool",
        "type": {
            "kind": "struct",
            "fields": [
                { "name": "authority", "type": "publicKey" },
                { "name": "hundredXMint", "type": "publicKey" },
                { "name": "rewardRate", "type": "u64" },
                { "name": "lockPeriod", "type": "i64" },
                { "name": "totalStaked", "type": "u64" },
                { "name": "totalRewardsDistributed", "type": "u64" },
                { "name": "availableRewards", "type": "u64" },
                { "name": "bump", "type": "u8" }
            ]
        }
    }]
};

type StakingPoolAccount = IdlAccounts<HundredXStaking>["stakingPool"];

interface StakerAccountData {
    owner: PublicKey;
    stakedAmount: BN;
    stakeTimestamp: BN;
    rewardsClaimed: BN;
}

type HundredXStakingProgram = Program<HundredXStakingIDL>;

export class StakingClient {
    private connection: Connection;
    private wallet: WalletContextState;
    private provider: AnchorProvider;
    private program: Program;

    constructor(connection: Connection, wallet: WalletContextState) {
        this.connection = connection;
        this.wallet = wallet;

        if (!wallet.publicKey) {
            throw new Error("Wallet not connected");
        }

        // Create a custom provider that wraps WalletContextState
        const customProvider = {
            connection,
            publicKey: wallet.publicKey,
            signTransaction: async (tx: Transaction) => {
                if (!wallet.signTransaction) {
                    throw new Error("Wallet does not support transaction signing");
                }
                return wallet.signTransaction(tx);
            },
            signAllTransactions: async (txs: Transaction[]) => {
                if (!wallet.signAllTransactions) {
                    throw new Error("Wallet does not support signing multiple transactions");
                }
                return wallet.signAllTransactions(txs);
            },
        };

        this.provider = new AnchorProvider(
            connection,
            customProvider as any,
            { commitment: 'confirmed' }
        );

        this.program = new Program(idl as any, PROGRAM_ID, this.provider);
    }

    async stake(amount: number): Promise<string> {
        try {
            if (!this.wallet.publicKey) {
                throw new Error("Wallet not connected");
            }

            // Convert amount to lamports
            const lamports = amount * LAMPORTS_PER_SOL;
            console.log("Amount in lamports:", lamports);

            // Check wallet balance before proceeding
            const balance = await this.connection.getBalance(this.wallet.publicKey);
            const requiredAmount = lamports + 5000; // Adding extra for fees
            if (balance < requiredAmount) {
                throw new Error(`Insufficient funds. Required ${requiredAmount / LAMPORTS_PER_SOL} SOL (including fees), but wallet has ${balance / LAMPORTS_PER_SOL} SOL`);
            }

            // Get staking pool PDA
            const [stakingPool] = PublicKey.findProgramAddressSync(
                [Buffer.from("staking_pool")],
                this.program.programId
            );
            console.log("Staking pool address:", stakingPool.toString());

            // Get staker account PDA
            const [stakerAccount] = PublicKey.findProgramAddressSync(
                [Buffer.from("staker"), this.wallet.publicKey.toBuffer()],
                this.program.programId
            );
            console.log("Staker account address:", stakerAccount.toString());

            // Log account states before transaction
            console.log("Fetching account states before transaction...");
            try {
                const poolAccount = await this.connection.getAccountInfo(stakingPool);
                console.log("Staking pool account exists:", !!poolAccount);
                if (poolAccount) {
                    console.log("Staking pool data length:", poolAccount.data.length);
                }

                const stakerAccountInfo = await this.connection.getAccountInfo(stakerAccount);
                console.log("Staker account exists:", !!stakerAccountInfo);
                if (stakerAccountInfo) {
                    console.log("Staker account data length:", stakerAccountInfo.data.length);
                    // If staker account exists, we need to unstake first
                    throw new Error("You already have an active stake. Please unstake first before staking again.");
                }
            } catch (e) {
                console.warn("Error fetching account states:", e);
            }

            // Build the stake transaction
            console.log("Building transaction...");
            const tx = await this.program.methods
                .stake(new BN(lamports))
                .accounts({
                    stakingPool,
                    stakerAccount,
                    user: this.wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .transaction();

            // Get the latest blockhash and set up transaction
            const latestBlockhash = await this.connection.getLatestBlockhash('confirmed');
            tx.recentBlockhash = latestBlockhash.blockhash;
            tx.feePayer = this.wallet.publicKey;

            // Log transaction details
            console.log("Transaction details:", {
                programId: this.program.programId.toString(),
                instructions: tx.instructions.map(ix => ({
                    programId: ix.programId.toString(),
                    keys: ix.keys.map(k => ({
                        pubkey: k.pubkey.toString(),
                        isSigner: k.isSigner,
                        isWritable: k.isWritable
                    }))
                }))
            });

            // Simulate transaction first
            console.log("Simulating transaction...");
            const simulation = await this.connection.simulateTransaction(tx);
            if (simulation.value.err) {
                console.error("Simulation error:", simulation.value);
                throw new Error(`Transaction simulation failed: ${JSON.stringify(simulation.value.err)}`);
            }

            // Log simulation logs
            console.log("Simulation logs:", simulation.value.logs);

            // Sign the transaction
            if (!this.wallet.signTransaction) {
                throw new Error("Wallet does not support transaction signing");
            }

            console.log("Signing transaction...");
            const signedTx = await this.wallet.signTransaction(tx);

            // Verify the transaction is properly signed
            const signatures = signedTx.signatures.map(s => ({
                publicKey: s.publicKey.toString(),
                signature: s.signature ? 'present' : 'missing'
            }));
            console.log("Transaction signatures:", signatures);

            console.log("Sending transaction...");
            try {
                const signature = await this.connection.sendRawTransaction(signedTx.serialize(), {
                    skipPreflight: false,
                    preflightCommitment: 'confirmed',
                    maxRetries: 5
                });

                console.log("Transaction sent, signature:", signature);
                console.log("Confirming transaction...");

                const confirmation = await this.connection.confirmTransaction({
                    signature,
                    blockhash: latestBlockhash.blockhash,
                    lastValidBlockHeight: latestBlockhash.lastValidBlockHeight
                }, 'confirmed');

                if (confirmation.value.err) {
                    // Check if the SOL was deducted
                    const newBalance = await this.connection.getBalance(this.wallet.publicKey);
                    if (newBalance < balance) {
                        console.error("Transaction failed but SOL was deducted. This should not happen.");
                        throw new Error("Transaction failed but SOL was deducted. Please contact support.");
                    }
                    throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
                }

                // Verify the staker account was created
                const postStakerAccount = await this.connection.getAccountInfo(stakerAccount);
                if (!postStakerAccount) {
                    throw new Error("Staker account was not created");
                }

                // Verify the stake amount
                const finalBalance = await this.connection.getBalance(this.wallet.publicKey);
                const expectedBalance = balance - lamports - 5000; // Approximate fee
                if (Math.abs(finalBalance - expectedBalance) > 10000) { // Allow for small fee variations
                    throw new Error("Unexpected balance change. Transaction may have failed.");
                }

                console.log("Transaction confirmed:", signature);
                return signature;
            } catch (error) {
                console.error("Transaction send/confirm error:", error);
                // Check if SOL was deducted
                const newBalance = await this.connection.getBalance(this.wallet.publicKey);
                if (newBalance < balance) {
                    console.error("Transaction failed but SOL was deducted. This should not happen.");
                    throw new Error("Transaction failed but SOL was deducted. Please contact support.");
                }

                if (error instanceof Error) {
                    const errorStr = error.toString();
                    if (errorStr.includes("insufficient funds")) {
                        throw new Error("Insufficient funds for transaction. Make sure you have enough SOL to cover the stake amount and transaction fees.");
                    } else if (errorStr.includes("invalid blockhash")) {
                        throw new Error("Transaction expired. Please try again.");
                    } else if (errorStr.includes("custom program error")) {
                        throw new Error("Program error: You may already have an active stake. Please unstake first.");
                    }
                }
                throw error;
            }
        } catch (error) {
            console.error("Error staking:", error);
            if (error instanceof Error) {
                throw new Error(`Staking failed: ${error.message}`);
            }
            throw error;
        }
    }

    async getPoolStats(): Promise<{
        totalStaked: number;
        availableRewards: number;
        currentRewardRate: number;
        lockPeriod: number;
    }> {
        try {
            const [stakingPool] = PublicKey.findProgramAddressSync(
                [Buffer.from("staking_pool")],
                this.program.programId
            );

            const poolAccount = await this.program.account.stakingPool.fetch(stakingPool) as StakingPoolAccount;
            
            console.log("Pool account data:", poolAccount);
            
            return {
                totalStaked: bnToNumber(poolAccount.totalStaked),
                availableRewards: bnToNumber(poolAccount.availableRewards),
                currentRewardRate: bnToNumber(poolAccount.rewardRate),
                lockPeriod: bnToNumber(poolAccount.lockPeriod)
            };
        } catch (error) {
            console.error("Error fetching pool stats:", error);
            throw error;
        }
    }

    async unstake(): Promise<string> {
        try {
            if (!this.wallet.publicKey) {
                throw new Error("Wallet not connected");
            }

            const [stakingPool] = PublicKey.findProgramAddressSync(
                [Buffer.from("staking_pool")],
                this.program.programId
            );

            const [stakerAccount] = PublicKey.findProgramAddressSync(
                [Buffer.from("staker"), this.wallet.publicKey.toBuffer()],
                this.program.programId
            );

            // First check if the staker account exists
            const stakerAccountInfo = await this.connection.getAccountInfo(stakerAccount);
            if (!stakerAccountInfo) {
                throw new Error("No stake found to unstake");
            }

            const tx = await this.program.methods
                .unstake()
                .accounts({
                    stakingPool,
                    stakerAccount,
                    user: this.wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .transaction();

            const signature = await this.wallet.sendTransaction(tx, this.connection);
            await this.connection.confirmTransaction(signature, 'confirmed');
            return signature;
        } catch (error) {
            console.error("Error unstaking:", error);
            throw error;
        }
    }

    async claimRewards(): Promise<string> {
        try {
            if (!this.wallet.publicKey) {
                throw new Error("Wallet not connected");
            }

            const [stakingPool] = PublicKey.findProgramAddressSync(
                [Buffer.from("staking_pool")],
                this.program.programId
            );

            const [stakerAccount] = PublicKey.findProgramAddressSync(
                [Buffer.from("staker"), this.wallet.publicKey.toBuffer()],
                this.program.programId
            );

            // First check if the staker account exists
            const stakerAccountInfo = await this.connection.getAccountInfo(stakerAccount);
            if (!stakerAccountInfo) {
                throw new Error("No stake found to claim rewards from");
            }

            const userTokenAccount = await getAssociatedTokenAddress(
                HUNDRED_X_MINT,
                this.wallet.publicKey
            );

            // Create user token account if it doesn't exist
            if (!await this.connection.getAccountInfo(userTokenAccount)) {
                const tx = new Transaction().add(
                    createAssociatedTokenAccountInstruction(
                        this.wallet.publicKey,
                        userTokenAccount,
                        this.wallet.publicKey,
                        HUNDRED_X_MINT
                    )
                );
                await this.wallet.sendTransaction(tx, this.connection);
                // Wait for confirmation
                await this.connection.confirmTransaction(await this.wallet.sendTransaction(tx, this.connection), 'confirmed');
            }

            // Get the pool's token account
            const poolTokenAccount = await getAssociatedTokenAddress(
                HUNDRED_X_MINT,
                stakingPool,
                true // allowOwnerOffCurve = true since PDA is the owner
            );

            // Initialize pool token account if it doesn't exist
            const poolTokenAccountInfo = await this.connection.getAccountInfo(poolTokenAccount);
            if (!poolTokenAccountInfo) {
                const tx = new Transaction().add(
                    createAssociatedTokenAccountInstruction(
                        this.wallet.publicKey, // payer
                        poolTokenAccount,
                        stakingPool, // owner
                        HUNDRED_X_MINT
                    )
                );
                await this.wallet.sendTransaction(tx, this.connection);
                await this.connection.confirmTransaction(await this.wallet.sendTransaction(tx, this.connection), 'confirmed');
            }

            // Build the transaction
            const tx = await this.program.methods
                .claimRewards()
                .accounts({
                    stakingPool,
                    stakerAccount,
                    poolTokenAccount,
                    userTokenAccount,
                    user: this.wallet.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    hundredXMint: HUNDRED_X_MINT,
                    systemProgram: SystemProgram.programId,
                })
                .transaction();

            // Add a recent blockhash
            tx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash;
            tx.feePayer = this.wallet.publicKey;

            // Sign and send transaction
            const signature = await this.wallet.sendTransaction(tx, this.connection);
            await this.connection.confirmTransaction(signature, 'confirmed');
            return signature;
        } catch (error) {
            console.error("Error claiming rewards:", error);
            if (error instanceof Error) {
                if (error.message.includes('0x1')) {
                    throw new Error("Insufficient rewards available");
                }
            }
            throw error;
        }
    }

    async getStakingPoolData(stakingPool: PublicKey): Promise<{
        totalStaked: number;
        rewardRate: number;
        lockPeriod: number;
    }> {
        try {
            const account = await this.program.account.stakingPool.fetch(stakingPool);
            return {
                totalStaked: bnToNumber(account.totalStaked),
                rewardRate: bnToNumber(account.rewardRate),
                lockPeriod: bnToNumber(account.lockPeriod)
            };
        } catch (error) {
            console.error('Error fetching staking pool data:', error);
            return {
                totalStaked: 0,
                rewardRate: 0,
                lockPeriod: 0
            };
        }
    }

    async getStakerData(stakerAccount: PublicKey): Promise<{
        stakedAmount: number;
        lastStakeTimestamp: number;
    } | null> {
        try {
            const account = await this.program.account.stakerAccount.fetch(stakerAccount);
            return {
                stakedAmount: bnToNumber(account.stakedAmount),
                lastStakeTimestamp: bnToNumber(account.stakeTimestamp)
            };
        } catch (error) {
            console.error('Error fetching staker data:', error);
            return null;
        }
    }

    async getStakerInfo(): Promise<{
        stakedAmount: number;
        stakeTimestamp: number;
        rewardsClaimed: number;
        potentialRewards: number;
    }> {
        try {
            if (!this.wallet.publicKey) {
                throw new Error("Wallet not connected");
            }

            const [stakerAccount] = PublicKey.findProgramAddressSync(
                [Buffer.from("staker"), this.wallet.publicKey.toBuffer()],
                this.program.programId
            );

            try {
                const account = await this.program.account.stakerAccount.fetch(stakerAccount) as StakerAccountData;
                const poolStats = await this.getPoolStats();

                const stakedAmount = bnToNumber(account.stakedAmount);
                const stakeTime = bnToNumber(account.stakeTimestamp);
                const now = Math.floor(Date.now() / 1000);
                const timeDiff = now - stakeTime;
                
                // Calculate potential rewards based on staked amount, time, and reward rate
                const potentialRewards = (stakedAmount * poolStats.currentRewardRate * timeDiff) / (100 * 24 * 60 * 60);

                return {
                    stakedAmount,
                    stakeTimestamp: stakeTime,
                    rewardsClaimed: bnToNumber(account.rewardsClaimed),
                    potentialRewards
                };
            } catch (error) {
                console.error('Error fetching staker account:', error);
                return {
                    stakedAmount: 0,
                    stakeTimestamp: 0,
                    rewardsClaimed: 0,
                    potentialRewards: 0
                };
            }
        } catch (error) {
            console.error('Error in getStakerInfo:', error);
            throw error;
        }
    }
}