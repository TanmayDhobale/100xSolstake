import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useStaking } from './StakingProvider';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import ClientOnly from './ClientOnly';
import { toast } from 'react-hot-toast';

export function StakingInterface() {
    const { connected, publicKey } = useWallet();
    const { poolStats, stakingInfo, isLoading, error, stake, unstake, claimRewards } = useStaking();
    const [stakeAmount, setStakeAmount] = useState('');

    const handleStake = async () => {
        if (!stakeAmount) return;
        try {
            console.log('Starting stake process...');
            console.log('Wallet connected:', connected);
            console.log('Public key:', publicKey?.toString());
            console.log('Stake amount:', stakeAmount);
            
            const amount = parseFloat(stakeAmount);
            console.log('Parsed amount:', amount);
            
            // Check if user has an active stake
            if (stakingInfo && stakingInfo.stakedAmount > 0) {
                toast.error('You already have an active stake. Please unstake first.');
                return;
            }
            
            console.log('Calling stake function...');
            const tx = await stake(amount);
            console.log('Stake transaction completed:', tx);
            toast.success('Successfully staked!');
            
            setStakeAmount('');
        } catch (err) {
            console.error('Error in handleStake:', err);
            if (err instanceof Error) {
                if (err.message.includes('active stake')) {
                    toast.error('You already have an active stake. Please unstake first.');
                } else {
                    toast.error(err.message);
                }
            }
        }
    };

    const handleUnstake = async () => {
        try {
            // Check if user has any stake
            if (!stakingInfo || stakingInfo.stakedAmount === 0) {
                toast.error('You have no SOL staked to unstake');
                return;
            }

            // Check if lock period has passed
            const now = Math.floor(Date.now() / 1000);
            if (now < stakingInfo.stakeTimestamp + (poolStats?.lockPeriod || 0)) {
                toast.error('Lock period has not passed yet. Please wait before unstaking.');
                return;
            }

            const tx = await unstake();
            console.log('Unstake transaction:', tx);
            toast.success('Successfully unstaked!');
        } catch (err) {
            console.error('Error unstaking:', err);
            if (err instanceof Error) {
                if (err.message.includes('No stake found')) {
                    toast.error('You have no SOL staked to unstake');
                } else if (err.message.includes('LockPeriodNotOver')) {
                    toast.error('Lock period has not passed yet. Please wait before unstaking.');
                } else {
                    toast.error(err.message);
                }
            }
        }
    };

    const handleClaimRewards = async () => {
        try {
            // Check if user has any stake
            if (!stakingInfo || stakingInfo.stakedAmount === 0) {
                toast.error('You have no SOL staked to claim rewards from');
                return;
            }

            // Check if there are any rewards to claim
            if (stakingInfo.potentialRewards <= 0) {
                toast.error('No rewards available to claim');
                return;
            }

            const tx = await claimRewards();
            console.log('Claim rewards transaction:', tx);
            toast.success('Successfully claimed rewards!');
        } catch (err) {
            console.error('Error claiming rewards:', err);
            if (err instanceof Error) {
                if (err.message.includes('No stake found')) {
                    toast.error('You have no SOL staked to claim rewards from');
                } else if (err.message.includes('InsufficientPoolTokens')) {
                    toast.error('Insufficient rewards available in the pool');
                } else if (err.message.includes('simulation')) {
                    toast.error('Transaction simulation failed. Please try again.');
                } else {
                    toast.error(err.message);
                }
            }
        }
    };

    if (!connected) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-blue-500 to-purple-600">
                <div className="bg-white p-8 rounded-xl shadow-2xl text-center">
                    <h1 className="text-3xl font-bold mb-6 text-gray-800">Welcome to 100x Staking</h1>
                    <p className="text-gray-600 mb-8">Connect your wallet to start staking</p>
                    <ClientOnly>
                        <WalletMultiButton className="!bg-blue-600 hover:!bg-blue-700 transition-colors" />
                    </ClientOnly>
                </div>
            </div>
        );
    }

    return (
        <ClientOnly>
            <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
                <div className="max-w-3xl mx-auto space-y-8">
                    <div className="text-center">
                        <h1 className="text-3xl font-bold text-gray-900 mb-8">Solana Staking Interface</h1>
                        <div className="flex justify-center mb-8">
                            <WalletMultiButton />
                        </div>
                    </div>

                    {connected && (
                        <div className="space-y-8">
                            {poolStats && (
                                <div className="bg-white p-6 rounded-lg shadow">
                                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Pool Statistics</h2>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-500">Total Staked</p>
                                            <p className="text-lg font-medium">{poolStats.totalStaked / LAMPORTS_PER_SOL} SOL</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Reward Rate</p>
                                            <p className="text-lg font-medium">{poolStats.rewardRate}x</p>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {stakingInfo && stakingInfo.stakedAmount > 0 ? (
                                <div className="bg-white p-6 rounded-lg shadow">
                                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Your Stake</h2>
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm text-gray-500">Staked Amount</p>
                                            <p className="text-lg font-medium">{stakingInfo.stakedAmount / LAMPORTS_PER_SOL} SOL</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Potential Rewards</p>
                                            <p className="text-lg font-medium">{stakingInfo.potentialRewards} tokens</p>
                                        </div>
                                        <div className="flex space-x-4">
                                            <button
                                                onClick={handleUnstake}
                                                disabled={isLoading}
                                                className="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400"
                                            >
                                                {isLoading ? 'Processing...' : 'Unstake'}
                                            </button>
                                            <button
                                                onClick={handleClaimRewards}
                                                disabled={isLoading}
                                                className="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
                                            >
                                                {isLoading ? 'Processing...' : 'Claim Rewards'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-gray-50 p-6 rounded-lg">
                                    <h2 className="text-xl font-semibold mb-4 text-gray-700">Stake SOL</h2>
                                    <div className="space-y-4">
                                        <div>
                                            <input
                                                type="number"
                                                value={stakeAmount}
                                                onChange={(e) => setStakeAmount(e.target.value)}
                                                placeholder="Amount in SOL"
                                                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                disabled={isLoading}
                                            />
                                        </div>
                                        <button
                                            onClick={handleStake}
                                            disabled={isLoading || !stakeAmount || !connected}
                                            className="w-full bg-blue-600 text-white py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400"
                                        >
                                            {!connected ? 'Connect Wallet First' : isLoading ? 'Processing...' : 'Stake'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </ClientOnly>
    );
} 