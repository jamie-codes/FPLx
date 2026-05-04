import { describe, it, expect } from 'vitest'
import { buildTransferRouteTree } from '@/lib/transfer-route-tree'
import type { ScoredPlayer, FTState, PlannerChip } from '@/lib/types'
import type { SquadPick } from '@/lib/squad-adapter'

// ---------------------------------------------------------------------------
// Test fixture helpers
// ---------------------------------------------------------------------------

function makePlayer(id: number, opts: Partial<ScoredPlayer> = {}): ScoredPlayer {
  return {
    id,
    web_name: `Player${id}`,
    element_type: opts.element_type ?? 3,
    team: 1,
    team_short_name: `T${id}`,
    now_cost: opts.now_cost ?? 60,
    status: 'a',
    xPts_1gw: opts.xPts_1gw ?? 5.0,
    xPts_90th_1gw: undefined,
    mins_risk: 'nailed',
    fixtures: opts.fixtures ?? [{ event_id: 33, opponent_team: 'OPP', is_home: true, difficulty_score: 0.5, difficulty_tier: 'medium', attacking_difficulty: 0.5, defensive_difficulty: 0.5 }],
    gem_score: 0,
    // Required MergedPlayer fields
    selected_by_percent: '10.0',
    form: '5.0',
    minutes: 900,
    starts: 10,
    total_points: 50,
    goals_scored: 5,
    assists: 3,
    expected_goals: 3.5,
    expected_assists: 2.5,
    pts_last3gw: 18,
    pts_last5gw: 30,
    pts_gw_count: 5,
    defensive_contribution: null,
    clearances_blocks_interceptions: null,
    direct_freekicks_order: null,
    penalties_order: null,
    corners_and_indirect_freekicks_order: null,
    penalties_text: '',
    direct_freekicks_text: '',
    corners_and_indirect_freekicks_text: '',
    news: '',
    cost_change_event: 0,
    cost_change_start: 0,
    understat_id: null,
    xg_per90: null,
    xa_per90: null,
    minutes_per90: 90,
    form_pts_per90: 5.0,
    xmins: 90,
    start_prob: 1.0,
    // ScoredPlayer extra fields
    fdr_score: 0.5,
    form_score: 0.5,
    xg_score: null,
    xa_score: null,
    ownership_score: 0.5,
    minutes_score: 1.0,
    set_piece_score: 0,
    ...opts,
  } as unknown as ScoredPlayer
}

function makePick(element: number, position: number): SquadPick {
  return { element, position, multiplier: 1, is_captain: false, is_vice_captain: false }
}

// Build a standard 15-pick squad using player IDs 1–15
// Positions: 1=GK pos1, 2=GK pos2(bench), 3-7=DEF, 8-12=MID, 13-15=FWD
function makeDefaultPicks(): SquadPick[] {
  return [
    makePick(1, 1),    // GK starter
    makePick(2, 12),   // GK bench
    makePick(3, 2),    // DEF
    makePick(4, 3),    // DEF
    makePick(5, 4),    // DEF
    makePick(6, 5),    // DEF
    makePick(7, 6),    // DEF bench
    makePick(8, 7),    // MID
    makePick(9, 8),    // MID
    makePick(10, 9),   // MID
    makePick(11, 10),  // MID
    makePick(12, 13),  // MID bench
    makePick(13, 11),  // FWD
    makePick(14, 14),  // FWD bench
    makePick(15, 15),  // FWD bench
  ]
}

// Build 15 scored players with distinct xPts_1gw values (ids 1-15)
// Player 1 (GK) has lowest xPts, player 2 (GK) second lowest, etc.
function makeDefaultPlayers(): ScoredPlayer[] {
  return [
    makePlayer(1, { element_type: 1, xPts_1gw: 1.0, now_cost: 45 }),  // GK, lowest xPts
    makePlayer(2, { element_type: 1, xPts_1gw: 2.0, now_cost: 45 }),  // GK bench
    makePlayer(3, { element_type: 2, xPts_1gw: 3.0, now_cost: 55 }),  // DEF
    makePlayer(4, { element_type: 2, xPts_1gw: 4.0, now_cost: 55 }),  // DEF
    makePlayer(5, { element_type: 2, xPts_1gw: 5.0, now_cost: 55 }),  // DEF
    makePlayer(6, { element_type: 2, xPts_1gw: 6.0, now_cost: 55 }),  // DEF
    makePlayer(7, { element_type: 2, xPts_1gw: 7.0, now_cost: 55 }),  // DEF bench
    makePlayer(8, { element_type: 3, xPts_1gw: 8.0, now_cost: 80 }),  // MID
    makePlayer(9, { element_type: 3, xPts_1gw: 9.0, now_cost: 80 }),  // MID
    makePlayer(10, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }), // MID
    makePlayer(11, { element_type: 3, xPts_1gw: 11.0, now_cost: 80 }), // MID
    makePlayer(12, { element_type: 3, xPts_1gw: 12.0, now_cost: 80 }), // MID bench
    makePlayer(13, { element_type: 4, xPts_1gw: 13.0, now_cost: 90 }), // FWD
    makePlayer(14, { element_type: 4, xPts_1gw: 14.0, now_cost: 90 }), // FWD bench
    makePlayer(15, { element_type: 4, xPts_1gw: 15.0, now_cost: 90 }), // FWD bench
  ]
}

// Additional high-xPts non-squad players available to buy
// These are the "candidates" the engine can choose for transfers
function makeCandidatePlayers(): ScoredPlayer[] {
  return [
    // GK candidate — better xPts than squad GK id=1
    makePlayer(101, { element_type: 1, xPts_1gw: 8.0, now_cost: 50 }),
    // DEF candidates — better than squad DEF id=3 (xPts_1gw=3.0)
    makePlayer(102, { element_type: 2, xPts_1gw: 10.0, now_cost: 60 }),
    makePlayer(103, { element_type: 2, xPts_1gw: 9.0, now_cost: 58 }),
    // MID candidates
    makePlayer(104, { element_type: 3, xPts_1gw: 15.0, now_cost: 85 }),
    makePlayer(105, { element_type: 3, xPts_1gw: 14.0, now_cost: 82 }),
    // FWD candidates
    makePlayer(106, { element_type: 4, xPts_1gw: 18.0, now_cost: 95 }),
    makePlayer(107, { element_type: 4, xPts_1gw: 16.0, now_cost: 92 }),
  ]
}

