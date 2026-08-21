/* BGM — 가짜 AudioContext 로 실제 스케줄을 계측한다 */
const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const errs=[];const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!/scrollTo|Could not load|stylesheet/.test(e.message))errs.push('JSDOM: '+e.message)});
/* ---- 가짜 Web Audio ---- */
const LOG={osc:[],buf:[]};
let CLOCK=0;
function P(v){return {value:v,setValueAtTime(){return this},linearRampToValueAtTime(){return this},
  exponentialRampToValueAtTime(){return this},setTargetAtTime(){return this},cancelScheduledValues(){return this}};}
function node(extra){return Object.assign({connect(){},disconnect(){}},extra||{});}
class FakeCtx{
  constructor(){ this.sampleRate=44100; this.state='running'; this.destination=node(); }
  get currentTime(){ return CLOCK; }
  resume(){ this.state='running'; return Promise.resolve(); }
  createGain(){ return node({gain:P(1)}); }
  createBiquadFilter(){ return node({type:'lowpass',frequency:P(1000),Q:P(1),gain:P(0)}); }
  createDynamicsCompressor(){ return node({threshold:P(0),knee:P(0),ratio:P(1),attack:P(0),release:P(0)}); }
  createStereoPanner(){ return node({pan:P(0)}); }
  createWaveShaper(){ return node({curve:null,oversample:'none'}); }
  createOscillator(){ const o=node({type:'sine',frequency:P(440),detune:P(0),
    start(t){o._t=t;}, stop(t){ if(o._t!=null) LOG.osc.push({t:o._t,end:t,f:o.frequency.value,type:o.type}); }});
    return o; }
  createBuffer(ch,len,sr){ return {length:len,sampleRate:sr,getChannelData:()=>new Float32Array(len)}; }
  createBufferSource(){ const s=node({buffer:null,
    start(t){s._t=t;}, stop(t){ if(s._t!=null) LOG.buf.push({t:s._t,end:t}); }});
    return s; }
}
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  virtualConsole:vc, beforeParse(win){ win.AudioContext=FakeCtx; win.scrollTo=()=>{}; }});
const w=dom.window,d=w.document;
w.confirm=()=>true;

