/* 세이브 다이어트 — 줄었는지 + 결과가 같은지 */
const {JSDOM,VirtualConsole}=require('jsdom');
const dom=new JSDOM(require('fs').readFileSync('index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  virtualConsole:new VirtualConsole(),beforeParse(w){w.scrollTo=()=>{};w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;}});
const w=dom.window,d=w.document,ev=s=>w.eval(s);
w.confirm=()=>true;
const bad=[];
const T=(n,f)=>{try{const r=f();const ok=r===true||(typeof r==='string'&&!/^!/.test(r));
  console.log((ok?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r.replace(/^!/,''):''));if(!ok)bad.push(n);}
  catch(e){console.log('  ❌ '+n+' :: '+e.message);bad.push(n+': '+e.message)}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await wait(700);
  d.querySelectorAll('.pickcard')[0].click(); await wait(60);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(300); ev("ST.tutDone=true");
  ev(`(function(){ for(let i=0;i<22;i++){
    runWeek(); ST.weekDone=true; ST.announced=true; ST.lineupDirty=false;
    if(ST.events&&ST.events.length)ST.events=[]; ST.absent={};
    const L=makeLive(); let k=0; while(!L.over&&k++<3000){L.pending=null;L.step();}
    L.finish(); const n=ST.schedule[ST.round]; if(!n)break;
    const r=L.result; const us=n.homeGame?r.home:r.away, th=n.homeGame?r.away:r.home;
    LIVE=L; commitGame(r,us,th,us.slots); if(ST.seasonOver)break; } })()`);

  const full=ev("JSON.stringify(ST).length"), trim=ev("serializeState().length");
  console.log(`[크기] ${(full/1024).toFixed(0)} KB → ${(trim/1024).toFixed(0)} KB  (${((1-trim/full)*100).toFixed(0)}% 감소)`);
  const codeFull=ev("packSave(JSON.stringify(ST)).length"), codeTrim=ev("packSave(serializeState()).length");
  console.log(`[공유코드] ${(codeFull/1024).toFixed(0)} KB → ${(codeTrim/1024).toFixed(0)} KB`);
  T('세이브가 줄었다', ()=>trim<full ? `${((1-trim/full)*100).toFixed(0)}% 감소` : '!안 줄었다');

  console.log('\n[결과가 같은지 — 저장→불러오기 왕복]');
  const before=ev(`JSON.stringify({
    stand:ST.stand, bat:ST.bat, pit:ST.pit, career:ST.career, feats:(ST.feats||[]).length,
    hall:(ST.hall||[]).length, round:ST.round,
    lgTop:Object.entries(ST.lgBat).filter(([,b])=>b.pa>0).length,
    lgPTop:Object.entries(ST.lgPit).filter(([,p])=>p.outs>0).length })`);
  // 실제 저장 경로로 왕복
  ev("window.__saved=serializeState()");
  ev("ST=JSON.parse(window.__saved); normalizeState();");
  const after=ev(`JSON.stringify({
    stand:ST.stand, bat:ST.bat, pit:ST.pit, career:ST.career, feats:(ST.feats||[]).length,
    hall:(ST.hall||[]).length, round:ST.round,
    lgTop:Object.entries(ST.lgBat).filter(([,b])=>b.pa>0).length,
    lgPTop:Object.entries(ST.lgPit).filter(([,p])=>p.outs>0).length })`);
  T('기록이 하나도 안 바뀐다', ()=>before===after ? true : '!달라졌다');
  T('빈 항목이 되채워진다', ()=>{
    const nb=ev("Object.keys(ST.lgBat).length"), np=ev("Object.keys(ST.lgPit).length");
    return nb>200 && np>60 ? `타자 ${nb}명 · 투수 ${np}명 복원` : `!타자 ${nb} 투수 ${np}`;
  });
  T('리그 순위표가 그대로 나온다', ()=>{
    ev("statTab='league'"); w.go('stats');
    const rows=d.querySelectorAll('#view table.box tr').length;
    return rows>5 ? `${rows}줄` : `!${rows}줄`;
  });
  T('구간 시상 스냅샷이 살아 있다', ()=>{
    if(!ev("!!ST.awardSnap")) return '스냅샷 없음(아직 시상 전)';
    let ok=true; try{ ev("runMiniAwards(ST)"); }catch(e){ ok='!'+e.message; }
    return ok;
  });
  T('공유 코드 왕복', ()=>{
    const code=ev("packSave(serializeState())");
    const back=ev(`(function(){try{return JSON.parse(unpackSave(${JSON.stringify(code)}))}catch(e){return null}})()`);
    return back && back.round===ev("ST.round") ? `${(code.length/1024).toFixed(0)}KB` : '!복원 실패';
  });
  T('전 화면 클린', ()=>{
    const dirty=[];
    for(const v of ['home','squad','lineup','kakao','stand','stats','records','train','scout','recruit','hall','more','player']){
      try{ w.go(v); }catch(e){ dirty.push(v+':'+e.message); continue; }
      const t=(d.getElementById('view')||{}).textContent||'';
      if(/undefined|NaN/.test(t)||t.trim().length<6) dirty.push(v);
    }
    return dirty.length?('!'+dirty.join(',')):true;
  });
  console.log(bad.length?`\n❌ ${bad.length}건`:'\n✅ 이상 없음');
  process.exit(bad.length?1:0);
})();
