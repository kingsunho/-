/* 홈/어웨이가 실제로 갈려서 돌아가는지 */
const {JSDOM,VirtualConsole}=require('jsdom');
const dom=new JSDOM(require('fs').readFileSync('index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:new VirtualConsole()});
dom.window.scrollTo=()=>{};
const ev=s=>dom.window.eval(s);
const T=(n,f)=>{try{const r=f();const ok=r===true||(typeof r==='string'&&!/^실패|안 함|넘음|불일치/.test(r));
  console.log((r?'  ✅ ':'  ❌ ')+n+(typeof r==='string'?' :: '+r:''));return !!r;}catch(e){console.log('  ❌ '+n+' :: '+e.message);return false}};
let bad=0;
setTimeout(()=>{
  const r=ev(`(function(){
    const T=buildAllTeams(); const us=T.find(t=>t.id==='wwzw');
    const rng=makeRng(4242);
    const lineup=us.players.slice(0,9).map((p,i)=>({id:p.id,pos:['C','1B','2B','3B','SS','LF','CF','RF','DH'][i]}));
    const rot=us.pitchers.map(p=>p.id);
    const out={homeGames:0,awayGames:0, walkoffSkip:0, homeLastInningSkipped:0,
      awayAlwaysBatsFirst:true, homeBatsBottom:true, lineLenOK:true, hfaHomeRuns:0,hfaAwayRuns:0,
      samples:[]};
    for(let k=0;k<200;k++){
      const opp=T[1+(k%(T.length-1))];
      const userHome=(k%2===0);
      const L=new LiveGame({home:userHome?us:opp, away:userHome?opp:us, userIsHome:userHome, rng, innings:7,
        homeLineup:userHome?lineup:aiLineup(opp), homeRotation:userHome?rot:aiRotation(opp),
        awayLineup:userHome?aiLineup(opp):lineup, awayRotation:userHome?aiRotation(opp):rot,
        homeTactics:{bat:'normal',run:'normal',hook:'normal'},awayTactics:{bat:'normal',run:'normal',hook:'normal'},
        homeCond:{},awayCond:{},benchPool:[],park:{hr:1,d2:1,d3:1,err:1,babip:1}});
      // 1회는 반드시 원정 공격
      const first=L.log.find(x=>x.t==='inning');
      if(!/1회 초/.test(first.text) || first.text.indexOf(L.away.team.name)<0) out.awayAlwaysBatsFirst=false;
      let g=0; while(!L.over && g++<3000){ L.pending=null; L.step(); }
      const res=L.result;
      if(userHome)out.homeGames++;else out.awayGames++;
      out.hfaHomeRuns+=res.home.runs; out.hfaAwayRuns+=res.away.runs;
      // 홈이 이기고 있으면 마지막 말 공격은 안 한다
      const hl=res.home.line, al=res.away.line;
      if(hl.length<al.length && res.home.runs>res.away.runs) out.homeLastInningSkipped++;
      if(hl.length>al.length) out.lineLenOK=false;   // 홈이 원정보다 많이 칠 수는 없다
      // 라인스코어 이닝 합 = R 이어야 한다
      const sum=a=>a.reduce((x,y)=>x+(y||0),0);
      if(sum(al)!==res.away.runs || sum(hl)!==res.home.runs){
        out.lineSumBad=(out.lineSumBad||0)+1;
        if(!out.lineSumEx) out.lineSumEx=sum(al)+'!='+res.away.runs+' / '+sum(hl)+'!='+res.home.runs;
      }
      if(out.samples.length<4) out.samples.push({
        userHome, away:res.away.team.name, home:res.home.team.name,
        al:al.join('-'), hl:hl.join('-'), score:res.away.runs+':'+res.home.runs, mercy:res.mercy});
    }
    return out;
  })()`);
  console.log('[홈/어웨이]');
  r.samples.forEach(s=>console.log(`   ${s.userHome?'우리 홈':'우리 원정'} | ${s.away} ${s.al}  vs  ${s.home} ${s.hl} = ${s.score}${s.mercy?' (콜드)':''}`));
  if(!T('원정이 항상 1회 초에 먼저 친다', ()=>r.awayAlwaysBatsFirst))bad++;
  if(!T('홈 이닝 수가 원정을 넘지 않는다', ()=>r.lineLenOK))bad++;
  if(!T('홈이 이기고 있으면 마지막 말 공격 생략', ()=>r.homeLastInningSkipped>0
      ? `${r.homeLastInningSkipped}경기에서 생략됨` : '한 번도 생략 안 함'))bad++;
  if(!T('홈/원정 둘 다 돈다', ()=>r.homeGames>0&&r.awayGames>0))bad++;
  if(!T('라인스코어 이닝 합 = R (200경기)', ()=>!r.lineSumBad
      ? true : `불일치 ${r.lineSumBad}경기 (예: ${r.lineSumEx})`))bad++;
  console.log(`   홈 ${r.homeGames}경기 · 원정 ${r.awayGames}경기 · 홈 총득점 ${r.hfaHomeRuns} vs 원정 ${r.hfaAwayRuns}`);

  console.log('\n[일정·구장]');
  ev("ST=newSeason();ST.lineup=recommendLineup();ST.rotation=recommendRotation();MYID='ksh';");
  const sch=ev("ST.schedule.map(x=>({opp:x.opp,home:!!x.homeGame,park:x.park||null}))");
  const h=sch.filter(x=>x.home).length;
  console.log(`   총 ${sch.length}경기 · 홈 ${h} · 원정 ${sch.length-h}`);
  console.log('   ', sch.slice(0,8).map(x=>(x.home?'홈':'원')+':'+x.opp).join(' '));
  if(!T('일정에 홈/원정이 둘 다 있다', ()=>h>0&&h<sch.length))bad++;
  if(!T('한쪽으로 심하게 쏠리지 않는다', ()=>Math.abs(h-(sch.length-h))<=Math.ceil(sch.length*0.4)
      ? true : `홈 ${h} / 원정 ${sch.length-h}`))bad++;
  if(!T('결과 화면이 홈/원정 순서로 라인스코어를 그린다', ()=>{
    const src=require('fs').readFileSync('index.html','utf8');
    return /ls\.innerHTML=`<table>\$\{h\}\$\{row\(res\.away\)\}\$\{row\(res\.home\)\}<\/table>`/.test(src);
  }))bad++;
  console.log(bad?`\n❌ ${bad}건`:'\n✅ 전부 통과');
  process.exit(bad?1:0);
},600);
