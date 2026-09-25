const ALLOWED_STYLES = new Set(["彩绘风", "线条风", "3D风", "插画风", "手办风"]);
const STYLE_PROMPTS = {
  "彩绘风": "warm hand-painted gouache and colored-pencil illustration, organic dark-brown rounded contours, cream paper grain, low-to-medium saturation",
  "线条风": "minimal expressive hand-drawn black ink character, organic uneven fine line, off-white ground, no color-heavy rendering",
  "3D风": "polished stylized 3D character, soft studio light, tactile fabric and hair, clean editorial finish, no logos",
  "插画风": "modern flat digital editorial illustration, clean tapered contours, layered color blocks, restrained paper grain",
  "手办风": "premium matte resin collectible figurine, softbox studio light, molded detail, clean neutral studio sweep",
};

function imageBuffer(dataUrl) {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || "");
  if (!match) throw Error("照片格式无效");
  return { type: match[1], bytes: Buffer.from(match[2], "base64") };
}

function basePrompt(style) {
  if (!ALLOWED_STYLES.has(style)) throw Error("未知风格");
  return `${STYLE_PROMPTS[style]}. Create an original, friendly non-photoreal personal desktop companion based only on the authorized portrait. Preserve visible identity anchors: face silhouette, hairstyle and color, eyewear when present, and recognizable feature relationships. Full body, centered, front or slight three-quarter basic standing pose, large readable face, compact durable silhouette, simple outfit without logos, uncluttered background. No text, watermark, copied character, extra person, or sensitive-attribute inference.`;
}

class ImageAI {
  constructor(options = {}) {
    this.fetch = options.fetch || globalThis.fetch;
    this.key = options.key === undefined ? process.env.OPENAI_API_KEY : options.key;
    this.endpoint = options.endpoint || process.env.CIKE_OPENAI_IMAGE_ENDPOINT || "https://api.openai.com/v1/images/edits";
    this.model = options.model || process.env.CIKE_OPENAI_IMAGE_MODEL || "gpt-image-2.5-sunburst";
    this.fixture = options.fixture === undefined ? process.env.CIKE_IMAGE_AI_FIXTURE === "1" : options.fixture;
  }
  status() {
    return { ready: !!this.key || this.fixture, provider: this.fixture ? "本地测试替身" : "OpenAI", model: this.model, mode: this.fixture ? "fixture" : this.key ? "owner-api-key" : "missing-key" };
  }
  async edit(reference, prompt, { quality = "medium", background = "transparent" } = {}) {
    if (this.fixture) return { image: reference, usage: { fixture: true } };
    if (!this.key) throw Error("本机尚未配置 OPENAI_API_KEY，不会产生付费请求");
    const { type, bytes } = imageBuffer(reference);
    const form = new FormData();
    form.append("model", this.model);
    form.append("image[]", new Blob([bytes], { type }), `reference.${type.split("/")[1]}`);
    form.append("prompt", prompt);
    form.append("size", "1024x1024");
    form.append("quality", quality);
    form.append("background", background);
    form.append("output_format", "png");
    const response = await this.fetch(this.endpoint, { method: "POST", headers: { Authorization: `Bearer ${this.key}` }, body: form });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw Error(body?.error?.message || `生图服务返回 ${response.status}`);
    const b64 = body?.data?.[0]?.b64_json;
    if (!b64 || !/^[A-Za-z0-9+/=]+$/.test(b64)) throw Error("生图服务未返回可用图片");
    return { image: `data:image/png;base64,${b64}`, usage: body.usage || null };
  }
  candidatePrompt(style, index) {
    const targets = ["balanced natural", "more portrait-feature preserving", "cuter chibi", "refined and clear", "lively game-character energy", "minimal durable"];
    return `${basePrompt(style)} Candidate interpretation: ${targets[index]}. Keep pose, outfit category, palette family, background, and composition comparable to the other candidates; vary only facial design interpretation, cheek fullness, feature spacing, temperament, and chibi degree.`;
  }
  actionPrompt(style, label) {
    const action = {
      "喝水": "hold one small plain cup with both hands, cup rim close to the mouth, believable hand-cup contact",
      "击掌": "raise one hand for a friendly high-five, clear palm hit area, the other arm remains natural",
      "晚安": "settled sleepy resting pose, gentle closed or lowered eyes, calm static end frame",
    }[label];
    if (!action) throw Error("未知试作动作");
    return `${basePrompt(style)} Edit the selected character reference into this action: ${action}. Preserve exactly the same face, hairstyle, silhouette, head-to-body ratio, outfit, palette, material, outline treatment, and accessory placement. Change only expression, gesture, limbs, and the required prop interaction. One complete character, transparent background, generous safe margin, readable at 256 px, no extra limbs, duplicate accessories, text, logo, watermark, or background rectangle.`;
  }
}

module.exports = { ImageAI, imageBuffer, ALLOWED_STYLES };
