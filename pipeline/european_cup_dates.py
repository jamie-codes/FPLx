"""European and domestic cup fixture dates for rotation risk detection.

Phase 80 GWI-01 (D-01/D-02): Static lookup imported by run.py via gw_intel.py.
ZERO HTTP calls. Maps FPL team_id -> list of ISO date strings (YYYY-MM-DD)
for remaining European + domestic cup fixtures this season.

Coverage: UCL/UEL/UECL semi-finals/finals + FA Cup Final dates that fall
within +-3 days of any GW36-38 PL kickoff. Update each season.
"""

# FPL team_id -> list[str] ISO date strings (YYYY-MM-DD)
# Empty dict permitted: rotation_risk will resolve to False for all teams.
# Populate per actual 2025/26 cup fixture calendar at execution time.
EUROPEAN_CUP_DATES: dict[int, list[str]] = {}
