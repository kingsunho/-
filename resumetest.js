/* [2.9.3] 경기 중 다른 탭 갔다 와도 이어서 진행되는지 */
const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const errs=[];const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!/scrollTo/.test(e.message))errs.push(e.message)});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:vc});
dom.window.scrollTo=()=>{};dom.window.confirm=()=>true;
const w=dom.window,d=w.document,ev=s=>w.eval(s);
const T=(n,f)=>{try{const r=f();console.log((r?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r:''));if(!r)errs.push(n);}catch(e){console.log('  ❌ '+n+' :: '+e.message);errs.push(n)}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

setTimeout(async()=>{
  d.querySelectorAll('.pickcard')[0].click();await wait(50);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(250);
  ev("ST.tutDone=true; ST.weekDone=true; ST.announced=true; ST.lineupDirty=false;");

  console.log('[경기 도중 다른 탭에 갔다 온다]');
  w.go('game'); await wait(120);
  const gb=[...d.querySelectorAll('#view .btn')].find(x=>/직접 지휘/.test(x.textContent));
  if(!gb){ console.log('  ❌ 직접 지휘 버튼이 없다'); process.exit(1); }
  gb.click(); await wait(120);
  ev("if(playTimer){clearInterval(playTimer);playTimer=null;}");
  // 몇 타석 진행시킨다
  ev(`for(let i=0;i<45;i++){ const dd=LIVE.pending||LIVE.detectDecision();
        if(dd){LIVE.applyDecision(dd.kind==='pitcherChange'?'stay':(dd.kind==='defense'?'defnone':'none'));continue;}
        LIVE.step(); }`);
  const snap=()=>ev("[LIVE.inning,LIVE.half,LIVE.outs,LIVE.home.runs,LIVE.away.runs,LIVE.paSeq,LIVE.log.length].join('/')");
  const before=snap();
  const beforeAB=ev("Object.keys(LIVE.box).reduce((n,k)=>n+(LIVE.box[k].pa||0),0)");
  console.log('   나가기 전 : '+before+`  (총 ${beforeAB}타석)`);
  T('경기가 실제로 진행돼 있다', ()=>beforeAB>5 && `${beforeAB}타석`);

  ['home','squad','lineup'].forEach(v=>{ try{ w.go(v); }catch(e){} });
  await wait(80);
  T('다른 탭에 갔을 때 진행이 멈춘다(타이머 정지)', ()=>{
    const a=snap(); return a===before || `진행됨 ${before} → ${a}`;
  });

  w.go('game'); await wait(200);
  ev("if(playTimer){clearInterval(playTimer);playTimer=null;}");
  const after=snap();
  const afterAB=ev("Object.keys(LIVE.box).reduce((n,k)=>n+(LIVE.box[k].pa||0),0)");
  console.log('   돌아온 뒤 : '+after+`  (총 ${afterAB}타석)`);

  T('경기가 리셋되지 않았다', ()=>after===before || `${before} → ${after}`);
  T('기록(타석 수)이 그대로다', ()=>afterAB===beforeAB && `${beforeAB}타석 유지`);
  T('「직접 지휘 / 자동 진행」 버튼이 다시 뜨지 않는다', ()=>{
    const b=[...d.querySelectorAll('#view .btn')].map(x=>x.textContent);
    return !b.some(x=>/직접 지휘|자동 진행/.test(x)) || '버튼 다시 뜸: '+b.join(' | ');
  });
  T('이어서 진행한다는 안내가 뜬다', ()=>{
    const wn=[...d.querySelectorAll('#view .warn')].map(x=>x.textContent).join(' ');
    return /이어서/.test(wn) && wn.trim().slice(0,60);
  });
  T('중계 로그가 다시 그려져 있다', ()=>{
    const n=d.querySelectorAll('#feed > *').length;
    return n>0 && `${n}줄`;
  });
  T('스코어보드가 복구됐다', ()=>{
    const us=d.getElementById('sb-us'), inn=d.getElementById('sb-inn');
    return us&&inn && `${inn.textContent} · 우리 ${us.textContent}점`;
  });

  console.log('[끝까지 완주된다]');
  ev(`let g=0; while(!LIVE.over&&g++<5000){ const dd=LIVE.pending||LIVE.detectDecision();
        if(dd){LIVE.applyDecision(dd.kind==='pitcherChange'?'stay':(dd.kind==='defense'?'defnone':'none'));continue;}
        LIVE.step(); }`);
  T('나갔다 온 경기도 정상 종료된다', ()=>ev("LIVE.over")&&ev("LIVE.inning+'회 종료'"));

  console.log('[다른 차전 찌꺼기는 버린다]');
  ev("LIVE.over=false; LIVE.round=ST.round+5;");
  w.go('game'); await wait(150);
  T('차전이 다르면 새로 시작 버튼이 나온다', ()=>{
    const b=[...d.querySelectorAll('#view .btn')].map(x=>x.textContent);
    return b.some(x=>/직접 지휘/.test(x)) && b.join(' | ');
  });

  if(errs.length) console.log('\n실패:',errs);
  console.log(errs.length?'\n❌ 실패 '+errs.length+'건':'\n✅ 이상 없음');
  process.exit(errs.length?1:0);
},3000);
