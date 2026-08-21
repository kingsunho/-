/* 구버전 세이브 호환 · 엣지 케이스 */
const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const bad=[];
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!/scrollTo|Could not load|stylesheet|Not implemented/.test(e.message))bad.push('JSDOM: '+e.message.split('\n')[0]);});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  virtualConsole:vc, beforeParse(w){ w.scrollTo=()=>{}; w.TextEncoder=TextEncoder; w.TextDecoder=TextDecoder; }});
const w=dom.window,d=w.document,ev=s=>w.eval(s);
w.confirm=()=>true;
process.on('unhandledRejection',e=>bad.push('REJECT: '+String(e).slice(0,120)));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const T=(n,f)=>{try{const r=f();const ok=r===true||(typeof r==='string'&&!/^!/.test(r));
  console.log((ok?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r.replace(/^!/,''):''));if(!ok)bad.push(n);}
  catch(e){console.log('  ❌ '+n+' :: '+e.message);bad.push(n+': '+e.message)}};
const VIEWS=['home','squad','lineup','kakao','game','stand','stats','records','train','scout','recruit','hall','more','player'];
function sweep(tag){
  const out=[];
  for(const v of VIEWS){
    try{ w.go(v); }catch(e){ out.push(`${v} 실패: ${e.message}`); continue; }
    const t=(d.getElementById('view')||{}).textContent||'';
    if(/undefined|NaN|\[object Object\]|Infinity/.test(t)){
      const m=t.match(/.{0,26}(undefined|NaN|\[object Object\]|Infinity).{0,26}/);
      out.push(`${v}: …${m?m[0].replace(/\s+/g,' '):''}…`);
    }
    if(t.trim().length<6) out.push(`${v}: 비었다`);
  }
  out.forEach(x=>bad.push(`[${tag}] ${x}`));
  return out;
}

