/* 단톡 다양성 측정 */
const {JSDOM,VirtualConsole}=require('jsdom');
const dom=new JSDOM(require('fs').readFileSync('index.html','utf8'),{runScripts:'dangerously',pretendToBeVisual:true,url:'https://x.test/',virtualConsole:new VirtualConsole(),beforeParse(w){w.scrollTo=()=>{};w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;}});
const w=dom.window,d=w.document,ev=s=>w.eval(s); w.confirm=()=>true;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  await wait(700);
  d.querySelectorAll('.pickcard')[0].click(); await wait(60);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(300); ev("ST.tutDone=true");
  const r=ev(`(function(){
    const all=[]; let games=0;
    for(let sN=0;sN<3;sN++){
      for(let i=0;i<40;i++){
        if(ST.round>=ST.schedule.length||ST.seasonOver)break;
        runWeek(); ST.weekDone=true; ST.lineupDirty=false;
        if(ST.events&&ST.events.length)ST.events=[]; ST.absent={};
        try{ (buildKakaoPre(ST)||[]).forEach(m=>all.push({who:m.who,ty:m.type||'talk',t:String(m.text),src:'pre'})); }catch(e){}
        ST.announced=true;
        const L=makeLive(); let k=0; while(!L.over&&k++<3000){L.pending=null;L.step();}
        L.finish(); const n=ST.schedule[ST.round]; if(!n)break;
        const r2=L.result; const us=n.homeGame?r2.home:r2.away, th=n.homeGame?r2.away:r2.home;
        LIVE=L; commitGame(r2,us,th,us.slots);
        games++;
        (ST.kakaoPost||[]).forEach(m=>all.push({who:m.who,ty:m.type||'talk',t:String(m.text),src:'post'}));
        // 이겼으면 회식
        if(ST.canParty&&!ST.partyDone){
          const pr=doAfterParty(ST);
          (pr.msgs||[]).forEach(m=>all.push({who:m.who,ty:m.type||'talk',t:String(m.text),src:'party'}));
        }
      }
      // 다음 시즌
      if(ST.seasonOver){
        const log=(ST.seasonLog||[]).slice();
        const keep={career:ST.career,teamCareer:ST.teamCareer,milestones:ST.milestones,firsts:ST.firsts,
          seasonNo:(ST.seasonNo||1)+1,playerId:ST.playerId,hall:ST.hall||[],feats:ST.feats||[],
          seasonLog:log, saidLog:ST.saidLog};
        const n2=newSeason(); Object.assign(n2,keep); ST=n2; normalizeState();
        ST.lineup=recommendLineup(); ST.rotation=recommendRotation();
      }
    }
    const talk=all.filter(m=>m.ty==='talk');
    const uniq=new Set(talk.map(m=>m.t));
    // 연속 중복 (바로 다음에 같은 말)
    let consec=0;
    for(let i=1;i<talk.length;i++) if(talk[i].t===talk[i-1].t) consec++;
    // 가장 많이 나온 말
    const cnt={}; talk.forEach(m=>cnt[m.t]=(cnt[m.t]||0)+1);
    const top=Object.entries(cnt).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const bySrc={}; all.forEach(m=>{bySrc[m.src]=(bySrc[m.src]||0)+1;});
    const uniqSrc={}; ['pre','post','party'].forEach(k=>{
      uniqSrc[k]=new Set(all.filter(m=>m.src===k&&m.ty==='talk').map(m=>m.t)).size; });
    return {games, total:all.length, talk:talk.length, uniq:uniq.size, consec, top,
      perGame:(all.length/games).toFixed(1), bySrc, uniqSrc};
  })()`);
  console.log(`${r.games}경기 · 단톡 메시지 ${r.total}개 (경기당 ${r.perGame}개)`);
  console.log(`대사(talk) ${r.talk}개 중 서로 다른 문장 ${r.uniq}개 — 다양도 ${(r.uniq/r.talk*100).toFixed(0)}%`);
  console.log(`바로 연속으로 같은 말: ${r.consec}회`);
  console.log(`구성: 경기전 ${r.bySrc.pre||0} · 경기후 ${r.bySrc.post||0} · 회식 ${r.bySrc.party||0}`);
  console.log(`고유 문장: 경기전 ${r.uniqSrc.pre} · 경기후 ${r.uniqSrc.post} · 회식 ${r.uniqSrc.party}`);
  console.log('\n가장 자주 나온 대사:');
  r.top.forEach(([t,c])=>console.log(`  ${c}회  ${t.slice(0,44)}`));
  process.exit(0);
})();
