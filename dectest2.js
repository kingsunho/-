/* [2.9.1] 지시없음이 판단 횟수를 먹지 않는지 · 투수 교체가 항상 되는지 */
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
  ev("ST.tutDone=true; ST.weekDone=true; ST.absent={}; ST.injury={};");
  ev("ST.lineup=recommendLineup(); ST.rotation=recommendRotation(); ST.useDH=true; applyDHRule(); resolveStarterField();");

  console.log('[지시 없음은 판단 횟수를 안 먹는다]');
  ev("LIVE=makeLive(); LIVE.manual=true;");
  T('수비 「그대로 간다」 5번 → 수비 판단 그대로', ()=>{
    const a=ev("LIVE.defTimeouts");
    ev("for(let i=0;i<5;i++) LIVE.applyDecision('defnone');");
    const b=ev("LIVE.defTimeouts");
    return a===b && `${a} → ${b}`;
  });
  T('공격 「그대로 간다」 5번 → 작전 횟수 그대로', ()=>{
    const a=ev("LIVE.timeouts");
    ev("for(let i=0;i<5;i++) LIVE.applyDecision('none');");
    const b=ev("LIVE.timeouts");
    return a===b && `${a} → ${b}`;
  });
  T('실제 작전은 여전히 횟수를 쓴다', ()=>{
    const a=ev("LIVE.timeouts"); ev("LIVE.applyDecision('swing')");
    const b=ev("LIVE.timeouts");
    return b===a-1 && `적극 타격: ${a} → ${b}`;
  });
  T('「지시 해제」는 공짜이고 전술을 실제로 푼다', ()=>{
    const a=ev("LIVE.timeouts"); ev("LIVE.applyDecision('normal')");
    const b=ev("LIVE.timeouts"), ttl=ev("LIVE.tacTTL.bat+LIVE.tacTTL.run");
    return b===a && ttl===0 && `${a} → ${b} · 남은 지시 타석 ${ttl}`;
  });

  console.log('[넘기기만 해도 판단창이 계속 뜬다]');
  ev(`
    LIVE=makeLive(); LIVE.manual=true;
    window._asked=0; let guard=0;
    while(!LIVE.over && guard++<4000){
      const dd=LIVE.pending||LIVE.detectDecision();
      if(dd){
        if(dd.kind==='defense'){ window._asked++; LIVE.applyDecision('defnone'); }
        else LIVE.applyDecision(dd.kind==='pitcherChange'?'stay':'none');
        continue;
      }
      LIVE.step();
    }`);
  T('한 경기 내내 넘겨도 수비 판단이 안 깎인다', ()=>{
    const v=ev("LIVE.defTimeouts"); return v===3 && `남은 ${v}회`;
  });
  T('수비 판단창이 경기 중 여러 번 떴다', ()=>{
    const n=ev("window._asked"); return n>=2 && `${n}번`;
  });
  T('공격 작전 횟수도 안 깎였다', ()=>{
    const v=ev("LIVE.timeouts"); return v===5 && `남은 ${v}회`;
  });

  console.log('[투수 교체]');
  ev("LIVE=makeLive(); LIVE.manual=true;");
  T('판단창 없이 바로 교체된다', ()=>{
    const before=ev("LIVE.curPitcher(LIVE.userSide()).name");
    const can=ev("LIVE.userSide().pIdx < LIVE.userSide().rot.length-1");
    ev("LIVE.applyDecision('pchange')");
    const after=ev("LIVE.curPitcher(LIVE.userSide()).name");
    return (!can || before!==after) && `${before} → ${after}`;
  });
  T('투수 교체는 횟수를 안 쓴다', ()=>{
    const a=ev("LIVE.timeouts"), b=ev("LIVE.defTimeouts");
    return a===5&&b===3 && `작전 ${a} · 수비 ${b}`;
  });
  T('경기 화면 상시 버튼에 투수 교체가 있다', ()=>{
    ev(`{ const st=document.createElement('div'); const lc=document.createElement('div');
         lc.id='livectl'; st.appendChild(lc); document.body.appendChild(st); paintLiveCtl(); }`);
    const labels=[...d.querySelectorAll('#livectl button')].map(b=>b.textContent);
    return labels.some(x=>/투수 교체|남은 투수 없음/.test(x)) && labels.join(' | ');
  });

  console.log('[판단창 UI]');
  T('공격 판단창에 「그대로 간다」 버튼이 있다', ()=>{
    ev(`LIVE=makeLive(); LIVE.manual=true;
        let g=0; while(!LIVE.over && g++<4000){
          const dd=LIVE.detectDecision();
          if(dd && dd.kind==='situation'){ window._d=dd; break; }
          if(dd) LIVE.applyDecision(dd.kind==='pitcherChange'?'stay':'defnone');
          else LIVE.step();
        }`);
    if(!ev("window._d")) return '공격 판단 지점이 안 나옴(확률) — 재실행';
    if(!d.getElementById('decision')){
      const b=d.createElement('div'); b.id='decision'; d.body.appendChild(b);
    }
    ev("showDecision(window._d)");
    const txt=[...d.querySelectorAll('#decision button')].map(b=>b.textContent).join(' | ');
    return /그대로 간다/.test(txt) && txt.slice(0,150);
  });

  if(errs.length) console.log('\njsdom/실패:',errs);
  console.log(errs.length?'\n❌ 실패 '+errs.length+'건':'\n✅ 이상 없음');
  process.exit(errs.length?1:0);
},3000);
