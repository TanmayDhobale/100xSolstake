import { PublicKey } from '@solana/web3.js';

export const DEVNET_URL = 'https://api.devnet.solana.com';
export const HUNDRED_X_MINT = new PublicKey('9CGUcCcmTTGwN6JdgnwWfUhH6CHK7MWdHYcxjRWYpeeN');
export const TOKEN_ACCOUNT = new PublicKey('9JMmP3GTcF9GT7YJwEGjnZPiXshf7y7BoWK4rJFtKqEw');
export const PROGRAM_ID = new PublicKey('3cWLYDBry2fH6aXkNMPABMRDAUgsjZTHzX6wdfgYNRPt');

// Network configuration
export const NETWORK = 'devnet';

// Default values for pool initialization
export const DEFAULT_REWARD_RATE = 100; // 100x rewards
export const DEFAULT_LOCK_PERIOD = 86400; // 1 day in seconds 