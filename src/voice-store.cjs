const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const key = text => createHash('sha256').update(text).digest('hex');
function textValue(text) {
  if (typeof text !== 'string' || !text.trim() || text.length > 240) throw Error('台词请填写 1–240 个字');
  return text.trim();
}
function wavInfo(bytes, min = .2, max = 30) {
  const b = Buffer.from(bytes);
  if (b.length < 44 || b.length > 3000000 || b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE' || b.readUInt32LE(4) + 8 !== b.length) throw Error('请使用有效的 WAV 录音');
  let format, data;
  for (let p = 12; p + 8 <= b.length;) {
    const n = b.readUInt32LE(p + 4), end = p + 8 + n;
    if (end > b.length) throw Error('录音文件不完整');
    if (b.toString('ascii', p, p + 4) === 'fmt ' && n >= 16) format = b.subarray(p + 8, end);
    if (b.toString('ascii', p, p + 4) === 'data') data = b.subarray(p + 8, end);
    p = end + (n % 2);
  }
  if (!format || !data || format.readUInt16LE(0) !== 1 || format.readUInt16LE(2) !== 1 || format.readUInt16LE(14) !== 16) throw Error('录音需要单声道 16 位 WAV');
  const rate = format.readUInt32LE(4);
  if (rate < 16000 || rate > 48000 || data.length % 2) throw Error('录音采样率或长度不正确');
  const duration = data.length / (2 * rate);
  if (duration < min || duration > max) throw Error(`录音需要 ${min}–${max} 秒`);
  let energy = 0, clipped = 0;
  for (let p = 0; p < data.length; p += 2) { const v = data.readInt16LE(p) / 32768; energy += v * v; if (Math.abs(v) > .995) clipped++; }
  if (Math.sqrt(energy / (data.length / 2)) < .002) throw Error('声音太轻或没有录到声音，请靠近麦克风再试');
  return { duration, clipped: clipped / (data.length / 2) > .02 };
}
// Trim only playback copies: preserve the child's original recording and pauses.
function trimSilence(bytes) {
  const b = Buffer.from(bytes); wavInfo(b);
  let rate, data;
  for (let p=12;p+8<=b.length;) {
    const n=b.readUInt32LE(p+4), type=b.toString('ascii',p,p+4);
    if(type==='fmt ') rate=b.readUInt32LE(p+12);
    if(type==='data') data=b.subarray(p+8,p+8+n);
    p+=8+n+(n%2);
  }
  const frame=Math.round(rate*.01), count=data.length/2;
  let first=-1,last=0;
  for(let i=0;i<count;i+=frame){
    let energy=0; const end=Math.min(count,i+frame);
    for(let j=i;j<end;j++) energy+=(data.readInt16LE(j*2)/32768)**2;
    if(Math.sqrt(energy/(end-i))>=.003){if(first<0)first=i;last=end;}
  }
  if(first<0)return b;
  const start=Math.max(0,first-Math.round(rate*.12)), end=Math.min(count,last+Math.round(rate*.18));
  const pcm=data.subarray(start*2,end*2), out=Buffer.alloc(44+pcm.length);
  out.write('RIFF');out.writeUInt32LE(36+pcm.length,4);out.write('WAVEfmt ',8);
  out.writeUInt32LE(16,16);out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);
  out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);
  out.write('data',36);out.writeUInt32LE(pcm.length,40);pcm.copy(out,44);return out;
}
class VoiceStore {
  constructor(dir) {
    this.dir = dir; this.file = path.join(dir, 'voice.json');
    this.data = { enabled: true, effects: true, volume: .45, reference: null, clips: {}, silent: [] };
    if (fs.existsSync(this.file)) {
      try {
        if (fs.statSync(this.file).size > 60000000) throw Error();
        const d = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        if (!d.clips || typeof d.clips !== 'object' || Array.isArray(d.clips) || typeof d.enabled !== 'boolean' || typeof d.effects !== 'boolean' || !Number.isFinite(d.volume) || d.volume < 0 || d.volume > 1) throw Error();
        for (const c of [...Object.values(d.clips), ...(d.reference ? [d.reference] : [])]) {
          textValue(c.text);
          if (typeof c.audio !== 'string' || typeof c.approved !== 'boolean' || !['recording','ai'].includes(c.source)) throw Error();
          wavInfo(Buffer.from(c.audio,'base64'));
        }
        Object.assign(this.data, d);
      }
      catch { this.loadError = '配音资料无法读取，已保留原文件。请先备份检查，或在配音室清除声音资料后重新录制'; }
    }
  }
  write(next) {
    if (this.loadError) throw Error(this.loadError);
    const json = JSON.stringify(next);
    if (Buffer.byteLength(json) > 60000000) throw Error('本机配音已达到 60 MB，请先删除不用的录音');
    fs.mkdirSync(this.dir, {recursive: true, mode: 0o700});
    fs.writeFileSync(this.file + '.tmp', json, {mode: 0o600});
    fs.renameSync(this.file + '.tmp', this.file); this.data = next;
  }
  summary() {
    return { error: this.loadError || null, enabled: this.data.enabled, effects: this.data.effects, volume: this.data.volume,
      reference: this.data.reference && {text: this.data.reference.text, duration: this.data.reference.duration},
      silent: this.data.silent || [],
      clips: Object.values(this.data.clips).map(({audio, ...c}) => c) };
  }
  settings(input) {
    if (!input || typeof input.enabled !== 'boolean' || typeof input.effects !== 'boolean' || !Number.isFinite(input.volume) || input.volume < 0 || input.volume > 1) throw Error('无效的声音设置');
    this.write({...this.data, enabled: input.enabled, effects: input.effects, volume: input.volume});
  }
  save({text, bytes, reference = false, source = 'recording', approved = true}) {
    text = textValue(text);
    const info = wavInfo(bytes, reference ? 5 : .2, reference ? 20 : 30);
    const clip = {text, ...info, source, approved, audio: Buffer.from(bytes).toString('base64')};
    if (reference) this.write({...this.data, reference: clip});
    else this.write({...this.data, clips: {...this.data.clips, [key(text)]: clip}});
    return info;
  }
  setSilent(text, silent) {
    text = textValue(text);
    if (typeof silent !== 'boolean') throw Error('无效的配音选项');
    const next = new Set(this.data.silent || []);
    silent ? next.add(text) : next.delete(text);
    this.write({...this.data, silent: [...next]});
  }
  audio(text, preview = false) {
    if (!preview && (this.data.silent || []).includes(text)) return null;
    const c = text === '__reference__' ? this.data.reference : this.data.clips[key(textValue(text))];
    return c && (preview || c.approved) ? 'data:audio/wav;base64,' + trimSilence(Buffer.from(c.audio, 'base64')).toString('base64') : null;
  }
  approve(text) {
    const k = key(textValue(text)), c = this.data.clips[k];
    if (!c) throw Error('这句还没有配音');
    this.write({...this.data, clips: {...this.data.clips, [k]: {...c, approved: true}}});
  }
  remove(text) {
    if (text === '__reference__') this.write({...this.data, reference: null});
    else { const clips = {...this.data.clips}; delete clips[key(textValue(text))]; this.write({...this.data, clips}); }
  }
  reset() { this.loadError = null; this.write({enabled: true, effects: true, volume: .45, reference: null, clips: {}, silent: []}); }
}
module.exports = {VoiceStore, trimSilence, wavInfo, textValue, key};
