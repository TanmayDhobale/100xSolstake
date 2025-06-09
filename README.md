# Solana Staking DApp

A decentralized staking application built on Solana that allows users to stake SOL and earn rewards in custom tokens.

<img width="464" alt="Screenshot 2025-06-09 at 3 23 05 PM" src="https://github.com/user-attachments/assets/6148ba5a-c9eb-4b91-87a5-2d379d125236" />

## Features

- 🌟 Stake SOL tokens and earn rewards
- 🔒 Configurable lock period for staked tokens
- 💰 Dynamic reward rates
- 🎯 Real-time staking statistics
- 🔄 Automatic reward calculations
- 📊 User-friendly dashboard
- 🔐 Secure wallet integration

## Technical Stack

- Frontend:
  - React.js with TypeScript
  - Tailwind CSS for styling
  - @solana/wallet-adapter for wallet integration
  - @solana/web3.js for Solana blockchain interaction

- Smart Contract:
  - Anchor framework
  - Solana Program Library (SPL) Token standard
  - Rust programming language

## Prerequisites

- Node.js v14+ and npm
- Rust and Cargo
- Solana CLI tools
- Anchor Framework
- A Solana wallet (e.g., Phantom)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd solana-staking-dapp
```

2. Install dependencies:
```bash
# Install frontend dependencies
cd frontend
npm install

# Install Anchor dependencies
cd ../hundred_x_staking
npm install
```

3. Configure environment variables:
```bash
# Create .env file in the frontend directory
cp .env.example .env
```

## Smart Contract Setup

1. Build the Anchor program:
```bash
cd hundred_x_staking
anchor build
```

2. Deploy the program:
```bash
anchor deploy
```

3. Initialize the staking pool:
```bash
npm run init-pool
```

## Running the Application

1. Start the frontend development server:
```bash
cd frontend
npm run dev
```

2. Open your browser and navigate to `http://localhost:3000`

## Core Features

### Staking Pool
- Configurable reward rate (1-1000x)
- Customizable lock period (1 day to 1 year)
- Automatic reward distribution
- Pool statistics tracking

### User Operations
- Stake SOL tokens
- Unstake tokens after lock period
- Claim rewards in custom tokens
- View staking statistics

### Security Features
- PDA-based account management
- Secure token transfers
- Lock period enforcement
- Overflow protection
- Input validation

## Smart Contract Architecture

### Key Accounts
1. StakingPool
   - Manages total staked amount
   - Tracks reward distribution
   - Controls lock period and reward rate

2. StakerAccount
   - Individual staker information
   - Tracks staked amount and timestamp
   - Manages rewards claimed

### Program Instructions
1. `initialize` - Set up staking pool
2. `stake` - Stake SOL tokens
3. `unstake` - Withdraw staked tokens
4. `claimRewards` - Claim earned rewards
5. `getPoolStats` - Fetch pool statistics

## Error Handling

The program includes comprehensive error handling for:
- Invalid stake amounts
- Insufficient funds
- Lock period violations
- Pool overflow protection
- Token account validation
- Calculation errors

## Configuration

Default values can be modified in `frontend/src/config.ts`:
- DEFAULT_REWARD_RATE: 100
- MIN_LOCK_PERIOD: 1 day
- MAX_LOCK_PERIOD: 1 year
- MIN_REWARD_RATE: 1
- MAX_REWARD_RATE: 1000

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License.
