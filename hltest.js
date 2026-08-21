const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const errs=[];const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!/scrollTo/.test(e.message))errs.push(e.message)});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:vc});
dom.window.scrollTo=()=>{};dom.window.confirm=()=>true;
const w=dom.window,d=w.document,ev=s=>w.eval(s);
const T=(n,f)=>{try{const r=f();console.log((r?'  ✅ ':'  ❌ ')+n);if(!r)errs.push(n);}catch(e){console.log('  ❌ '+n+' :: '+e.message);errs.push(n)}};
/* v1.5.1 부터 라인업을 단톡방에 발표해야 경기로 넘어간다.
   그리고 startLive() 는 #stage 가 있어야 한다 — 경기 화면을 먼저 그린다. */
async function enterGame(w,d,ev,manual){
  ev("ST.weekDone=true; ST.announced=true; ST.lineupDirty=false; if(ST.events)ST.events=[];");
  w.go('game'); await new Promise(r=>setTimeout(r,120));
  const b=[...d.querySelectorAll('#view .btn')]
    .find(x=>new RegExp(manual?'직접 지휘':'자동 진행').test(x.textContent));
  if(!b) return false;
  b.click(); await new Promise(r=>setTimeout(r,manual?150:60));
  return true;
}
setTimeout(async()=>{
  d.querySelectorAll('.pickcard')[0].click();await new Promise(r=>setTimeout(r,50));
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await new Promise(r=>setTimeout(r,250));
  ev("runWeek();ST.events=[];autoFixLineup();applyDHRule();");
  w.go('game'); await new Promise(r=>setTimeout(r,50));
  await enterGame(w,d,ev,false); await new Promise(r=>setTimeout(r,200));

  const res=ev("LIVE.result");
  console.log('[하이라이트 수집]');
  const hls=ev("LIVE.result.highlights");
  console.log(`   ${hls.length}건`);
  hls.slice(0,10).forEach(x=>console.log(`   ${x.inning}회 ${x.half===0?'초':'말'} · ${({hr:'홈런',d3:'3루타',d2:'2루타',dp:'병살타',cs:'도루자'})[x.kind]} · ${x.name} (${x.team})${x.detail?' '+x.detail:''}`));
  T('하이라이트 수집됨', ()=>hls.length>0);
  T('이닝 정보 정확', ()=>hls.every(x=>x.inning>=1&&x.inning<=12&&(x.half===0||x.half===1)));
  T('종류 5종만', ()=>hls.every(x=>['hr','d3','d2','dp','cs'].includes(x.kind)));
  T('우리팀 표시(us) 존재', ()=>hls.some(x=>typeof x.us==='boolean'));
  // 박스스코어와 대조
  const box=ev("LIVE.result.box");
  const uSide=ev("LIVE.userIsHome?'home':'away'");
  const uSlots=ev(`LIVE.${uSide==='home'?'home':'away'}.slots.map(s=>s.id)`);
  let d2b=0,d3b=0,hrb=0,csb=0;
  uSlots.forEach(id=>{const b=box[id];if(!b)return;d2b+=b.d2;d3b+=b.d3;hrb+=b.hr;csb+=b.cs;});
  const cnt=k=>hls.filter(x=>x.us&&x.kind===k).length;
  console.log(`   대조 — 박스: 2B${d2b} 3B${d3b} HR${hrb} CS${csb} / 하이라이트: 2B${cnt('d2')} 3B${cnt('d3')} HR${cnt('hr')} CS${cnt('cs')}`);
  T('2루타 수 일치', ()=>cnt('d2')===d2b);
  T('3루타 수 일치', ()=>cnt('d3')===d3b);
  T('홈런 수 일치', ()=>cnt('hr')===hrb);
  T('도루자 수 일치', ()=>cnt('cs')===csb);
  T('병살타 수 일치', ()=>hls.filter(x=>x.kind==='dp').length===ev("LIVE.result.dpCount"));

  console.log('\n[화면 렌더]');
  const stage=d.getElementById('stage');
  T('하이라이트 카드', ()=>/경기 하이라이트/.test(stage.textContent));
  T('승리·패배투수 표시', ()=>/승리투수/.test(stage.textContent)&&/패전투수/.test(stage.textContent) || /무승부/.test(stage.textContent));
  const decRow=stage.querySelector('.hl-dec');
  console.log('   ', decRow?decRow.textContent.replace(/\s+/g,' '):'(없음)');
  T('투수 이름이 id 가 아님', ()=>{
    const t=decRow?decRow.textContent:'';
    return !/swm|lg|kig|khg|kjh|ksh|_p\d/.test(t);});
  T('요약 줄', ()=>/2루타 \d+ · 3루타 \d+ · 홈런 \d+ · 병살타 \d+ · 도루자 \d+/.test(stage.textContent));
  T('undefined/NaN 없음', ()=>!/undefined|NaN/.test(stage.textContent));
  const rows=stage.querySelectorAll('.hl-tbl tr');
  console.log('   표 행수:', rows.length-1);
  T('표 행수 = 하이라이트 수', ()=>rows.length-1===hls.length||hls.length===0);

  console.log('\n[여러 경기 안정성]');
  let tot=0, hr=0;
  for(let i=0;i<15;i++){
    ev("applyDHRule();LIVE=makeLive();LIVE.manual=false;var _g=0;while(!LIVE.over&&_g++<4000){if(LIVE.pending)LIVE.applyDecision('change');LIVE.step();}LIVE.finish();");
    const h=ev("LIVE.result.highlights"); tot+=h.length; hr+=h.filter(x=>x.kind==='hr').length;
    if(!ev("LIVE.result.wp")&&!ev("LIVE.result.tie"))errs.push('승리투수 누락');
  }
  console.log(`   15경기 하이라이트 ${tot}건 (경기당 ${(tot/15).toFixed(1)}) · 홈런 ${hr}개`);
  T('경기당 하이라이트 존재', ()=>tot>0);
  console.log(errs.length?'\n❌ '+errs.length+'건':'\n✅ 전체 통과');
  errs.forEach(e=>console.log('  - '+e));
  process.exit(errs.length?1:0);
},450);
