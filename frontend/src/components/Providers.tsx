'use client';

import { WalletContextProvider } from './WalletContextProvider';
import { StakingProvider } from './StakingProvider';

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <WalletContextProvider>
            <StakingProvider>
                {children}
            </StakingProvider>
        </WalletContextProvider>
    );
} 