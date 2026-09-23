// Run once on the target Mac. Downloads runtime/model only, never user audio.
const {spawnSync} = require('node:child_process');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
if (process.platform !== 'darwin' || process.arch !== 'arm64') throw Error('本机 AI 当前仅支持 Apple Silicon Mac；其他平台可使用亲录配音。');
const root = path.resolve(__dirname, '..');
const runtime = process.env.CIKE_VOICE_RUNTIME || path.join(root,'.private/voice-runtime');
const uv = process.env.CIKE_UV || (fs.existsSync(path.join(os.homedir(),'.local/bin/uv')) ? path.join(os.homedir(),'.local/bin/uv') : 'uv');
function run(command,args,env={}) {const r=spawnSync(command,args,{stdio:'inherit',env:{...process.env,...env}});if(r.error||r.status!==0)throw Error('引擎准备未完成，请检查网络、可用空间和 uv 安装后重试。');}
const env={UV_PYTHON_INSTALL_DIR:path.join(root,'.private/python'),UV_CACHE_DIR:path.join(root,'.private/uv-cache')};
run(uv,['venv','--allow-existing','--python','3.11',runtime],env);
const python=path.join(runtime,'bin/python');
run(uv,['pip','install','--python',python,'-r',path.join(__dirname,'voice-requirements.txt')],env);
run(python,[path.join(__dirname,'prepare-voice.py'),runtime],{HF_HUB_DISABLE_TELEMETRY:'1',DO_NOT_TRACK:'1'});
console.log('本机 AI 已准备好。重新打开小小配音室，录声音样本后即可生成。');
