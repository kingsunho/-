/* 승리·패전투수가 규칙대로 정해지는지 */
const {JSDOM,VirtualConsole}=require('jsdom');
const dom=new JSDOM(require('fs').readFileSync('index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:new VirtualConsole(),beforeParse(w){w.scrollTo=()=>{};w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;}});
const w=dom.window,d=w.document,ev=s=>w.eval(s); w.confirm=()=>true;
const bad=[];
const T=(n,f)=>{try{const r=f();const ok=r===true||(typeof r==='string'&&!/^!/.test(r));
  console.log((ok?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r.replace(/^!/,''):''));if(!ok)bad.push(n);}
  catch(e){console.log('  ❌ '+n+' :: '+e.message);bad.push(n)}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await wait(700);
  console.log('[규칙 단위 검사]');
  // log: {d:내준투수, f:득점팀 투수, a:원정, h:홈}
  const D=(log,awayWin)=>ev(`JSON.stringify(decidePitchers(${JSON.stringify(log)},${awayWin}))`);
  T('처음부터 앞서면 선발이 승리투수', ()=>{
    const r=JSON.parse(D([{d:'A1',f:'H1',a:0,h:1},{d:'A1',f:'H1',a:0,h:2}],false));
    return r.wp==='H1'&&r.lp==='A1' ? `승 ${r.wp} / 패 ${r.lp}` : '!'+JSON.stringify(r);
  });
  T('역전한 순간의 두 투수에게 준다', ()=>{
    // 홈이 0:3 뒤지다 4점 내서 역전. 역전 순간 홈 투수는 H2, 원정 투수는 A2
    const r=JSON.parse(D([
      {d:'H1',f:'A1',a:1,h:0},{d:'H1',f:'A1',a:2,h:0},{d:'H1',f:'A1',a:3,h:0},
      {d:'A1',f:'H2',a:3,h:1},{d:'A2',f:'H2',a:3,h:2},{d:'A2',f:'H2',a:3,h:3},
      {d:'A2',f:'H2',a:3,h:4}],false));
    return r.wp==='H2'&&r.lp==='A2' ? `승 ${r.wp} / 패 ${r.lp}` : '!'+JSON.stringify(r);
  });
  T('마무리 투수가 애먼 패를 안 받는다', ()=>{
    // 선발 A1 이 5점 내주고 내려감. 구원 A2 는 무실점. 원정 패.
    const r=JSON.parse(D([
      {d:'A1',f:'H1',a:0,h:1},{d:'A1',f:'H1',a:0,h:2},{d:'A1',f:'H1',a:0,h:5}],false));
    return r.lp==='A1' ? `패 ${r.lp} (구원 A2 아님)` : '!'+JSON.stringify(r);
  });
  T('동점 뒤 다시 앞선 순간이 기준', ()=>{
    const r=JSON.parse(D([
      {d:'H1',f:'A1',a:1,h:0},{d:'A1',f:'H1',a:1,h:1},
      {d:'H2',f:'A2',a:2,h:1},{d:'A2',f:'H2',a:2,h:2},
      {d:'H3',f:'A3',a:3,h:2}],true));
    return r.wp==='A3'&&r.lp==='H3' ? `승 ${r.wp} / 패 ${r.lp}` : '!'+JSON.stringify(r);
  });
  T('득점이 없으면 null', ()=>{
    const r=JSON.parse(D([],true));
    return r.wp===null&&r.lp===null;
  });

  console.log('\n[실제 경기 — 500판]');
  const r=ev(`(function(){
    const T=buildAllTeams(); const us=T.find(t=>t.id==='wwzw');
    const rng=makeRng(31337);
    let n=0, wpBad=0, lpBad=0, wpNull=0, lpNull=0, lpIsFinisher=0, lpWorst=0;
    for(let k=0;k<500;k++){
      const opp=T[1+(k%(T.length-1))];
      const res=simGame(us,opp,{rng,innings:7,
        awayLineup:aiLineup(opp),awayRotation:aiRotation(opp),
        homeLineup:aiLineup(us),homeRotation:aiRotation(us)});
      if(res.tie) continue;
      n++;
      const winId=res.winner, loseId=(winId===us.id)?opp.id:us.id;
      const own=id=>T.find(t=>t.id===id);
      const wOK=(own(winId).pitchers||[]).some(p=>p.id===res.wp);
      const lOK=(own(loseId).pitchers||[]).some(p=>p.id===res.lp);
      if(res.wp==null)wpNull++; else if(!wOK)wpBad++;
      if(res.lp==null)lpNull++; else if(!lOK)lpBad++;
      // 패전투수가 그 팀에서 자책을 가장 많이 준 투수인가 (참고 지표)
      if(res.lp){
        const ls=(own(loseId).pitchers||[]).map(p=>res.pbox[p.id]).filter(x=>x&&x.bf);
        const worst=ls.length?Math.max(...ls.map(x=>x.er)):0;
        const mine=(res.pbox[res.lp]||{}).er||0;
        if(mine>=worst) lpWorst++;
        // 마지막에 던진 투수인가
        const rot=aiRotation(own(loseId));
        const used=rot.filter(id=>res.pbox[id]&&res.pbox[id].bf);
        if(used.length>1 && used[used.length-1]===res.lp) lpIsFinisher++;
      }
    }
    return {n,wpBad,lpBad,wpNull,lpNull,lpIsFinisher,lpWorst};
  })()`);
  console.log(`   ${r.n}경기 · 승투수 팀 오류 ${r.wpBad} · 패투수 팀 오류 ${r.lpBad} · null ${r.wpNull}/${r.lpNull}`);
  console.log(`   패전투수가 그 팀 최다 자책: ${(r.lpWorst/r.n*100).toFixed(0)}% · 마지막 투수: ${(r.lpIsFinisher/r.n*100).toFixed(0)}%`);
  T('승리투수는 항상 이긴 팀 소속', ()=>r.wpBad===0);
  T('패전투수는 항상 진 팀 소속', ()=>r.lpBad===0);
  T('승/패투수가 비지 않는다', ()=>r.wpNull===0&&r.lpNull===0 ? true : `!null ${r.wpNull}/${r.lpNull}`);
  T('패전투수가 대체로 제일 많이 내준 투수', ()=>r.lpWorst/r.n>=0.6
    ? `${(r.lpWorst/r.n*100).toFixed(0)}%` : `!${(r.lpWorst/r.n*100).toFixed(0)}% — 아직 엉뚱하다`);

  console.log('\n[LiveGame 도 같은지]');
  const L=ev(`(function(){
    const T=buildAllTeams(); const us=T.find(t=>t.id==='wwzw');
    let n=0,bad2=0,nul=0;
    for(let k=0;k<200;k++){
      const opp=T[1+(k%(T.length-1))];
      const rng=makeRng(500+k*97);
      const lu=us.players.slice(0,9).map((p,i)=>({id:p.id,pos:['C','1B','2B','3B','SS','LF','CF','RF','DH'][i]}));
      const G=new LiveGame({home:us,away:opp,userIsHome:true,rng,innings:7,
        homeLineup:lu,homeRotation:us.pitchers.map(p=>p.id),
        awayLineup:aiLineup(opp),awayRotation:aiRotation(opp),
        homeTactics:{bat:'normal',run:'normal',hook:'normal'},awayTactics:{bat:'normal',run:'normal',hook:'normal'},
        homeCond:{},awayCond:{},benchPool:[],park:{hr:1,d2:1,d3:1,err:1,babip:1}});
      let g=0; while(!G.over&&g++<3000){G.pending=null;G.step();}
      G.finish(); const R=G.result;
      if(R.tie) continue;
      n++;
      const winT=(R.winner===us.id)?us:opp, loseT=(R.winner===us.id)?opp:us;
      if(R.wp==null||R.lp==null){nul++;continue;}
      if(!(winT.pitchers||[]).some(p=>p.id===R.wp))bad2++;
      if(!(loseT.pitchers||[]).some(p=>p.id===R.lp))bad2++;
    }
    return {n,bad2,nul};
  })()`);
  console.log(`   ${L.n}경기 · 소속 오류 ${L.bad2} · null ${L.nul}`);
  T('LiveGame 도 소속이 맞다', ()=>L.bad2===0);
  T('LiveGame 도 안 비었다', ()=>L.nul===0 ? true : `!${L.nul}건`);

  console.log(bad.length?`\n❌ ${bad.length}건`:'\n✅ 이상 없음');
  process.exit(bad.length?1:0);
})();