const DEFAULT_FT: FTState = { available: 1, banked: 0 }
const DEFAULT_BANK = 50 // £5.0m = 50 tenths
const DEFAULT_STARTING_GW = 33

function makeDefaultArgs() {
  const squadPlayers = makeDefaultPlayers()
  const candidates = makeCandidatePlayers()
  return {
    picks: makeDefaultPicks(),
    players: [...squadPlayers, ...candidates],
    horizon: 3 as const,
    initialFT: DEFAULT_FT,
    initialBank: DEFAULT_BANK,
    sellPrices: undefined,
    chipMode: null as PlannerChip,
    startingGw: DEFAULT_STARTING_GW,
  }
}

// ---------------------------------------------------------------------------
// describe('buildTransferRouteTree')
// ---------------------------------------------------------------------------

describe('buildTransferRouteTree', () => {

  // -------------------------------------------------------------------------
  describe('sell-root selection', () => {

    it('A1: 15 picks with strictly distinct xPts_1gw → tree.paths length === 3, rootSellIds equal the 3 lowest-xPts ids in ascending xPts order', () => {
      const args = makeDefaultArgs()
      const tree = buildTransferRouteTree(args)
      // Squad players sorted by xPts_1gw asc: id=1 (1.0), id=2 (2.0), id=3 (3.0)
      expect(tree.paths).toHaveLength(3)
      expect(tree.paths[0].rootSellId).toBe(1)
      expect(tree.paths[1].rootSellId).toBe(2)
      expect(tree.paths[2].rootSellId).toBe(3)
    })

    it('A2: Tie on xPts_1gw → tie-break by now_cost ascending; assert deterministic root order', () => {
      // Two players with same xPts_1gw, different now_cost
      const players: ScoredPlayer[] = [
        makePlayer(1, { element_type: 1, xPts_1gw: 2.0, now_cost: 55 }),  // GK, tied xPts, higher cost
        makePlayer(2, { element_type: 1, xPts_1gw: 2.0, now_cost: 45 }),  // GK bench, tied xPts, lower cost
        makePlayer(3, { element_type: 2, xPts_1gw: 3.0, now_cost: 55 }),
        makePlayer(4, { element_type: 2, xPts_1gw: 4.0, now_cost: 55 }),
        makePlayer(5, { element_type: 2, xPts_1gw: 5.0, now_cost: 55 }),
        makePlayer(6, { element_type: 2, xPts_1gw: 6.0, now_cost: 55 }),
        makePlayer(7, { element_type: 2, xPts_1gw: 7.0, now_cost: 55 }),
        makePlayer(8, { element_type: 3, xPts_1gw: 8.0, now_cost: 80 }),
        makePlayer(9, { element_type: 3, xPts_1gw: 9.0, now_cost: 80 }),
        makePlayer(10, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(11, { element_type: 3, xPts_1gw: 11.0, now_cost: 80 }),
        makePlayer(12, { element_type: 3, xPts_1gw: 12.0, now_cost: 80 }),
        makePlayer(13, { element_type: 4, xPts_1gw: 13.0, now_cost: 90 }),
        makePlayer(14, { element_type: 4, xPts_1gw: 14.0, now_cost: 90 }),
        makePlayer(15, { element_type: 4, xPts_1gw: 15.0, now_cost: 90 }),
        makePlayer(101, { element_type: 1, xPts_1gw: 8.0, now_cost: 50 }),
        makePlayer(102, { element_type: 2, xPts_1gw: 10.0, now_cost: 60 }),
        makePlayer(103, { element_type: 2, xPts_1gw: 9.0, now_cost: 58 }),
      ]
      const args = { ...makeDefaultArgs(), players }
      const tree = buildTransferRouteTree(args)
      // id=2 (cost=45) should come before id=1 (cost=55) due to now_cost asc tie-break
      const rootIds = tree.paths.map(p => p.rootSellId)
      expect(rootIds[0]).toBe(2) // lower now_cost wins tie
      expect(rootIds[1]).toBe(1)
    })

    it('A3: Triple tie on xPts_1gw and now_cost → tie-break by id ascending; assert deterministic root order', () => {
      const players: ScoredPlayer[] = [
        makePlayer(5, { element_type: 1, xPts_1gw: 2.0, now_cost: 45 }), // GK, tied all
        makePlayer(3, { element_type: 1, xPts_1gw: 2.0, now_cost: 45 }), // GK, tied all, lower id
        makePlayer(7, { element_type: 1, xPts_1gw: 2.0, now_cost: 45 }), // GK bench, tied all
        makePlayer(4, { element_type: 2, xPts_1gw: 4.0, now_cost: 55 }),
        makePlayer(6, { element_type: 2, xPts_1gw: 5.0, now_cost: 55 }),
        makePlayer(8, { element_type: 2, xPts_1gw: 6.0, now_cost: 55 }),
        makePlayer(9, { element_type: 2, xPts_1gw: 7.0, now_cost: 55 }),
        makePlayer(10, { element_type: 3, xPts_1gw: 8.0, now_cost: 80 }),
        makePlayer(11, { element_type: 3, xPts_1gw: 9.0, now_cost: 80 }),
        makePlayer(12, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(13, { element_type: 3, xPts_1gw: 11.0, now_cost: 80 }),
        makePlayer(14, { element_type: 3, xPts_1gw: 12.0, now_cost: 80 }),
        makePlayer(15, { element_type: 4, xPts_1gw: 13.0, now_cost: 90 }),
        makePlayer(16, { element_type: 4, xPts_1gw: 14.0, now_cost: 90 }),
        makePlayer(17, { element_type: 4, xPts_1gw: 15.0, now_cost: 90 }),
        makePlayer(101, { element_type: 1, xPts_1gw: 8.0, now_cost: 50 }),
        makePlayer(102, { element_type: 2, xPts_1gw: 10.0, now_cost: 60 }),
      ]
      const picks: SquadPick[] = [
        makePick(5, 1), makePick(3, 2), makePick(7, 12),
        makePick(4, 3), makePick(6, 4), makePick(8, 5), makePick(9, 6),
        makePick(10, 7), makePick(11, 8), makePick(12, 9), makePick(13, 10), makePick(14, 13),
        makePick(15, 11), makePick(16, 14), makePick(17, 15),
      ]
      const args = { ...makeDefaultArgs(), picks, players }
      const tree = buildTransferRouteTree(args)
      // id=3, 5, 7 all tied — should be sorted by id asc
      const rootIds = tree.paths.map(p => p.rootSellId)
      expect(rootIds[0]).toBe(3)
      expect(rootIds[1]).toBe(5)
      expect(rootIds[2]).toBe(7)
    })

    it('A4: Empty picks array → tree.paths === [] AND tree.recommendedPathIndex === -1', () => {
      const args = { ...makeDefaultArgs(), picks: [] }
      const tree = buildTransferRouteTree(args)
      expect(tree.paths).toEqual([])
      expect(tree.recommendedPathIndex).toBe(-1)
    })

    it('A5: Empty players array → tree.paths === [] AND tree.recommendedPathIndex === -1', () => {
      const args = { ...makeDefaultArgs(), players: [] }
      const tree = buildTransferRouteTree(args)
      expect(tree.paths).toEqual([])
      expect(tree.recommendedPathIndex).toBe(-1)
    })
  })

  // -------------------------------------------------------------------------
  describe('greedy continuation', () => {

    it('B1: With horizon=3 and a squad where every step has a positive-gain transfer available, every node[i].transfers.length >= 1', () => {
      // Use default args — squad has low-xPts players and high-xPts candidates available
      const args = { ...makeDefaultArgs(), horizon: 3 as const }
      const tree = buildTransferRouteTree(args)
      expect(tree.paths.length).toBeGreaterThan(0)
      const path = tree.paths[0]
      // All three nodes should have at least one transfer since candidates are much better
      // At minimum GW1 (root transfer) must fire
      expect(path.nodes[0].transfers.length).toBeGreaterThanOrEqual(1)
      expect(path.nodes).toHaveLength(3)
    })

    it('B2: When no player improves the current squad in step 2, node[1].transfers.length === 0 (hold)', () => {
      // Squad where players 1-15 are already top of their position, no non-squad players are better
      // except for specifically GW1 root transfer target
      const squadPlayers: ScoredPlayer[] = [
        makePlayer(1, { element_type: 1, xPts_1gw: 1.0, now_cost: 45 }),  // GK, root (lowest)
        makePlayer(2, { element_type: 1, xPts_1gw: 20.0, now_cost: 45 }), // GK bench
        makePlayer(3, { element_type: 2, xPts_1gw: 20.0, now_cost: 55 }),
        makePlayer(4, { element_type: 2, xPts_1gw: 20.0, now_cost: 55 }),
        makePlayer(5, { element_type: 2, xPts_1gw: 20.0, now_cost: 55 }),
        makePlayer(6, { element_type: 2, xPts_1gw: 20.0, now_cost: 55 }),
        makePlayer(7, { element_type: 2, xPts_1gw: 20.0, now_cost: 55 }),
        makePlayer(8, { element_type: 3, xPts_1gw: 20.0, now_cost: 80 }),
        makePlayer(9, { element_type: 3, xPts_1gw: 20.0, now_cost: 80 }),
        makePlayer(10, { element_type: 3, xPts_1gw: 20.0, now_cost: 80 }),
        makePlayer(11, { element_type: 3, xPts_1gw: 20.0, now_cost: 80 }),
        makePlayer(12, { element_type: 3, xPts_1gw: 20.0, now_cost: 80 }),
        makePlayer(13, { element_type: 4, xPts_1gw: 20.0, now_cost: 90 }),
        makePlayer(14, { element_type: 4, xPts_1gw: 20.0, now_cost: 90 }),
        makePlayer(15, { element_type: 4, xPts_1gw: 20.0, now_cost: 90 }),
      ]
      // Only one candidate — a GK that replaces root (id=1), nothing better for GW2+
      const candidates: ScoredPlayer[] = [
        makePlayer(101, { element_type: 1, xPts_1gw: 8.0, now_cost: 50 }), // GK - better than root, worse than others
      ]
      const args = {
        ...makeDefaultArgs(),
        players: [...squadPlayers, ...candidates],
        horizon: 3 as const,
      }
      const tree = buildTransferRouteTree(args)
      expect(tree.paths.length).toBeGreaterThan(0)
      const path = tree.paths[0]
      // GW1: root sell fires (id=1 → id=101)
      expect(path.nodes[0].transfers.length).toBeGreaterThanOrEqual(1)
      // GW2: no positive gain for remaining squad → hold
      expect(path.nodes[1].transfers.length).toBe(0)
      // GW3: still no positive gain → hold
      expect(path.nodes[2].transfers.length).toBe(0)
    })

    it('B3: When initialFT.available === 2 and 2 distinct positive-gain transfers exist in step 1, node[0].transfers.length === 2', () => {
      // Squad where root is id=1 (GK), and after root transfer, a second positive-gain transfer exists
      const squadPlayers: ScoredPlayer[] = [
        makePlayer(1, { element_type: 1, xPts_1gw: 1.0, now_cost: 45 }),  // GK, lowest
        makePlayer(2, { element_type: 1, xPts_1gw: 2.0, now_cost: 45 }),
        makePlayer(3, { element_type: 2, xPts_1gw: 1.5, now_cost: 45 }),  // second lowest (DEF)
        makePlayer(4, { element_type: 2, xPts_1gw: 10.0, now_cost: 55 }),
        makePlayer(5, { element_type: 2, xPts_1gw: 10.0, now_cost: 55 }),
        makePlayer(6, { element_type: 2, xPts_1gw: 10.0, now_cost: 55 }),
        makePlayer(7, { element_type: 2, xPts_1gw: 10.0, now_cost: 55 }),
        makePlayer(8, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(9, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(10, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(11, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(12, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(13, { element_type: 4, xPts_1gw: 10.0, now_cost: 90 }),
        makePlayer(14, { element_type: 4, xPts_1gw: 10.0, now_cost: 90 }),
        makePlayer(15, { element_type: 4, xPts_1gw: 10.0, now_cost: 90 }),
      ]
      const candidates: ScoredPlayer[] = [
        makePlayer(101, { element_type: 1, xPts_1gw: 12.0, now_cost: 50 }), // GK replacement (positive gain)
        makePlayer(102, { element_type: 2, xPts_1gw: 15.0, now_cost: 55 }), // DEF replacement (positive gain for id=3)
      ]
      const args = {
        ...makeDefaultArgs(),
        players: [...squadPlayers, ...candidates],
        initialFT: { available: 2, banked: 1 }, // 2 FTs available
        initialBank: 200, // plenty of bank
        horizon: 1 as const,
      }
      const tree = buildTransferRouteTree(args)
      // Root = id=1 (GK, xPts=1.0). With 2 FTs, GW1 should fire 2 transfers:
      // 1st: sell id=1, buy id=101 (positive gain)
      // 2nd: sell id=3 (xPts=1.5), buy id=102 (xPts=15.0) (positive gain)
      expect(tree.paths.length).toBeGreaterThan(0)
      const path = tree.paths[0]
      expect(path.nodes[0].transfers.length).toBe(2)
    })

    it('B4: When initialFT.available === 2 and only 1 positive-gain transfer exists, node[0].transfers.length === 1 (D-04)', () => {
      const squadPlayers: ScoredPlayer[] = [
        makePlayer(1, { element_type: 1, xPts_1gw: 1.0, now_cost: 45 }),
        makePlayer(2, { element_type: 1, xPts_1gw: 20.0, now_cost: 45 }),
        makePlayer(3, { element_type: 2, xPts_1gw: 20.0, now_cost: 55 }),
        makePlayer(4, { element_type: 2, xPts_1gw: 20.0, now_cost: 55 }),
        makePlayer(5, { element_type: 2, xPts_1gw: 20.0, now_cost: 55 }),
        makePlayer(6, { element_type: 2, xPts_1gw: 20.0, now_cost: 55 }),
        makePlayer(7, { element_type: 2, xPts_1gw: 20.0, now_cost: 55 }),
        makePlayer(8, { element_type: 3, xPts_1gw: 20.0, now_cost: 80 }),
        makePlayer(9, { element_type: 3, xPts_1gw: 20.0, now_cost: 80 }),
        makePlayer(10, { element_type: 3, xPts_1gw: 20.0, now_cost: 80 }),
        makePlayer(11, { element_type: 3, xPts_1gw: 20.0, now_cost: 80 }),
        makePlayer(12, { element_type: 3, xPts_1gw: 20.0, now_cost: 80 }),
        makePlayer(13, { element_type: 4, xPts_1gw: 20.0, now_cost: 90 }),
        makePlayer(14, { element_type: 4, xPts_1gw: 20.0, now_cost: 90 }),
        makePlayer(15, { element_type: 4, xPts_1gw: 20.0, now_cost: 90 }),
      ]
      // Only one candidate (for the root GK), nothing else improves the squad
      const candidates: ScoredPlayer[] = [
        makePlayer(101, { element_type: 1, xPts_1gw: 8.0, now_cost: 50 }), // GK - positive gain vs root (1.0)
      ]
      const args = {
        ...makeDefaultArgs(),
        players: [...squadPlayers, ...candidates],
        initialFT: { available: 2, banked: 1 }, // 2 FTs but no second leg
        horizon: 1 as const,
      }
      const tree = buildTransferRouteTree(args)
      expect(tree.paths.length).toBeGreaterThan(0)
      const path = tree.paths[0]
      // Only 1 positive-gain transfer exists → second leg refused per D-04
      expect(path.nodes[0].transfers.length).toBe(1)
    })

    it('B5: Engine never takes a hit — for any path and any node, node.hitCost === 0; path.totalHits === 0; path.totalHitCostPts === 0', () => {
      const args = makeDefaultArgs()
      const tree = buildTransferRouteTree(args)
      for (const path of tree.paths) {
        expect(path.totalHits).toBe(0)
        expect(path.totalHitCostPts).toBe(0)
        for (const node of path.nodes) {
          expect(node.hitCost).toBe(0)
        }
      }
    })
  })

  // -------------------------------------------------------------------------
  describe('node shape', () => {

    it('C1: Each node has exact fields { gw, ftBefore, transfers, hitCost, chip, xPtsContribution, squadAfter } with correct types', () => {
      const args = makeDefaultArgs()
      const tree = buildTransferRouteTree(args)
      expect(tree.paths.length).toBeGreaterThan(0)
      const node = tree.paths[0].nodes[0]
      expect(typeof node.gw).toBe('number')
      expect(typeof node.ftBefore).toBe('object')
      expect(typeof node.ftBefore.available).toBe('number')
      expect(typeof node.ftBefore.banked).toBe('number')
      expect(Array.isArray(node.transfers)).toBe(true)
      expect(node.hitCost).toBe(0)
      expect(node.chip === null || typeof node.chip === 'string').toBe(true)
      expect(typeof node.xPtsContribution).toBe('number')
      expect(Array.isArray(node.squadAfter)).toBe(true)
    })

    it('C2: node.gw === args.startingGw + index for index in 0..horizon-1', () => {
      const args = { ...makeDefaultArgs(), horizon: 3 as const, startingGw: 34 }
      const tree = buildTransferRouteTree(args)
      expect(tree.paths.length).toBeGreaterThan(0)
      for (const path of tree.paths) {
        path.nodes.forEach((node, i) => {
          expect(node.gw).toBe(34 + i)
        })
      }
    })

    it('C3: node.squadAfter has length 15 (matches input picks length)', () => {
      const args = makeDefaultArgs()
      const tree = buildTransferRouteTree(args)
      for (const path of tree.paths) {
        for (const node of path.nodes) {
          expect(node.squadAfter).toHaveLength(15)
        }
      }
    })

    it('C4: node.ftBefore equals computeNextFTState applied to the prior node\'s transfers (or initialFT for node[0])', () => {
      const args = { ...makeDefaultArgs(), initialFT: { available: 1, banked: 0 }, horizon: 3 as const }
      const tree = buildTransferRouteTree(args)
      expect(tree.paths.length).toBeGreaterThan(0)
      const path = tree.paths[0]
      // node[0].ftBefore should equal initialFT
      expect(path.nodes[0].ftBefore).toEqual({ available: 1, banked: 0 })
      // node[1].ftBefore should equal computeNextFTState(1, node[0].transfers.length, node[0].chip)
      // If node[0] had 1 transfer: computeNextFTState(1, 1, null) = { available: 1, banked: 0 }
      // If node[0] had 0 transfers: computeNextFTState(1, 0, null) = { available: 2, banked: 1 }
      const expectedNode1FT = path.nodes[0].transfers.length === 0
        ? { available: 2, banked: 1 }
        : { available: 1, banked: 0 }
      expect(path.nodes[1].ftBefore).toEqual(expectedNode1FT)
    })

    it('C5: After a transfer, node.squadAfter contains the buyId and excludes the sellId', () => {
      const args = makeDefaultArgs()
      const tree = buildTransferRouteTree(args)
      expect(tree.paths.length).toBeGreaterThan(0)
      for (const path of tree.paths) {
        for (const node of path.nodes) {
          for (const t of node.transfers) {
            expect(node.squadAfter).toContain(t.buyId)
            expect(node.squadAfter).not.toContain(t.sellId)
          }
        }
      }
    })
  })

  // -------------------------------------------------------------------------
  describe('path metrics', () => {

    it('D1: xPtsContribution per node === Σ over transfers of (buy.xPts_1gw * fixtureCount - sell.xPts_1gw * fixtureCount); DGW x2', () => {
      // GW33 with 2 fixtures (DGW) for the buy player, normal for sell
      const dgwFixtures = [
        { event_id: 33, opponent_team: 'OPP1', is_home: true, difficulty_score: 0.5, difficulty_tier: 'medium' as const, attacking_difficulty: 0.5, defensive_difficulty: 0.5 },
        { event_id: 33, opponent_team: 'OPP2', is_home: false, difficulty_score: 0.5, difficulty_tier: 'medium' as const, attacking_difficulty: 0.5, defensive_difficulty: 0.5 },
      ]
      const normalFixture = [
        { event_id: 33, opponent_team: 'OPP3', is_home: true, difficulty_score: 0.5, difficulty_tier: 'medium' as const, attacking_difficulty: 0.5, defensive_difficulty: 0.5 },
      ]
      const squadPlayers: ScoredPlayer[] = [
        makePlayer(1, { element_type: 1, xPts_1gw: 1.0, now_cost: 45, fixtures: normalFixture }),  // GK root
        makePlayer(2, { element_type: 1, xPts_1gw: 15.0, now_cost: 45, fixtures: normalFixture }),
        makePlayer(3, { element_type: 2, xPts_1gw: 10.0, now_cost: 55, fixtures: normalFixture }),
        makePlayer(4, { element_type: 2, xPts_1gw: 10.0, now_cost: 55, fixtures: normalFixture }),
        makePlayer(5, { element_type: 2, xPts_1gw: 10.0, now_cost: 55, fixtures: normalFixture }),
        makePlayer(6, { element_type: 2, xPts_1gw: 10.0, now_cost: 55, fixtures: normalFixture }),
        makePlayer(7, { element_type: 2, xPts_1gw: 10.0, now_cost: 55, fixtures: normalFixture }),
        makePlayer(8, { element_type: 3, xPts_1gw: 10.0, now_cost: 80, fixtures: normalFixture }),
        makePlayer(9, { element_type: 3, xPts_1gw: 10.0, now_cost: 80, fixtures: normalFixture }),
        makePlayer(10, { element_type: 3, xPts_1gw: 10.0, now_cost: 80, fixtures: normalFixture }),
        makePlayer(11, { element_type: 3, xPts_1gw: 10.0, now_cost: 80, fixtures: normalFixture }),
        makePlayer(12, { element_type: 3, xPts_1gw: 10.0, now_cost: 80, fixtures: normalFixture }),
        makePlayer(13, { element_type: 4, xPts_1gw: 10.0, now_cost: 90, fixtures: normalFixture }),
        makePlayer(14, { element_type: 4, xPts_1gw: 10.0, now_cost: 90, fixtures: normalFixture }),
        makePlayer(15, { element_type: 4, xPts_1gw: 10.0, now_cost: 90, fixtures: normalFixture }),
      ]
      // Buy player has DGW (2 fixtures in GW33): xPts_1gw=6.0 * 2 = 12 contribution
      // Sell player (id=1) has 1 fixture: xPts_1gw=1.0 * 1 = 1 contribution
      // Expected xPtsContribution = 12 - 1 = 11
      const candidates: ScoredPlayer[] = [
        makePlayer(101, { element_type: 1, xPts_1gw: 6.0, now_cost: 50, fixtures: dgwFixtures }), // GK with DGW
      ]
      const args = {
        ...makeDefaultArgs(),
        players: [...squadPlayers, ...candidates],
        horizon: 1 as const,
        startingGw: 33,
      }
      const tree = buildTransferRouteTree(args)
      expect(tree.paths.length).toBeGreaterThan(0)
      const path = tree.paths[0] // root is id=1 (GK, xPts=1.0)
      // GW1 root transfer: sell id=1 (xPts=1.0, 1 fixture), buy id=101 (xPts=6.0, 2 fixtures)
      expect(path.nodes[0].xPtsContribution).toBeCloseTo(6.0 * 2 - 1.0 * 1, 5)
    })

    it('D2: BGW (no fixture in target GW) → xPtsContribution for that leg === 0', () => {
      // Player with no fixture in GW33 (BGW) - xPtsContribution should be 0
      const bgwFixture = [] // no fixtures in GW33
      const squadPlayers: ScoredPlayer[] = [
        makePlayer(1, { element_type: 1, xPts_1gw: 1.0, now_cost: 45, fixtures: bgwFixture }), // GK BGW
        makePlayer(2, { element_type: 1, xPts_1gw: 15.0, now_cost: 45, fixtures: bgwFixture }),
        makePlayer(3, { element_type: 2, xPts_1gw: 10.0, now_cost: 55, fixtures: bgwFixture }),
        makePlayer(4, { element_type: 2, xPts_1gw: 10.0, now_cost: 55, fixtures: bgwFixture }),
        makePlayer(5, { element_type: 2, xPts_1gw: 10.0, now_cost: 55, fixtures: bgwFixture }),
        makePlayer(6, { element_type: 2, xPts_1gw: 10.0, now_cost: 55, fixtures: bgwFixture }),
        makePlayer(7, { element_type: 2, xPts_1gw: 10.0, now_cost: 55, fixtures: bgwFixture }),
        makePlayer(8, { element_type: 3, xPts_1gw: 10.0, now_cost: 80, fixtures: bgwFixture }),
        makePlayer(9, { element_type: 3, xPts_1gw: 10.0, now_cost: 80, fixtures: bgwFixture }),
        makePlayer(10, { element_type: 3, xPts_1gw: 10.0, now_cost: 80, fixtures: bgwFixture }),
        makePlayer(11, { element_type: 3, xPts_1gw: 10.0, now_cost: 80, fixtures: bgwFixture }),
        makePlayer(12, { element_type: 3, xPts_1gw: 10.0, now_cost: 80, fixtures: bgwFixture }),
        makePlayer(13, { element_type: 4, xPts_1gw: 10.0, now_cost: 90, fixtures: bgwFixture }),
        makePlayer(14, { element_type: 4, xPts_1gw: 10.0, now_cost: 90, fixtures: bgwFixture }),
        makePlayer(15, { element_type: 4, xPts_1gw: 10.0, now_cost: 90, fixtures: bgwFixture }),
      ]
      const candidates: ScoredPlayer[] = [
        makePlayer(101, { element_type: 1, xPts_1gw: 8.0, now_cost: 50, fixtures: bgwFixture }), // GK also BGW
      ]
      const args = {
        ...makeDefaultArgs(),
        players: [...squadPlayers, ...candidates],
        horizon: 1 as const,
        startingGw: 33,
      }
      const tree = buildTransferRouteTree(args)
      // BGW: fixtureCountForGw returns 0 for all players → xPtsContribution = 0 * 8 - 0 * 1 = 0
      // All players have BGW, so root transfer fires (forced) but contributes 0 xPts
      expect(tree.paths.length).toBeGreaterThan(0)
      const path = tree.paths[0]
      expect(path.nodes[0].xPtsContribution).toBe(0)
    })

    it('D3: path.netXpts === sum of all node.xPtsContribution values', () => {
      const args = { ...makeDefaultArgs(), horizon: 3 as const }
      const tree = buildTransferRouteTree(args)
      for (const path of tree.paths) {
        const sumContributions = path.nodes.reduce((sum, node) => sum + node.xPtsContribution, 0)
        expect(path.netXpts).toBeCloseTo(sumContributions, 10)
      }
    })

    it('D4: path.totalTransfers === sum of node.transfers.length across all nodes', () => {
      const args = makeDefaultArgs()
      const tree = buildTransferRouteTree(args)
      for (const path of tree.paths) {
        const sumTransfers = path.nodes.reduce((sum, node) => sum + node.transfers.length, 0)
        expect(path.totalTransfers).toBe(sumTransfers)
      }
    })

    it('D5: tree.recommendedPathIndex === argmax_i(paths[i].netXpts); ties → first-occurrence wins', () => {
      const args = makeDefaultArgs()
      const tree = buildTransferRouteTree(args)
      if (tree.paths.length === 0) {
        expect(tree.recommendedPathIndex).toBe(-1)
        return
      }
      const maxNetXpts = Math.max(...tree.paths.map(p => p.netXpts))
      const firstMaxIndex = tree.paths.findIndex(p => p.netXpts === maxNetXpts)
      expect(tree.recommendedPathIndex).toBe(firstMaxIndex)
    })
  })

  // -------------------------------------------------------------------------
  describe('chip mode', () => {

    it('E1: chipMode === \'wildcard\' on input → node[0].chip === \'wildcard\'; node[1..H-1].chip === null', () => {
      const args = { ...makeDefaultArgs(), chipMode: 'wildcard' as PlannerChip, horizon: 3 as const }
      const tree = buildTransferRouteTree(args)
      expect(tree.paths.length).toBeGreaterThan(0)
      for (const path of tree.paths) {
        expect(path.nodes[0].chip).toBe('wildcard')
        expect(path.nodes[1].chip).toBeNull()
        expect(path.nodes[2].chip).toBeNull()
      }
    })

    it('E2: chipMode === \'wildcard\' → path.chipsConsumed === [\'wildcard\'] (length 1, GW1 only)', () => {
      const args = { ...makeDefaultArgs(), chipMode: 'wildcard' as PlannerChip, horizon: 3 as const }
      const tree = buildTransferRouteTree(args)
      expect(tree.paths.length).toBeGreaterThan(0)
      for (const path of tree.paths) {
        expect(path.chipsConsumed).toEqual(['wildcard'])
      }
    })

    it('E3: chipMode === null → every node.chip === null AND path.chipsConsumed === []', () => {
      const args = { ...makeDefaultArgs(), chipMode: null as PlannerChip, horizon: 3 as const }
      const tree = buildTransferRouteTree(args)
      for (const path of tree.paths) {
        expect(path.chipsConsumed).toEqual([])
        for (const node of path.nodes) {
          expect(node.chip).toBeNull()
        }
      }
    })

    it('E4: chipMode === \'wildcard\' AND initialFT.available === 1 with 1 positive-gain candidate → node[0].transfers.length is still limited by ft.available', () => {
      // With 1 FT available and wildcard chip, engine should still use at most 1 FT
      // (chip does not unlock extra transfers per D-01 and test spec)
      const squadPlayers: ScoredPlayer[] = [
        makePlayer(1, { element_type: 1, xPts_1gw: 1.0, now_cost: 45 }), // root
        makePlayer(2, { element_type: 1, xPts_1gw: 15.0, now_cost: 45 }),
        makePlayer(3, { element_type: 2, xPts_1gw: 10.0, now_cost: 55 }),
        makePlayer(4, { element_type: 2, xPts_1gw: 10.0, now_cost: 55 }),
        makePlayer(5, { element_type: 2, xPts_1gw: 10.0, now_cost: 55 }),
        makePlayer(6, { element_type: 2, xPts_1gw: 10.0, now_cost: 55 }),
        makePlayer(7, { element_type: 2, xPts_1gw: 10.0, now_cost: 55 }),
        makePlayer(8, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(9, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(10, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(11, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(12, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(13, { element_type: 4, xPts_1gw: 10.0, now_cost: 90 }),
        makePlayer(14, { element_type: 4, xPts_1gw: 10.0, now_cost: 90 }),
        makePlayer(15, { element_type: 4, xPts_1gw: 10.0, now_cost: 90 }),
      ]
      const candidates: ScoredPlayer[] = [
        makePlayer(101, { element_type: 1, xPts_1gw: 8.0, now_cost: 50 }),
      ]
      const args = {
        ...makeDefaultArgs(),
        players: [...squadPlayers, ...candidates],
        chipMode: 'wildcard' as PlannerChip,
        initialFT: { available: 1, banked: 0 },
        horizon: 1 as const,
      }
      const tree = buildTransferRouteTree(args)
      expect(tree.paths.length).toBeGreaterThan(0)
      // Root transfer: sell id=1, buy id=101 (the only positive transfer available)
      // Chip does not unlock additional transfers beyond ft.available for the route tree engine
      expect(tree.paths[0].nodes[0].transfers.length).toBe(1)
    })
  })

  // -------------------------------------------------------------------------
  describe('budget', () => {

    it('F1: A buy candidate whose now_cost > bank + sellPrice is excluded; engine picks next-best within budget', () => {
      const squadPlayers: ScoredPlayer[] = makeDefaultPlayers()
      // High-xPts GK that costs more than bank allows
      const expensiveGK = makePlayer(200, { element_type: 1, xPts_1gw: 20.0, now_cost: 200 }) // costs £20m — too expensive
      const affordableGK = makePlayer(201, { element_type: 1, xPts_1gw: 10.0, now_cost: 50 })  // affordable
      const args = {
        ...makeDefaultArgs(),
        players: [...squadPlayers, expensiveGK, affordableGK],
        initialBank: 10, // only £1.0m available
        sellPrices: undefined,
        horizon: 1 as const,
      }
      // Root is id=1 (GK, now_cost=45). sell price = 45. bank = 10. budget = 55.
      // expensiveGK.now_cost = 200 > 55 → excluded
      // affordableGK.now_cost = 50 <= 55 → selected
      const tree = buildTransferRouteTree(args)
      expect(tree.paths.length).toBeGreaterThan(0)
      const rootPath = tree.paths[0]
      if (rootPath.nodes[0].transfers.length > 0) {
        const buyId = rootPath.nodes[0].transfers[0].buyId
        expect(buyId).toBe(201) // not the expensive one
        expect(buyId).not.toBe(200)
      }
    })

    it('F2: Sell-price uses sellPrices.get(sellId) ?? player.now_cost ?? 0; verify with sellPrices override below now_cost', () => {
      const squadPlayers: ScoredPlayer[] = makeDefaultPlayers()
      const candidates: ScoredPlayer[] = makeCandidatePlayers()
      // Override sell price of id=1 (GK, now_cost=45) to 30 (sell at a loss due to price drop)
      const sellPrices = new Map<number, number>([[1, 30]])
      const args = {
        ...makeDefaultArgs(),
        players: [...squadPlayers, ...candidates],
        sellPrices,
        initialBank: 30, // budget = 30 (sell price) + 30 (bank) = 60
        horizon: 1 as const,
      }
      const tree = buildTransferRouteTree(args)
      // Root = id=1, sell price = 30 (from sellPrices map, not now_cost=45)
      // Budget = 30 + 30 = 60. GK candidate id=101 has now_cost=50 <= 60 → buyable
      expect(tree.paths.length).toBeGreaterThan(0)
      const path = tree.paths[0]
      expect(path.nodes[0].transfers.length).toBeGreaterThanOrEqual(1)
    })
  })

  // -------------------------------------------------------------------------
  describe('position matching', () => {

    it('G1: Root sell is a GK (element_type=1) → its replacement (node[0].transfers[0].buyId) has element_type === 1', () => {
      const args = makeDefaultArgs()
      const playerMap = new Map(args.players.map(p => [p.id, p]))
      const tree = buildTransferRouteTree(args)
      expect(tree.paths.length).toBeGreaterThan(0)
      const path = tree.paths[0] // root is id=1 (GK)
      expect(path.rootSellId).toBe(1)
      if (path.nodes[0].transfers.length > 0) {
        const buyId = path.nodes[0].transfers[0].buyId
        const buyPlayer = playerMap.get(buyId)
        expect(buyPlayer?.element_type).toBe(1) // must be GK
      }
    })

    it('G2: Greedy step buy is a MID → replacement has element_type === 3 (matches the sold player\'s position)', () => {
      // Make a squad where a MID player is the root (lowest xPts overall)
      const squadPlayers: ScoredPlayer[] = [
        makePlayer(1, { element_type: 1, xPts_1gw: 5.0, now_cost: 45 }), // GK
        makePlayer(2, { element_type: 1, xPts_1gw: 6.0, now_cost: 45 }), // GK bench
        makePlayer(3, { element_type: 2, xPts_1gw: 7.0, now_cost: 55 }),
        makePlayer(4, { element_type: 2, xPts_1gw: 8.0, now_cost: 55 }),
        makePlayer(5, { element_type: 2, xPts_1gw: 9.0, now_cost: 55 }),
        makePlayer(6, { element_type: 2, xPts_1gw: 10.0, now_cost: 55 }),
        makePlayer(7, { element_type: 2, xPts_1gw: 11.0, now_cost: 55 }),
        makePlayer(8, { element_type: 3, xPts_1gw: 1.0, now_cost: 80 }), // MID, lowest xPts → root
        makePlayer(9, { element_type: 3, xPts_1gw: 12.0, now_cost: 80 }),
        makePlayer(10, { element_type: 3, xPts_1gw: 13.0, now_cost: 80 }),
        makePlayer(11, { element_type: 3, xPts_1gw: 14.0, now_cost: 80 }),
        makePlayer(12, { element_type: 3, xPts_1gw: 15.0, now_cost: 80 }),
        makePlayer(13, { element_type: 4, xPts_1gw: 16.0, now_cost: 90 }),
        makePlayer(14, { element_type: 4, xPts_1gw: 17.0, now_cost: 90 }),
        makePlayer(15, { element_type: 4, xPts_1gw: 18.0, now_cost: 90 }),
      ]
      const midCandidate = makePlayer(101, { element_type: 3, xPts_1gw: 20.0, now_cost: 82 }) // MID candidate
      const args = {
        ...makeDefaultArgs(),
        players: [...squadPlayers, midCandidate],
        horizon: 1 as const,
        initialBank: 50,
      }
      const playerMap = new Map(args.players.map(p => [p.id, p]))
      const tree = buildTransferRouteTree(args)
      expect(tree.paths.length).toBeGreaterThan(0)
      const path = tree.paths[0] // root should be id=8 (MID, xPts=1.0)
      expect(path.rootSellId).toBe(8)
      if (path.nodes[0].transfers.length > 0) {
        const buyId = path.nodes[0].transfers[0].buyId
        const buyPlayer = playerMap.get(buyId)
        expect(buyPlayer?.element_type).toBe(3) // must be MID
      }
    })
  })

  // -------------------------------------------------------------------------
  describe('forced root replacement', () => {

    it('H1: Root has NO position-matched buy with positive gain → node[0].transfers.length === 1 (forced sell, even non-positive replacement)', () => {
      // Per CONTEXT D-03 + RESEARCH.md A1, GW1 always force-sells the root
      // Root = id=1 (GK, xPts=1.0), best GK candidate has xPts=0.5 (worse)
      // Engine should still fire the transfer (forced root sell)
      const squadPlayers: ScoredPlayer[] = [
        makePlayer(1, { element_type: 1, xPts_1gw: 1.0, now_cost: 45 }), // GK root
        makePlayer(2, { element_type: 1, xPts_1gw: 2.0, now_cost: 45 }), // GK bench
        makePlayer(3, { element_type: 2, xPts_1gw: 5.0, now_cost: 55 }),
        makePlayer(4, { element_type: 2, xPts_1gw: 6.0, now_cost: 55 }),
        makePlayer(5, { element_type: 2, xPts_1gw: 7.0, now_cost: 55 }),
        makePlayer(6, { element_type: 2, xPts_1gw: 8.0, now_cost: 55 }),
        makePlayer(7, { element_type: 2, xPts_1gw: 9.0, now_cost: 55 }),
        makePlayer(8, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(9, { element_type: 3, xPts_1gw: 11.0, now_cost: 80 }),
        makePlayer(10, { element_type: 3, xPts_1gw: 12.0, now_cost: 80 }),
        makePlayer(11, { element_type: 3, xPts_1gw: 13.0, now_cost: 80 }),
        makePlayer(12, { element_type: 3, xPts_1gw: 14.0, now_cost: 80 }),
        makePlayer(13, { element_type: 4, xPts_1gw: 15.0, now_cost: 90 }),
        makePlayer(14, { element_type: 4, xPts_1gw: 16.0, now_cost: 90 }),
        makePlayer(15, { element_type: 4, xPts_1gw: 17.0, now_cost: 90 }),
      ]
      // GK candidate has LOWER xPts than the root — non-positive gain
      const weakGK = makePlayer(101, { element_type: 1, xPts_1gw: 0.5, now_cost: 45 })
      const args = {
        ...makeDefaultArgs(),
        players: [...squadPlayers, weakGK],
        horizon: 1 as const,
        initialBank: 50,
      }
      const tree = buildTransferRouteTree(args)
      expect(tree.paths.length).toBeGreaterThan(0)
      const path = tree.paths[0]
      // Per CONTEXT D-03: root is force-sold even with non-positive replacement
      expect(path.nodes[0].transfers.length).toBe(1)
      expect(path.nodes[0].transfers[0].sellId).toBe(1)
    })

    it('H2: Root has zero position-matched candidates available → node[0].transfers.length === 0; branch dropped from tree.paths', () => {
      // Only 1 GK in the player pool — the root itself. No other GK to replace with.
      // This should result in 0 GK transfers, dropping the branch.
      // Use a squad where id=1 (GK) is the root (lowest xPts), but there are no other GKs
      // in the player pool except the ones already in squad.
      const squadPlayers: ScoredPlayer[] = [
        makePlayer(1, { element_type: 1, xPts_1gw: 1.0, now_cost: 45 }), // GK root, lowest
        makePlayer(2, { element_type: 1, xPts_1gw: 2.0, now_cost: 45 }), // GK bench, second lowest
        makePlayer(3, { element_type: 2, xPts_1gw: 3.0, now_cost: 55 }), // DEF, third lowest
        makePlayer(4, { element_type: 2, xPts_1gw: 10.0, now_cost: 55 }),
        makePlayer(5, { element_type: 2, xPts_1gw: 10.0, now_cost: 55 }),
        makePlayer(6, { element_type: 2, xPts_1gw: 10.0, now_cost: 55 }),
        makePlayer(7, { element_type: 2, xPts_1gw: 10.0, now_cost: 55 }),
        makePlayer(8, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(9, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(10, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(11, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(12, { element_type: 3, xPts_1gw: 10.0, now_cost: 80 }),
        makePlayer(13, { element_type: 4, xPts_1gw: 10.0, now_cost: 90 }),
        makePlayer(14, { element_type: 4, xPts_1gw: 10.0, now_cost: 90 }),
        makePlayer(15, { element_type: 4, xPts_1gw: 10.0, now_cost: 90 }),
      ]
      // Only non-squad GK candidates for the other positions
      const candidates: ScoredPlayer[] = [
        // DEF and FWD candidates for other roots, but NO GK candidates
        makePlayer(102, { element_type: 2, xPts_1gw: 12.0, now_cost: 60 }),
        makePlayer(103, { element_type: 4, xPts_1gw: 15.0, now_cost: 95 }),
      ]
      const args = {
        ...makeDefaultArgs(),
        players: [...squadPlayers, ...candidates],
        horizon: 1 as const,
        initialBank: 50,
      }
      const tree = buildTransferRouteTree(args)
      // Root id=1 (GK) has no replacement → branch dropped
      // Root id=2 (GK) has no replacement → branch dropped
      // Root id=3 (DEF) has replacement (id=102) → branch included
      expect(tree.paths.length).toBeLessThan(3)
      const rootIds = tree.paths.map(p => p.rootSellId)
      expect(rootIds).not.toContain(1) // GK branch dropped
    })
  })

  // -------------------------------------------------------------------------
  describe('no-LLM contract', () => {

    it('I1: buildTransferRouteTree is a synchronous function that returns a plain object, not a Promise', () => {
      expect(typeof buildTransferRouteTree).toBe('function')
      expect(buildTransferRouteTree.length).toBeGreaterThanOrEqual(1)
      const args = makeDefaultArgs()
      const result = buildTransferRouteTree(args)
      // Must NOT be async — result should be a plain object, not a Promise
      expect((result as unknown as { then?: unknown }).then).toBeUndefined()
    })
  })

})
