"""Stage A command line: train, evaluate, detect.

    python -m stage_a.cli train \
        --data-root stage_a/data/raw/oil-spill

    python -m stage_a.cli evaluate \
        --data-root stage_a/data/raw/oil-spill \
        --checkpoint stage_a/checkpoints/best.pt

    python -m stage_a.cli detect \
        --scene path/to/scene.tif \
        --case-id OS-001 \
        --detected-at 2026-08-29T10:30:00Z \
        --checkpoint stage_a/checkpoints/best.pt
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime
from pathlib import Path

from stage_a.config import PathConfig, TrainingConfig, resolve_device


def _configure_logging(verbose: bool) -> None:
    logging.basicConfig(
        level=logging.DEBUG if verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )


def cmd_train(args: argparse.Namespace) -> int:
    from stage_a.train import train

    config = TrainingConfig()
    if args.epochs:
        config.epochs = args.epochs
    if args.batch_size:
        config.batch_size = args.batch_size
    if args.device:
        config.device = args.device

    summary = train(Path(args.data_root), config=config, val_split=args.val_split)

    best = summary["best_oil_spill_iou"]
    print(f"\nBest oil-spill IoU: {best:.4f}" if best is not None else "\nNo validated epoch.")
    print(f"Checkpoint: {summary['best_checkpoint']}")
    if summary.get("validation_caveat"):
        print(f"\nCAVEAT: {summary['validation_caveat']}")
    return 0


def cmd_evaluate(args: argparse.Namespace) -> int:
    from torch.utils.data import DataLoader

    from stage_a.dataset import SARSegmentationDataset
    from stage_a.evaluate import evaluate_model
    from stage_a.model import load_checkpoint

    device = args.device or resolve_device()
    model, payload = load_checkpoint(Path(args.checkpoint), device=device)

    dataset = SARSegmentationDataset(
        Path(args.data_root), args.split, tile_size=payload["tile_size"], augment=False
    )
    loader = DataLoader(dataset, batch_size=args.batch_size, shuffle=False)

    report = evaluate_model(model, loader, device=device)
    print(report.render())

    output = Path(args.output or PathConfig().artifact_dir / "detection_metrics.json")
    report.save(output)
    print(f"\nWritten to {output}")
    return 0


def cmd_detect(args: argparse.Namespace) -> int:
    from stage_a.inference import load_scene, predict_scene
    from stage_a.model import load_checkpoint
    from stage_a.pipeline import NoDetectionError, detect_scene, write_artifact

    device = args.device or resolve_device()
    model, payload = load_checkpoint(Path(args.checkpoint), device=device)

    scene = load_scene(Path(args.scene))
    probabilities, mask = predict_scene(
        model, scene, tile_size=payload["tile_size"], device=device
    )

    coastline = _load_coastline(args.coastline) if args.coastline else None

    try:
        result = detect_scene(
            scene,
            case_id=args.case_id,
            detected_at=_parse_timestamp(args.detected_at),
            probabilities=probabilities,
            class_mask=mask,
            coastline_wgs84=coastline,
        )
    except NoDetectionError as exc:
        print(f"No detection: {exc}", file=sys.stderr)
        return 2

    # `detection.real.json`, never `detection.json`: the latter is the hand-authored mock
    # fixture, and overwriting it would leave the demo unable to tell model output from a
    # fixture. Must stay in step with ARTIFACT_NAME in
    # backend/app/integrations/real/real_detection.py.
    default_destination = Path("data/cases") / args.case_id / "detection.real.json"
    destination = Path(args.output) if args.output else default_destination
    write_artifact(result, destination)

    print(json.dumps({k: v for k, v in result.items() if not k.startswith("_")}, indent=2))
    print(f"\nArtifact written to {destination}", file=sys.stderr)
    return 0


def _parse_timestamp(raw: str) -> datetime:
    return datetime.fromisoformat(raw.replace("Z", "+00:00"))


def _load_coastline(path: str):
    from shapely.geometry import shape
    from shapely.ops import unary_union

    payload = json.loads(Path(path).read_text(encoding="utf-8"))
    if payload.get("type") == "FeatureCollection":
        return unary_union([shape(f["geometry"]) for f in payload["features"]])
    return shape(payload.get("geometry", payload))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="stage_a", description="Stage A — SAR oil-spill detection"
    )
    parser.add_argument("-v", "--verbose", action="store_true")
    subparsers = parser.add_subparsers(dest="command", required=True)

    train_parser = subparsers.add_parser("train", help="Stage 6 — train the segmentation model")
    train_parser.add_argument("--data-root", required=True)
    train_parser.add_argument("--epochs", type=int)
    train_parser.add_argument("--batch-size", type=int)
    train_parser.add_argument("--device")
    train_parser.add_argument(
        "--val-split",
        default="test",
        help="Split used for checkpoint selection. Defaults to the official test split; "
        "see the caveat in train.build_dataloaders.",
    )
    train_parser.set_defaults(func=cmd_train)

    eval_parser = subparsers.add_parser("evaluate", help="Stage 10 — metrics on the held-out split")
    eval_parser.add_argument("--data-root", required=True)
    eval_parser.add_argument("--checkpoint", required=True)
    eval_parser.add_argument("--split", default="test")
    eval_parser.add_argument("--batch-size", type=int, default=8)
    eval_parser.add_argument("--device")
    eval_parser.add_argument("--output")
    eval_parser.set_defaults(func=cmd_evaluate)

    detect_parser = subparsers.add_parser("detect", help="Stages 7-9 — scene to DetectionResult")
    detect_parser.add_argument("--scene", required=True, help="Georeferenced scene (GeoTIFF)")
    detect_parser.add_argument("--case-id", required=True)
    detect_parser.add_argument(
        "--detected-at", required=True, help="UTC ISO 8601, e.g. 2026-08-29T10:30:00Z"
    )
    detect_parser.add_argument("--checkpoint", required=True)
    detect_parser.add_argument(
        "--coastline", help="Optional coastline GeoJSON for Stage 9 distance"
    )
    detect_parser.add_argument("--device")
    detect_parser.add_argument("--output")
    detect_parser.set_defaults(func=cmd_detect)

    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    _configure_logging(args.verbose)
    return args.func(args)


if __name__ == "__main__":
    raise SystemExit(main())
