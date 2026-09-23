/* Shared local playback and PCM encoding; no browser network requests. */
window.CikeSound = (() => {
  let playing, finishPlaying, revision = 0;
  function stop() { revision++; finishPlaying?.(); if (playing) { playing.pause(); playing.src = ''; playing = null; } }
  async function play(url, volume = .45, waitForEnd = false) {
    stop();
    if (!url) return false;
    const audio = new Audio(url); playing = audio; audio.volume = volume;
    let finish;
    const ended = new Promise(resolve => { finish = () => { audio.onended = audio.onerror = null; if(finishPlaying===finish)finishPlaying=null; resolve(); }; });
    finishPlaying=finish; audio.onended=finish; audio.onerror=finish;
    try { await audio.play(); if(waitForEnd)await ended; return true; }
    catch (error) { finish(); if (error.name === 'AbortError') return false; throw Error('这段声音暂时无法播放，请重录或重新导入'); }
  }
  async function line(text) {
    stop(); const version = revision;
    try {
      const result = await window.cike.call('voice-play', text);
      if (version !== revision || !result?.url) return;
      await play(result.url, result.volume, true);
    } catch { /* Missing/invalid clips stay silent, never block the card. */ }
  }
  async function clap() {
    stop(); const version = revision;
    try {
      const s = await window.cike.call('voice-summary');
      if (version !== revision || !s.enabled || !s.effects) return;
      await play('../assets/audio/high-five.wav', s.volume, true);
    } catch { /* Audio hardware failure must not prevent the high five. */ }
  }
  function wav(buffer) {
    const rate = buffer.sampleRate, length = buffer.length;
    const bytes = new ArrayBuffer(44 + length * 2), v = new DataView(bytes);
    function str(p, s) { for (let i=0;i<s.length;i++) v.setUint8(p+i,s.charCodeAt(i)); }
    str(0,'RIFF'); v.setUint32(4,36+length*2,true); str(8,'WAVE'); str(12,'fmt ');
    v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true); v.setUint32(24,rate,true);
    v.setUint32(28,rate*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true); str(36,'data'); v.setUint32(40,length*2,true);
    const channels = Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));
    for(let i=0;i<length;i++) { let s=0; for(const c of channels) s+=c[i]; s=Math.max(-1,Math.min(1,s/channels.length)); v.setInt16(44+i*2,s<0?s*32768:s*32767,true); }
    return bytes;
  }
  return {stop,play,line,clap,wav};
})();
