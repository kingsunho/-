/* 종합 안정성 — 시즌 하나를 UI 로 끝까지 돌린다 */
const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const bad=[], warn=[];
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{ if(!/scrollTo|Could not load|stylesheet|Not implemented/.test(e.message)) bad.push('JSDOM: '+e.message.split('\n')[0]); });
let CLOCK=0;
function P(v){return {value:v,setValueAtTime(){return this},linearRampToValueAtTime(){return this},exponentialRampToValueAtTime(){return this},setTargetAtTime(){return this},cancelScheduledValues(){return this}};}
function nd(e){return Object.assign({connect(){},disconnect(){}},e||{});}
class FakeAC{constructor(){this.sampleRate=44100;this.state='running';this.destination=nd();}
 get currentTime(){return CLOCK+=0.02;} resume(){return Promise.resolve();}
 createGain(){return nd({gain:P(1)});} createBiquadFilter(){return nd({type:'',frequency:P(1),Q:P(1),gain:P(0)});}
 createDynamicsCompressor(){return nd({threshold:P(0),knee:P(0),ratio:P(1),attack:P(0),release:P(0)});}
 createStereoPanner(){return nd({pan:P(0)});} createWaveShaper(){return nd({curve:null,oversample:''});}
 createOscillator(){return nd({type:'',frequency:P(1),detune:P(0),start(){},stop(){}});}
 createBuffer(c,l,s){return{length:l,sampleRate:s,getChannelData:()=>new Float32Array(l)};}
 createBufferSource(){return nd({buffer:null,start(){},stop(){}});}}
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  virtualConsole:vc, beforeParse(w){ w.AudioContext=FakeAC; w.scrollTo=()=>{};
    w.TextEncoder=TextEncoder; w.TextDecoder=TextDecoder; }});   // jsdom 에 없어서 채워준다
const w=dom.window,d=w.document,ev=s=>w.eval(s);
w.confirm=()=>true;
process.on('unhandledRejection',e=>bad.push('REJECT: '+String(e).slice(0,120)));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const T=(n,f)=>{try{const r=f();const ok=r===true||(typeof r==='string'&&r.length>0&&!/^!/.test(r));
  console.log((ok?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r.replace(/^!/,''):''));if(!ok)bad.push(n);}
  catch(e){console.log('  ❌ '+n+' :: '+e.message);bad.push(n+': '+e.message)}};

const VIEWS=['home','squad','lineup','kakao','game','stand','stats','records','train','scout','recruit','hall','more','meet','player'];
function sweep(tag){
  const found=[];
  for(const v of VIEWS){
    try{ w.go(v); }catch(e){ found.push(`${v} 렌더 실패: ${e.message}`); continue; }
    const el=d.getElementById('view'); const t=el?el.textContent:'';
    if(/undefined|NaN|\[object Object\]|Infinity/.test(t)){
      const m=t.match(/.{0,28}(undefined|NaN|\[object Object\]|Infinity).{0,28}/);
      found.push(`${v}: …${m?m[0].replace(/\s+/g,' '):''}…`);
    }
    if(!t || t.trim().length<6) found.push(`${v}: 화면이 비었다`);
  }
  if(found.length) found.forEach(f=>bad.push(`[${tag}] ${f}`));
  return found;
}

