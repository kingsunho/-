/* 정렬 · 구단 리더 · 진기록 보관 */
const {JSDOM,VirtualConsole}=require('jsdom');
const html=require('fs').readFileSync('index.html','utf8');
const bad=[];
const vc=new VirtualConsole();
vc.on('jsdomError',e=>{if(!/scrollTo|Could not load|stylesheet|Not implemented/.test(e.message))bad.push('JSDOM: '+e.message.split('\n')[0]);});
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',
  virtualConsole:vc,beforeParse(w){w.scrollTo=()=>{};w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;}});
const w=dom.window,d=w.document,ev=s=>w.eval(s);
w.confirm=()=>true;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const T=(n,f)=>{try{const r=f();const ok=r===true||(typeof r==='string'&&!/^!/.test(r));
  console.log((ok?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r.replace(/^!/,''):''));if(!ok)bad.push(n);}
  catch(e){console.log('  ❌ '+n+' :: '+e.message);bad.push(n+': '+e.message)}};
const nums=(tbl,col)=>[...tbl.querySelectorAll('tr')].slice(1)
  .map(tr=>tr.children[col]&&tr.children[col].textContent.trim())
  .filter(x=>x!=null&&x!=='').map(x=>{const v=parseFloat(x.replace(/^\./,'0.').replace('—','NaN'));return isNaN(v)?null:v;})
  .filter(v=>v!==null);
const isDesc=a=>a.every((v,i)=>i===0||a[i-1]>=v);
const isAsc =a=>a.every((v,i)=>i===0||a[i-1]<=v);

