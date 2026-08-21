/* [2.9.2] 투수 교체 시 타순·수비 정리 — 지명타자 유무 모두 */
const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const errs=[];const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!/scrollTo/.test(e.message))errs.push(e.message)});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:vc});
dom.window.scrollTo=()=>{};dom.window.confirm=()=>true;
const w=dom.window,d=w.document,ev=s=>w.eval(s);
const T=(n,f)=>{try{const r=f();console.log((r?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r:''));if(!r)errs.push(n);}catch(e){console.log('  ❌ '+n+' :: '+e.message);errs.push(n)}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));

const setup=(useDH)=>ev(`
  ST.weekDone=true; ST.absent={}; ST.injury={};
  ST.lineup=recommendLineup(); ST.rotation=recommendRotation();
  ST.useDH=${useDH}; applyDHRule(); resolveStarterField();
  LIVE=makeLive(); LIVE.manual=true;`);
const order=()=>ev("LIVE.userSide().slots.map((s,i)=>(i+1)+'.'+nameOf(s.id)+'('+s.pos+')').join(' ')");
const dupPos=()=>ev(`(()=>{const p=LIVE.userSide().slots.map(s=>s.pos);
  return p.filter((x,i)=>p.indexOf(x)!==i).join(',');})()`);
const dupId=()=>ev(`(()=>{const p=LIVE.userSide().slots.map(s=>s.id);
  return p.filter((x,i)=>p.indexOf(x)!==i).map(nameOf).join(',');})()`);

