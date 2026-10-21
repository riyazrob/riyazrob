#!/usr/bin/env python3
"""Pad future dates in the current week with neutral contribution cells."""

from pathlib import Path
import re
import sys

CELL_PATTERN = re.compile(
    r'<rect class="c(?: c\d+)?" x="(?P<x>-?\d+(?:\.\d+)?)" '
    r'y="(?P<y>-?\d+(?:\.\d+)?)"'
)


def pad_current_week(svg_path: Path) -> None:
    svg = svg_path.read_text(encoding="utf-8")
    cells = list(CELL_PATTERN.finditer(svg))
    if not cells:
        raise SystemExit(f"No contribution cells found in {svg_path}")

    coordinates = {
        (match.group("x"), match.group("y")) for match in cells
    }
    max_x = max(float(x) for x, _ in coordinates)
    last_column_x = next(x for x, _ in coordinates if float(x) == max_x)
    row_positions = sorted(
        {y for _, y in coordinates}, key=float
    )
    missing = [
        y for y in row_positions if (last_column_x, y) not in coordinates
    ]
    if not missing:
        print(f"{svg_path}: current-week column already complete")
        return

    placeholders = "".join(
        f'<rect class="c" x="{last_column_x}" y="{y}" rx="2" ry="2"/>'
        for y in missing
    )
    insert_before = re.search(r'<rect class="u(?:\s|\")', svg)
    if not insert_before:
        insert_before = re.search(r'<rect class="s(?:\s|\")', svg)
    if not insert_before:
        raise SystemExit(f"Could not find insertion point in {svg_path}")

    svg = svg[: insert_before.start()] + placeholders + svg[insert_before.start() :]
    svg_path.write_text(svg, encoding="utf-8")
    print(f"{svg_path}: added {len(missing)} neutral future-date cells")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: pad-contribution-grid.py SVG [SVG ...]")
    for argument in sys.argv[1:]:
        pad_current_week(Path(argument))
