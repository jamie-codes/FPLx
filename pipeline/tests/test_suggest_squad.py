"""Contract tests for pipeline/suggest_squad.py force parameter (Phase 128 AUTO-02).

suggest_squad.py imports PuLP at module level and runs a full ILP solve when called.
To avoid importing PuLP at test time (and to avoid running a live ILP solve), these
tests use a REPLICA FUNCTION that mirrors the idempotency guard logic introduced by
D-03/D-04 rather than calling suggest_squad directly.

The replica function mirrors the exact wrapped guard structure that Task 1 adds to
pipeline/suggest_squad.py (lines immediately after `import os as _os` inside
suggest_squad):

    if not force:
        if USE_BLOB:           # blob path
            if blob_present: return True   # skip
        else:                  # local path
            if local_present: return True  # skip
    return False               # proceed

If production code in suggest_squad.py drifts from this structure (e.g. only one
branch is wrapped in `if not force:`), the replica-based tests here will NOT catch
that drift — but the acceptance criteria for Task 1 lock the structure via grep checks.
The purpose of these tests is to provide a living regression anchor for the D-03/D-04
contract: the two behaviours (force=False skip-if-exists; force=True bypass) remain
testable without PuLP.

References:
  AUTO-02: suggest_squad gains force=False; re-runs ILP on activation (D-03/D-04)
  D-03: force=True bypasses blob + local idempotency check only
  D-04: suggest_squad signature is suggest_squad(bootstrap, archive, force=False)
"""


# ---------------------------------------------------------------------------
# Replica function — mirrors the wrapped guard in suggest_squad.py
# ---------------------------------------------------------------------------
# Contract source: pipeline/suggest_squad.py — the if not force: block wrapping
# both the blob-path check AND the local-path check inside suggest_squad().
# If production drifts (e.g. only one branch wrapped), that is a bug per D-03;
# this test file anchors the intended contract. The replica keeps tests hermetic.


def _should_skip_due_to_idempotency(
    force: bool,
    use_blob: bool,
    blob_present: bool,
    local_present: bool,
) -> bool:
    """Replica of the idempotency guard in suggest_squad.py.

    Returns True when production code would early-return (skip ILP),
    and False when production code would proceed to the ILP solve.

    Mirrors:
        if not force:
            if use_blob:
                if blob_present: return True   # [suggest_squad] already exists — skipping.
            else:
                if local_present: return True  # [suggest_squad] already exists — skipping.
        return False  # proceed to score_map + ILP
    """
    if not force:
        if use_blob:
            if blob_present:
                return True   # skip
        else:
            if local_present:
                return True   # skip
    return False  # proceed


# ---------------------------------------------------------------------------
# force=False + blob path
# ---------------------------------------------------------------------------


def test_idempotency_skip_when_force_false_use_blob_blob_present():
    """force=False + USE_BLOB=true + blob list returns blobs → replica returns True (skip).

    Production: USE_BLOB branch checks blob list; non-empty list → early return.
    """
    result = _should_skip_due_to_idempotency(
        force=False, use_blob=True, blob_present=True, local_present=False
    )
    assert result is True


def test_idempotency_proceed_when_force_false_use_blob_blob_absent():
    """force=False + USE_BLOB=true + blob list returns empty → replica returns False (proceed).

    Production: USE_BLOB branch; empty blob list → falls through to ILP.
    """
    result = _should_skip_due_to_idempotency(
        force=False, use_blob=True, blob_present=False, local_present=False
    )
    assert result is False


# ---------------------------------------------------------------------------
# force=False + local path
# ---------------------------------------------------------------------------


def test_idempotency_skip_when_force_false_local_path_exists():
    """force=False + USE_BLOB=false + local path exists → replica returns True (skip).

    Production: local else branch; os.path.exists(local_path) True → early return.
    """
    result = _should_skip_due_to_idempotency(
        force=False, use_blob=False, blob_present=False, local_present=True
    )
    assert result is True


def test_idempotency_proceed_when_force_false_local_path_absent():
    """force=False + USE_BLOB=false + local path absent → replica returns False (proceed).

    Production: local else branch; os.path.exists(local_path) False → proceeds to ILP.
    """
    result = _should_skip_due_to_idempotency(
        force=False, use_blob=False, blob_present=False, local_present=False
    )
    assert result is False


# ---------------------------------------------------------------------------
# force=True — bypass tests (D-03: both paths bypassed)
# ---------------------------------------------------------------------------


def test_force_true_bypasses_blob_path_even_when_blob_present():
    """force=True + USE_BLOB=true + blob present → replica returns False (proceed, bypass).

    D-03: force=True skips the blob-path idempotency check entirely.
    Pre-existing pre_season_squad.json in Blob is overwritten.
    """
    result = _should_skip_due_to_idempotency(
        force=True, use_blob=True, blob_present=True, local_present=False
    )
    assert result is False


def test_force_true_bypasses_local_path_even_when_local_present():
    """force=True + USE_BLOB=false + local path exists → replica returns False (proceed, bypass).

    D-03: force=True skips the local-path idempotency check entirely.
    Ensures local development environments also bypass the cached squad.
    """
    result = _should_skip_due_to_idempotency(
        force=True, use_blob=False, blob_present=False, local_present=True
    )
    assert result is False
