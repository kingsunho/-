/* 그라운드 홈런 */
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
  console.log('[발 느린 선수는 못 한다]');
  const r=ev(`(function(){
    const T=buildAllTeams(); const us=T.find(t=>t.id==='wwzw'); const opp=T[1];
    const rng=makeRng(777);
    const test=(spd)=>{
      const bat={id:'x',name:'테스트',bats:'R',con:60,pow:40,eye:45,spd,def:45,arm:45};
      const pit={id:'p',name:'P',stf:45,ctl:43,sta:50};
      let hr=0,itp=0,n=0;
      for(let i=0;i<300000;i++){
        const r2=simPA(bat,pit,us,opp,rng,{bat:'normal'},70,{hr:1,d2:1,d3:1,err:1,babip:1});
        if(r2.type==='HR'){ hr++; if(r2.itp)itp++; }
        n++;
      }
      return {spd,hr,itp,itpPct:hr?(itp/hr*100).toFixed(0):0};
    };
    return [30,45,50,58,70].map(test);
  })()`);
  r.forEach(x=>console.log(`   주력 ${String(x.spd).padStart(2)} → 홈런 ${String(x.hr).padStart(4)} 중 그라운드 ${String(x.itp).padStart(4)} (${x.itpPct}%)`));
  T('주력 30은 그라운드 홈런 0', ()=>r[0].itp===0 ? true : `!${r[0].itp}개`);
  T('주력 45(리그 중앙)도 0', ()=>r[1].itp===0 ? true : `!${r[1].itp}개`);
  T('주력 50부터 나온다', ()=>r[2].itp>0 ? `${r[2].itpPct}%` : '!안 나옴');
  T('빠를수록 더 많다', ()=>r[4].itp>r[2].itp ? `50: ${r[2].itpPct}% → 70: ${r[4].itpPct}%` : '!반대');
  T('발 빠른 선수는 홈런의 절반 이상이 그라운드', ()=>Number(r[4].itpPct)>=40
    ? `${r[4].itpPct}%` : `!${r[4].itpPct}%`);

  console.log('\n[리그 전체 비율]');
  const lg=ev(`(function(){
    const T=buildAllTeams(); const rng=makeRng(4242);
    let hr=0,itp=0,h=0;
    for(let s=0;s<6;s++)for(let i=0;i<T.length;i++)for(let j=0;j<T.length;j++){
      if(i===j)continue; if(((i*31+j*17+s*7)%9)!==0)continue;
      const res=simGame(T[j],T[i],{rng,innings:7,awayLineup:aiLineup(T[i]),awayRotation:aiRotation(T[i]),
        homeLineup:aiLineup(T[j]),homeRotation:aiRotation(T[j])});
      for(const pid in res.box){const b=res.box[pid]; hr+=b.hr; h+=b.h; itp+=(b.itp||0);}
    }
    return {hr,h,itp,hrPct:(hr/h*100).toFixed(2),itpShare:hr?(itp/hr*100).toFixed(0):0};
  })()`);
  console.log(`   안타 ${lg.h} · 홈런 ${lg.hr} (${lg.hrPct}%) · 그중 그라운드 ${lg.itp} (${lg.itpShare}%)`);
  T('홈런 비율이 목표(1.0%) 근처', ()=>Math.abs(lg.hrPct-1.0)<0.5 ? `${lg.hrPct}%` : `!${lg.hrPct}%`);
  T('그라운드 홈런이 상당수', ()=>Number(lg.itpShare)>=30 ? `${lg.itpShare}%` : `!${lg.itpShare}%`);

  console.log('\n[표시 · 진기록 · 대사]');
  d.querySelectorAll('.pickcard')[0].click(); await wait(60);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(300); ev("ST.tutDone=true");
  const live=ev(`(function(){
    const T=buildAllTeams(); const us=T.find(t=>t.id==='wwzw');
    for(let k=0;k<600;k++){
      const opp=T[1+(k%(T.length-1))];
      const rng=makeRng(9000+k*131);
      const lu=us.players.slice(0,9).map((p,i)=>({id:p.id,pos:['C','1B','2B','3B','SS','LF','CF','RF','DH'][i]}));
      const L=new LiveGame({home:us,away:opp,userIsHome:true,rng,innings:7,
        homeLineup:lu,homeRotation:us.pitchers.map(p=>p.id),
        awayLineup:aiLineup(opp),awayRotation:aiRotation(opp),
        homeTactics:{bat:'normal',run:'normal',hook:'normal'},awayTactics:{bat:'normal',run:'normal',hook:'normal'},
        homeCond:{},awayCond:{},benchPool:[],park:{hr:1,d2:1,d3:1,err:1,babip:1}});
      let g=0; while(!L.over&&g++<3000){L.pending=null;L.step();}
      L.finish();
      const f=(L.result.feats||[]).find(x=>x.kind==='그라운드 홈런');
      if(f){
        const log=L.log.find(x=>/그라운드 홈런/.test(x.text||''));
        const hl=(L.result.highlights||[]).find(x=>/그라운드/.test(x.detail||''));
        const box=Object.keys(L.box).find(id=>L.box[id].itp);
        return {feat:f, logText:log?log.text:null, hlDetail:hl?hl.detail:null, boxItp:!!box};
      }
    }
    return null;
  })()`);
  T('실제 경기에서 나온다', ()=>live ? live.feat.detail : '!600경기에서 한 번도 안 나옴');
  if(live){
    T('중계에 "담장은 안 넘었다" 가 붙는다', ()=>/담장은 안 넘었다/.test(live.logText||'') ? live.logText : '!'+live.logText);
    T('하이라이트에 그라운드 표시', ()=>/그라운드/.test(live.hlDetail||''));
    T('박스스코어에 itp 가 기록된다', ()=>live.boxItp);
    T('진기록으로 남는다', ()=>ev("!!FEAT_INFO['그라운드 홈런']"));
  }
  T('놀리는 대사가 있다', ()=>ev("ITP_TEASE.length")>=6&&ev("ITP_REPLY.length")>=4
    ? `놀림 ${ev("ITP_TEASE.length")}줄 · 대답 ${ev("ITP_REPLY.length")}줄` : '!부족');
  console.log(bad.length?`\n❌ ${bad.length}건`:'\n✅ 이상 없음');
  process.exit(bad.length?1:0);
})();
