import {
    Connection,
    Keypair,
    PublicKey,
    SystemProgram,
    LAMPORTS_PER_SOL,
    Transaction,
} from '@solana/web3.js';
import * as anchor from '@project-serum/anchor';
import { Program } from '@project-serum/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccount, getAccount, createAccount, mintTo } from '@solana/spl-token';
import {
    PROGRAM_ID,
    HUNDRED_X_MINT,
    DEVNET_URL,
    DEFAULT_REWARD_RATE,
    DEFAULT_LOCK_PERIOD,
} from './config';
import { BN } from 'bn.js';

export class HundredXStakingClient {
    private connection: Connection;
    private program: Program;
    private wallet: anchor.Wallet;
    private authorityTokenAccount: PublicKey;

    constructor(wallet: anchor.Wallet, authorityTokenAccount: PublicKey) {
        this.connection = new Connection(DEVNET_URL, 'confirmed');
        this.wallet = wallet;
        this.authorityTokenAccount = authorityTokenAccount;

        // Initialize Anchor program
        const provider = new anchor.AnchorProvider(
            this.connection,
            this.wallet,
            { commitment: 'confirmed' }
        );
        anchor.setProvider(provider);

        // Load the program IDL
        this.program = new Program(require('../idl.json'), PROGRAM_ID);
    }

    get getConnection(): Connection {
        return this.connection;
    }

    async requestAirdrop(amount = LAMPORTS_PER_SOL): Promise<string> {
        const signature = await this.connection.requestAirdrop(
            this.wallet.publicKey,
            amount
        );
        await this.connection.confirmTransaction(signature);
        return signature;
    }

    async getTokenBalance(tokenAccount: PublicKey): Promise<number> {
        const account = await getAccount(this.connection, tokenAccount);
        return Number(account.amount);
    }

    async initializePool(rewardRate = DEFAULT_REWARD_RATE, lockPeriod = DEFAULT_LOCK_PERIOD) {
        try {
            // Check authority token balance
            const authorityBalance = await this.getTokenBalance(this.authorityTokenAccount);
            console.log('Authority token balance:', authorityBalance);
            if (authorityBalance === 0) {
                throw new Error('Authority token account has no tokens');
            }

            // Derive PDA for staking pool - matches the Rust program
            const [stakingPool] = PublicKey.findProgramAddressSync(
                [Buffer.from("staking_pool")],
                this.program.programId
            );

            console.log('Staking pool address:', stakingPool.toString());
            console.log('Authority:', this.wallet.publicKey.toString());

            // Create pool's token account
            console.log('Creating pool token account...');
            let poolTokenAccount: PublicKey;
            try {
                // Create a new token account owned by the staking pool
                const tokenAccountKeypair = Keypair.generate();
                poolTokenAccount = await createAccount(
                    this.connection,
                    this.wallet.payer,
                    HUNDRED_X_MINT,
                    stakingPool,
                    tokenAccountKeypair
                );

                console.log('Pool token account created:', poolTokenAccount.toString());
            } catch (error) {
                console.error('Error creating pool token account:', error);
                throw error;
            }

            const tx = await this.program.methods
                .initialize(
                    new BN(rewardRate),
                    new BN(lockPeriod),
                    new BN(LAMPORTS_PER_SOL)
                )
                .accounts({
                    stakingPool,
                    hundredXMint: HUNDRED_X_MINT,
                    authorityTokenAccount: this.authorityTokenAccount,
                    poolTokenAccount: poolTokenAccount,
                    authority: this.wallet.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log('Pool initialized! Transaction:', tx);
            return tx;
        } catch (error) {
            console.error('Error initializing pool:', error);
            throw error;
        }
    }

    async stake(amount: number) {
        try {
            // Derive PDAs
            const [stakingPool] = PublicKey.findProgramAddressSync(
                [Buffer.from("staking_pool")],
                this.program.programId
            );
            const [stakerAccount] = PublicKey.findProgramAddressSync(
                [Buffer.from("staker"), this.wallet.publicKey.toBuffer()],
                this.program.programId
            );

            const tx = await this.program.methods
                .stake(new BN(amount))
                .accounts({
                    stakingPool,
                    stakerAccount,
                    user: this.wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log('Staked successfully! Transaction:', tx);
            return tx;
        } catch (error) {
            console.error('Error staking:', error);
            throw error;
        }
    }

    async unstake() {
        try {
            // Derive PDAs
            const [stakingPool] = PublicKey.findProgramAddressSync(
                [Buffer.from("staking_pool")],
                this.program.programId
            );
            const [stakerAccount] = PublicKey.findProgramAddressSync(
                [Buffer.from("staker"), this.wallet.publicKey.toBuffer()],
                this.program.programId
            );

            const tx = await this.program.methods
                .unstake()
                .accounts({
                    stakingPool,
                    stakerAccount,
                    user: this.wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log('Unstaked successfully! Transaction:', tx);
            return tx;
        } catch (error) {
            console.error('Error unstaking:', error);
            throw error;
        }
    }

    async claimRewards() {
        try {
            // Derive PDAs
            const [stakingPool] = PublicKey.findProgramAddressSync(
                [Buffer.from("staking_pool")],
                this.program.programId
            );
            const [stakerAccount] = PublicKey.findProgramAddressSync(
                [Buffer.from("staker"), this.wallet.publicKey.toBuffer()],
                this.program.programId
            );

            // Get user's associated token account
            const userTokenAccount = await getAssociatedTokenAddress(
                HUNDRED_X_MINT,
                this.wallet.publicKey
            );

            // Create a new token account for the pool
            const tokenAccountKeypair = Keypair.generate();
            const poolTokenAccount = await createAccount(
                this.connection,
                this.wallet.payer,
                HUNDRED_X_MINT,
                stakingPool,
                tokenAccountKeypair
            );

            // Transfer tokens from authority to pool token account
            const stats = await this.program.methods
                .getPoolStats()
                .accounts({
                    stakingPool,
                })
                .view();

            const rewardAmount = stats.totalStaked.toNumber() * stats.currentRewardRate.toNumber() / 100;
            console.log('Reward amount:', rewardAmount);

            await mintTo(
                this.connection,
                this.wallet.payer,
                HUNDRED_X_MINT,
                poolTokenAccount,
                this.wallet.publicKey,
                rewardAmount
            );

            console.log('User token account for rewards:', userTokenAccount.toString());
            console.log('Pool token account for rewards:', poolTokenAccount.toString());

            const tx = await this.program.methods
                .claimRewards()
                .accounts({
                    stakingPool,
                    stakerAccount,
                    poolTokenAccount: poolTokenAccount,
                    userTokenAccount: userTokenAccount,
                    user: this.wallet.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
                    hundredXMint: HUNDRED_X_MINT,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();

            console.log('Rewards claimed successfully! Transaction:', tx);
            return tx;
        } catch (error) {
            console.error('Error claiming rewards:', error);
            throw error;
        }
    }

    async getPoolStats() {
        try {
            const [stakingPool] = PublicKey.findProgramAddressSync(
                [Buffer.from("staking_pool")],
                this.program.programId
            );

            const stats = await this.program.methods
                .getPoolStats()
                .accounts({
                    stakingPool,
                })
                .view();

            return stats;
        } catch (error) {
            console.error('Error getting pool stats:', error);
            throw error;
        }
    }
} 