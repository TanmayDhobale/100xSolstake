'use client';

import { WalletContextProvider } from '../components/WalletProvider';
import { StakingProvider } from '../components/StakingProvider';
import { StakingInterface } from '../components/StakingInterface';

export default function Home() {
  return (
    <WalletContextProvider>
      <StakingProvider>
        <StakingInterface />
      </StakingProvider>
    </WalletContextProvider>
  );
}