setTimeout(async()=>{
  d.querySelectorAll('.pickcard')[0].click();await wait(50);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(250);
  ev("ST.tutDone=true;");

  console.log('[지명타자 미사용 — 내려간 투수는 경기에서 빠진다]');
  setup(false);
  console.log('   교체 전 : '+order());
  T('타순에 투수(P) 칸이 있다', ()=>ev("LIVE.userSide().slots.some(s=>s.pos==='P')"));
  const out1=ev("LIVE.curPitcher(LIVE.userSide()).id");
  ev("LIVE.applyDecision('pchange')");
  console.log('   교체 후 : '+order());
  T('내려간 투수가 타순에서 빠졌다', ()=>{
    const still=ev(`LIVE.userSide().slots.some(s=>s.id==='${out1}')`);
    return !still && `${ev(`nameOf('${out1}')`)} 아웃`;
  });
  T('새 투수가 타순의 P 자리에 있다', ()=>{
    const pid=ev("(LIVE.userSide().slots.find(s=>s.pos==='P')||{}).id");
    const now=ev("LIVE.curPitcher(LIVE.userSide()).id");
    return pid===now && ev("LIVE.curPitcher(LIVE.userSide()).name");
  });
  T('한 사람이 두 포지션을 맡지 않는다', ()=>{const x=dupPos(); return !x || '중복 '+x;});
  T('같은 사람이 타순에 두 번 없다', ()=>{const x=dupId(); return !x || '중복 '+x;});
  T('타순은 9명 그대로', ()=>ev("LIVE.userSide().slots.length")===9);

  console.log('[지명타자 미사용 — 야수가 구원 등판하면 그 수비를 벤치가 메운다]');
  setup(false);
  // 로테이션 다음 투수를 '이미 야수로 뛰는 사람' 으로 강제
  const forced=ev(`(()=>{
    const s=LIVE.userSide();
    const f=s.slots.find(x=>x.pos!=='P'&&s.team.pitchers.some(p=>p.id===x.id));
    if(!f) return '';
    s.rot=[s.rot[s.pIdx], f.id].concat(s.rot.filter(id=>id!==f.id&&id!==s.rot[s.pIdx]));
    s.pIdx=0; return f.id+'|'+f.pos;})()`);
  if(!forced){ console.log('  ⚠ 야수 겸 투수가 없어 이 케이스는 건너뜀'); }
  else{
    const [fid,fpos]=forced.split('|');
    console.log(`   ${ev(`nameOf('${fid}')`)}(${fpos})를 등판시킨다`);
    console.log('   교체 전 : '+order());
    ev("LIVE.applyDecision('pchange')");
    console.log('   교체 후 : '+order());
    T('그 사람이 투수(P)로 바뀌었다', ()=>ev(`(LIVE.userSide().slots.find(s=>s.id==='${fid}')||{}).pos`)==='P');
    T('비었던 수비 자리를 누가 맡았다', ()=>{
      const who=ev(`(LIVE.userSide().slots.find(s=>s.pos==='${fpos}')||{}).id`);
      return !!who && `${POSNAMESJS(fpos)} → ${ev(`nameOf('${who}')`)}`;
    });
    T('투수 겸 야수가 없다', ()=>{const x=dupPos(); return !x || '중복 '+x;});
    T('같은 사람이 타순에 두 번 없다', ()=>{const x=dupId(); return !x || '중복 '+x;});
    T('타순은 9명 그대로', ()=>ev("LIVE.userSide().slots.length")===9);
  }
  function POSNAMESJS(p){ return ev(`POSNAMES['${p}']||'${p}'`); }

  console.log('[지명타자 사용 — 투수는 타순 밖이라 타순이 안 흔들린다]');
  setup(true);
  const before=order();
  console.log('   교체 전 : '+before);
  ev("LIVE.applyDecision('pchange')");
  console.log('   교체 후 : '+order());
  T('지명타자 상태가 규칙에 맞다', ()=>{
    const hasDH=ev("LIVE.userSide().slots.some(s=>s.pos==='DH')");
    const hasP =ev("LIVE.userSide().slots.some(s=>s.pos==='P')");
    const lost =ev("!!LIVE.dhLost");
    // 지타 유지 = P 칸 없음 / 지타 소멸 = 야수가 등판해 P 칸이 생기고 소멸 기록이 남음
    if(hasDH && !hasP && !lost) return '지명타자 유지 · 투수는 타순 밖';
    if(!hasDH && hasP && lost)  return '지명타자 소멸 (야수가 등판) · 기록됨';
    return false;
  });
  T('지명타자 소멸이면 중계에 남는다', ()=>{
    if(!ev("!!LIVE.dhLost")) return '소멸 안 함 — 해당 없음';
    const has=ev("LIVE.log.some(l=>/지명타자 소멸/.test(l.text||''))");
    return has && ev("LIVE.log.filter(l=>/지명타자 소멸/.test(l.text||''))[0].text");
  });
  T('한 사람이 두 포지션을 맡지 않는다', ()=>{const x=dupPos(); return !x || '중복 '+x;});
  T('같은 사람이 타순에 두 번 없다', ()=>{const x=dupId(); return !x || '중복 '+x;});
  T('타순은 9명 그대로', ()=>ev("LIVE.userSide().slots.length")===9);

  console.log('[전 경기 완주 — 교체를 반복해도 라인업이 안 깨진다]');
  [false,true].forEach(useDH=>{
    setup(useDH);
    const r=ev(`(()=>{
      let g=0,badPos=0,badId=0,badLen=0,changes=0,pitchedAndFielded=0;
      while(!LIVE.over && g++<5000){
        const dd=LIVE.pending||LIVE.detectDecision();
        if(dd){ if(dd.kind==='pitcherChange'){changes++;LIVE.applyDecision('change');}
                else LIVE.applyDecision(dd.kind==='defense'?'defnone':'none'); continue; }
        if(g%12===0 && LIVE.userSide().pIdx<LIVE.userSide().rot.length-1){
          LIVE.applyDecision('pchange'); changes++;
        }
        LIVE.step();
        const sl=LIVE.userSide().slots;
        const ol=LIVE.oppSide().slots;
        if(ol.some(x=>!LIVE.oppSide().team.players.some(q=>q.id===x.id))) badId++;
        const ps=sl.map(x=>x.pos), ids=sl.map(x=>x.id);
        if(ps.some((x,i)=>ps.indexOf(x)!==i)) badPos++;
        if(ids.some((x,i)=>ids.indexOf(x)!==i)) badId++;
        if(sl.length!==9) badLen++;
        const mound=LIVE.curPitcher(LIVE.userSide()).id;
        const f=sl.find(x=>x.id===mound);
        if(f && f.pos!=='P' && !LIVE.userSide().slots.every(x=>x.pos!=='P')) pitchedAndFielded++;
      }
      return [changes,badPos,badId,badLen,pitchedAndFielded].join(',');
    })()`);
    const [ch,bp,bi,bl,pf]=r.split(',').map(Number);
    T(`지명타자 ${useDH?'사용':'미사용'} — 교체 ${ch}회, 포지션 중복 ${bp} · 인원 중복 ${bi} · 타순 인원 이상 ${bl} · 투수겸야수 ${pf}`,
      ()=>bp===0&&bi===0&&bl===0&&pf===0);
  });

  console.log('[교체 안내 문구]');
  setup(false);
  T('지명타자 미사용 — 빠진다고 알려준다', ()=>{
    const outN=ev("LIVE.curPitcher(LIVE.userSide()).name");
    const hadDH=ev("LIVE.userSide().slots.some(x=>x.pos==='DH')");
    ev("LIVE.applyDecision('pchange')");
    return ev(`pchangeToast(LIVE.userSide(),'${outN}',${hadDH})`);
  });
  setup(true);
  T('지명타자 사용 — 소멸하면 알려준다', ()=>{
    ev(`(function(){var s=LIVE.userSide();
      var f=s.slots.find(function(x){return x.pos!=='P'&&s.team.pitchers.some(function(p){return p.id===x.id})});
      if(f){ s.rot=[s.rot[s.pIdx],f.id].concat(s.rot.filter(function(id){return id!==f.id&&id!==s.rot[s.pIdx]})); s.pIdx=0; }
    })()`);
    const outN=ev("LIVE.curPitcher(LIVE.userSide()).name");
    const hadDH=ev("LIVE.userSide().slots.some(x=>x.pos==='DH')");
    ev("LIVE.applyDecision('pchange')");
    const t=ev(`pchangeToast(LIVE.userSide(),'${outN}',${hadDH})`);
    return (!ev("!!LIVE.dhLost") || /지명타자 소멸/.test(t)) && t;
  });

  if(errs.length) console.log('\n실패:',errs);
  console.log(errs.length?'\n❌ 실패 '+errs.length+'건':'\n✅ 이상 없음');
  process.exit(errs.length?1:0);
},3000);
