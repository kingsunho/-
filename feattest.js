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

  console.log('[진기록 판정]');
  // 박스스코어를 직접 만들어서 각 조건을 때린다
  const mk=(box,pbox,extra)=>ev(`(function(){
    const res=Object.assign({box:${JSON.stringify(box)},pbox:${JSON.stringify(pbox)},feats:[],dpCount:0},${JSON.stringify(extra||{})});
    const us={runs:${(extra&&extra.usRuns)||5}}, th={runs:3};
    return detectFeats(ST,res,us,th,Object.keys(res.box),Object.keys(res.pbox),res.dpCount)
      .map(f=>f.kind+(f.pid?'/'+f.pid:''));
  })()`);
  const B=o=>Object.assign({pa:4,ab:4,h:0,d2:0,d3:0,hr:0,bb:0,hbp:0,k:0,rbi:0,r:0,sb:0,cs:0},o);
  const P=o=>Object.assign({outs:0,h:0,r:0,er:0,bb:0,k:0,hbp:0,sbA:0,bf:0},o);

  T('사이클링 히트', ()=>mk({ksh:B({pa:5,ab:5,h:4,d2:1,d3:1,hr:1})},{}).includes('사이클링 히트/ksh'));
  T('사이클링 아님 (3루타 없음)', ()=>!mk({ksh:B({pa:5,ab:5,h:4,d2:2,d3:0,hr:1})},{}).includes('사이클링 히트/ksh'));
  T('한 경기 5안타', ()=>mk({ksh:B({pa:6,ab:6,h:5})},{}).includes('한 경기 5안타/ksh'));
  T('한 경기 2홈런', ()=>mk({ksh:B({h:2,hr:2,rbi:3})},{}).includes('한 경기 2홈런/ksh'));
  T('한 경기 6타점', ()=>mk({ksh:B({h:3,rbi:6})},{}).includes('한 경기 6타점/ksh'));
  T('한 경기 4도루', ()=>mk({ksh:B({h:2,sb:4})},{}).includes('한 경기 4도루/ksh'));
  T('전 타석 출루', ()=>mk({ksh:B({pa:4,ab:3,h:3,bb:1})},{}).includes('전 타석 출루/ksh'));
  T('전 타석 출루 아님(1타석 아웃)', ()=>!mk({ksh:B({pa:4,ab:3,h:2,bb:1})},{}).includes('전 타석 출루/ksh'));
  T('전 타석 출루 아님(아웃 있음)', ()=>!mk({ksh:B({pa:4,ab:4,h:2})},{}).includes('전 타석 출루/ksh'));
  T('퍼펙트게임', ()=>mk({},{swm:P({outs:21,bf:21,k:9})}).includes('퍼펙트게임/swm'));
  T('노히트 노런(사사구 있음)', ()=>{const r=mk({},{swm:P({outs:21,bf:24,bb:3,k:9})});
    return r.includes('노히트 노런/swm')&&!r.includes('퍼펙트게임/swm');});
  T('완봉승', ()=>{const r=mk({},{swm:P({outs:21,bf:26,h:4,bb:1,k:6})});
    return r.includes('완봉승/swm')&&!r.includes('노히트 노런/swm');});
  T('무사사구 완투', ()=>mk({},{swm:P({outs:21,bf:25,h:5,r:2,er:2,k:5})}).includes('무사사구 완투/swm'));
  T('두 자릿수 탈삼진', ()=>mk({},{swm:P({outs:15,bf:22,h:3,r:1,er:1,k:11})}).includes('두 자릿수 탈삼진/swm'));
  T('완투 아니면 노히트 아님(중간계투)', ()=>!mk({},{swm:P({outs:12,bf:12,k:5}),kjh:P({outs:9,bf:12,h:2,r:1,er:1})}).includes('노히트 노런/swm'));
  T('팀 합작 노히트', ()=>mk({},{swm:P({outs:12,bf:13,bb:1,k:6}),kjh:P({outs:9,bf:9,k:3})}).includes('팀 합작 노히트'));
  T('한 경기 20득점', ()=>mk({ksh:B({h:2})},{},{usRuns:21}).includes('한 경기 20득점'));
  T('한 경기 3병살', ()=>mk({ksh:B({h:2})},{},{dpCount:3}).includes('한 경기 3병살'));
  T('평범한 경기엔 아무것도 안 뜬다', ()=>{
    const r=mk({ksh:B({h:1,rbi:1}),lg:B({h:2,d2:1})},{swm:P({outs:15,bf:24,h:6,r:4,er:3,bb:3,k:5})});
    return r.length===0 ? true : '오검출: '+r.join(',');
  });

  console.log('\n[엔진 훅 — 만루홈런 · 끝내기]');
  const eng=ev(`(function(){
    const T=buildAllTeams(); const us=T.find(t=>t.id==='wwzw');
    let slam=0, walk=0, games=0;
    for(let k=0;k<400;k++){
      const opp=T[1+(k%(T.length-1))];
      const rng=makeRng(90000+k*131);
      const lu=us.players.slice(0,9).map((p,i)=>({id:p.id,pos:['C','1B','2B','3B','SS','LF','CF','RF','DH'][i]}));
      const L=new LiveGame({home:us,away:opp,userIsHome:true,rng,innings:7,
        homeLineup:lu,homeRotation:us.pitchers.map(p=>p.id),
        awayLineup:aiLineup(opp),awayRotation:aiRotation(opp),
        homeTactics:{bat:'normal',run:'normal',hook:'normal'},awayTactics:{bat:'normal',run:'normal',hook:'normal'},
        homeCond:{},awayCond:{},benchPool:[],park:{hr:2.3,d2:1,d3:1,err:1,babip:1}});
      let g=0; while(!L.over&&g++<3000){L.pending=null;L.step();}
      games++;
      (L.result.feats||[]).forEach(f=>{ if(f.kind==='만루홈런')slam++; if(f.kind==='끝내기')walk++; });
    }
    return {slam,walk,games};
  })()`);
  console.log(`   ${eng.games}경기 · 만루홈런 ${eng.slam} · 끝내기 ${eng.walk}`);
  T('만루홈런이 잡힌다', ()=>eng.slam>0);
  T('끝내기가 잡힌다', ()=>eng.walk>0);

  console.log('\n[보관 · 화면]');
  ev(`(function(){
    ST.feats=[]; ST.notices=[]; ST.kakaoPost=[];
    const fs=[{kind:'사이클링 히트',pid:'ksh',detail:'4안타'},
              {kind:'노히트 노런',pid:'swm',detail:'7이닝 2사사구 9탈삼진'},
              {kind:'팀 합작 노히트',pid:null,detail:'2명 · 1사사구'}];
    window.__msgs=recordFeats(ST,fs);
  })()`);
  T('ST.feats 에 3건 쌓인다', ()=>ev("ST.feats.length")===3);
  T('구단 최초로 표시된다', ()=>ev("ST.feats.every(f=>f.first)"));
  T('두 번째부터는 최초가 아니다', ()=>{
    ev("recordFeats(ST,[{kind:'사이클링 히트',pid:'lg',detail:'4안타'}])");
    return ev("ST.feats[ST.feats.length-1].first")===false;
  });
  T('단톡 메시지가 생긴다', ()=>ev("__msgs.length")>=3);
  T('알림에도 들어간다', ()=>ev("ST.notices.filter(n=>n.type==='feat').length")>=3);
  T('사기가 오른다', ()=>ev("ST.morale['swm']")>70);

  ev("recTab='feat'"); w.go('records'); await wait(120);
  const rt=d.getElementById('view').textContent;
  T('기록실 진기록 탭', ()=>/진기록/.test(rt)&&/사이클링 히트/.test(rt)&&/노히트 노런/.test(rt));
  T('아직 안 나온 기록 목록', ()=>/아직 안 나온 기록/.test(rt)&&/퍼펙트게임/.test(rt));
  T('기록실에 undefined 없음', ()=>!/undefined|NaN/.test(rt));
  const nml=d.querySelectorAll('#view .nml');
  T('진기록에서 이름 클릭 가능', ()=>nml.length>0);
  if(nml.length){ nml[0].click(); await wait(50);
    T('선수 카드 열림', ()=>d.getElementById('sheet').classList.contains('open')); ev("closeSheet()"); }

  ev("hallWho='swm'"); w.go('hall'); await wait(120);
  const ht=d.getElementById('view').textContent;
  T('전시장에 진기록 섹션', ()=>/진기록/.test(ht)&&/노히트 노런/.test(ht));
  T('전시장에 undefined 없음', ()=>!/undefined|NaN/.test(ht));

  console.log(errs.length?`\n❌ ${errs.length}건\n - `+errs.join('\n - '):'\n✅ 전부 통과');
  process.exit(errs.length?1:0);
},600);
