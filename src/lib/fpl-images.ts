export function playerImageUrl(code: number): string {
  return `https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`
}

export function teamBadgeUrl(teamCode: number): string {
  return `https://resources.premierleague.com/premierleague/badges/t${teamCode}.png`
}
