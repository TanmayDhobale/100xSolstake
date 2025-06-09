use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::{
    token::{self, Mint, Token, TokenAccount},
    associated_token::AssociatedToken,
};

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");
pub const MIN_LOCK_PERIOD: i64 = 1 * 24 * 60 * 60; // 1 day in seconds
pub const MAX_LOCK_PERIOD: i64 = 365 * 24 * 60 * 60; // 1 year in seconds
pub const MIN_REWARD_RATE: u64 = 1;
pub const MAX_REWARD_RATE: u64 = 1000; // 1000x reward rate maximum
pub const LAMPORTS_PER_SOL: u64 = 1_000_000_000;

#[program]
pub mod hundred_x_staking {
    use super::*;

    // Initialize the staking pool
    pub fn initialize(
        ctx: Context<Initialize>,
        reward_rate: u64,
        lock_period: i64,
        pool_token_amount: u64,  
    ) -> Result<()> {
      
        require!(
            reward_rate >= MIN_REWARD_RATE && reward_rate <= MAX_REWARD_RATE,
            StakingError::InvalidRewardRate
        );
        require!(
            lock_period >= MIN_LOCK_PERIOD && lock_period <= MAX_LOCK_PERIOD,
            StakingError::InvalidLockPeriod
        );
        require!(pool_token_amount > 0, StakingError::InvalidPoolTokenAmount);


        let staking_pool = &mut ctx.accounts.staking_pool;
        staking_pool.authority = ctx.accounts.authority.key();
        staking_pool.hundred_x_mint = ctx.accounts.hundred_x_mint.key();
        staking_pool.reward_rate = reward_rate;
        staking_pool.lock_period = lock_period;
        staking_pool.total_staked = 0;
        staking_pool.total_rewards_distributed = 0;
        staking_pool.available_rewards = pool_token_amount;
        staking_pool.bump = ctx.bumps.staking_pool;

     
        let cpi_accounts = token::Transfer {
            from: ctx.accounts.authority_token_account.to_account_info(),
            to: ctx.accounts.pool_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, pool_token_amount)?;

        Ok(())
    }

   
    pub fn add_rewards(
        ctx: Context<AddRewards>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, StakingError::InvalidAmount);

        let staking_pool = &mut ctx.accounts.staking_pool;
        
      
        let cpi_accounts = token::Transfer {
            from: ctx.accounts.authority_token_account.to_account_info(),
            to: ctx.accounts.pool_token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // Update pool rewards
        staking_pool.available_rewards = staking_pool.available_rewards
            .checked_add(amount)
            .ok_or(StakingError::CalculationError)?;

        Ok(())
    }