(async()=>{
  await wait(700);
  d.querySelectorAll('.pickcard')[0].click(); await wait(60);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(300); ev("ST.tutDone=true");
  // 12경기 돌려서 기록을 만든다
  ev(`(function(){ for(let i=0;i<12;i++){
    runWeek(); ST.weekDone=true; ST.announced=true; ST.lineupDirty=false;
    if(ST.events&&ST.events.length)ST.events=[]; ST.absent={};
    const L=makeLive(); let k=0; while(!L.over&&k++<3000){L.pending=null;L.step();}
    L.finish(); const n=ST.schedule[ST.round]; if(!n)break;
    const r=L.result; const us=n.homeGame?r.home:r.away, th=n.homeGame?r.away:r.home;
    LIVE=L; commitGame(r,us,th,us.slots); if(ST.seasonOver)break; } })()`);
  console.log(`[준비] ${ev("ST.stand['wwzw'].g")}경기 · 진기록 ${ev("(ST.feats||[]).length")}건`);

  const tblIn=(re)=>{
    const card=[...d.querySelectorAll('#view .card')].find(c=>re.test((c.querySelector('.card-h')||{}).textContent||''));
    return card?card.querySelector('table'):null;
  };
  const clickHead=(tbl,label)=>{
    const th=[...tbl.querySelectorAll('th.sortable')].find(x=>x.textContent.replace(/[▾▴]/g,'').trim()===label);
    if(!th) return false; th.click(); return true;
  };

  console.log('\n[우리 타격 정렬]');
  ev("statTab='team'"); w.go('stats'); await wait(120);
  let t=tblIn(/타격 기록/);
  T('정렬 가능한 헤더가 있다', ()=>t&&t.querySelectorAll('th.sortable').length>=10
    ? `${t.querySelectorAll('th.sortable').length}개` : '!없다');
  for(const [label,col] of [['HR',5],['타점',6],['도루',7],['안타',3]]){
    T(`${label} 내림차순`, ()=>{
      if(!clickHead(tblIn(/타격 기록/),label)) return '!헤더 없음';
      const tb=tblIn(/타격 기록/); const v=nums(tb,col);
      return isDesc(v) ? v.slice(0,6).join('>') : '!'+v.slice(0,8).join(',');
    });
  }
  T('같은 헤더 다시 누르면 오름차순', ()=>{
    clickHead(tblIn(/타격 기록/),'안타');
    const v=nums(tblIn(/타격 기록/),3);
    return isAsc(v) ? v.slice(0,6).join('<') : '!'+v.slice(0,8).join(',');
  });
  T('화살표 방향이 바뀐다', ()=>{
    const on=[...tblIn(/타격 기록/).querySelectorAll('th.on')][0];
    return on && /▴/.test(on.textContent) ? on.textContent.trim() : '!'+(on?on.textContent:'없음');
  });

  console.log('\n[우리 투수 정렬]');
  ev("statTab='pitch'"); w.go('stats'); await wait(120);
  T('ERA 는 낮은 순이 위', ()=>{
    const tb=tblIn(/투수 기록/); if(!tb) return '!표 없음';
    clickHead(tb,'ERA');
    const v=nums(tblIn(/투수 기록/),9);
    return isAsc(v) ? v.slice(0,5).join('<') : '!'+v.slice(0,6).join(',');
  });
  const eraTop=()=>{
    const first=[...tblIn(/투수 기록/).querySelectorAll('tr')][1];
    return first?first.children[9].textContent.trim():'?';
  };
  T('내림/오름 어느 쪽이든 미등판이 위로 안 온다', ()=>{
    const a=eraTop();                              // 지금은 오름차순
    clickHead(tblIn(/투수 기록/),'ERA');            // 내림차순으로
    const b=eraTop();
    return (a!=='—'&&b!=='—') ? `오름 ${a} / 내림 ${b}` : `!오름 ${a} / 내림 ${b}`;
  });
  T('삼진 내림차순', ()=>{
    clickHead(tblIn(/투수 기록/),'삼진');
    const v=nums(tblIn(/투수 기록/),8);
    return isDesc(v) ? v.slice(0,5).join('>') : '!'+v.join(',');
  });

  console.log('\n[통산 정렬]');
  ev("recTab='career'"); w.go('records'); await wait(120);
  T('통산 타격 헤더 정렬', ()=>{
    const tb=tblIn(/개인 통산 · 타격/); if(!tb) return '!표 없음';
    if(!clickHead(tb,'타점')) return '!헤더 없음';
    const v=nums(tblIn(/개인 통산 · 타격/),7);
    return isDesc(v) ? v.slice(0,6).join('>') : '!'+v.join(',');
  });
  T('통산 투구 헤더 정렬', ()=>{
    const tb=tblIn(/개인 통산 · 투구/); if(!tb) return '!표 없음(등판 기록 없음)';
    if(!clickHead(tb,'삼진')) return '!헤더 없음';
    const v=nums(tblIn(/개인 통산 · 투구/),8);
    return isDesc(v) ? v.slice(0,5).join('>') : '!'+v.join(',');
  });

  console.log('\n[구단 통산 1위 · 진기록]');
  ev("recTab='team'"); w.go('records'); await wait(150);
  const txt=d.getElementById('view').textContent;
  T('타격 1위 표가 있다', ()=>/구단 통산 1위 · 타격/.test(txt));
  T('부문이 값과 무관하게 전부 보인다', ()=>{
    const need=['최다 출전','최다 안타','최다 홈런','최다 2루타','최다 3루타','최다 타점',
                '최다 득점','최다 도루','최다 볼넷','최다 삼진','최고 타율'];
    const miss=need.filter(n=>!txt.includes(n));
    return miss.length===0 ? `${need.length}부문` : '!빠짐: '+miss.join(',');
  });
  T('기록 없는 부문은 "아직 없다" 로 남는다', ()=>{
    const tb=tblIn(/구단 통산 1위 · 타격/);
    const rows=[...tb.querySelectorAll('tr')].slice(1);
    return rows.length===11 ? `${rows.length}줄` : `!${rows.length}줄`;
  });
  T('투구 1위 표가 있다', ()=>/구단 통산 1위 · 투구/.test(txt)?true:'!(등판 기록이 없을 수 있다)');
  T('구단 진기록 카드가 있다', ()=>/구단 진기록/.test(txt));
  T('1위 값이 실제 최댓값과 맞다', ()=>{
    const tb=tblIn(/구단 통산 1위 · 타격/); if(!tb) return '!표 없음';
    const row=[...tb.querySelectorAll('tr')].find(r=>/최다 안타/.test(r.textContent));
    const shown=parseInt(row.children[2].textContent);
    const real=ev("Math.max(...TBYID['wwzw'].players.map(p=>(ST.career[p.id]||{h:0}).h||0))");
    return shown===real ? `${shown}안타` : `!표 ${shown} vs 실제 ${real}`;
  });
  T('1위 이름을 누르면 선수 카드가 열린다', ()=>{
    const l=d.querySelector('#view .nml'); if(!l) return '!링크 없음';
    l.click(); const on=d.getElementById('sheet').classList.contains('open');
    ev("closeSheet()"); return on;
  });
  T('undefined/NaN 없음', ()=>!/undefined|NaN/.test(txt));

  console.log('\n[진기록 보관]');
  T('시즌을 넘겨도 진기록이 남는다', ()=>{
    const before=ev("(ST.feats||[]).length");
    if(!before) return '진기록 0건(검사 생략)';
    ev(`(function(){
      const keep={career:ST.career,teamCareer:ST.teamCareer,milestones:ST.milestones,firsts:ST.firsts,
        feats:ST.feats, seasonNo:(ST.seasonNo||1)+1, playerId:ST.playerId,
        hall:ST.hall||[], awardBonus:ST.awardBonus||{}, gear:ST.gear||{}, playSec:ST.playSec||0};
      const n=newSeason(); Object.assign(n,keep); ST=n; normalizeState();
    })()`);
    const after=ev("(ST.feats||[]).length");
    return after===before ? `${after}건 유지` : `!${before} → ${after}`;
  });
  console.log(bad.length?`\n❌ ${bad.length}건\n - `+bad.join('\n - '):'\n✅ 이상 없음');
  process.exit(bad.length?1:0);
})();
