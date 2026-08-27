"""Create alphaScreen SVG mark masters from the approved source artwork.

Requires vtracer on PYTHONPATH. The source PNGs are the exact assets extracted
from alphaScreen-logo-directions.pdf; the generated SVGs contain paths only.
"""

from pathlib import Path
import sys

import vtracer


PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_ROOT = PROJECT_ROOT / "src/assets/branding/alphascreen/marks"


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: vectorize-alphascreen-marks.py /path/to/extracted-source-pngs")

    source_root = Path(sys.argv[1]).expanduser().resolve()
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)

    for geometry in ("08", "09"):
        for treatment in ("gradient", "navy", "white", "duotone", "teal"):
            source_name = (
                f"lockup-icon-{geometry}-white.png"
                if treatment == "teal"
                else f"mark-{geometry}-{treatment}.png"
            )
            source = source_root / source_name
            output = OUTPUT_ROOT / f"alphascreen-mark-{geometry}-{treatment}.svg"

            if not source.exists():
                raise FileNotFoundError(source)

            vtracer.convert_image_to_svg_py(
                str(source),
                str(output),
                colormode="color",
                hierarchical="stacked",
                mode="spline",
                filter_speckle=2,
                color_precision=8,
                layer_difference=8,
                corner_threshold=60,
                length_threshold=4.0,
                max_iterations=10,
                splice_threshold=45,
                path_precision=3,
            )
            print(output.relative_to(PROJECT_ROOT))


if __name__ == "__main__":
    main()
