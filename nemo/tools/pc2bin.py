#!/usr/bin/env python3
"""Convert a NeMO point-cloud JSON export into the binary format PointCloudViewer.js loads.

Input JSON:
    {
      "points":       [[x, y, z], ...],
      "colors":       [[r, g, b], ...],       # optional; floats in 0..1 or ints in 0..255
      "camera_poses": [[[4x4 row-major]], ...] # optional
    }

Output binary (little-endian):
    uint32           N   number of points
    uint32           P   number of camera poses
    float32[P * 16]      camera poses, row-major 4x4
    float32[N * 3]       positions
    uint8[N * 3]         colors

Usage:
    python3 nemo/tools/pc2bin.py path/to/points.json [path/to/points.bin]

If the output path is omitted, points.bin is written next to the input file.
Then point the viewer config in nemo/index.html at the .bin file.
"""
import json
import struct
import sys
from pathlib import Path

import numpy as np


def convert(src: Path, dst: Path) -> None:
    d = json.loads(src.read_text())

    pts = np.asarray(d["points"], dtype=np.float32).reshape(-1, 3)

    cols = d.get("colors")
    cols = np.asarray(cols, dtype=np.float64).reshape(-1, 3) if cols else np.ones_like(pts, dtype=np.float64)
    if len(cols) != len(pts):
        raise ValueError(f"{len(pts)} points but {len(cols)} colors")
    if cols.max() <= 1.0:
        cols = cols * 255.0
    cols = np.clip(np.rint(cols), 0, 255).astype(np.uint8)

    poses = np.asarray(d.get("camera_poses") or [], dtype=np.float32).reshape(-1, 16)

    with open(dst, "wb") as f:
        f.write(struct.pack("<II", len(pts), len(poses)))
        f.write(poses.astype("<f4").tobytes())
        f.write(pts.astype("<f4").tobytes())
        f.write(cols.tobytes())

    print(f"{dst}: {len(pts)} points, {len(poses)} camera poses, {dst.stat().st_size / 1e6:.2f} MB")


def main() -> None:
    if len(sys.argv) not in (2, 3):
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2]) if len(sys.argv) == 3 else src.with_name("points.bin")
    convert(src, dst)


if __name__ == "__main__":
    main()
