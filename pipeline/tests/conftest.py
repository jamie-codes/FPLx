"""Pytest configuration for pipeline tests.

Mirrors pipeline/run.py's sys.path injection so tests can import pipeline
modules by bare name (e.g., `from accuracy import ...`) rather than
`from pipeline.accuracy import ...`. This matches how run.py imports its
sibling modules and keeps the tests aligned with production import style.
"""

import os
import sys

# Insert pipeline/ (the parent of tests/) onto sys.path so bare imports work
PIPELINE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PIPELINE_DIR not in sys.path:
    sys.path.insert(0, PIPELINE_DIR)
