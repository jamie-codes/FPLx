export function playerImageUrl(code: number): string {
  return `https://resources.premierleague.com/premierleague/photos/players/110x140/p${code}.png`
}

export function teamBadgeUrl(teamCode: number): string {
  return `https://resources.premierleague.com/premierleague/badges/t${teamCode}.png`
}

export function teamKitUrl(teamCode: number): string {
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${teamCode}-66.png`
}
