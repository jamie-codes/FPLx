// Phase 67 NLP-01 D-12 — exact-match player-name guardrail (case-insensitive, whitespace-normalised).
// Mirror algorithm: pipeline/prose_summary.py::_passes_guardrail (Plan 02). Both implementations MUST agree.

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * Return the (normalised) corpus names that appear in `prose` but are NOT in the allowed set.
 * Empty array means the prose passes the guardrail.
 */
export function findHallucinatedNames(
  prose: string,
  allowedNames: string[],
  candidatePlayerNames: string[],
): string[] {
  const allowed = new Set(allowedNames.map(normalize))
  const proseLower = normalize(prose)
  const hits: string[] = []
  for (const raw of candidatePlayerNames) {
    const n = normalize(raw)
    if (!n) continue
    if (proseLower.includes(n) && !allowed.has(n)) {
      hits.push(n)
    }
  }
  return hits
}

export function passesGuardrail(
  prose: string,
  allowed: string[],
  corpus: string[],
): boolean {
  return findHallucinatedNames(prose, allowed, corpus).length === 0
}
