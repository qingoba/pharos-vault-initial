'use client';

/**
 * Transparency Dashboard Page
 * Full-featured dashboard showing vault health, zk-POR, tranches, and keeper status
 */

import { useVaultInfo, usePoR, useTranches, useKeeperStatus, useMounted } from '@/hooks';
import { useChainId } from 'wagmi';
import { getContracts } from '@/lib/contracts';
import { formatUnits } from 'viem';

// ─── Helpers ──────────────────────────────────────────────
function formatUSD(val: bigint | undefined, decimals = 6): string {
  if (!val) return '$0.00';
  const n = Number(formatUnits(val, decimals));
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`;
  return `$${n.toFixed(2)}`;
}

function timeAgo(ts: number): string {
  if (!ts) return 'Never';
  const delta = Math.floor(Date.now() / 1000) - ts;
  if (delta < 60) return `${delta}s ago`;
  if (delta < 3600) return `${Math.floor(delta / 60)}m ago`;
  if (delta < 86400) return `${Math.floor(delta / 3600)}h ago`;
  return `${Math.floor(delta / 86400)}d ago`;
}

// ─── Badge ────────────────────────────────────────────────
function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
        ok ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
      }`}
    >
      <span className={`w-2 h-2 rounded-full ${ok ? 'bg-green-500' : 'bg-red-500'}`} />
      {label}
    </span>
  );
}

