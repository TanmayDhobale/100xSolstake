import { createContext, useContext, useEffect, useState } from 'react';
import { StakingClient } from '../lib/StakingClient';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { toast } from 'react-hot-toast';

interface PoolStats {
    totalStaked: number;
    rewardRate: number;
    lockPeriod: number;
}

interface StakingInfo {
    stakedAmount: number;
    stakeTimestamp: number;
    rewardsClaimed: number;
    potentialRewards: number;
}

interface StakingContextType {
    client: StakingClient | null;
    isInitialized: boolean;
    stakingInfo: StakingInfo | null;
    poolStats: PoolStats | null;
    isLoading: boolean;
    error: string | null;
    refreshStakingInfo: () => Promise<void>;
    stake: (amount: number) => Promise<string>;
    unstake: () => Promise<string>;
    claimRewards: () => Promise<string>;
}

const StakingContext = createContext<StakingContextType>({
    client: null,
    isInitialized: false,
    stakingInfo: null,
    poolStats: null,
    isLoading: false,
    error: null,
    refreshStakingInfo: async () => {},
    stake: async () => "",
    unstake: async () => "",
    claimRewards: async () => "",
});

export const useStaking = () => useContext(StakingContext);

export const StakingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { connection } = useConnection();
    const wallet = useWallet();
    const [client, setClient] = useState<StakingClient | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);
    const [stakingInfo, setStakingInfo] = useState<StakingInfo | null>(null);
    const [poolStats, setPoolStats] = useState<PoolStats | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (wallet.connected && connection && wallet.publicKey) {
            try {
                console.log("Initializing staking client...");
                const newClient = new StakingClient(connection, wallet);
                setClient(newClient);
                setIsInitialized(true);
                setError(null);
            } catch (error) {
                console.error('Error initializing client:', error);
                setClient(null);
                setIsInitialized(false);
                setError('Failed to initialize staking client');
            }
        } else {
            setClient(null);
            setIsInitialized(false);
            setStakingInfo(null);
            setPoolStats(null);
            setError(null);
        }
    }, [wallet.connected, connection, wallet.publicKey]);

    const refreshStakingInfo = async () => {
        if (!client || !wallet.connected) return;

        try {
            setIsLoading(true);
            setError(null);

            const [info, stats] = await Promise.all([
                client.getStakerInfo(),
                client.getPoolStats()
            ]);

            setStakingInfo(info);
            setPoolStats(stats);
        } catch (error) {
            console.error('Error refreshing staking info:', error);
            setError('Failed to fetch staking information');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (client && wallet.connected) {
            refreshStakingInfo();
            const interval = setInterval(refreshStakingInfo, 30000);
            return () => clearInterval(interval);
        }
    }, [client, wallet.connected]);

    const stake = async (amount: number) => {
        if (!client || !wallet.connected) {
            throw new Error("Client not initialized or wallet not connected");
        }

        try {
            setIsLoading(true);
            setError(null);
            console.log("Starting stake transaction...");
            const signature = await client.stake(amount);
            await refreshStakingInfo();
            toast.success('Successfully staked!');
            return signature;
        } catch (error: any) {
            console.error('Error staking:', error);
            const errorMessage = error.message || 'Failed to stake';
            setError(errorMessage);
            toast.error(errorMessage);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const unstake = async () => {
        if (!client || !wallet.connected) {
            throw new Error("Client not initialized or wallet not connected");
        }

        try {
            setIsLoading(true);
            setError(null);
            const signature = await client.unstake();
            await refreshStakingInfo();
            toast.success('Successfully unstaked!');
            return signature;
        } catch (error: any) {
            console.error('Error unstaking:', error);
            const errorMessage = error.message || 'Failed to unstake';
            setError(errorMessage);
            toast.error(errorMessage);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    const claimRewards = async () => {
        if (!client || !wallet.connected) {
            throw new Error("Client not initialized or wallet not connected");
        }

        try {
            setIsLoading(true);
            setError(null);
            const signature = await client.claimRewards();
            await refreshStakingInfo();
            toast.success('Successfully claimed rewards!');
            return signature;
        } catch (error: any) {
            console.error('Error claiming rewards:', error);
            const errorMessage = error.message || 'Failed to claim rewards';
            setError(errorMessage);
            toast.error(errorMessage);
            throw error;
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <StakingContext.Provider
            value={{
                client,
                isInitialized,
                stakingInfo,
                poolStats,
                isLoading,
                error,
                refreshStakingInfo,
                stake,
                unstake,
                claimRewards,
            }}
        >
            {children}
        </StakingContext.Provider>
    );
}; 