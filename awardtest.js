const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const errs=[];const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!/scrollTo|Could not load|stylesheet/.test(e.message))errs.push('JSDOM: '+e.message)});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:vc});
dom.window.scrollTo=()=>{};dom.window.confirm=()=>true;
const w=dom.window,d=w.document,ev=s=>w.eval(s);
const T=(n,f)=>{try{const r=f();console.log((r?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r:''));if(!r)errs.push(n);}catch(e){console.log('  ❌ '+n+' :: '+e.message);errs.push(n)}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
setTimeout(async()=>{
  d.querySelectorAll('.pickcard')[0].click();await wait(50);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(250); ev("ST.tutDone=true");

  console.log('[구간 시상]');
  // 5경기 돌려서 실제 시상을 태운다
  for(let g=0;g<5;g++){
    ev("ST.weekDone=true; ST.announced=true; ST.lineupDirty=false;");
    w.go('game'); await wait(100);
    const b=[...d.querySelectorAll('#view .btn')].find(x=>/자동 진행/.test(x.textContent));
    if(!b){ console.log('  ! 경기 시작 못함'); break; }
    b.click();
    for(let i=0;i<400 && !ev("LIVE&&LIVE.over");i++) await wait(20);
    await wait(120);
    [...d.querySelectorAll('#view .btn')].find(x=>/결과 확정/.test(x.textContent)).click();
    await wait(180);
  }
  const hall=ev("JSON.parse(JSON.stringify(ST.hall||[]))");
  console.log('   수상:', hall.map(h=>`${h.label}=${h.name}(${h.value})`).join(' · ')||'없음');
  T('구간 시상이 나왔다', ()=>hall.length>0);
  T('모든 상에 선정 기준이 붙는다', ()=>hall.every(h=>h.criteria&&h.criteria.length>3)
      ? true : '빠진 상: '+hall.filter(h=>!h.criteria).map(h=>h.label).join(','));
  T('감독상 외에는 후보 순위가 붙는다', ()=>hall.filter(h=>h.kind!=='mgr').every(h=>h.podium&&h.podium.length)
      ? true : '빠짐: '+hall.filter(h=>h.kind!=='mgr'&&!h.podium).map(h=>h.label).join(','));
  T('수상자가 후보 1위다', ()=>hall.filter(h=>h.podium).every(h=>{
      const me=h.podium.find(x=>x.pid===h.pid); return me && me.rank===1; })
      ? true : '1위가 아닌 수상: '+hall.filter(h=>h.podium&&!(h.podium.find(x=>x.pid===h.pid)||{}).rank===1).map(h=>h.label).join(','));
  T('중복 수상이 가능하다(기록으로만)', ()=>{
    const src=require('fs').readFileSync('index.html','utf8');
    return !/won\.some\(w=>w\.pid===c\.pid\)/.test(src);
  });
  T('투수상 값에 이닝·자책이 같이 나온다', ()=>{
    const p=hall.find(h=>h.kind==='pit');
    return !p || /이닝/.test(p.value) ? true : '투수상 값='+p.value;
  });

  console.log('\n[전시장 트로피 클릭 → 포디움]');
  const who=hall.length?hall[0].pid:'ksh';
  ev(`hallWho='${who}'`); w.go('hall'); await wait(120);
  const tro=d.querySelectorAll('#view .tro.tap');
  T('트로피가 클릭 가능하다', ()=>tro.length>0);
  if(tro.length){
    tro[0].click(); await wait(80);
    const sb=d.getElementById('sheet-body').textContent;
    T('시트가 열린다', ()=>d.getElementById('sheet').classList.contains('open'));
    T('선정 기준이 보인다', ()=>/선정 기준/.test(sb));
    T('후보 순위(포디움)가 보인다', ()=>/후보 순위/.test(sb)||/기준을 따로 남기지 않은/.test(sb));
    T('수상 표시가 있다', ()=>/수상/.test(sb));
    T('undefined 없음', ()=>!/undefined|NaN/.test(sb));
    const rows=d.querySelectorAll('#sheet-body .pod-r');
    console.log('   포디움:', [...rows].map(r=>r.textContent.replace(/\s+/g,' ').trim()).join(' / '));
    T('포디움 줄이 있다', ()=>rows.length>0);
    T('1위 줄이 강조된다', ()=>d.querySelectorAll('#sheet-body .pod-r.win').length===1);
    const nml=d.querySelectorAll('#sheet-body .nml');
    T('포디움에서 이름 클릭 가능', ()=>nml.length>0);
    ev("closeSheet()");
  }
  console.log(errs.length?`\n❌ ${errs.length}건\n - `+errs.join('\n - '):'\n✅ 전부 통과');
  process.exit(errs.length?1:0);
},600);
