import {
    Connection,
    PublicKey,
} from '@solana/web3.js';
import {
    createAssociatedTokenAccount,
    getAssociatedTokenAddress,
    getAccount,
} from '@solana/spl-token';
import * as anchor from '@project-serum/anchor';
import { DEVNET_URL, HUNDRED_X_MINT } from './config';

export async function setupWallet(wallet: anchor.Wallet) {
    const connection = new Connection(DEVNET_URL, 'confirmed');

    // Create associated token account for 100x token
    console.log('Creating associated token account...');
    const ata = await getAssociatedTokenAddress(
        HUNDRED_X_MINT,
        wallet.publicKey
    );
    
    try {
        await createAssociatedTokenAccount(
            connection,
            wallet.payer,
            HUNDRED_X_MINT,
            wallet.publicKey
        );
        console.log('Associated token account created:', ata.toString());
    } catch (error) {
        console.log('Associated token account might already exist:', ata.toString());
    }

    return ata;
}

export async function setupAuthorityTokenAccount(wallet: anchor.Wallet) {
    const connection = new Connection(DEVNET_URL, 'confirmed');

    // Create associated token account for authority
    console.log('Creating authority token account...');
    const ata = await getAssociatedTokenAddress(
        HUNDRED_X_MINT,
        wallet.publicKey
    );
    
    try {
        await createAssociatedTokenAccount(
            connection,
            wallet.payer,
            HUNDRED_X_MINT,
            wallet.publicKey
        );
        console.log('Authority token account created:', ata.toString());
    } catch (error) {
        console.log('Authority token account might already exist:', ata.toString());
    }

    // Check token balance
    try {
        const tokenAccount = await getAccount(connection, ata);
        console.log('Authority token balance:', tokenAccount.amount.toString());
    } catch (error) {
        console.log('Error checking token balance:', error);
    }

    return ata;
} 