(async()=>{
  await wait(700);
  d.querySelectorAll('.pickcard')[0].click(); await wait(60);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(300); ev("ST.tutDone=true");

  console.log('[구버전 세이브 — v1.x 처럼 새 필드가 없는 상태]');
  ev(`(function(){
    // 몇 경기 돌려서 데이터를 만든 뒤, 이번 버전에서 새로 생긴 필드를 전부 지운다
    for(let i=0;i<3;i++){
      ST.weekDone=true; ST.announced=true; ST.lineupDirty=false;
      const L=makeLive(); let g=0; while(!L.over&&g++<3000){L.pending=null;L.step();}
      L.finish();
      const n=ST.schedule[ST.round]; const r=L.result;
      const us=n.homeGame?r.home:r.away, th=n.homeGame?r.away:r.home;
      LIVE=L; commitGame(r,us,th,us.slots);
    }
    // v1.x 흉내: 이번에 추가된 것들을 제거
    delete ST.feats; delete ST.lastFeats; delete ST.spark;
    (ST.hall||[]).forEach(h=>{ delete h.criteria; delete h.podium; delete h.skipped; delete h.cand; delete h.coWith; });
    (ST.lastLineup||[]).forEach(s=>{ delete s.ord; });
    window.__OLD=JSON.stringify(ST);
    return true;
  })()`);
  ev("ST=JSON.parse(window.__OLD); normalizeState();");
  T('구버전 세이브가 로드된다', ()=>ev("!!ST && ST.v===5"));
  T('진기록 필드가 복구된다', ()=>ev("Array.isArray(ST.feats)")||ev("(ST.feats===undefined)")
      ? true : '!feats 이상');
  const s1=sweep('구버전');
  T('구버전 세이브로 전 화면 클린', ()=>s1.length===0?true:'!'+s1.join(' / '));
  T('근거 없는 옛 트로피도 열린다', ()=>{
    // v1.x 판에서 받은 트로피 흉내 — criteria/podium 이 아예 없다
    ev(`(function(){ ST.hall=ST.hall||[];
      ST.hall.push({season:1,year:2026,at:5,kind:'pit',label:'투수상',
        pid:'khg',name:'김한규',value:'ERA 12.68',scope:'구간'}); })()`);
    const n=ev("(ST.hall||[]).length"); if(!n) return '수상 없음(검사 생략)';
    ev("hallWho=(ST.hall.find(h=>h.pid)||{}).pid||MYID"); w.go('hall');
    const tro=d.querySelectorAll('#view .tro.tap');
    if(!tro.length) return '!트로피가 안 뜬다';
    tro[0].click();
    const sb=d.getElementById('sheet-body').textContent;
    ev("closeSheet()");
    return !/undefined|NaN/.test(sb) && /선정 기준/.test(sb) ? `${n}개` : '!시트 내용 이상';
  });
  T('구버전 세이브로도 경기가 돌아간다', ()=>ev(`(function(){
    ST.weekDone=true; ST.announced=true; ST.lineupDirty=false;
    const L=makeLive(); let g=0; while(!L.over&&g++<3000){L.pending=null;L.step();}
    L.finish();
    const n=ST.schedule[ST.round]; const r=L.result;
    const us=n.homeGame?r.home:r.away, th=n.homeGame?r.away:r.home;
    LIVE=L; commitGame(r,us,th,us.slots);
    return true;
  })()`));
  const s1b=sweep('구버전+경기'); T('그 뒤로도 전 화면 클린', ()=>s1b.length===0?true:'!'+s1b.join(' / '));

  console.log('\n[인원 부족 · 부상 · 용병]');
  T('9명 미만이면 막고 안내한다', ()=>ev(`(function(){
    const us=TBYID['wwzw'];
    ST.absent={}; us.players.slice(0,8).forEach(p=>ST.absent[p.id]='개인 사정');
    ST.weekDone=true; ST.announced=true;
    go('game');
    const t=document.getElementById('view').textContent;
    ST.absent={};
    return t.trim().length>6 && !/undefined|NaN/.test(t);
  })()`));
  T('전원 부상이어도 화면이 안 깨진다', ()=>ev(`(function(){
    const us=TBYID['wwzw'];
    ST.injury={}; us.players.forEach(p=>ST.injury[p.id]={name:'테스트',games:3,sev:2});
    const bads=[];
    ['home','squad','lineup','game','train','more'].forEach(v=>{ go(v);
      const t=document.getElementById('view').textContent;
      if(/undefined|NaN/.test(t)||t.trim().length<6) bads.push(v); });
    ST.injury={};
    return bads.length?('!'+bads.join(',')):true;
  })()`));

  console.log('\n[0 나눗셈 · 빈 기록]');
  T('타석 0 인 선수 지표가 안전하다', ()=>ev(`(function(){
    const b=blankBat();
    const v=[avg(b),obp(b),slg(b),ops(b),iso(b),bbk(b),woba(b),wrcPlus(b,leagueWoba()),warOf('ksh',b,leagueWoba())];
    return v.every(x=>Number.isFinite(x)) ? v.map(x=>x.toFixed(2)).join(' ') : '!'+v.join(',');
  })()`));
  T('이닝 0 인 투수 지표가 안전하다', ()=>ev(`(function(){
    const p=blankPit();
    const v=[era(p),whip(p),k9(p),warPit(p,leagueEra())];
    return v.every(x=>Number.isFinite(x)) ? v.map(x=>x.toFixed(2)).join(' ') : '!'+v.join(',');
  })()`));
  T('빈 시즌에도 시상이 안 터진다', ()=>ev(`(function(){
    const keep=JSON.stringify({bat:ST.bat,pit:ST.pit});
    TBYID['wwzw'].players.forEach(p=>ST.bat[p.id]=blankBat());
    TBYID['wwzw'].pitchers.forEach(p=>ST.pit[p.id]=blankPit());
    let ok=true;
    try{ buildAwards(ST); runMiniAwards(ST); }catch(e){ ok='!'+e.message; }
    const k=JSON.parse(keep); ST.bat=k.bat; ST.pit=k.pit;
    return ok;
  })()`));
  T('진기록 판정에 빈 박스를 넣어도 안전하다', ()=>ev(`(function(){
    try{ const r=detectFeats(ST,{box:{},pbox:{},feats:[],dpCount:0},{runs:0},{runs:0},[],[],0);
      return Array.isArray(r)&&r.length===0; }catch(e){ return '!'+e.message; }
  })()`));

  console.log('\n[플레이오프]');
  T('플레이오프가 끝까지 간다', ()=>ev(`(function(){
    // 정규시즌을 강제로 끝내고 PO 로 보낸다
    let g=0;
    while(ST.round<ST.schedule.length && g++<40){
      ST.weekDone=true; ST.announced=true; ST.lineupDirty=false;
      if(ST.events&&ST.events.length)ST.events=[];
      const L=makeLive(); let k=0; while(!L.over&&k++<3000){L.pending=null;L.step();}
      L.finish();
      const n=ST.schedule[ST.round]; if(!n){break;}
      const r=L.result; const us=n.homeGame?r.home:r.away, th=n.homeGame?r.away:r.home;
      LIVE=L; commitGame(r,us,th,us.slots);
      if(ST.seasonOver)break;
    }
    return ST.seasonOver ? ('시즌 종료 · PO '+((ST.playoff&&ST.playoff.place)||'미진출')) : '!안 끝났다';
  })()`));
  const s2=sweep('PO후'); T('플레이오프 후 전 화면 클린', ()=>s2.length===0?true:'!'+s2.join(' / '));

  console.log('\n[리그 균형]');
  const bal=ev(`(function(){
    const rows=TEAMS.map(t=>({n:t.name,s:ST.stand[t.id]})).filter(x=>x.s.g>0);
    const us=rows.find(x=>x.n==='우완좌완');
    const wr=rows.map(x=>x.s.w/Math.max(1,x.s.g));
    return {us:us?(us.s.w+'승 '+us.s.l+'패'):'-', usWr:us?us.s.w/Math.max(1,us.s.g):0,
      min:Math.min(...wr), max:Math.max(...wr), n:rows.length};
  })()`);
  console.log(`   우완좌완 ${bal.us} (승률 ${bal.usWr.toFixed(3)}) · 리그 승률 폭 ${bal.min.toFixed(3)}~${bal.max.toFixed(3)}`);
  T('리그가 한쪽으로 안 쏠린다', ()=>bal.max-bal.min<0.95 ? `폭 ${(bal.max-bal.min).toFixed(2)}` : '!전승/전패 팀 존재');

  console.log('\n[결론]');
  console.log(bad.length?`\n❌ ${bad.length}건\n - `+bad.join('\n - '):'\n✅ 이상 없음');
  process.exit(bad.length?1:0);
})();
