#!/usr/bin/env python3
"""Turn a controlled green-screen action video into transparent desktop assets."""

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont


def smoothstep(value, low, high):
    x = np.clip((value - low) / max(high - low, 1e-6), 0.0, 1.0)
    return x * x * (3.0 - 2.0 * x)


def border_connected(mask):
    count, labels = cv2.connectedComponents(mask.astype(np.uint8), connectivity=8)
    if count <= 1:
        return mask
    border = np.concatenate((labels[0], labels[-1], labels[:, 0], labels[:, -1]))
    keep = np.zeros(count, dtype=bool)
    keep[np.unique(border)] = True
    keep[0] = False
    return keep[labels]


def checkerboard(width, height, cell=24):
    yy, xx = np.indices((height, width))
    pattern = ((xx // cell + yy // cell) % 2).astype(np.uint8)
    base = np.where(pattern[..., None] == 0, 224, 184).astype(np.uint8)
    return np.repeat(base, 3, axis=2)


def sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--python-path", default="")
    args = parser.parse_args()

    source = Path(args.input).resolve()
    output = Path(args.output_dir).resolve()
    if not source.is_file():
        raise SystemExit("input video does not exist")
    if output.exists():
        raise SystemExit("output directory already exists")
    frames_dir = output / "png-frames"
    frames_dir.mkdir(parents=True)

    capture = cv2.VideoCapture(str(source))
    fps = float(capture.get(cv2.CAP_PROP_FPS))
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    if not fps or not width or not height:
        raise SystemExit("invalid video metadata")

    previous_alpha = None
    rgba_frames = []
    alpha_coverage = []
    index = 0
    while True:
        ok, bgr = capture.read()
        if not ok:
            break
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB).astype(np.float32)
        border = np.concatenate((rgb[:20].reshape(-1, 3), rgb[-20:].reshape(-1, 3), rgb[:, :20].reshape(-1, 3), rgb[:, -20:].reshape(-1, 3)))
        bg = np.median(border, axis=0)
        distance = np.linalg.norm(rgb - bg, axis=2)
        red, green, blue = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        dominance = green - np.maximum(red, blue)
        candidate = (dominance > 38) & (green > 95) & (distance < 150)
        connected = border_connected(candidate)
        chroma_alpha = 1.0 - smoothstep(dominance, 45, 165)
        edge_alpha = 1.0 - smoothstep(dominance, 32, 105)
        alpha = np.where(connected, edge_alpha, 1.0)
        alpha = cv2.GaussianBlur(alpha.astype(np.float32), (0, 0), 0.65)
        alpha = np.clip(alpha, 0.0, 1.0)
        if previous_alpha is not None:
            alpha = 0.82 * alpha + 0.18 * previous_alpha
        previous_alpha = alpha

        spill = (alpha > 0.02) & (alpha < 0.99) & (green > np.maximum(red, blue))
        rgb[..., 1] = np.where(spill, np.minimum(green, np.maximum(red, blue) + 10), green)
        rgba = np.dstack((np.clip(rgb, 0, 255).astype(np.uint8), np.round(alpha * 255).astype(np.uint8)))
        frame_path = frames_dir / f"frame-{index:04d}.png"
        Image.fromarray(rgba, "RGBA").save(frame_path, optimize=True)
        rgba_frames.append(rgba)
        alpha_coverage.append(float(np.mean(alpha > 0.05)))
        index += 1
    capture.release()
    if not rgba_frames:
        raise SystemExit("video contained no readable frames")

    if args.python_path:
        sys.path.insert(0, args.python_path)
    import imageio_ffmpeg
    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    webm = output / "drink-water-transparent.webm"
    subprocess.run([
        ffmpeg, "-y", "-framerate", f"{fps:g}", "-i", str(frames_dir / "frame-%04d.png"),
        "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-lossless", "1", "-auto-alt-ref", "0", str(webm)
    ], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

    preview_frames = []
    board = checkerboard(width, height)
    for rgba in rgba_frames:
        alpha = rgba[..., 3:4].astype(np.float32) / 255.0
        composite = rgba[..., :3].astype(np.float32) * alpha + board.astype(np.float32) * (1.0 - alpha)
        preview_frames.append(Image.fromarray(np.clip(composite, 0, 255).astype(np.uint8)).resize((480, 480), Image.Resampling.LANCZOS))
    preview = output / "checkerboard-preview.webp"
    preview_frames[0].save(preview, save_all=True, append_images=preview_frames[1:], duration=round(1000 / fps), loop=0, quality=88, method=6)

    sample_indices = [0, round((index - 1) * .25), round((index - 1) * .5), round((index - 1) * .75), index - 1]
    tile = 300
    contact = Image.new("RGB", (tile * 5, tile + 44), (245, 245, 245))
    draw = ImageDraw.Draw(contact)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 20)
    except OSError:
        font = ImageFont.load_default()
    for column, frame_index in enumerate(sample_indices):
        contact.paste(preview_frames[frame_index].resize((tile, tile), Image.Resampling.LANCZOS), (column * tile, 0))
        draw.text((column * tile + 120, tile + 10), f"{frame_index / fps:.1f}s", fill=(40, 40, 40), font=font)
    contact_path = output / "transparent-contact-sheet.jpg"
    contact.save(contact_path, quality=92)

    manifest = {
        "source": str(source),
        "sourceSha256": sha256(source),
        "method": "border-connected green-screen matte with temporal alpha smoothing",
        "fps": fps,
        "width": width,
        "height": height,
        "frameCount": index,
        "duration": index / fps,
        "alphaCoverage": {"min": min(alpha_coverage), "max": max(alpha_coverage), "mean": sum(alpha_coverage) / len(alpha_coverage)},
        "outputs": {
            "webm": {"path": str(webm), "sha256": sha256(webm), "bytes": webm.stat().st_size},
            "pngFrames": {"path": str(frames_dir), "count": index},
            "preview": {"path": str(preview), "sha256": sha256(preview)},
            "contactSheet": {"path": str(contact_path), "sha256": sha256(contact_path)}
        }
    }
    (output / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(manifest, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
