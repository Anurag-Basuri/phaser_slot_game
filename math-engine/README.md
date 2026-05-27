# Sugar Blast 1000 — Math Engine

Stake Engine SDK-compliant math engine for the Sugar Blast 1000 slot game.

## Quick Start

```bash
pip install zstandard

# Generate reel strips
python generate_reels.py

# Generate RGS output files
python games/sugar_blast_1000/run.py

# Verify RTP
python rtp_test.py

# (Optional) Optimize reel weights
python optimize.py
```

## Output

After `run.py` completes, the uploadable files are in:
```
games/sugar_blast_1000/library/
```

Upload this directory to the Stake Admin Control Panel (ACP).

## Full Documentation

See [MATH_ENGINE_DOCUMENTATION.md](./MATH_ENGINE_DOCUMENTATION.md).