    // Stake SOL
    pub fn stake(ctx: Context<Stake>, amount: u64) -> Result<()> {
        // Validate stake amount
        require!(amount > 0, StakingError::InvalidStakeAmount);
        require!(
            amount <= ctx.accounts.user.lamports(),
            StakingError::InsufficientFunds
        );


        require!(
            ctx.accounts.staking_pool.total_staked.checked_add(amount).is_some(),
            StakingError::PoolOverflow
        );

      
        let ix = anchor_lang::solana_program::system_instruction::transfer(
            &ctx.accounts.user.key(),
            &ctx.accounts.staking_pool.key(),
            amount,
        );
        anchor_lang::solana_program::program::invoke(
            &ix,
            &[
                ctx.accounts.user.to_account_info(),
                ctx.accounts.staking_pool.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
        )?;

     
        let staker = &mut ctx.accounts.staker_account;
        staker.owner = ctx.accounts.user.key();
        staker.staked_amount = amount;
        staker.stake_timestamp = Clock::get()?.unix_timestamp;
        staker.rewards_claimed = 0;
        
        // Update pool info
        let staking_pool = &mut ctx.accounts.staking_pool;
        staking_pool.total_staked = staking_pool.total_staked.checked_add(amount).unwrap();

        Ok(())
    }


    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let staking_pool = &ctx.accounts.staking_pool;
        let staker = &mut ctx.accounts.staker_account;
        
    
        require!(
            ctx.accounts.pool_token_account.mint == staking_pool.hundred_x_mint,
            StakingError::InvalidTokenAccount
        );
        require!(
            ctx.accounts.user_token_account.mint == staking_pool.hundred_x_mint,
            StakingError::InvalidTokenAccount
        );
        require!(
            ctx.accounts.user_token_account.owner == ctx.accounts.user.key(),
            StakingError::InvalidTokenAccountOwner
        );

        // Calculate rewards with safe math
        let current_time = Clock::get()?.unix_timestamp;
        let time_staked = current_time.checked_sub(staker.stake_timestamp)
            .ok_or(StakingError::CalculationError)?;
        
        let rewards = (staker.staked_amount as u128)
            .checked_mul(staking_pool.reward_rate as u128)
            .ok_or(StakingError::CalculationError)?
            .checked_mul(time_staked as u128)
            .ok_or(StakingError::CalculationError)?
            .checked_div(LAMPORTS_PER_SOL as u128)
            .ok_or(StakingError::CalculationError)? as u64;

        let rewards_to_claim = rewards.checked_sub(staker.rewards_claimed)
            .ok_or(StakingError::CalculationError)?;


        require!(
            ctx.accounts.pool_token_account.amount >= rewards_to_claim,
            StakingError::InsufficientPoolTokens
        );


        let pool_seeds = &[
            b"staking_pool".as_ref(),
            &[staking_pool.bump],
        ];
        let signer = &[&pool_seeds[..]];

        let cpi_accounts = token::Transfer {
            from: ctx.accounts.pool_token_account.to_account_info(),
            to: ctx.accounts.user_token_account.to_account_info(),
            authority: ctx.accounts.staking_pool.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);

        token::transfer(cpi_ctx, rewards_to_claim)?;

        // Update staker info with safe math
        staker.rewards_claimed = staker.rewards_claimed.checked_add(rewards_to_claim)
            .ok_or(StakingError::CalculationError)?;

        Ok(())
    }


    pub fn unstake(ctx: Context<Unstake>) -> Result<()> {
        let staker = &ctx.accounts.staker_account;
        

        require!(
            staker.owner == ctx.accounts.user.key(),
            StakingError::InvalidStakerOwner
        );

        // Check lock period
        let current_time = Clock::get()?.unix_timestamp;
        require!(
            current_time >= staker.stake_timestamp + ctx.accounts.staking_pool.lock_period,
            StakingError::LockPeriodNotOver
        );


        let unstake_amount = staker.staked_amount;


        let pool_lamports = ctx.accounts.staking_pool.to_account_info().lamports();
        require!(
            pool_lamports >= unstake_amount,
            StakingError::InsufficientPoolBalance
        );


        **ctx.accounts.staking_pool.to_account_info().try_borrow_mut_lamports()? = pool_lamports
            .checked_sub(unstake_amount)
            .ok_or(StakingError::CalculationError)?;
        **ctx.accounts.user.try_borrow_mut_lamports()? = ctx.accounts.user.lamports()
            .checked_add(unstake_amount)
            .ok_or(StakingError::CalculationError)?;

        // Update pool info
        let staking_pool = &mut ctx.accounts.staking_pool;
        staking_pool.total_staked = staking_pool.total_staked
            .checked_sub(unstake_amount)
            .ok_or(StakingError::CalculationError)?;

        Ok(())
    }

 
    pub fn get_pool_stats(ctx: Context<GetPoolStats>) -> Result<PoolStats> {
        let pool = &ctx.accounts.staking_pool;
        Ok(PoolStats {
            total_staked: pool.total_staked,
            available_rewards: pool.available_rewards,
            total_rewards_distributed: pool.total_rewards_distributed,
            current_reward_rate: pool.reward_rate,
            lock_period: pool.lock_period,
        })
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1,
        seeds = [b"staking_pool".as_ref()],
        bump
    )]
    pub staking_pool: Account<'info, StakingPool>,
    pub hundred_x_mint: Account<'info, Mint>,
    #[account(mut)]
    pub authority_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AddRewards<'info> {
    #[account(mut, seeds = [b"staking_pool".as_ref()], bump = staking_pool.bump)]
    pub staking_pool: Account<'info, StakingPool>,
    #[account(mut)]
    pub authority_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct GetPoolStats<'info> {
    #[account(seeds = [b"staking_pool".as_ref()], bump = staking_pool.bump)]
    pub staking_pool: Account<'info, StakingPool>,
}

