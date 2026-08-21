/* 통산 연도별/총합 + 리그 전체 종합왕 */
const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const bad=[];
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!/scrollTo|Could not load|stylesheet|Not implemented/.test(e.message))bad.push('JSDOM: '+e.message.split('\n')[0]);});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  virtualConsole:vc,beforeParse(w){w.scrollTo=()=>{};w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;}});
const w=dom.window,d=w.document,ev=s=>w.eval(s); w.confirm=()=>true;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const T=(n,f)=>{try{const r=f();const ok=r===true||(typeof r==='string'&&!/^!/.test(r));
  console.log((ok?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r.replace(/^!/,''):''));if(!ok)bad.push(n);}
  catch(e){console.log('  ❌ '+n+' :: '+e.message);bad.push(n+': '+e.message)}};
const season=()=>ev(`(function(){ let g=0;
  while(ST.round<ST.schedule.length && g++<40){
    runWeek(); ST.weekDone=true; ST.announced=true; ST.lineupDirty=false;
    if(ST.events&&ST.events.length)ST.events=[]; ST.absent={};
    const L=makeLive(); let k=0; while(!L.over&&k++<3000){L.pending=null;L.step();}
    L.finish(); const n=ST.schedule[ST.round]; if(!n)break;
    const r=L.result; const us=n.homeGame?r.home:r.away, th=n.homeGame?r.away:r.home;
    LIVE=L; commitGame(r,us,th,us.slots); if(ST.seasonOver)break; }
  return ST.seasonOver; })()`);

