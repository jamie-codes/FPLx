---
date: "2026-04-01 12:00"
promoted: false
---

Some players (e.g. Groß FPL 783, M.Sarr FPL 231) have Understat IDs in player_id_map.json but are absent from Understat's actual dataset — showing blank xG/xA in GemTable. Consider switching xG source to FBref (via soccerdata FBref client) which has better squad-player coverage and uses StatsBomb model. Alternative: graceful fallback showing 0 with a "no data" indicator rather than blank.