#[derive(Accounts)]
pub struct Stake<'info> {
    #[account(mut, seeds = [b"staking_pool".as_ref()], bump = staking_pool.bump)]
    pub staking_pool: Account<'info, StakingPool>,
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 8 + 8 + 8,
        seeds = [b"staker".as_ref(), user.key().as_ref()],
        bump
    )]
    pub staker_account: Account<'info, StakerAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut, seeds = [b"staking_pool".as_ref()], bump = staking_pool.bump)]
    pub staking_pool: Account<'info, StakingPool>,
    #[account(mut, seeds = [b"staker".as_ref(), user.key().as_ref()], bump)]
    pub staker_account: Account<'info, StakerAccount>,
    #[account(mut)]
    pub pool_token_account: Account<'info, TokenAccount>,
    #[account(
        mut,
        associated_token::mint = hundred_x_mint,
        associated_token::authority = user
    )]
    pub user_token_account: Account<'info, TokenAccount>,
    pub user: Signer<'info>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub hundred_x_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Unstake<'info> {
    #[account(mut, seeds = [b"staking_pool".as_ref()], bump = staking_pool.bump)]
    pub staking_pool: Account<'info, StakingPool>,
    #[account(
        mut,
        seeds = [b"staker".as_ref(), user.key().as_ref()],
        bump,
        close = user
    )]
    pub staker_account: Account<'info, StakerAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct StakingPool {
    pub authority: Pubkey,
    pub hundred_x_mint: Pubkey,
    pub reward_rate: u64,
    pub lock_period: i64,
    pub total_staked: u64,
    pub total_rewards_distributed: u64,
    pub available_rewards: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize)]
pub struct PoolStats {
    pub total_staked: u64,
    pub available_rewards: u64,
    pub total_rewards_distributed: u64,
    pub current_reward_rate: u64,
    pub lock_period: i64,
}

#[account]
pub struct StakerAccount {
    pub owner: Pubkey,
    pub staked_amount: u64,
    pub stake_timestamp: i64,
    pub rewards_claimed: u64,
}

#[error_code]
pub enum StakingError {
    #[msg("Lock period is not over yet")]
    LockPeriodNotOver,
    #[msg("Invalid reward rate")]
    InvalidRewardRate,
    #[msg("Invalid lock period")]
    InvalidLockPeriod,
    #[msg("Invalid mint authority")]
    InvalidMintAuthority,
    #[msg("Invalid stake amount")]
    InvalidStakeAmount,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Pool overflow")]
    PoolOverflow,
    #[msg("Invalid token account")]
    InvalidTokenAccount,
    #[msg("Invalid token account owner")]
    InvalidTokenAccountOwner,
    #[msg("Calculation error")]
    CalculationError,
    #[msg("Insufficient pool tokens")]
    InsufficientPoolTokens,
    #[msg("Invalid staker owner")]
    InvalidStakerOwner,
    #[msg("Insufficient pool balance")]
    InsufficientPoolBalance,
    #[msg("Invalid pool token amount")]
    InvalidPoolTokenAmount,
    #[msg("Invalid amount")]
    InvalidAmount,
}