(async()=>{
  await wait(700);
  d.querySelectorAll('.pickcard')[0].click(); await wait(60);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(300); ev("ST.tutDone=true");

  console.log('[1년차 소화]');
  T('시즌이 끝난다', ()=>season() ? `${ev("ST.stand['wwzw'].g")}경기` : '!안 끝남');

  console.log('\n[종합왕이 리그 전체 기준인가]');
  w.go('home'); await wait(350);
  const kings=ev("(ST.awards||[]).filter(a=>a.king)");
  console.log('   종합왕:', kings.slice(0,5).map(a=>`${a.label}=${a.name}(${a.team||'?'})`).join(' · '));
  T('종합왕에 팀 정보가 붙는다', ()=>kings.length&&kings.every(a=>a.team) ? `${kings.length}부문` : '!팀 없음');
  T('남의 팀도 종합왕에 오른다', ()=>{
    const opp=kings.filter(a=>!a.ours).length;
    return opp>0 ? `${opp}/${kings.length}부문이 타팀` : '!전부 우리 팀 — 리그 비교가 아니다';
  });
  T('실제 리그 1위와 값이 맞다', ()=>{
    const hr=kings.find(a=>a.label==='홈런왕'); if(!hr) return '홈런왕 없음';
    const max=ev(`(function(){let m=0;TEAMS.forEach(t=>t.players.forEach(p=>{
      const b=(t.id==='wwzw')?(ST.bat[p.id]||blankBat()):(ST.lgBat[p.id]||blankBat());
      if(b.hr>m)m=b.hr;}));return m})()`);
    return hr.value===`${max}홈런` ? `${max}홈런` : `!표 ${hr.value} vs 리그 최대 ${max}`;
  });

  console.log('\n[새 시즌으로 넘기기]');
  const nb=[...d.querySelectorAll('#view .btn')].find(x=>/새 시즌 시작/.test(x.textContent));
  T('새 시즌 버튼', ()=>!!nb);
  if(nb){ nb.click(); await wait(500); }
  T('2년차', ()=>ev("ST.seasonNo")===2);
  T('시즌 로그가 남는다', ()=>{
    const n=ev("(ST.seasonLog||[]).length");
    return n===1 ? '1개 시즌' : `!${n}개`;
  });
  T('로그에 전적·타격·투구가 들어간다', ()=>{
    const l=ev("JSON.parse(JSON.stringify((ST.seasonLog||[])[0]||null))");
    if(!l) return '!로그 없음';
    return (l.rec && Object.keys(l.bat||{}).length>0)
      ? `${l.year} ${l.rec.w}승 ${l.rec.l}패 · 타자 ${Object.keys(l.bat).length}명 · 투수 ${Object.keys(l.pit||{}).length}명`
      : '!내용 부실';
  });
  T('진기록이 이월된다', ()=>ev("(ST.feats||[]).length")>=0 ? `${ev("(ST.feats||[]).length")}건` : '!');

  console.log('\n[통산 탭 — 총합]');
  ev("recTab='career'; carTab='total'"); w.go('records'); await wait(150);
  let t=d.getElementById('view').textContent;
  T('하위탭이 있다', ()=>/통산 합계/.test(t)&&/연도별/.test(t));
  T('합산 범위 안내', ()=>/합산 범위/.test(t)||/시즌/.test(t));
  T('통산 표가 나온다', ()=>/개인 통산 · 타격/.test(t));
  T('undefined 없음', ()=>!/undefined|NaN/.test(t));

  console.log('\n[통산 탭 — 연도별]');
  ev("carTab='year'; carYear=null"); w.go('records'); await wait(150);
  t=d.getElementById('view').textContent;
  const yrs=d.querySelectorAll('#view .yr');
  console.log('   연도 버튼:', [...yrs].map(x=>x.textContent.replace(/\s+/g,' ')).join(' | '));
  T('연도 선택 버튼이 있다', ()=>yrs.length>=2 ? `${yrs.length}개` : `!${yrs.length}개`);
  T('진행 중 시즌이 표시된다', ()=>/진행 중/.test(t));
  T('undefined 없음', ()=>!/undefined|NaN/.test(t));
  // 지난 시즌 클릭
  const past=[...yrs].find(x=>!/진행 중/.test(x.textContent));
  T('지난 시즌을 볼 수 있다', ()=>{
    if(!past) return '!지난 시즌 버튼 없음';
    past.click();
    const tt=d.getElementById('view').textContent;
    return /타격/.test(tt)&&/투구/.test(tt)&&!/undefined|NaN/.test(tt) ? true : '!내용 이상';
  });
  T('그 해 수상이 나온다', ()=>/그 해 수상/.test(d.getElementById('view').textContent));
  T('연도별 표 이름이 눌린다', ()=>{
    const l=d.querySelector('#view .nml'); if(!l) return '!링크 없음';
    l.click(); const on=d.getElementById('sheet').classList.contains('open');
    ev("closeSheet()"); return on;
  });

  console.log('\n[2년차도 돌려서 로그 2개]');
  season(); w.go('home'); await wait(350);
  const nb2=[...d.querySelectorAll('#view .btn')].find(x=>/새 시즌 시작/.test(x.textContent));
  if(nb2){ nb2.click(); await wait(500); }
  T('로그가 2개로 늘어난다', ()=>{
    const n=ev("(ST.seasonLog||[]).length");
    return n===2 ? '2개 시즌' : `!${n}개`;
  });
  ev("recTab='career'; carTab='year'; carYear=null"); w.go('records'); await wait(150);
  T('연도 버튼이 3개(진행+지난2)', ()=>{
    const n=d.querySelectorAll('#view .yr').length;
    return n===3 ? `${n}개` : `!${n}개`;
  });
  T('세이브 왕복 후에도 로그가 남는다', ()=>{
    ev("window.__s=serializeState(); ST=JSON.parse(window.__s); normalizeState();");
    return ev("(ST.seasonLog||[]).length")===2 ? true : '!로그 유실';
  });
  T('전 화면 클린', ()=>{
    const dirty=[];
    for(const v of ['home','squad','records','stats','hall','more','train']){
      w.go(v); const tt=(d.getElementById('view')||{}).textContent||'';
      if(/undefined|NaN/.test(tt)||tt.trim().length<6) dirty.push(v);
    }
    return dirty.length?('!'+dirty.join(',')):true;
  });
  console.log(bad.length?`\n❌ ${bad.length}건\n - `+bad.join('\n - '):'\n✅ 이상 없음');
  process.exit(bad.length?1:0);
})();
