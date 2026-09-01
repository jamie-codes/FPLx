/** Player headshot URL.
 *
 * PHOTO-01 (2026-09-01): prefer the api-football headshot the pipeline stamps
 * onto each player as `photo_url`. The Premier League CDN below has not
 * reshot players since Aug 2024, so anyone transferred since appears in their
 * old club's kit. `photoUrl` is absent for unmapped players, who fall back to
 * the PL photo — i.e. exactly the previous behaviour.
 */
export function playerImageUrl(code: number, photoUrl?: string | null): string {
  return photoUrl || `https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`
}

export function teamBadgeUrl(teamCode: number): string {
  return `https://resources.premierleague.com/premierleague/badges/t${teamCode}.png`
}

export function teamKitUrl(teamCode: number): string {
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}-66.png`
}
