"""Offline inference only. Input/output and reference remain on this computer."""
import json
import sys
import wave
import numpy as np
from mlx_audio.tts.utils import load_model
from mlx_audio.utils import load_audio

with open(sys.argv[1], encoding="utf-8") as f:
    job = json.load(f)
model = load_model(job["model"])
reference = load_audio(job["ref_audio"], sample_rate=model.sample_rate)
chunks = []
for result in model.generate(text=job["text"], ref_audio=reference,
                             ref_text=job["ref_text"], lang_code="Chinese",
                             max_tokens=360, temperature=0.7):
    chunks.append(np.asarray(result.audio).reshape(-1))
if not chunks:
    raise RuntimeError("No audio generated")
audio = np.concatenate(chunks)
with wave.open(job["output"], "wb") as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(model.sample_rate)
    f.writeframes((np.clip(audio, -1, 1) * 32767).astype("<i2").tobytes())
