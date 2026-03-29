'use client'

import { useState, useMemo } from 'react'
import { useSquad } from '@/lib/hooks/useSquad'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { computeAllGemScores } from '@/lib/gem-score'
import { computeTransferSuggestions, type ChipState, type SingleTransfer } from '@/lib/transfer-engine'
import { SquadView } from '@/components/squad/SquadView'

export function TransferPanel() {
  const [teamId, setTeamId] = useState<string>('')
  const [submittedId, setSubmittedId] = useState<string | null>(null)
  const [freeTransfers, setFreeTransfers] = useState<number>(1)

  const { data: squadData, isLoading: squadLoading, error: squadError } = useSquad(submittedId)
  const { data: playersData, isLoading: playersLoading } = usePlayers()

  const scoredPlayers = useMemo(
    () => computeAllGemScores(playersData ?? []),
    [playersData],
  )

  const transferResult = useMemo(() => {
    if (!squadData || scoredPlayers.length === 0) return null
    return computeTransferSuggestions(
      squadData.picks,
      scoredPlayers,
      squadData.entry_history.bank,
      freeTransfers,
      squadData.active_chip as ChipState,
    )
  }, [squadData, scoredPlayers, freeTransfers])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (teamId.trim()) {
      setSubmittedId(teamId.trim())
    }
  }

  const isLoading = squadLoading || playersLoading

  return (
    <div className="max-w-7xl space-y-4">
      {/* Team ID input */}
      <form onSubmit={handleSubmit} className="rounded border border-zinc-200 p-4 space-y-3">
        <h2 className="text-base font-semibold text-zinc-900">Load Your Squad</h2>
        <div className="flex gap-2 items-end flex-wrap">
          <div className="flex flex-col gap-1">
            <label htmlFor="teamId" className="text-sm text-zinc-600">
              FPL Team ID
            </label>
            <input
              id="teamId"
              type="text"
              pattern="[0-9]*"
              inputMode="numeric"
              value={teamId}
              onChange={e => setTeamId(e.target.value)}
              placeholder="e.g. 1234567"
              className="border border-zinc-300 rounded px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-400 w-40"
            />
          </div>

          {/* Free transfers selector */}
          <div className="flex flex-col gap-1">
            <label htmlFor="freeTransfers" className="text-sm text-zinc-600">
              Free transfers:{' '}
              <span
                className="text-zinc-400 cursor-help underline underline-offset-2 decoration-dotted"
                title="Enter your available free transfers (check FPL app)"
              >
                ?
              </span>
            </label>
            <input
              id="freeTransfers"
              type="number"
              min={1}
              max={5}
              value={freeTransfers}
              onChange={e => setFreeTransfers(Math.max(1, Math.min(5, Number(e.target.value))))}
              className="border border-zinc-300 rounded px-3 py-1.5 text-sm text-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-400 w-20"
            />
          </div>

          <button
            type="submit"
            className="px-4 py-1.5 bg-zinc-900 text-white text-sm font-medium rounded hover:bg-zinc-700 transition-colors"
          >
            Load Squad
          </button>
        </div>
      </form>

      {/* Loading state */}
      {isLoading && submittedId && (
        <div className="rounded border border-zinc-200 p-4 text-sm text-zinc-500">
          Loading squad...
        </div>
      )}

      {/* Error state */}
      {squadError && (
        <div className="rounded border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {squadError instanceof Error ? squadError.message : String(squadError)}
        </div>
      )}

      {/* Squad and suggestions (only when data is loaded) */}
      {squadData && scoredPlayers.length > 0 && (
        <>
          {/* Squad display */}
          <div className="rounded border border-zinc-200 p-4">
            <h2 className="text-base font-semibold text-zinc-900 mb-3">Your Squad</h2>
            <SquadView
              picks={squadData.picks}
              allPlayers={scoredPlayers}
              entryHistory={squadData.entry_history}
            />
          </div>

          {/* Chip warning */}
          {transferResult?.type === 'CHIP_WARNING' && transferResult.chip === 'freehit' && (
            <div className="rounded border border-amber-400 bg-amber-50 p-4 text-sm text-amber-800">
              <span className="font-semibold">Free Hit active</span> — your squad is temporary this
              gameweek. Transfer suggestions are paused.
            </div>
          )}

          {transferResult?.type === 'CHIP_WARNING' && transferResult.chip === 'wildcard' && (
            <div className="rounded border border-blue-400 bg-blue-50 p-4 text-sm text-blue-800">
              <span className="font-semibold">Wildcard active</span> — unlimited transfers
              available.
            </div>
          )}

          {/* Save recommendation */}
          {transferResult?.type === 'SAVE' && (
            <div className="rounded border border-green-400 bg-green-50 p-4 text-sm text-green-800">
              No transfer improves your squad Gem rating. Save your transfer and bank it for next
              week.
            </div>
          )}

          {/* Transfer suggestions */}
          {transferResult?.type === 'SUGGESTIONS' && transferResult.suggestions && (
            <div className="rounded border border-zinc-200 p-4 space-y-3">
              <h2 className="text-base font-semibold text-zinc-900">Suggested Transfers</h2>

              <div className="space-y-2">
                {transferResult.suggestions
                  .slice(0, freeTransfers * 3)
                  .map((s: SingleTransfer, i: number) => (
                    <div
                      key={i}
                      className="rounded border border-zinc-100 bg-zinc-50 px-3 py-2 space-y-0.5"
                    >
                      <div className="text-sm text-zinc-900">
                        Sell{' '}
                        <span className="font-medium">{s.sell.web_name}</span>{' '}
                        <span className="text-zinc-500">({s.sell.gem_score.toFixed(2)})</span>
                        {/* VAL-03: price trend */}
                        {(s.sell.cost_change_event ?? 0) > 0 && (
                          <span className="text-green-600 text-xs ml-1">↑{((s.sell.cost_change_event ?? 0) / 10).toFixed(1)}</span>
                        )}
                        {(s.sell.cost_change_event ?? 0) < 0 && (
                          <span className="text-red-600 text-xs ml-1">↓{(Math.abs(s.sell.cost_change_event ?? 0) / 10).toFixed(1)}</span>
                        )}
                        {(s.sell.cost_change_start ?? 0) !== 0 && (
                          <span className="text-zinc-400 text-[10px] ml-1">({(s.sell.cost_change_start ?? 0) > 0 ? '+' : '-'}{(Math.abs(s.sell.cost_change_start ?? 0) / 10).toFixed(1)}m season)</span>
                        )}
                        {' '}&rarr; Buy{' '}
                        <span className="font-medium">{s.buy.web_name}</span>{' '}
                        <span className="text-zinc-500">({s.buy.gem_score.toFixed(2)})</span>
                        {/* VAL-03: price trend */}
                        {(s.buy.cost_change_event ?? 0) > 0 && (
                          <span className="text-green-600 text-xs ml-1">↑{((s.buy.cost_change_event ?? 0) / 10).toFixed(1)}</span>
                        )}
                        {(s.buy.cost_change_event ?? 0) < 0 && (
                          <span className="text-red-600 text-xs ml-1">↓{(Math.abs(s.buy.cost_change_event ?? 0) / 10).toFixed(1)}</span>
                        )}
                        {(s.buy.cost_change_start ?? 0) !== 0 && (
                          <span className="text-zinc-400 text-[10px] ml-1">({(s.buy.cost_change_start ?? 0) > 0 ? '+' : '-'}{(Math.abs(s.buy.cost_change_start ?? 0) / 10).toFixed(1)}m season)</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">
                        Gem improvement:{' '}
                        <span className="text-zinc-700">+{s.gem_delta.toFixed(2)}</span>
                        {' '}| Cost:{' '}
                        <span className="text-zinc-700">
                          £{s.approx_cost.toFixed(1)}m
                        </span>{' '}
                        <span className="text-zinc-400">(approx)</span>
                      </div>
                      <div>
                        {s.budget_sufficient ? (
                          <span className="inline-block text-xs font-medium text-green-700 bg-green-100 rounded px-1.5 py-0.5">
                            Affordable
                          </span>
                        ) : (
                          <span className="inline-block text-xs font-medium text-red-700 bg-red-100 rounded px-1.5 py-0.5">
                            Over budget
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
              </div>

              {/* 2-transfer combo */}
              {transferResult.two_transfer_combo && (
                <div className="space-y-2 pt-2 border-t border-zinc-200">
                  <h3 className="text-sm font-semibold text-zinc-700">2-Transfer Combo</h3>
                  {transferResult.two_transfer_combo.map((s: SingleTransfer, i: number) => (
                    <div
                      key={i}
                      className="rounded border border-zinc-100 bg-zinc-50 px-3 py-2 space-y-0.5"
                    >
                      <div className="text-sm text-zinc-900">
                        Sell{' '}
                        <span className="font-medium">{s.sell.web_name}</span>{' '}
                        <span className="text-zinc-500">({s.sell.gem_score.toFixed(2)})</span>
                        {/* VAL-03: price trend */}
                        {(s.sell.cost_change_event ?? 0) > 0 && (
                          <span className="text-green-600 text-xs ml-1">↑{((s.sell.cost_change_event ?? 0) / 10).toFixed(1)}</span>
                        )}
                        {(s.sell.cost_change_event ?? 0) < 0 && (
                          <span className="text-red-600 text-xs ml-1">↓{(Math.abs(s.sell.cost_change_event ?? 0) / 10).toFixed(1)}</span>
                        )}
                        {(s.sell.cost_change_start ?? 0) !== 0 && (
                          <span className="text-zinc-400 text-[10px] ml-1">({(s.sell.cost_change_start ?? 0) > 0 ? '+' : '-'}{(Math.abs(s.sell.cost_change_start ?? 0) / 10).toFixed(1)}m season)</span>
                        )}
                        {' '}&rarr; Buy{' '}
                        <span className="font-medium">{s.buy.web_name}</span>{' '}
                        <span className="text-zinc-500">({s.buy.gem_score.toFixed(2)})</span>
                        {/* VAL-03: price trend */}
                        {(s.buy.cost_change_event ?? 0) > 0 && (
                          <span className="text-green-600 text-xs ml-1">↑{((s.buy.cost_change_event ?? 0) / 10).toFixed(1)}</span>
                        )}
                        {(s.buy.cost_change_event ?? 0) < 0 && (
                          <span className="text-red-600 text-xs ml-1">↓{(Math.abs(s.buy.cost_change_event ?? 0) / 10).toFixed(1)}</span>
                        )}
                        {(s.buy.cost_change_start ?? 0) !== 0 && (
                          <span className="text-zinc-400 text-[10px] ml-1">({(s.buy.cost_change_start ?? 0) > 0 ? '+' : '-'}{(Math.abs(s.buy.cost_change_start ?? 0) / 10).toFixed(1)}m season)</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">
                        Gem improvement:{' '}
                        <span className="text-zinc-700">+{s.gem_delta.toFixed(2)}</span>
                        {' '}| Cost:{' '}
                        <span className="text-zinc-700">
                          £{s.approx_cost.toFixed(1)}m
                        </span>{' '}
                        <span className="text-zinc-400">(approx)</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-zinc-400 pt-1">
                Prices are approximate (based on current market price, not your actual sell price).
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