(async()=>{
  await wait(700);
  console.log('[시작]');
  T('선수 선택 화면', ()=>d.querySelectorAll('.pickcard').length>0);
  d.dispatchEvent(new w.Event('pointerdown'));   // 소리 깨우기(실제로는 첫 탭)
  d.querySelectorAll('.pickcard')[0].click(); await wait(60);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(300);
  ev("ST.tutDone=true"); w.go('home'); await wait(80);
  T('부팅 후 로딩이 걷혔다', ()=>d.getElementById('loading').style.display==='none');
  T('버전 배지', ()=>/^v\d+\.\d+\.\d+$/.test(d.getElementById('appver').textContent));

  console.log('\n[시즌 전체 소화]');
  let g=0, guard=0, feats=0, awards0=0; const condLog=[];
  const seen={cold:0,tie:0,walkoff:0,inj:0,rain:0};
  while(guard++<70){
    const sch=ev("ST.schedule[ST.round]");
    if(!sch) break;
    /* 실제 플레이 경로 — 홈에서 버튼을 눌러 진행한다.
       '이번 주 시작' 을 눌러야 주간 회복(컨디션·사기)과 이벤트가 돈다. */
    let rained=false;
    for(let z=0;z<6;z++){
      w.go('home'); await wait(90);
      const btns=[...d.querySelectorAll('#view .btn')];
      const wk=btns.find(x=>/이번 주 시작/.test(x.textContent));
      const nx=btns.find(x=>/다음 주로/.test(x.textContent));
      const beg=btns.find(x=>/단톡방에 사정해본다/.test(x.textContent));
      const mc=btns.find(x=>/용병 부른다/.test(x.textContent));
      const ok=btns.find(x=>/확인|넘어가|알겠/.test(x.textContent));
      if(wk){ wk.click(); await wait(140); continue; }
      if(nx){ nx.click(); await wait(140); rained=true; seen.rain=(seen.rain||0)+1; break; }
      // 인원이 모자라면 사정 → 그래도 모자라면 용병
      if(beg && ev("TBYID['wwzw'].players.filter(p=>isAvailable(p.id)).length")<9){
        beg.click(); await wait(120);
        if(ev("TBYID['wwzw'].players.filter(p=>isAvailable(p.id)).length")>=9) continue;
      }
      if(mc && ev("TBYID['wwzw'].players.filter(p=>isAvailable(p.id)).length")<9){
        mc.click(); await wait(120);
        let picked=0;
        while(ev("TBYID['wwzw'].players.filter(p=>isAvailable(p.id)).length")<9 && picked<5){
          const rows=[...d.querySelectorAll('#sheet-body .pick-row')].filter(r=>!/합류함/.test(r.textContent));
          if(!rows.length) break;
          rows[0].click(); await wait(120); picked++;
          if(!d.getElementById('sheet').classList.contains('open')){
            w.go('home'); await wait(90);
            const m2=[...d.querySelectorAll('#view .btn')].find(x=>/용병 부른다/.test(x.textContent));
            if(!m2) break; m2.click(); await wait(120);
          }
        }
        ev("closeSheet()"); seen.merc=(seen.merc||0)+1;
        await wait(90); continue;
      }
      if(ok){ ok.click(); await wait(90); continue; }
      break;
    }
    if(rained) continue;                       // 우천이면 그 주는 경기가 없다
    ev("ST.announced=true; ST.lineupDirty=false; if(!ST.weekDone)ST.weekDone=true;");
    w.go('game'); await wait(90);
    const btn=[...d.querySelectorAll('#view .btn')].find(x=>/자동 진행/.test(x.textContent));
    if(!btn){
      const rb=[...d.querySelectorAll('#view .btn')].find(x=>/결과 보기/.test(x.textContent));
      if(rb){ rb.click(); await wait(120); }
      else { warn.push(`${g+1}차전: 시작 버튼 없음 — ${d.getElementById('view').textContent.slice(0,70)}`); break; }
    } else {
      btn.click();
      for(let i=0;i<500 && !ev("LIVE&&LIVE.over");i++) await wait(15);
      await wait(150);
    }
    if(!ev("LIVE&&LIVE.over")){ warn.push(`${g+1}차전: 경기가 안 끝났다`); break; }
    const r=ev("(function(){const r=LIVE.result;return {mercy:!!r.mercy,tie:!!r.tie,feats:(r.feats||[]).length,inj:(r.injuries||[]).length}})()");
    if(r.mercy)seen.cold++; if(r.tie)seen.tie++; if(r.inj)seen.inj++;
    const rt=d.getElementById('view').textContent;
    if(/undefined|NaN|\[object Object\]/.test(rt)){
      const m=rt.match(/.{0,30}(undefined|NaN|\[object Object\]).{0,30}/);
      bad.push(`${g+1}차전 결과 화면: …${m?m[0].replace(/\s+/g,' '):''}…`);
    }
    // 라인스코어 합 = R
    const lc=ev(`(function(){const r=LIVE.result;const S=a=>a.reduce((x,y)=>x+(y||0),0);
      return {a:S(r.away.line)===r.away.runs, h:S(r.home.line)===r.home.runs}})()`);
    if(!lc.a||!lc.h) bad.push(`${g+1}차전: 라인스코어 합 불일치`);
    const fb=[...d.querySelectorAll('#view .btn')].find(x=>/결과 확정/.test(x.textContent));
    if(!fb){ warn.push(`${g+1}차전: 확정 버튼 없음`); break; }
    fb.click(); await wait(200);
    g++;
    feats=ev("(ST.feats||[]).length");
    condLog.push(ev(`(function(){const P=TBYID['wwzw'].players;
      const a=o=>P.map(p=>o[p.id]||0).reduce((x,y)=>x+y,0)/P.length;
      return Math.round(a(ST.cond));})()`));
    if(ev("ST.seasonOver")) break;
  }
  console.log(`   ${g}경기 소화 · 콜드 ${seen.cold} · 무 ${seen.tie} · 우천 ${seen.rain} · 용병 ${seen.merc||0}회 · 부상 ${seen.inj} · 진기록 ${feats}건`);
  console.log(`   팀 컨디션 추이: ${condLog.join(' ')}`);
  T('컨디션이 바닥으로 안 간다', ()=>{
    const tail=condLog.slice(-5); const m=tail.reduce((a,b)=>a+b,0)/Math.max(1,tail.length);
    return m>=40 ? `후반 평균 ${m.toFixed(0)}` : `!후반 평균 ${m.toFixed(0)} — 데스스파이럴`;
  });
  T('승률이 실제(.385)와 크게 안 벌어진다', ()=>{
    const st=ev("ST.stand['wwzw']"); const wr=st.w/Math.max(1,st.g);
    return Math.abs(wr-0.385)<0.30 ? `승률 ${wr.toFixed(3)}` : `!승률 ${wr.toFixed(3)} — 실제와 ${(wr-0.385).toFixed(3)} 차이`;
  });
  T('시즌이 끝까지 돌아간다', ()=>g>=13 ? `${g}경기` : `!${g}경기에서 멈췄다`);
  T('전적이 경기 수와 맞는다', ()=>{
    const st=ev("ST.stand['wwzw']");
    return st.w+st.l+st.t===st.g ? `${st.w}승 ${st.l}패 ${st.t}무` : `!${st.w}/${st.l}/${st.t} vs ${st.g}경기`;
  });
  T('구간 시상이 쌓였다', ()=>{const n=ev("(ST.hall||[]).length"); return n>0?`${n}개`:'!0개';});
  T('통산 기록이 쌓였다', ()=>{const n=ev("Object.keys(ST.career||{}).length"); return n>0?`${n}명`:'!0명';});
  T('리그 기록에 상대 타자도 있다', ()=>{
    const n=ev(`(function(){let n=0;TEAMS.forEach(t=>{if(t.id==='wwzw')return;
      t.players.forEach(p=>{if(ST.lgBat[p.id]&&ST.lgBat[p.id].pa>0)n++})});return n})()`);
    return n>100?`${n}명`:`!${n}명뿐`;
  });

  console.log('\n[전 화면 훑기 — 시즌 종료 시점]');
  const s1=sweep('시즌말');
  T('전 화면 클린', ()=>s1.length===0?true:'!'+s1.join(' / '));

  console.log('\n[세이브 왕복]');
  ev("saveGame(true)"); await wait(120);
  const before=ev("JSON.stringify({r:ST.round,w:ST.stand['wwzw'].w,f:(ST.feats||[]).length,h:(ST.hall||[]).length,c:Object.keys(ST.career||{}).length})");
  const okLoad=await new Promise(res=>{ w.eval("loadGame().then(x=>{window.__L=x;})"); setTimeout(()=>res(ev("!!window.__L")),200); });
  T('저장본을 다시 읽는다', ()=>okLoad);
  T('핵심 상태가 보존된다', ()=>{
    ev("ST=window.__L; normalizeState();");
    const after=ev("JSON.stringify({r:ST.round,w:ST.stand['wwzw'].w,f:(ST.feats||[]).length,h:(ST.hall||[]).length,c:Object.keys(ST.career||{}).length})");
    return after===before ? before : `!${before} → ${after}`;
  });
  const s2=sweep('로드후');
  T('로드 후 전 화면 클린', ()=>s2.length===0?true:'!'+s2.join(' / '));

  console.log('\n[세이브 코드 왕복]');
  T('내보내기/불러오기', ()=>{
    const code=ev("packSave(JSON.stringify(ST))");
    const back=ev(`(function(){try{return JSON.parse(unpackSave(${JSON.stringify(code)}))}catch(e){return null}})()`);
    if(!back) return '!압축 해제 실패';
    return back.round===ev("ST.round") ? `${Math.round(code.length/1024)}KB` : '!내용 불일치';
  });

  console.log('\n[새 시즌]');
  if(ev("ST.seasonOver")){
    w.go('home'); await wait(250);
    const nb=[...d.querySelectorAll('#view .btn')].find(x=>/새 시즌 시작/.test(x.textContent));
    T('새 시즌 버튼', ()=>!!nb);
    if(nb){ nb.click(); await wait(400);
      T('2년차로 넘어간다', ()=>ev("ST.seasonNo")>=2?`${ev("ST.seasonNo")}년차`:'!안 넘어감');
      T('통산은 이월된다', ()=>ev("Object.keys(ST.career||{}).length")>0);
      T('전시장은 이월된다', ()=>ev("(ST.hall||[]).length")>0);
      T('시즌 기록은 초기화된다', ()=>ev("ST.stand['wwzw'].g")===0);
      const s3=sweep('새시즌'); T('새 시즌 전 화면 클린', ()=>s3.length===0?true:'!'+s3.join(' / '));
    }
  } else { warn.push('시즌이 안 끝나서 새 시즌 검사를 못 했다'); }

  console.log('\n[사운드]');
  T('BGM 이 돈다', ()=>ev("BGM.ready&&BGM.playing"));
  T('끄면 저장된다', ()=>{ ev("if(BGM.on)BGM.toggle()"); return JSON.parse(w.localStorage.getItem('wwzw_snd')).on===false; });
  T('꺼도 화면은 멀쩡하다', ()=>{ const s=sweep('소리끔'); return s.length===0?true:'!'+s.join(' / '); });
  ev("if(!BGM.on)BGM.toggle()");

  console.log('\n[결론]');
  if(warn.length) warn.forEach(x=>console.log('  ⚠️  '+x));
  console.log(bad.length?`\n❌ ${bad.length}건\n - `+bad.join('\n - '):'\n✅ 이상 없음');
  process.exit(bad.length?1:0);
})();
