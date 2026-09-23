import json
import os
import sys
from huggingface_hub import snapshot_download
runtime = os.path.abspath(sys.argv[1])
model = snapshot_download(repo_id="mlx-community/Qwen3-TTS-12Hz-0.6B-Base-bf16",
                          revision="1eccf1cb2519b5a4e8a95b5f0544f3303568164f",
                          local_dir=os.path.join(runtime, "model"),
                          allow_patterns=["*.json", "*.safetensors", "*.txt", "*.model", "*.tiktoken"])
# Readiness is only written after the model, tokenizer and runtime actually load.
from mlx_audio.tts.utils import load_model
load_model(model)
with open(os.path.join(runtime, "ready.json"), "w") as f:
    json.dump({"model":"Qwen3-TTS-12Hz-0.6B-Base-bf16","runtime":"mlx-audio 0.3.1"},f)
