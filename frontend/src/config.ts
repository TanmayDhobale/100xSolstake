import { PublicKey } from '@solana/web3.js';

// Network
export const DEVNET_URL = 'https://api.devnet.solana.com';

// Program and Token Configuration
export const PROGRAM_ID = new PublicKey('3cWLYDBry2fH6aXkNMPABMRDAUgsjZTHzX6wdfgYNRPt');
export const HUNDRED_X_MINT = new PublicKey('9CGUcCcmTTGwN6JdgnwWfUhH6CHK7MWdHYcxjRWYpeeN');

// Staking Configuration
export const DEFAULT_REWARD_RATE = 100;
export const DEFAULT_LOCK_PERIOD = 15180; // 4.2 hours in seconds 