const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync(process.argv[2]||'index.html','utf8');
const errs=[];const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!/scrollTo/.test(e.message))errs.push('JSDOM: '+e.message)});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:vc});
dom.window.scrollTo=()=>{};dom.window.confirm=()=>true;
const w=dom.window,d=w.document,ev=s=>w.eval(s);
const T=(n,f)=>{try{const r=f();console.log((r?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r:''));if(!r)errs.push(n);}catch(e){console.log('  ❌ '+n+' :: '+e.message);errs.push(n)}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(async()=>{
  d.querySelectorAll('.pickcard')[0].click();await wait(50);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(250); ev("ST.tutDone=true");

  console.log('[UI 자동 진행 3경기]');
  for(let g=0;g<3;g++){
    ev("ST.weekDone=true; ST.announced=true; ST.lineupDirty=false;");
    w.go('game'); await wait(120);
    const b=[...d.querySelectorAll('#view .btn')].find(x=>/자동 진행/.test(x.textContent));
    if(!b){ errs.push('경기 '+g+': 자동 진행 버튼 없음'); break; }
    b.click();
    for(let i=0;i<400 && !ev("LIVE&&LIVE.over");i++) await wait(20);
    await wait(150);
    const t=d.getElementById('view').textContent;
    if(/undefined|NaN/.test(t)) errs.push('경기 '+g+' 결과 화면에 undefined/NaN');
    const cards=[...d.querySelectorAll('#view .card-h')].map(x=>x.textContent);
    if(cards.filter(x=>/타격$/.test(x)).length!==2) errs.push('경기 '+g+': 타격 카드 2개 아님 → '+cards.join(','));
    const nml=d.querySelectorAll('#view .nml');
    if(nml.length<18) errs.push('경기 '+g+': 클릭 가능한 이름 부족 '+nml.length);
    nml[nml.length-1].click(); await wait(40);
    if(!d.getElementById('sheet').classList.contains('open')) errs.push('경기 '+g+': 카드 안 열림');
    if(/undefined|NaN/.test(d.getElementById('sheet-body').textContent)) errs.push('경기 '+g+': 카드에 undefined/NaN');
    ev("closeSheet()");
    const fin=[...d.querySelectorAll('#view .btn')].find(x=>/결과 확정/.test(x.textContent));
    if(!fin){ errs.push('경기 '+g+': 결과 확정 버튼 없음'); break; }
    fin.click(); await wait(200);
    console.log(`   경기 ${g+1} 확정 · 전적 ${ev("ST.stand['wwzw'].w")}승 ${ev("ST.stand['wwzw'].l")}패`);
  }
  T('3경기 반영', ()=>ev("ST.stand['wwzw'].g")===3);
  T('타석 합계 > 0', ()=>ev("Object.values(ST.bat).reduce((a,b)=>a+b.pa,0)")>0);
  T('상대 팀 타자도 리그 기록에 쌓인다', ()=>ev(`(function(){
      var n=0; TEAMS.forEach(t=>{ if(t.id==='wwzw')return;
        t.players.forEach(p=>{ if(ST.lgBat[p.id]&&ST.lgBat[p.id].pa>0)n++; }); });
      return n})()`)>50);

  console.log('\n[전 화면 클린]');
  const views=['home','squad','lineup','kakao','game','stand','stats','records','train','scout','recruit','hall','more','meet'];
  for(const v of views){
    try{ w.go(v); }catch(e){ errs.push(v+' 렌더 실패: '+e.message); continue; }
    await wait(60);
    const t=d.getElementById('view').textContent;
    if(/undefined|NaN/.test(t)) errs.push(v+' 화면에 undefined/NaN');
  }
  T('전 화면 클린', ()=>!errs.some(e=>/화면에 undefined/.test(e)));

  console.log('\n[기록실 이름 클릭]');
  w.go('stats'); await wait(80);
  for(const tab of ['team','pitch','league','lgpit']){
    ev(`statTab='${tab}'; renderStats();`); await wait(60);
    const n=d.querySelectorAll('#view .nml');
    if(!n.length){ errs.push('기록실 '+tab+' 이름 링크 없음'); continue; }
    n[0].click(); await wait(40);
    const ok=d.getElementById('sheet').classList.contains('open');
    console.log(`  ${ok?'✅':'❌'} ${tab} — ${d.getElementById('sheet-title').textContent}`);
    if(!ok) errs.push('기록실 '+tab+' 카드 안 열림');
    if(/undefined|NaN/.test(d.getElementById('sheet-body').textContent)) errs.push('기록실 '+tab+' 카드 undefined');
    ev("closeSheet()"); await wait(30);
  }

  console.log('\n[세이브 왕복]');
  ev("saveGame(true)");
  T('세이브 후 로드', ()=>{ ev("loadGame&&loadGame()"); return true; });

  console.log(errs.length?`\n❌ ${errs.length}건\n - `+errs.join('\n - '):'\n✅ 전부 통과');
  process.exit(errs.length?1:0);
},600);
