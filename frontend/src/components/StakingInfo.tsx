import { useStaking } from './StakingProvider';
import { useWallet } from '@solana/wallet-adapter-react';
import { formatDistance } from 'date-fns';

export const StakingInfo: React.FC = () => {
    const { stakingInfo, poolStats } = useStaking();
    const { connected } = useWallet();

    if (!connected) {
        return (
            <div className="p-4 bg-gray-800 rounded-lg text-white">
                <p>Connect your wallet to view staking information</p>
            </div>
        );
    }

    if (!stakingInfo) {
        return (
            <div className="p-4 bg-gray-800 rounded-lg text-white">
                <p>Loading staking information...</p>
            </div>
        );
    }

    const stakeDate = new Date(stakingInfo.stakeTimestamp * 1000);
    const timeStaked = formatDistance(stakeDate, new Date(), { addSuffix: true });

    return (
        <div className="p-6 bg-gray-800 rounded-lg text-white space-y-4">
            <h2 className="text-2xl font-bold mb-4">Your Staking Overview</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-300">Staked Amount</h3>
                    <p className="text-2xl font-bold">{stakingInfo.stakedAmount.toFixed(4)} SOL</p>
                </div>

                <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-300">Potential Rewards</h3>
                    <p className="text-2xl font-bold text-green-400">{stakingInfo.potentialRewards.toFixed(4)} SOL</p>
                </div>

                <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-300">Time Staked</h3>
                    <p className="text-xl">{timeStaked}</p>
                </div>

                <div className="bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-300">Rewards Claimed</h3>
                    <p className="text-xl">{stakingInfo.rewardsClaimed.toFixed(4)} SOL</p>
                </div>
            </div>

            {poolStats && (
                <div className="mt-6 bg-gray-700 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-gray-300 mb-2">Pool Information</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-gray-400">Total Staked</p>
                            <p className="text-xl">{(poolStats.totalStaked / 1e9).toFixed(2)} SOL</p>
                        </div>
                        <div>
                            <p className="text-gray-400">Reward Rate</p>
                            <p className="text-xl">{poolStats.rewardRate}%</p>
                        </div>
                        <div>
                            <p className="text-gray-400">Lock Period</p>
                            <p className="text-xl">{poolStats.lockPeriod / 3600} hours</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}; 