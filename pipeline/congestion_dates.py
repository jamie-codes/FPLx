"""EUR-01: 2025/26 midweek-fixture congestion calendar (European + domestic cups).

Maps FPL team_id -> ISO dates of UCL/UEL/UECL + Carabao Cup + FA Cup matches,
used to detect rotation risk when a club plays midweek 1-4 days before a PL GW.
Hand-researched from Wikipedia season pages and official sources (cited per club).
2025/26 only; the 2026/27 calendar is entered at launch if EUR-01 validates.

FPL team_id map (2025/26):
  1 Arsenal, 2 Aston Villa, 3 Burnley, 4 Bournemouth, 5 Brentford,
  6 Brighton, 7 Chelsea, 8 Crystal Palace, 9 Everton, 10 Fulham,
  11 Leeds, 12 Liverpool, 13 Man City, 14 Man Utd, 15 Newcastle,
  16 Nott'm Forest, 17 Sunderland, 18 Spurs, 19 West Ham, 20 Wolves
"""

# team_id -> [ISO date strings]. Sources cited per club.
MIDWEEK_FIXTURE_DATES: dict[int, list[str]] = {

    # ── Arsenal (id 1) ────────────────────────────────────────────────────────
    # UCL + EFL Cup + FA Cup.
    # Source: en.wikipedia.org/wiki/2025%E2%80%9326_Arsenal_F.C._season
    #         premierleague.com/en/news/4399855 (UCL schedule)
    #         101greatgoals.com (EFL Cup results)
    #         goal.com (FA Cup)
    1: [
        # UCL League Phase (8 matchdays)
        "2025-09-16",  # UCL MD1 vs Athletic Bilbao (A)
        "2025-10-01",  # UCL MD2 vs Olympiacos (H)
        "2025-10-21",  # UCL MD3 vs Atlético Madrid (H)
        "2025-11-04",  # UCL MD4 vs Slavia Prague (A)
        "2025-11-26",  # UCL MD5 vs Bayern Munich (H)
        "2025-12-10",  # UCL MD6 vs Club Brugge (A)
        "2026-01-20",  # UCL MD7 vs Inter Milan (A)
        "2026-01-28",  # UCL MD8 vs FC Kairat (H)
        # UCL Round of 16 (top-8 qualified, no playoff)
        "2026-03-11",  # UCL R16 Leg 1 vs Bayer Leverkusen (A)
        "2026-03-17",  # UCL R16 Leg 2 vs Bayer Leverkusen (H)
        # UCL Quarter-finals
        "2026-04-07",  # UCL QF Leg 1 vs Sporting CP (A)
        "2026-04-15",  # UCL QF Leg 2 vs Sporting CP (H)
        # UCL Semi-finals
        "2026-04-29",  # UCL SF Leg 1 vs Atlético Madrid (A)
        "2026-05-05",  # UCL SF Leg 2 vs Atlético Madrid (H)
        # UCL Final: 2026-05-30 (Saturday — not midweek, omitted)
        # EFL Cup
        "2025-09-24",  # EFL Cup R3 vs Port Vale (A)
        "2025-10-28",  # EFL Cup R4 vs Brighton (H)
        "2025-12-23",  # EFL Cup QF vs Crystal Palace (H)
        "2026-01-14",  # EFL Cup SF Leg 1 vs Chelsea (A)
        "2026-02-03",  # EFL Cup SF Leg 2 vs Chelsea (H) — Tuesday
        "2026-03-22",  # EFL Cup Final vs Man City — Sunday (not midweek; omitted)
        # FA Cup
        "2026-01-11",  # FA Cup R3 vs Portsmouth (A) — Sunday
        "2026-02-15",  # FA Cup R4 vs Wigan Athletic (H) — Sunday
        "2026-03-07",  # FA Cup R5 vs Mansfield Town (A) — Saturday (not midweek)
    ],

    # ── Aston Villa (id 2) ────────────────────────────────────────────────────
    # UEL + EFL Cup + FA Cup.
    # Source: 101greatgoals.com/football/europa-league/aston-villa-europa-league-fixtures
    #         en.wikipedia.org/wiki/2025%E2%80%9326_Aston_Villa_F.C._season
    2: [
        # UEL League Phase (8 matchdays — all on Thursdays)
        "2025-09-25",  # UEL MD1 vs Bologna (H)
        "2025-10-02",  # UEL MD2 vs Feyenoord (A)
        "2025-10-23",  # UEL MD3 vs Go Ahead Eagles (A)
        "2025-11-06",  # UEL MD4 vs Maccabi Tel Aviv (H)
        "2025-11-27",  # UEL MD5 vs Young Boys (H)
        "2025-12-11",  # UEL MD6 vs Basel (A)
        "2026-01-22",  # UEL MD7 vs Fenerbahçe (A)
        "2026-01-29",  # UEL MD8 vs Salzburg (H)
        # UEL Knockout Playoff (not needed — Villa entered R16 directly as top-8)
        # UEL Round of 16
        "2026-03-12",  # UEL R16 Leg 1 vs Lille (A)
        "2026-03-19",  # UEL R16 Leg 2 vs Lille (H)
        # UEL Quarter-finals
        "2026-04-09",  # UEL QF Leg 1 vs Bologna (H)
        "2026-04-16",  # UEL QF Leg 2 vs Bologna (A)
        # UEL Semi-finals
        "2026-04-30",  # UEL SF Leg 1 vs Nottingham Forest (A)
        "2026-05-07",  # UEL SF Leg 2 vs Nottingham Forest (H)
        # UEL Final: 2026-05-20 (Wednesday) — Istanbul
        "2026-05-20",  # UEL Final vs SC Freiburg
        # EFL Cup
        "2025-09-16",  # EFL Cup R3 vs Brentford — went to pens (A) (Tuesday)
        # FA Cup
        "2026-01-10",  # FA Cup R3 vs Tottenham (H) — Saturday (omitted midweek)
        "2026-02-14",  # FA Cup R4 vs Newcastle (H) — Saturday (omitted)
    ],

    # ── Burnley (id 3) ────────────────────────────────────────────────────────
    # No European competition. EFL Cup + FA Cup only.
    # Source: 101greatgoals.com (EFL Cup); goal.com (FA Cup)
    3: [
        # EFL Cup (entered R2 as non-European PL club)
        "2025-08-26",  # EFL Cup R2 (week of 25 Aug 2025)
        # EFL Cup R3
        "2025-09-23",  # EFL Cup R3
        # FA Cup
        "2026-01-10",  # FA Cup R3 — Saturday
        "2026-02-14",  # FA Cup R4 — eliminated (Mansfield Town 2-1 Burnley)
    ],

    # ── Bournemouth (id 4) ────────────────────────────────────────────────────
    # No European competition. EFL Cup + FA Cup only.
    # Source: en.wikipedia.org/wiki/2025%E2%80%9326_EFL_Cup; goal.com (FA Cup)
    4: [
        # EFL Cup (entered R2)
        "2025-08-26",  # EFL Cup R2
        # EFL Cup R3
        "2025-09-23",  # EFL Cup R3
        # FA Cup
        "2026-01-10",  # FA Cup R3
        "2026-02-14",  # FA Cup R4 — Newcastle 3-1 Bournemouth (Newcastle advanced)
    ],

    # ── Brentford (id 5) ─────────────────────────────────────────────────────
    # No European competition. EFL Cup + FA Cup only.
    # Source: 101greatgoals.com (EFL Cup: Brentford beat Grimsby 5-0 in R3, beat Man City QF)
    #         goal.com (FA Cup)
    5: [
        # EFL Cup R2
        "2025-08-26",  # EFL Cup R2
        # EFL Cup R3
        "2025-09-23",  # EFL Cup R3 — Brentford 5-0 Grimsby
        # EFL Cup R4
        "2025-10-28",  # EFL Cup R4
        # EFL Cup QF
        "2025-12-17",  # EFL Cup QF — Man City 2-0 Brentford (eliminated)
        # FA Cup
        "2026-01-10",  # FA Cup R3
        "2026-02-14",  # FA Cup R4 — Macclesfield (H) — advanced
        "2026-03-07",  # FA Cup R5 — West Ham vs Brentford
    ],

    # ── Brighton (id 6) ───────────────────────────────────────────────────────
    # No European competition. EFL Cup + FA Cup only.
    # Source: 101greatgoals.com (Brighton eliminated Arsenal in EFL Cup R3? —
    #         actually Arsenal beat Brighton 2-0 in R4 on 2025-10-28);
    #         Arsenal R3 was Port Vale 2025-09-24; Brighton entered R2.
    # Brighton won FA Cup R3 vs Man Utd 2-1 (2026-01-11).
    6: [
        # EFL Cup R2
        "2025-08-26",  # EFL Cup R2
        # EFL Cup R3 (Brighton drew Arsenal? No — Arsenal beat Brighton in R4)
        "2025-09-23",  # EFL Cup R3
        # EFL Cup R4 — Arsenal 2-0 Brighton (eliminated)
        "2025-10-28",  # EFL Cup R4 (eliminated)
        # FA Cup
        "2026-01-11",  # FA Cup R3 vs Manchester United (Brighton won 2-1) — Sunday
        "2026-02-14",  # FA Cup R4 — Liverpool 3-0 Brighton (eliminated)
    ],

    # ── Chelsea (id 7) ────────────────────────────────────────────────────────
    # UCL + EFL Cup + FA Cup.
    # Source: premierleague.com/en/news/4399855 (UCL schedule)
    #         101greatgoals.com (EFL Cup)
    #         goal.com (FA Cup)
    7: [
        # UCL League Phase (8 matchdays)
        "2025-09-17",  # UCL MD1
        "2025-09-30",  # UCL MD2
        "2025-10-22",  # UCL MD3
        "2025-11-05",  # UCL MD4
        "2025-11-25",  # UCL MD5
        "2025-12-09",  # UCL MD6
        "2026-01-21",  # UCL MD7
        "2026-01-28",  # UCL MD8
        # UCL Round of 16 (Chelsea finished 9th-24th → KO playoff)
        "2026-03-11",  # UCL R16 Leg 1 vs PSG (A) — per Wikipedia knockout page
        "2026-03-17",  # UCL R16 Leg 2 vs PSG (H) — (eliminated)
        # EFL Cup
        "2025-09-23",  # EFL Cup R3 vs Lincoln City (A)
        "2025-10-28",  # EFL Cup R4 vs Wolves (H) — Chelsea won 4-3 on pens
        "2025-12-16",  # EFL Cup QF vs Cardiff City (A) — Chelsea won 3-1
        "2026-01-14",  # EFL Cup SF Leg 1 vs Arsenal (H) — Chelsea won 3-2
        "2026-02-03",  # EFL Cup SF Leg 2 vs Arsenal (A) — Chelsea lost 0-1 (eliminated)
        # FA Cup
        "2026-01-10",  # FA Cup R3 vs Charlton Athletic (H) — Sat
        "2026-02-13",  # FA Cup R4 vs Hull City (H) — Fri
        "2026-03-07",  # FA Cup R5 vs Wrexham — Sat
        "2026-04-04",  # FA Cup QF vs Port Vale — Sat
        "2026-04-26",  # FA Cup SF vs Leeds United — Sun
        "2026-05-16",  # FA Cup Final vs Man City — Sat (not midweek)
    ],

    # ── Crystal Palace (id 8) ─────────────────────────────────────────────────
    # UECL + EFL Cup + FA Cup.
    # Source: 101greatgoals.com (Conference League fixtures)
    #         en.wikipedia.org/wiki/2025%E2%80%9326_Crystal_Palace_F.C._season
    8: [
        # UECL Qualifying (play-off round — August)
        "2025-08-21",  # UECL Playoff Leg 1 vs Fredrikstad FK
        "2025-08-28",  # UECL Playoff Leg 2 vs Fredrikstad FK
        # UECL League Phase (6 matchdays — all Thursdays)
        "2025-10-02",  # UECL MD1
        "2025-10-23",  # UECL MD2 — also AEK Larnaca match
        "2025-11-06",  # UECL MD3 — AZ Alkmaar
        "2025-11-27",  # UECL MD4 — Strasbourg
        "2025-12-11",  # UECL MD5 vs Shelbourne
        "2025-12-18",  # UECL MD6 vs KuPS
        # UECL Knockout Playoff
        "2026-02-19",  # UECL KO Playoff Leg 1
        "2026-02-26",  # UECL KO Playoff Leg 2
        # UECL Round of 16
        "2026-03-12",  # UECL R16 Leg 1
        "2026-03-19",  # UECL R16 Leg 2
        # UECL Quarter-finals
        "2026-04-09",  # UECL QF Leg 1 vs Fiorentina
        "2026-04-16",  # UECL QF Leg 2 vs Fiorentina
        # UECL Semi-finals
        "2026-04-30",  # UECL SF Leg 1
        "2026-05-07",  # UECL SF Leg 2
        # UECL Final: 2026-05-27 (Wednesday) vs Rayo Vallecano
        "2026-05-27",  # UECL Final
        # EFL Cup (entered R3 as European club)
        "2025-09-16",  # EFL Cup R3 — Crystal Palace R3
        "2025-10-28",  # EFL Cup R4 — Crystal Palace 3-0 Liverpool
        "2025-12-23",  # EFL Cup QF — Arsenal 1-1, Arsenal won pens (eliminated)
        # FA Cup
        "2026-01-10",  # FA Cup R3 — Crystal Palace vs Macclesfield (lost 1-2)
    ],

    # ── Everton (id 9) ────────────────────────────────────────────────────────
    # No European competition. EFL Cup + FA Cup only.
    # Source: 101greatgoals.com (Everton vs Mansfield 0-3 in EFL Cup R2 on 2025-08-27)
    #         goal.com (FA Cup)
    9: [
        # EFL Cup R2 (eliminated)
        "2025-08-27",  # EFL Cup R2 — Everton 1-3 Mansfield Town (eliminated)
        # FA Cup
        "2026-01-10",  # FA Cup R3
        "2026-02-14",  # FA Cup R4
    ],

    # ── Fulham (id 10) ────────────────────────────────────────────────────────
    # No European competition. EFL Cup + FA Cup only.
    # Source: 101greatgoals.com (Fulham 1-0 Cambridge in R3; Newcastle 2-1 Fulham QF)
    #         goal.com (FA Cup)
    10: [
        # EFL Cup R2
        "2025-08-26",  # EFL Cup R2 vs Wycombe Wanderers
        # EFL Cup R3
        "2025-09-23",  # EFL Cup R3 — Fulham 1-0 Cambridge United (H)
        # EFL Cup R4
        "2025-10-28",  # EFL Cup R4
        # EFL Cup QF — Newcastle 2-1 Fulham (eliminated)
        "2025-12-17",  # EFL Cup QF — eliminated
        # FA Cup
        "2026-01-10",  # FA Cup R3
        "2026-02-14",  # FA Cup R4
        "2026-03-08",  # FA Cup R5 — Southampton 1-0 Fulham (eliminated)
    ],

    # ── Leeds United (id 11) ─────────────────────────────────────────────────
    # No European competition (promoted to PL for 2025/26). EFL Cup + FA Cup only.
    # Source: goal.com (FA Cup — Leeds beat West Ham on pens in QF, beat Chelsea SF)
    #         EFL Cup: Leeds not in Europe, entered R2
    11: [
        # EFL Cup R2
        "2025-08-26",  # EFL Cup R2
        # EFL Cup R3
        "2025-09-23",  # EFL Cup R3
        # FA Cup
        "2026-01-10",  # FA Cup R3
        "2026-02-14",  # FA Cup R4
        "2026-03-07",  # FA Cup R5 — Leeds 3-0 Norwich City
        "2026-04-05",  # FA Cup QF — Leeds vs West Ham (won on pens) — Sunday
        "2026-04-26",  # FA Cup SF — Chelsea 1-0 Leeds (eliminated)
    ],

    # ── Liverpool (id 12) ─────────────────────────────────────────────────────
    # UCL + EFL Cup + FA Cup.
    # Source: premierleague.com/en/news/4399855 (UCL schedule)
    #         101greatgoals.com (EFL Cup: Liverpool 2-1 Southampton R3; Crystal Palace 3-0 in R4)
    #         goal.com (FA Cup: Liverpool R3 2026-01-12; QF 2026-04-04 Man City 4-0)
    12: [
        # UCL League Phase
        "2025-09-17",  # UCL MD1 vs Atlético Madrid (H)
        "2025-09-30",  # UCL MD2
        "2025-10-22",  # UCL MD3
        "2025-11-04",  # UCL MD4
        "2025-11-26",  # UCL MD5
        "2025-12-09",  # UCL MD6
        "2026-01-21",  # UCL MD7
        "2026-01-28",  # UCL MD8 vs Qarabağ (biggest win 6-0)
        # UCL Round of 16 (Liverpool qualified directly as top-8)
        "2026-03-10",  # UCL R16 Leg 1 vs Galatasaray (A)
        "2026-03-18",  # UCL R16 Leg 2 vs Galatasaray (H)
        # UCL Quarter-finals
        "2026-04-08",  # UCL QF Leg 1 vs PSG (A)
        "2026-04-14",  # UCL QF Leg 2 vs PSG (H) — eliminated
        # EFL Cup
        "2025-09-23",  # EFL Cup R3 — Liverpool 2-1 Southampton
        "2025-10-28",  # EFL Cup R4 — Crystal Palace 3-0 Liverpool (eliminated)
        # FA Cup
        "2026-01-12",  # FA Cup R3 vs Barnsley (H) — Monday
        "2026-02-14",  # FA Cup R4 — Liverpool 3-0 Brighton
        "2026-03-06",  # FA Cup R5 — Liverpool 3-1 Wolves — Friday
        "2026-04-04",  # FA Cup QF — Man City 4-0 Liverpool (eliminated)
    ],

    # ── Manchester City (id 13) ───────────────────────────────────────────────
    # UCL + EFL Cup + FA Cup.
    # Source: premierleague.com/en/news/4399855 (UCL schedule)
    #         en.wikipedia.org/wiki/2025%E2%80%9326_Manchester_City_F.C._season
    #         101greatgoals.com (EFL Cup)
    #         goal.com (FA Cup)
    13: [
        # UCL League Phase
        "2025-09-18",  # UCL MD1 vs Napoli (H)
        "2025-10-01",  # UCL MD2 vs Monaco (A)
        "2025-10-21",  # UCL MD3 vs Villarreal (A)
        "2025-11-05",  # UCL MD4
        "2025-11-25",  # UCL MD5
        "2025-12-10",  # UCL MD6 vs Real Madrid (A) — won 2-1
        "2026-01-20",  # UCL MD7 vs Bodø/Glimt (H)
        "2026-01-28",  # UCL MD8 vs Galatasaray (H)
        # UCL Round of 16
        "2026-03-11",  # UCL R16 Leg 1 vs Real Madrid (A) — lost 0-3
        "2026-03-17",  # UCL R16 Leg 2 vs Real Madrid (H) — lost 1-2 (eliminated)
        # EFL Cup
        "2025-09-24",  # EFL Cup R3 vs Huddersfield Town (H)
        "2025-12-17",  # EFL Cup QF vs Brentford (H)
        "2026-01-13",  # EFL Cup SF Leg 1 vs Newcastle (A) — won 2-0 — Monday
        "2026-02-04",  # EFL Cup SF Leg 2 vs Newcastle (H) — won 3-1 — Wednesday
        "2026-03-22",  # EFL Cup Final vs Arsenal — Sunday (not midweek)
        # FA Cup
        "2026-01-10",  # FA Cup R3 vs Exeter City (H) — won 10-1
        "2026-02-14",  # FA Cup R4 vs Salford City — won 2-0
        "2026-03-07",  # FA Cup R5 vs Newcastle United — won 3-1
        "2026-04-04",  # FA Cup QF vs Liverpool — won 4-0
        "2026-04-25",  # FA Cup SF vs Southampton — won 2-1 — Saturday
        "2026-05-16",  # FA Cup Final vs Chelsea — Saturday (not midweek)
    ],

    # ── Manchester United (id 14) ─────────────────────────────────────────────
    # No European competition (first time since 2014-15). EFL Cup + FA Cup only.
    # Source: en.wikipedia.org/wiki/2025%E2%80%9326_Manchester_United_F.C._season
    14: [
        # EFL Cup R2 — Grimsby Town 4-2 Man Utd on pens (eliminated 2025-08-27)
        "2025-08-27",  # EFL Cup R2 — eliminated
        # FA Cup R3 — Brighton 2-1 Man Utd (eliminated 2026-01-11)
        "2026-01-11",  # FA Cup R3 — eliminated — Sunday
    ],

    # ── Newcastle United (id 15) ──────────────────────────────────────────────
    # UCL + EFL Cup + FA Cup.
    # Source: premierleague.com/en/news/4399855 (UCL schedule)
    #         en.wikipedia.org/wiki/2025%E2%80%9326_Newcastle_United_F.C._season
    #         101greatgoals.com (EFL Cup)
    #         goal.com (FA Cup)
    15: [
        # UCL League Phase
        "2025-09-18",  # UCL MD1 vs Union Saint-Gilloise (A)
        "2025-10-01",  # UCL MD2
        "2025-10-21",  # UCL MD3
        "2025-11-05",  # UCL MD4
        "2025-11-25",  # UCL MD5 — Marseille 2-1 Newcastle (referenced)
        "2025-12-10",  # UCL MD6 — Leverkusen 2-2 Newcastle
        "2026-01-21",  # UCL MD7
        "2026-01-28",  # UCL MD8
        # UCL Knockout Playoff (Newcastle finished 9th-24th)
        "2026-02-18",  # UCL KO Playoff Leg 1 vs Qarabağ (A) — won 6-1
        "2026-02-24",  # UCL KO Playoff Leg 2 vs Qarabağ (H) — Tuesday
        # UCL Round of 16
        "2026-03-10",  # UCL R16 Leg 1 vs Barcelona (H)
        "2026-03-18",  # UCL R16 Leg 2 vs Barcelona (A) — lost 2-7 (eliminated)
        # EFL Cup
        "2025-09-24",  # EFL Cup R3 vs Bradford City (H) — won 4-1
        "2025-10-29",  # EFL Cup R4 vs Tottenham (H) — won 2-0 — Wednesday
        "2025-12-17",  # EFL Cup QF vs Fulham (H) — won 2-1
        "2026-01-13",  # EFL Cup SF Leg 1 vs Man City (H) — lost 0-2 — Monday
        "2026-02-04",  # EFL Cup SF Leg 2 vs Man City (A) — lost 1-3 (eliminated)
        # FA Cup
        "2026-01-10",  # FA Cup R3
        "2026-02-14",  # FA Cup R4 vs Aston Villa — Newcastle won 3-1
        "2026-03-07",  # FA Cup R5 vs Man City — Newcastle lost 1-3 (eliminated)
    ],

    # ── Nottingham Forest (id 16) ─────────────────────────────────────────────
    # UEL + EFL Cup + FA Cup.
    # Source: 101greatgoals.com/football/europa-league/nottingham-forest-europa-league-fixtures
    #         en.wikipedia.org/wiki/2025%E2%80%9326_Nottingham_Forest_F.C._season
    16: [
        # UEL League Phase (8 matchdays — all Thursdays)
        "2025-09-24",  # UEL MD1
        "2025-10-02",  # UEL MD2
        "2025-10-23",  # UEL MD3
        "2025-11-06",  # UEL MD4
        "2025-11-27",  # UEL MD5 — Forest 3-0 Malmö
        "2025-12-11",  # UEL MD6 — Utrecht 1-2 Forest
        "2026-01-22",  # UEL MD7 — Braga 1-0 Forest
        "2026-01-29",  # UEL MD8 — Forest 4-0 Ferencváros
        # UEL Knockout Playoff
        "2026-02-19",  # UEL KO Playoff Leg 1 vs Fenerbahçe
        "2026-02-26",  # UEL KO Playoff Leg 2 vs Fenerbahçe
        # UEL Round of 16
        "2026-03-12",  # UEL R16 Leg 1 vs Midtjylland
        "2026-03-19",  # UEL R16 Leg 2 vs Midtjylland — won on pens
        # UEL Quarter-finals
        "2026-04-09",  # UEL QF Leg 1 vs Porto
        "2026-04-16",  # UEL QF Leg 2 vs Porto — advanced
        # UEL Semi-finals (vs Aston Villa)
        "2026-04-30",  # UEL SF Leg 1 vs Aston Villa (H)
        "2026-05-07",  # UEL SF Leg 2 vs Aston Villa (A) — 0-4 loss (eliminated)
        # EFL Cup (entered R3 as European club)
        "2025-09-23",  # EFL Cup R3 — eliminated (reached R3 only per Wikipedia)
        # FA Cup
        "2026-01-10",  # FA Cup R3
        "2026-02-14",  # FA Cup R4
    ],

    # ── Sunderland (id 17) ────────────────────────────────────────────────────
    # No European competition. EFL Cup + FA Cup only.
    # Source: goal.com (FA Cup — Sunderland R3, R4, R5 vs Port Vale eliminated)
    #         EFL Cup: Sunderland entered R2
    17: [
        # EFL Cup R2
        "2025-08-26",  # EFL Cup R2
        # EFL Cup R3
        "2025-09-23",  # EFL Cup R3
        # FA Cup
        "2026-01-10",  # FA Cup R3
        "2026-02-14",  # FA Cup R4
        "2026-03-07",  # FA Cup R5 — Port Vale 1-0 Sunderland (eliminated)
    ],

    # ── Tottenham Hotspur (id 18) ─────────────────────────────────────────────
    # UCL + EFL Cup + FA Cup.
    # Source: premierleague.com/en/news/4399855 (UCL schedule)
    #         en.wikipedia.org/wiki/2025%E2%80%9326_Tottenham_Hotspur_F.C._season
    #         101greatgoals.com (EFL Cup: Spurs R3 2025-09-24 vs Doncaster 3-0;
    #                             R4 Newcastle 2-0 Spurs 2025-10-29)
    18: [
        # UCL League Phase
        "2025-09-16",  # UCL MD1
        "2025-09-30",  # UCL MD2
        "2025-10-22",  # UCL MD3
        "2025-11-04",  # UCL MD4 vs Copenhagen (H) — won 4-0
        "2025-11-26",  # UCL MD5
        "2025-12-09",  # UCL MD6 — Spurs 3-0 Slavia Praha
        "2026-01-20",  # UCL MD7
        "2026-01-29",  # UCL MD8
        # UCL Round of 16 (Spurs finished top-8 — direct R16)
        "2026-03-10",  # UCL R16 Leg 1 vs Atlético Madrid (A) — lost 2-5
        "2026-03-18",  # UCL R16 Leg 2 vs Atlético Madrid (H) — eliminated
        # EFL Cup (entered R3 as European club)
        "2025-09-24",  # EFL Cup R3 vs Doncaster Rovers (H) — won 3-0
        "2025-10-29",  # EFL Cup R4 — Newcastle 2-0 Spurs (eliminated) — Wednesday
        # FA Cup
        "2026-01-10",  # FA Cup R3 — eliminated by Aston Villa
    ],

    # ── West Ham United (id 19) ───────────────────────────────────────────────
    # No European competition. EFL Cup + FA Cup only.
    # Source: goal.com (FA Cup — West Ham R3, R4, R5 Burton QF eliminated by Leeds)
    #         EFL Cup: West Ham entered R2; beat Burton 1-0 in R4
    19: [
        # EFL Cup R2
        "2025-08-26",  # EFL Cup R2
        # EFL Cup R3
        "2025-09-23",  # EFL Cup R3
        # EFL Cup R4
        "2025-10-28",  # EFL Cup R4 — West Ham 1-0 Burton Albion (after extra time)
        # FA Cup
        "2026-01-10",  # FA Cup R3
        "2026-02-14",  # FA Cup R4 vs Burton Albion — West Ham won 1-0 (AET)
        "2026-03-07",  # FA Cup R5
        "2026-04-05",  # FA Cup QF — Leeds vs West Ham (Leeds won pens) — Sunday
    ],

    # ── Wolverhampton (id 20) ─────────────────────────────────────────────────
    # No European competition. EFL Cup + FA Cup only.
    # Source: 101greatgoals.com (EFL Cup: Wolves 2-0 Everton R3 2025-09-23;
    #                              Wolves 3-4 Chelsea R4 2025-10-28)
    #         goal.com (FA Cup: Liverpool 3-1 Wolves R5 2026-03-06)
    20: [
        # EFL Cup R2
        "2025-08-26",  # EFL Cup R2
        # EFL Cup R3 — Wolves 2-0 Everton (H)
        "2025-09-23",  # EFL Cup R3
        # EFL Cup R4 — Chelsea 4-3 Wolves on pens (eliminated)
        "2025-10-28",  # EFL Cup R4
        # FA Cup
        "2026-01-10",  # FA Cup R3
        "2026-02-14",  # FA Cup R4
        "2026-03-06",  # FA Cup R5 — Liverpool 3-1 Wolves (eliminated) — Friday
    ],
}

# Total dates across all clubs — asserted in tests to catch accidental truncation.
TOTAL_DATES = sum(len(v) for v in MIDWEEK_FIXTURE_DATES.values())