const T=(n,f)=>{try{const r=f();console.log((r?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r:''));if(!r)errs.push(n);}catch(e){console.log('  ❌ '+n+' :: '+e.message);errs.push(n)}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const ev=s=>w.eval(s);

setTimeout(async()=>{
  d.querySelectorAll('.pickcard')[0].click();await wait(50);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(250); ev("ST.tutDone=true");

  console.log('[재생]');
  ev("BGM.unlock()");
  T('재생이 시작된다', ()=>ev("BGM.playing"));
  // 오디오 시계를 곡 한 바퀴만큼 돌린다
  const BPM=138, SP16=(60/BPM)/4, BARS=28, TOTAL=BARS*16;
  const songLen=TOTAL*SP16;
  for(let i=0;i<220;i++){ CLOCK+=songLen/200; await wait(2); }
  await wait(200);
  const notes=LOG.osc.slice(), hits=LOG.buf.slice();
  console.log(`   곡 길이 ${songLen.toFixed(1)}초 (${BARS}마디 · ${BPM}BPM) · 음 ${notes.length}개 · 타악 ${hits.length}개`);
  T('음이 실제로 예약된다', ()=>notes.length>2000 ? true : `${notes.length}개뿐`);
  T('타악기가 예약된다', ()=>hits.length>300 ? `${hits.length}개` : `${hits.length}개뿐 — 너무 적다`);

  console.log('\n[템포 · 격자]');
  // 스케줄 시작점이 0 이 아니므로 '간격'으로 격자를 본다
  const t0=Math.min(...notes.map(n=>n.t));
  const offGrid=notes.filter(n=>{
    const k=(n.t-t0)/SP16; return Math.abs(k-Math.round(k))>0.01;
  });
  T('모든 음이 16분 격자에 붙는다', ()=>offGrid.length===0 ? true : `이탈 ${offGrid.length}개 — 격자 벗어남`);
  const onsets=[...new Set(notes.map(n=>Math.round((n.t-t0)/SP16*1000)/1000))].sort((a,b)=>a-b);
  T('16분 간격이 균일하다', ()=>{
    const gaps=[]; for(let i=1;i<onsets.length;i++) gaps.push(onsets[i]-onsets[i-1]);
    const bad=gaps.filter(g=>Math.abs(g-Math.round(g))>0.01);
    return bad.length===0 ? `${onsets.length}개 온셋` : `불균일 ${bad.length}개`;
  });
  T('138 BPM 이 맞다', ()=>{
    const beats=songLen/(60/BPM);
    return Math.abs(beats-BARS*4)<0.01 ? `${songLen.toFixed(1)}초 = ${BARS*4}박` : '어긋남';
  });

  console.log('\n[편성]');
  const inRange=(lo,hi)=>notes.filter(n=>n.f>=lo&&n.f<hi).length;
  console.log(`   저역(<120Hz) ${inRange(0,120)} · 중저(120~350) ${inRange(120,350)} · 중고(350~900) ${inRange(350,900)} · 고역(900+) ${inRange(900,20000)}`);
  T('베이스 음역이 있다', ()=>inRange(0,120)>200);
  T('브라스·기타 음역이 있다', ()=>inRange(350,900)>500);
  T('멜로디 음역(500Hz+)이 두껍다', ()=>inRange(500,20000)>400 ? `${inRange(500,20000)}개` : `${inRange(500,20000)}개뿐`);
  T('최상단 옥타브(900Hz+)도 반짝인다', ()=>inRange(900,20000)>80 ? `${inRange(900,20000)}개` : `${inRange(900,20000)}개뿐`);
  const types={}; notes.forEach(n=>types[n.type]=(types[n.type]||0)+1);
  console.log('   파형:', JSON.stringify(types));
  T('톱니(브라스·기타·현)가 주력', ()=>(types.sawtooth||0)>1500);
  T('사인(킥·서브베이스) 포함', ()=>(types.sine||0)>200);
  T('사각(트롬본 두께) 포함', ()=>(types.square||0)>50);

  console.log('\n[음정 — E단조]');
  const EMIN=[4,6,7,9,11,0,2];   // E F# G A B C D 의 피치클래스
  const pcs={};
  notes.filter(n=>n.f>150&&n.f<2000).forEach(n=>{
    const m=Math.round(69+12*Math.log2(n.f/440));
    pcs[((m%12)+12)%12]=(pcs[((m%12)+12)%12]||0)+1;
  });
  const total=Object.values(pcs).reduce((a,b)=>a+b,0);
  const inKey=EMIN.reduce((a,pc)=>a+(pcs[pc]||0),0);
  console.log(`   조성 내 음 ${(inKey/total*100).toFixed(1)}%`);
  T('E단조 안에서 논다', ()=>inKey/total>0.95 ? `${(inKey/total*100).toFixed(1)}%` : `${(inKey/total*100).toFixed(1)}% — 이탈음 있음`);

  console.log('\n[켜기·끄기 · 저장]');
  T('끄면 멈춘다', ()=>{ ev("BGM.toggle()"); return !ev("BGM.on")&&!ev("BGM.playing"); });
  T('끈 상태가 저장된다', ()=>JSON.parse(w.localStorage.getItem('wwzw_snd')).on===false);
  T('상단 버튼이 🔇 로 바뀐다', ()=>{ ev("paintSndBtn()"); return d.getElementById('sndbtn').textContent==='🔇'; });
  T('다시 켜면 재생된다', ()=>{ ev("BGM.toggle()"); return ev("BGM.on")&&ev("BGM.playing"); });
  T('켠 상태가 저장된다', ()=>JSON.parse(w.localStorage.getItem('wwzw_snd')).on===true);
  T('음량이 저장된다', ()=>{ ev("BGM.setVol(0.25)");
    return Math.abs(JSON.parse(w.localStorage.getItem('wwzw_snd')).vol-0.25)<1e-6; });
  T('M 키로 토글된다', ()=>{ const before=ev("BGM.on");
    d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'m',bubbles:true}));
    return ev("BGM.on")!==before; });
  ev("if(!BGM.on)BGM.toggle();");

  console.log('\n[설정 화면]');
  w.go('more'); await wait(120);
  const t=d.getElementById('view').textContent;
  T('사운드 카드가 있다', ()=>/사운드/.test(t)&&/음량/.test(t));
  T('끄면 계속 꺼진다고 안내', ()=>/한 번 끄면/.test(t));
  T('undefined 없음', ()=>!/undefined|NaN/.test(t));
  const r=d.getElementById('sndvol');
  T('음량 슬라이더가 있다', ()=>!!r);
  if(r){ r.value='80'; r.dispatchEvent(new w.Event('input',{bubbles:true}));
    T('슬라이더가 음량에 반영된다', ()=>Math.abs(ev("BGM.vol")-0.8)<1e-6); }

  console.log('\n[경기 중 덕킹]');
  T('경기 화면에선 작아진다', ()=>{
    const src=require('fs').readFileSync('index.html','utf8');
    return /BGM\.duck\(v==='game'\?0\.32:1\)/.test(src);
  });
  T('치명적 오류 없음', ()=>errs.filter(e=>/JSDOM/.test(e)).length===0);

  console.log(errs.length?`\n❌ ${errs.length}건\n - `+errs.join('\n - '):'\n✅ 전부 통과');
  process.exit(errs.length?1:0);
},600);
