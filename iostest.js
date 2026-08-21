/* 아이폰 사파리 조건 재현 — 소리가 열리는지 */
const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
let bad=[];
const T=(n,f)=>{try{const r=f();const ok=r===true||(typeof r==='string'&&!/^!/.test(r));
  console.log((ok?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r.replace(/^!/,''):''));if(!ok)bad.push(n);}
  catch(e){console.log('  ❌ '+n+' :: '+e.message);bad.push(n+': '+e.message)}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const IOS_UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

function P(v){return {value:v,setValueAtTime(){return this},linearRampToValueAtTime(){return this},exponentialRampToValueAtTime(){return this},setTargetAtTime(){return this},cancelScheduledValues(){return this}};}
function nd(e){return Object.assign({connect(){},disconnect(){}},e||{});}

async function run(label,{hasAudioSession, failFirstResume}){
  console.log('\n['+label+']');
  const log={session:null, silentPlayed:0, kicks:0, resumes:0};
  let resumeCalls=0;
  class IosAC{
    constructor(){ this.sampleRate=48000; this.state='suspended'; this.destination=nd(); this._t=0; }
    get currentTime(){ return this._t+=0.02; }
    resume(){ resumeCalls++; log.resumes++;
      if(failFirstResume && resumeCalls===1) return Promise.reject(new Error('NotAllowed'));
      this.state='running'; return Promise.resolve(); }
    createGain(){return nd({gain:P(1)});} createBiquadFilter(){return nd({type:'',frequency:P(1),Q:P(1),gain:P(0)});}
    createDynamicsCompressor(){return nd({threshold:P(0),knee:P(0),ratio:P(1),attack:P(0),release:P(0)});}
    createStereoPanner(){return nd({pan:P(0)});} createWaveShaper(){return nd({curve:null,oversample:''});}
    createOscillator(){return nd({type:'',frequency:P(1),detune:P(0),start(){},stop(){}});}
    createBuffer(c,l,s){ if(l===1) log.kicks++; return {length:l,sampleRate:s,getChannelData:()=>new Float32Array(l)};}
    createBufferSource(){return nd({buffer:null,start(){},stop(){}});}
  }
  const vc=new VirtualConsole();
  vc.on('jsdomError',e=>{if(!/scrollTo|Could not load|stylesheet|Not implemented/.test(e.message))bad.push('JSDOM: '+e.message.split('\n')[0]);});
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
    virtualConsole:vc, beforeParse(win){
      win.scrollTo=()=>{};
      Object.defineProperty(win.navigator,'userAgent',{value:IOS_UA,configurable:true});
      Object.defineProperty(win.navigator,'platform',{value:'iPhone',configurable:true});
      Object.defineProperty(win.navigator,'maxTouchPoints',{value:5,configurable:true});
      // 사파리는 webkitAudioContext 도 같이 준다
      win.webkitAudioContext=IosAC; win.AudioContext=IosAC;
      if(hasAudioSession){
        const sess={_t:null}; Object.defineProperty(sess,'type',{get(){return sess._t},set(v){sess._t=v;log.session=v}});
        Object.defineProperty(win.navigator,'audioSession',{value:sess,configurable:true});
      }
      // <audio>.play() 를 세어본다
      win.HTMLMediaElement.prototype.play=function(){ log.silentPlayed++; return Promise.resolve(); };
    }});
  const w=dom.window,d=w.document,ev=s=>w.eval(s);
  w.confirm=()=>true;
  await wait(700);
  d.querySelectorAll('.pickcard')[0].click(); await wait(60);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(300); ev("ST.tutDone=true");

  T('아이폰으로 인식한다', ()=>/아이폰|iOS/.test(ev("browserTag()")) ? ev("browserTag()") : '!'+ev("browserTag()"));
  // 화면을 만진 순간(선수 선택 탭) 이미 열려야 한다
  d.dispatchEvent(new w.Event('pointerdown',{bubbles:true}));
  await wait(120);
  if(failFirstResume){
    T('첫 resume 이 거부돼도 재시도로 열린다', ()=>
      log.resumes>=2 && ev("BGM.live") ? `resume ${log.resumes}회` : `!resume ${log.resumes}회 · live=${ev("BGM.live")}`);
  } else {
    T('탭 한 번에 열린다', ()=>ev("BGM.live") ? `resume ${log.resumes}회` : '!안 열림');
  }
  T('재생이 돈다', ()=>ev("BGM.playing"));
  T('제스처 안에서 무음 버퍼를 쏜다', ()=>log.kicks>0 ? `${log.kicks}회` : '!안 쏨');

  if(hasAudioSession){
    T("audioSession 을 'playback' 으로 잡는다", ()=>log.session==='playback' ? true : '!'+log.session);
    T('구버전 폴백은 안 만든다', ()=>log.silentPlayed===0 ? true : `!무음 트랙 ${log.silentPlayed}회`);
  } else {
    T('구버전은 무음 트랙으로 세션을 연다', ()=>log.silentPlayed>0 ? `${log.silentPlayed}회` : '!안 열음');
  }

  T('열린 뒤엔 리스너를 뗀다', ()=>{
    const before=log.kicks;
    d.dispatchEvent(new w.Event('pointerdown',{bubbles:true}));
    return log.kicks===before ? true : '!계속 붙어 있다';
  });

  T('백그라운드 갔다 오면 다시 깨운다', ()=>{
    ev("(function(){ /* iOS 는 돌아오면 재운다 */ })()");
    const before=log.resumes;
    Object.defineProperty(d,'hidden',{value:false,configurable:true});
    d.dispatchEvent(new w.Event('visibilitychange'));
    return log.resumes>=before ? true : '!반응 없음';
  });

  T('진단 패널에 소리 상태가 뜬다', ()=>{
    w.go('more');
    const t=d.getElementById('view').textContent;
    return /소리running|소리.*running/.test(t.replace(/\s+/g,'')) || /running/.test(t)
      ? true : '!상태 안 보임';
  });
  T('아이폰 안내 문구가 있다', ()=>{
    const t=d.getElementById('view').textContent;
    return /무음 스위치/.test(t) ? true : '!안내 없음';
  });
  T('스피커 버튼으로 껐다 켜도 다시 열린다', ()=>{
    ev("toggleSound()");            // 끔
    const off=!ev("BGM.on");
    ev("toggleSound()");            // 켬
    return off && ev("BGM.on") && ev("BGM.playing") ? true : '!복구 실패';
  });
  dom.window.close();
}

(async()=>{
  await run('아이폰 · Safari 17 (audioSession 있음)', {hasAudioSession:true});
  await run('아이폰 · 구버전 Safari (audioSession 없음)', {hasAudioSession:false});
  await run('아이폰 · 첫 제스처가 막힘', {hasAudioSession:true, failFirstResume:true});
  console.log(bad.length?`\n❌ ${bad.length}건\n - `+bad.join('\n - '):'\n✅ 전부 통과');
  process.exit(bad.length?1:0);
})();
