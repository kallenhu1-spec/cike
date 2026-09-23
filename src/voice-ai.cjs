const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {textValue} = require('./voice-store.cjs');
class VoiceAI {
  constructor(runtime, store) { this.runtime = runtime; this.store = store; this.child = null;
    if (fs.existsSync(store.dir)) for (const name of fs.readdirSync(store.dir))
      if (/^generation-[a-zA-Z0-9]{6}$/.test(name)) fs.rmSync(path.join(store.dir, name), {recursive:true,force:true});
  }
  status() {
    return {ready: fs.existsSync(path.join(this.runtime, 'ready.json')) && fs.existsSync(path.join(this.runtime, 'bin/python')), busy: !!this.child};
  }
  cancel() { this.child?.kill('SIGTERM'); }
  async generate(text) {
    text = textValue(text);
    if (this.child) throw Error('正在生成另一句，请稍等或停止');
    if (!this.status().ready) throw Error('本机 AI 尚未准备好，请按配音说明安装本机引擎');
    const ref = this.store.data.reference;
    if (!ref) throw Error('先录一段 5–20 秒的声音样本，并填写实际说出的文字');
    const work = fs.mkdtempSync(path.join(this.store.dir, 'generation-'));
    const input = path.join(work, 'input.json'), output = path.join(work, 'output.wav');
    fs.writeFileSync(path.join(work, 'reference.wav'), Buffer.from(ref.audio, 'base64'), {mode: 0o600});
    fs.writeFileSync(input, JSON.stringify({text, ref_text: ref.text, ref_audio: path.join(work, 'reference.wav'), output, model: path.join(this.runtime, 'model')}), {mode: 0o600});
    try {
      await new Promise((resolve, reject) => {
        const child = spawn(path.join(this.runtime, 'bin/python'), [path.join(__dirname.replace('app.asar', 'app.asar.unpacked'), 'voice_worker.py'), input], {
          env: {...process.env, HF_HUB_OFFLINE: '1', TRANSFORMERS_OFFLINE: '1', HF_HUB_DISABLE_TELEMETRY: '1', DO_NOT_TRACK: '1'}, stdio: ['ignore', 'ignore', 'pipe'],
        });
        this.child = child;
        let error = '', timedOut = false;
        const timeout = setTimeout(() => {timedOut = true; child.kill('SIGTERM');}, 240000);
        child.stderr.on('data', b => error = (error + b.toString()).slice(-3000));
        child.once('error', () => {clearTimeout(timeout); reject(Error('本机 AI 无法启动，请重新准备引擎'));});
        child.once('exit', (code, signal) => {clearTimeout(timeout); code === 0 ? resolve() : reject(Error(timedOut ? '这次生成超过 4 分钟，已停止。请缩短台词再试' : signal ? '生成已停止' : '本机生成失败。请检查引擎安装与可用内存后重试'));});
      });
      // The reference may be deleted while an inference is being cancelled.
      if (this.store.data.reference !== ref) throw Error('声音样本已变化，本次结果未保存');
      const info = this.store.save({text, bytes: fs.readFileSync(output), source: 'ai', approved: false});
      return info;
    } finally { this.child = null; fs.rmSync(work, {recursive:true, force:true}); }
  }
}
module.exports = {VoiceAI};
