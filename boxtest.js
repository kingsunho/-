/* 박스스코어(선발+대타 전원) · 선수 카드 통합 테스트 */
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
  ev("ST.tutDone=true"); w.go('home'); await wait(60);

  console.log('[경기 · 대타 포함 박스스코어]');
  // 경기를 엔진에서 직접 돌린다 (UI 자동진행은 타이머라 느리다)
  ev("ST.weekDone=true; ST.announced=true; ST.lineupDirty=false;"); w.go('game'); await wait(120);
  console.log('    게임화면 버튼:', [...d.querySelectorAll('#view .btn')].map(b=>b.textContent).join(' | '));
  const gb=[...d.querySelectorAll('#view .btn')].find(x=>/직접 지휘/.test(x.textContent));
  if(!gb){ console.log('    view:', d.getElementById('view').textContent.slice(0,400)); process.exit(1); }
  gb.click(); await wait(120);
  ev("if(playTimer){clearInterval(playTimer);playTimer=null;}");
  const info=ev(`(function(){
    var us=LIVE.userSide();
    // 4번 타자 자리에 대타를 하나 꽂는다
    var bench=(LIVE.benchPool||[]).filter(id=>!us.slots.some(s=>s.id===id));
    var starter=null, ph=null;
    var guard=0;
    while(!LIVE.over && guard++<4000){
      LIVE.pending=null;
      if(!ph && LIVE.inning>=3 && LIVE.half===(LIVE.userIsHome?1:0) && bench.length){
        var idx=us.order%9;
        starter=us.slots[idx].id; ph=bench[0];
        LIVE.pinchHit(ph);
      }
      LIVE.step();
    }
    return {starter:starter, ph:ph, over:LIVE.over,
            used:us.used.map(u=>u.id+'/'+u.ord+'/'+(u.starter?'선발':u.how)),
            starterBox:LIVE.box[starter], phBox:LIVE.box[ph]};
  })()`);
  console.log('   ', JSON.stringify(info.used));
  T('대타가 실제로 들어갔다', ()=>!!info.ph && !!info.starter);
  T('출전 명단에 선발 9명이 전부 남는다', ()=>info.used.filter(x=>/선발$/.test(x)).length===9);
  T('교체·대타가 명단 뒤에 붙는다', ()=>info.used.length>9 && info.used.some(x=>/대타$/.test(x)));
  T('대타는 선발과 같은 타순(ord)을 물려받는다', ()=>{
    const st=info.used.find(x=>x.startsWith(info.starter+'/'));
    const p=info.used.find(x=>x.startsWith(info.ph+'/'));
    return st.split('/')[1]===p.split('/')[1];
  });

  // 결과 화면
  ev("(function(){ var st=document.createElement('div'); st.id='stage'; document.getElementById('view').innerHTML=''; document.getElementById('view').appendChild(st); showResult(); })()");
  await wait(60);
  const txt=d.getElementById('view').textContent;
  T('선발 타자가 결과 박스스코어에 남아 있다', ()=>txt.includes(ev(`nameOf('${info.starter}')`)));
  T('대타도 결과 박스스코어에 나온다', ()=>txt.includes(ev(`nameOf('${info.ph}')`)));
  T('대타 줄에 태그가 붙는다', ()=>d.querySelectorAll('#view .box td.nm.sub .subtag').length>=1);
  T('상대 팀 타격 박스스코어도 나온다', ()=>{
    const heads=[...d.querySelectorAll('#view .card-h')].map(x=>x.textContent);
    return heads.filter(h=>/타격$/.test(h)).length===2 && heads.filter(h=>/투수$/.test(h)).length===2;
  });
  T('박스스코어 줄 수 = 출전 인원(헤더·합계 제외)', ()=>{
    const tbl=[...d.querySelectorAll('#view .card')].find(c=>/우완좌완 타격/.test(c.textContent)).querySelector('table');
    const n=tbl.querySelectorAll('tr').length-2;
    return n===info.used.length ? true : `표 ${n}명 vs 출전 ${info.used.length}명`;
  });
  T('선발 9명 + 교체분이 순서대로(타순 오름차순) 나온다', ()=>{
    const tbl=[...d.querySelectorAll('#view .card')].find(c=>/우완좌완 타격/.test(c.textContent)).querySelector('table');
    const rows=[...tbl.querySelectorAll('tr')].slice(1,-1);
    let last=0, ok=true;
    rows.forEach(r=>{ const o=r.querySelector('.ordn');
      if(o){ const v=Number(o.textContent); if(v<last)ok=false; last=v; } });
    return ok;
  });
  T('합계 행의 안타 수가 라인스코어 H와 같다', ()=>{
    const card=[...d.querySelectorAll('#view .card')].find(c=>/우완좌완 타격/.test(c.textContent));
    const tds=[...card.querySelectorAll('tr.tot td')].map(x=>x.textContent);
    const usH=ev("(function(){var n=ST.schedule[ST.round];var s=n.homeGame?LIVE.result.home:LIVE.result.away;return s.hits})()");
    return Number(tds[2])===usH ? true : `합계 ${tds[2]} vs 라인스코어 ${usH}`;
  });

  console.log('\n[선수 카드]');
  const nml=d.querySelectorAll('#view .nml');
  T('결과 화면 이름이 클릭 가능하다', ()=>nml.length>=10);
  nml[0].click(); await wait(50);
  T('시트가 열린다', ()=>d.getElementById('sheet').classList.contains('open'));
  T('오늘 경기 기록이 보인다', ()=>!!d.querySelector('#sheet-body .pcs-today')||/올 시즌 출전 기록이 아직 없다|배팅 레이팅/.test(d.getElementById('sheet-body').textContent));
  T('능력치 바가 있다', ()=>d.querySelectorAll('#sheet-body .ot-bar').length>=6);
  ev("closeSheet()");

  // 상대 팀 선수 카드
  const oppPid=ev("(function(){var n=ST.schedule[ST.round];var t=(n.homeGame?LIVE.result.away:LIVE.result.home).team;return t.players[0].id})()");
  ev(`openPlayerCard('${oppPid}')`); await wait(50);
  T('상대 팀 선수도 카드가 열린다', ()=>d.getElementById('sheet').classList.contains('open')
      && d.querySelectorAll('#sheet-body .ot-bar').length>=6);
  T('상대 선수 카드에 팀 이름이 나온다', ()=>/·/.test(d.getElementById('sheet-title').textContent));
  ev("closeSheet()");

  console.log('\n[결과 확정 — 시즌 누적]');
  const before=ev(`JSON.parse(JSON.stringify({s:ST.bat['${info.starter}'],p:ST.bat['${info.ph}']}))`);
  ev("(function(){var n=ST.schedule[ST.round];var r=LIVE.result;var us=n.homeGame?r.home:r.away;var th=n.homeGame?r.away:r.home;commitGame(r,us,th,(n.homeGame?us:us).slots);})()");
  await wait(80);
  const after=ev(`JSON.parse(JSON.stringify({s:ST.bat['${info.starter}'],p:ST.bat['${info.ph}']}))`);
  T('교체된 선발의 시즌 기록이 살아남는다', ()=>
      after.s.pa===before.s.pa+(info.starterBox.pa||0) && after.s.g===before.s.g+1
      ? true : `PA ${before.s.pa}→${after.s.pa} (경기 ${info.starterBox.pa})`);
  T('대타의 시즌 기록도 쌓인다', ()=>
      after.p.pa===before.p.pa+(info.phBox.pa||0) && after.p.g===before.p.g+1);
  T('선발이 결장 처리되지 않는다(사기)', ()=>ev(`ST.morale['${info.starter}']`)>0);

  console.log('\n[이건 너프]');
  const lg=ev("(function(){var p=TBYID['wwzw'].players.find(x=>x.id==='lg');return {con:p.con,pow:p.pow,eye:p.eye,spd:p.spd}})()");
  console.log('   ', JSON.stringify(lg));
  T('파워가 내려갔다 (48 → 34)', ()=>lg.pow===34);
  T('컨택이 내려갔다 (80 → 74)', ()=>lg.con===74);
  T('주루·선구는 그대로', ()=>lg.spd===70&&lg.eye===44);

  console.log(errs.length?`\n❌ ${errs.length}건\n`+errs.join('\n'):'\n✅ 전부 통과');
  process.exit(errs.length?1:0);
},600);
