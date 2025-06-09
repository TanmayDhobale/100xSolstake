import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { StakingProvider } from './components/StakingProvider';
import { StakingForm } from './components/StakingForm';
import { StakingInfo } from './components/StakingInfo';
import { WalletContextProvider } from './components/WalletContextProvider';

function App() {
    return (
        <WalletContextProvider>
            <StakingProvider>
                <div className="min-h-screen bg-gray-900 text-white">
                    <div className="container mx-auto px-4 py-8">
                        <div className="flex justify-between items-center mb-8">
                            <h1 className="text-3xl font-bold">Solana Staking App</h1>
                            <WalletMultiButton />
                        </div>
                        
                        <div className="space-y-8">
                            <StakingInfo />
                            <StakingForm />
                        </div>
                    </div>
                </div>
            </StakingProvider>
        </WalletContextProvider>
    );
}

export default App; 