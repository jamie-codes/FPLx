// FPL team codes (team.code from bootstrap-static) mapped from short_name.
// Used to construct badge URLs: https://resources.premierleague.com/premierleague/badges/t{code}.png
export const TEAM_BADGE_CODE: Record<string, number> = {
  ARS: 3,
  AVL: 7,
  BOU: 91,
  BRE: 94,
  BHA: 36,
  BUR: 90,
  CHE: 8,
  CRY: 31,
  EVE: 11,
  FUL: 54,
  IPS: 40,
  LEE: 2,
  LEI: 13,
  LIV: 14,
  LUT: 102,
  MCI: 43,
  MUN: 1,
  NEW: 4,
  NFO: 17,
  SHU: 49,
  SOU: 20,
  SUN: 56,
  TOT: 6,
  WHU: 21,
  WOL: 39,
}

export interface TeamColour {
  primary: string   // main shirt colour (hex)
  secondary: string // trim/sleeve colour (hex)
  text: string      // readable text on primary background (hex)
}

export const TEAM_COLOURS: Record<string, TeamColour> = {
  ARS: { primary: '#EF0107', secondary: '#063672', text: '#FFFFFF' },
  AVL: { primary: '#670E36', secondary: '#95BFE5', text: '#FFFFFF' },
  BOU: { primary: '#DA291C', secondary: '#000000', text: '#FFFFFF' },
  BRE: { primary: '#FF0000', secondary: '#FFFFFF', text: '#FFFFFF' },
  BHA: { primary: '#0057B8', secondary: '#FFCD00', text: '#FFFFFF' },
  BUR: { primary: '#6C1D45', secondary: '#99D6EA', text: '#FFFFFF' },
  CHE: { primary: '#034694', secondary: '#DBA111', text: '#FFFFFF' },
  CRY: { primary: '#1B458F', secondary: '#C4122E', text: '#FFFFFF' },
  EVE: { primary: '#003399', secondary: '#FFFFFF', text: '#FFFFFF' },
  FUL: { primary: '#CC0000', secondary: '#000000', text: '#FFFFFF' },
  IPS: { primary: '#0044A9', secondary: '#FFFFFF', text: '#FFFFFF' },
  LEE: { primary: '#FFCD00', secondary: '#FFFFFF', text: '#1C4F9C' },
  LEI: { primary: '#003090', secondary: '#FDBE11', text: '#FFFFFF' },
  LIV: { primary: '#C8102E', secondary: '#00B2A9', text: '#FFFFFF' },
  LUT: { primary: '#F78F1E', secondary: '#002663', text: '#FFFFFF' },
  MCI: { primary: '#6CABDD', secondary: '#1C2C5B', text: '#FFFFFF' },
  MUN: { primary: '#DA291C', secondary: '#FBE122', text: '#FFFFFF' },
  NEW: { primary: '#241F20', secondary: '#FFFFFF', text: '#FFFFFF' },
  NFO: { primary: '#DD0000', secondary: '#FFFFFF', text: '#FFFFFF' },
  SHU: { primary: '#EE2737', secondary: '#000000', text: '#FFFFFF' },
  SOU: { primary: '#D71920', secondary: '#FFC20E', text: '#FFFFFF' },
  SUN: { primary: '#EB172B', secondary: '#000000', text: '#FFFFFF' },
  TOT: { primary: '#132257', secondary: '#FFFFFF', text: '#FFFFFF' },
  WHU: { primary: '#7A263A', secondary: '#1BB1E7', text: '#FFFFFF' },
  WOL: { primary: '#FDB913', secondary: '#231F20', text: '#000000' },
}

export function getTeamBadgeCode(shortName: string): number | null {
  return TEAM_BADGE_CODE[shortName] ?? null
}

export function getTeamColour(shortName: string): TeamColour {
  return TEAM_COLOURS[shortName] ?? { primary: '#71717A', secondary: '#FFFFFF', text: '#FFFFFF' }
}