// ─── Card wrapper ─────────────────────────────────────────
function Card({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-6 ${className}`}>
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export default function TransparencyPage() {
  const mounted = useMounted();
  const chainId = useChainId();
  const contracts = getContracts(chainId);
  const { vaultData, isLoading: vaultLoading, tvl, projectedApr, realizedApr, maxDrawdownPercent } = useVaultInfo();
  const { isHealthy, latestProof, proofCount, reserveRatio, isDeployed: porDeployed } = usePoR();
  const { trancheData, juniorYield, isDeployed: trancheDeployed, seniorAPR } = useTranches();
  const { upkeepNeeded, gelatoCanExec, nextHarvestIndex, isDeployed: keeperDeployed } = useKeeperStatus();

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Transparency Dashboard</h1>
        <p className="text-gray-500 mt-1">
          On-chain verifiable vault health, reserves, and risk breakdown
        </p>
      </div>

      {/* ─── Row 1: Key Metrics ──────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card title="TVL">
          <p className="text-2xl font-bold text-gray-900">
            {vaultLoading ? '...' : `$${tvl}`}
          </p>
        </Card>
        <Card title="Projected / Realized APY">
          <p className="text-xl font-bold text-green-600">
            {vaultLoading ? '...' : `${projectedApr}% / ${realizedApr}%`}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Projected bucket weight + realized PPS annualization
          </p>
        </Card>
        <Card title="Idle / Pending / Deployed">
          <p className="text-lg font-bold text-gray-900">
            {vaultData
              ? `${formatUSD(vaultData.idleAssets)} / ${formatUSD(vaultData.pendingAssets)} / ${formatUSD(vaultData.deployedAssets)}`
              : '...'}
          </p>
        </Card>
        <Card title="Price Per Share">
          <p className="text-lg font-bold text-gray-900">
            {vaultData && vaultData.totalSupply > 0n
              ? `${((Number(vaultData.totalAssets) / Number(vaultData.totalSupply)) * 1).toFixed(6)}`
              : '1.000000'}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Max drawdown: {vaultLoading ? '...' : `${maxDrawdownPercent}%`}
          </p>
        </Card>
      </div>

      {/* ─── Row 2: zk-POR + Keeper ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* zk-POR */}
        <Card title="Proof of Reserves (zk-POR)">
          {!porDeployed ? (
            <div className="text-sm text-yellow-600 bg-yellow-50 rounded-lg p-3">
              PorRegistry not deployed yet. Deploy to enable zk-POR verification.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Reserve Health</span>
                <StatusBadge ok={isHealthy} label={isHealthy ? 'Healthy' : 'Under-reserved'} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Reserve Ratio</span>
                <span className="text-lg font-bold text-gray-900">
                  {reserveRatio > 0 ? `${reserveRatio.toFixed(2)}%` : 'N/A'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Total Proofs</span>
                <span className="text-sm font-medium text-gray-700">{proofCount}</span>
              </div>
              {latestProof && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Last Attestation</span>
                    <span className="text-sm text-gray-700">
                      {mounted ? timeAgo(latestProof.timestamp) : '...'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Reserves</span>
                    <span className="text-sm font-mono text-gray-700">
                      {formatUSD(latestProof.totalReserves)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Liabilities</span>
                    <span className="text-sm font-mono text-gray-700">
                      {formatUSD(latestProof.totalLiabilities)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Proof Verified</span>
                    <StatusBadge
                      ok={latestProof.verified}
                      label={latestProof.verified ? 'Verified' : 'Failed'}
                    />
                  </div>
                </>
              )}
            </div>
          )}
        </Card>

        {/* Keeper Status */}
        <Card title="Keeper / Auto-Compound">
          {!keeperDeployed ? (
            <div className="text-sm text-yellow-600 bg-yellow-50 rounded-lg p-3">
              Vault not deployed. Keeper status unavailable.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Chainlink Upkeep Needed</span>
                <StatusBadge
                  ok={!upkeepNeeded}
                  label={upkeepNeeded ? 'Harvest Ready' : 'Up to Date'}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Gelato Executable</span>
                <StatusBadge
                  ok={!gelatoCanExec}
                  label={gelatoCanExec ? 'Executable' : 'Idle'}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Next Harvest Index</span>
                <span className="text-sm font-mono text-gray-700">{nextHarvestIndex}</span>
              </div>
              <div className="text-xs text-gray-400 mt-2">
                Keepers automatically harvest strategies in round-robin order for optimal gas
                efficiency. Compatible with both Chainlink Automation and Gelato Ops.
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* ─── Row 3: Tranches ────────────────────────────── */}
      <Card title="Risk Tranches (Senior / Junior Waterfall)">
        {!trancheDeployed ? (
          <div className="text-sm text-yellow-600 bg-yellow-50 rounded-lg p-3">
            TrancheManager not deployed. Deploy to enable risk-split deposits.
          </div>
        ) : trancheData ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Senior */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full bg-blue-500" />
                  <h4 className="font-semibold text-blue-900">Senior Tranche</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-600">Deposits</span>
                    <span className="font-medium">{formatUSD(trancheData.seniorDeposits)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Total Value</span>
                    <span className="font-medium">{formatUSD(trancheData.seniorTotalAssets)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-600">Target APR</span>
                    <span className="font-medium">{seniorAPR}%</span>
                  </div>
                  <div className="text-xs text-blue-500 mt-2">
                    Priority yield distribution. Protected by junior tranche.
                  </div>
                </div>
              </div>

              {/* Junior */}
              <div className="bg-purple-50 border border-purple-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full bg-purple-500" />
                  <h4 className="font-semibold text-purple-900">Junior Tranche</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-purple-600">Deposits</span>
                    <span className="font-medium">{formatUSD(trancheData.juniorDeposits)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-600">Total Value</span>
                    <span className="font-medium">{formatUSD(trancheData.juniorTotalAssets)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-600">Yield Earned</span>
                    <span className="font-medium">
                      {juniorYield >= 0 ? `+${juniorYield}` : juniorYield}
                    </span>
                  </div>
                  <div className="text-xs text-purple-500 mt-2">
                    Higher yield potential. Absorbs first losses.
                  </div>
                </div>
              </div>

              {/* Pool Summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-3 h-3 rounded-full bg-gray-500" />
                  <h4 className="font-semibold text-gray-900">Pool Summary</h4>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Managed</span>
                    <span className="font-medium">{formatUSD(trancheData.totalManagedAssets)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Last Waterfall</span>
                    <span className="font-medium">{timeAgo(trancheData.lastWaterfallTime)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Senior Ratio</span>
                    <span className="font-medium">
                      {trancheData.seniorDeposits + trancheData.juniorDeposits > 0n
                        ? `${(
                            (Number(trancheData.seniorDeposits) /
                              Number(
                                trancheData.seniorDeposits + trancheData.juniorDeposits
                              )) *
                            100
                          ).toFixed(1)}%`
                        : '0%'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual bar */}
            {trancheData.seniorDeposits + trancheData.juniorDeposits > 0n && (
              <div>
                <div className="text-xs text-gray-400 mb-1">Allocation</div>
                <div className="w-full h-4 rounded-full bg-gray-200 flex overflow-hidden">
                  <div
                    className="bg-blue-500 h-full transition-all"
                    style={{
                      width: `${
                        (Number(trancheData.seniorDeposits) /
                          Number(
                            trancheData.seniorDeposits + trancheData.juniorDeposits
                          )) *
                        100
                      }%`,
                    }}
                  />
                  <div
                    className="bg-purple-500 h-full transition-all"
                    style={{
                      width: `${
                        (Number(trancheData.juniorDeposits) /
                          Number(
                            trancheData.seniorDeposits + trancheData.juniorDeposits
                          )) *
                        100
                      }%`,
                    }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Senior</span>
                  <span>Junior</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="animate-pulse h-32 bg-gray-100 rounded-lg" />
        )}
      </Card>

      {/* ─── Row 4: Asset Composition ───────────────────── */}
      <Card title="Asset Composition">
        {vaultData ? (
          <div className="space-y-4">
            {/* Idle vs Pending vs Deployed bar */}
            <div>
              <div className="flex justify-between text-sm text-gray-500 mb-1">
                <span>Idle</span>
                <span>Pending</span>
                <span>Deployed to Strategies</span>
              </div>
              <div className="w-full h-6 rounded-full bg-gray-100 flex overflow-hidden">
                {vaultData.totalAssets > 0n && (
                  <>
                    <div
                      className="bg-emerald-400 h-full transition-all flex items-center justify-center text-[10px] text-white font-bold"
                      style={{
                        width: `${
                          (Number(vaultData.idleAssets) / Number(vaultData.totalAssets)) * 100
                        }%`,
                      }}
                    >
                      {(
                        (Number(vaultData.idleAssets) / Number(vaultData.totalAssets)) *
                        100
                      ).toFixed(0)}
                      %
                    </div>
                    <div
                      className="bg-amber-500 h-full transition-all flex items-center justify-center text-[10px] text-white font-bold"
                      style={{
                        width: `${
                          (Number(vaultData.pendingAssets) / Number(vaultData.totalAssets)) * 100
                        }%`,
                      }}
                    >
                      {(
                        (Number(vaultData.pendingAssets) / Number(vaultData.totalAssets)) *
                        100
                      ).toFixed(0)}
                      %
                    </div>
                    <div
                      className="bg-sky-500 h-full transition-all flex items-center justify-center text-[10px] text-white font-bold"
                      style={{
                        width: `${
                          (Number(vaultData.deployedAssets) / Number(vaultData.totalAssets)) * 100
                        }%`,
                      }}
                    >
                      {(
                        (Number(vaultData.deployedAssets) / Number(vaultData.totalAssets)) *
                        100
                      ).toFixed(0)}
                      %
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Strategies table */}
            <div className="text-sm">
              <div className="font-medium text-gray-700 mb-2">
                Active Strategies: {vaultData.strategies.length}
              </div>
              <div className="space-y-2">
                {vaultData.strategies.map((addr, i) => (
                  <div
                    key={addr}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                  >
                    <span className="font-mono text-xs text-gray-600">
                      {addr.slice(0, 8)}...{addr.slice(-6)}
                    </span>
                    <span className="text-xs text-gray-400">Strategy #{i + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-sm">
              <div className="font-medium text-gray-700 mb-2">
                Supported Deposit Assets: {vaultData.supportedDepositAssets.length}
              </div>
              <div className="space-y-2">
                {vaultData.supportedDepositAssets.map((addr) => (
                  <div
                    key={addr}
                    className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                  >
                    <span className="font-mono text-xs text-gray-600">
                      {addr.slice(0, 8)}...{addr.slice(-6)}
                    </span>
                    <span className="text-xs text-gray-400">Depositable</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="animate-pulse h-20 bg-gray-100 rounded-lg" />
        )}
      </Card>

      {/* ─── Row 5: Fee & Governance ────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card title="Fee Structure">
          {vaultData ? (
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Management Fee</span>
                <span className="text-sm font-medium">{(vaultData.managementFee / 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Performance Fee</span>
                <span className="text-sm font-medium">{(vaultData.performanceFee / 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Deposit Limit</span>
                <span className="text-sm font-medium">
                  {vaultData.depositLimit > BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935')
                    ? 'Unlimited'
                    : formatUSD(vaultData.depositLimit)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Emergency Shutdown</span>
                <StatusBadge
                  ok={!vaultData.emergencyShutdown}
                  label={vaultData.emergencyShutdown ? 'ACTIVE' : 'Normal'}
                />
              </div>
            </div>
          ) : (
            <div className="animate-pulse h-24 bg-gray-100 rounded-lg" />
          )}
        </Card>

        <Card title="Governance">
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Timelock</span>
              <span className="text-xs font-mono text-gray-600">
                {contracts.PharosTimelock !== '0x0000000000000000000000000000000000000000'
                  ? `${contracts.PharosTimelock.slice(0, 8)}...${contracts.PharosTimelock.slice(-6)}`
                  : 'Not deployed'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Min Delay</span>
              <span className="text-sm font-medium">24 hours</span>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              All admin actions (fee changes, strategy additions) are subject to a 24-hour
              timelock delay, ensuring users have time to react before changes take effect.
            </div>
          </div>
        </Card>
      </div>

      {/* Footer note */}
      <div className="text-center text-xs text-gray-400 py-4">
        All data is read directly from on-chain contracts. Refreshes every 15 seconds.
      </div>
    </div>
  );
}
