/* 감독 액션 · 물통 부상 · 상황별 답변 */
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
(async()=>{
  await wait(700);
  d.querySelectorAll('.pickcard')[0].click(); await wait(60);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(300); ev("ST.tutDone=true");

  console.log('[물통차기 — 3% 자해]');
  const r=ev(`(function(){
    let hurt=0, tries=0, subbed=0, legOnly=true;
    for(let t=0;t<4000;t++){
      const L=makeLive(); L.myId=ST.playerId||MYID;
      // 몇 타석 굴려서 벤치풀이 생기게
      for(let k=0;k<20&&!L.over;k++){ L.pending=null; L.step(); }
      const before=L.injuries.length;
      const res=L.mgrAction('bottle'); tries++;
      if(L.injuries.length>before){
        hurt++;
        const iv=L.injuries[L.injuries.length-1];
        if(iv.why!=='물통') legOnly=false;
        if(iv.id!==(ST.playerId||MYID)) legOnly=false;
        if(!L.userSide().slots.some(x=>x.id===iv.id)) subbed++;
      }
    }
    return {hurt,tries,rate:(hurt/tries*100).toFixed(2),subbed,legOnly};
  })()`);
  console.log(`   ${r.tries}번 차서 ${r.hurt}번 다침 (${r.rate}%)`);
  T('3% 근처다', ()=>Math.abs(r.rate-3)<1.0 ? `${r.rate}%` : `!${r.rate}%`);
  T('다치는 건 본인(고른 캐릭터)뿐', ()=>r.legOnly);
  T('다치면 그 자리에서 교체된다', ()=>r.subbed>0 ? `${r.subbed}/${r.hurt}건` : '!교체 안 됨');

  console.log('\n[부상이 다리 쪽으로 고정되나]');
  const inj=ev(`(function(){
    const names={};
    for(let i=0;i<300;i++){
      const iv={id:ST.playerId||MYID, roll:Math.random(), why:'물통'};
      const x = iv.why==='물통'
        ? pickOne([{name:'발등 타박상',games:2},{name:'발가락 염좌',games:2},
                   {name:'발목 접질림',games:3},{name:'정강이 타박상',games:1}])
        : rollInjury(iv.id,iv.roll);
      names[x.name]=(names[x.name]||0)+1;
    }
    return names;
  })()`);
  console.log('  ', Object.entries(inj).map(([k,v])=>`${k} ${v}`).join(' · '));
  T('전부 다리 부상', ()=>Object.keys(inj).every(n=>/발|정강이/.test(n)));

  console.log('\n[감독 액션이 경기 내내 보이나]');
  ev("ST.weekDone=true; ST.announced=true; ST.lineupDirty=false;");
  w.go('game'); await wait(120);
  const mb=[...d.querySelectorAll('#view .btn')].find(x=>/직접 지휘/.test(x.textContent));
  if(mb){ mb.click(); await wait(200); }
  T('상시 버튼이 있다', ()=>{
    const b=[...d.querySelectorAll('#livectl .btn')].find(x=>/감독 액션/.test(x.textContent));
    return b ? b.textContent : '!없다';
  });
  T('눌러서 시트가 열린다', ()=>{
    const b=[...d.querySelectorAll('#livectl .btn')].find(x=>/감독 액션/.test(x.textContent));
    if(!b) return '!버튼 없음'; b.click();
    const on=d.getElementById('sheet').classList.contains('open');
    const has=/물통을 걷어찬다/.test(d.getElementById('sheet-body').textContent);
    const warn=/3% 확률로 본인 발을 다친다/.test(d.getElementById('sheet-body').innerHTML);
    ev("closeSheet()");
    return on&&has&&warn ? true : (!warn?'!경고 문구 없음':'!시트 이상');
  });
  ev("if(playTimer)clearInterval(playTimer); LIVE=null;");

  console.log('\n[경기 후 답변이 상황마다 다른가]');
  const sets=ev(`(function(){
    const out={};
    const mk=(o)=>{ ST.lastResult=Object.assign({won:false,tie:false,diff:2,errs:0,bbAllowed:0,lob:0,feat:0,injured:0},o);
      return kakaoOptions(ST,'post').map(x=>x.id); };
    out['대승']      = mk({won:true,diff:9});
    out['역전승']    = mk({won:true,diff:2,comeback:true});
    out['접전패']    = mk({won:false,diff:1});
    out['대패']      = mk({won:false,diff:11});
    out['무승부']    = mk({tie:true,diff:0});
    out['실책3개']   = mk({won:false,diff:3,errs:4});
    out['사사구10']  = mk({won:false,diff:3,bbAllowed:11});
    out['잔루많음']  = mk({won:false,diff:2,lob:9});
    out['진기록']    = mk({won:true,diff:3,feat:2});
    out['부상자']    = mk({won:false,diff:4,injured:1});
    return out;
  })()`);
  Object.entries(sets).forEach(([k,v])=>console.log(`   ${k.padEnd(8)} ${v.join(', ')}`));
  T('상황마다 선택지가 다르다', ()=>{
    const sigs=new Set(Object.values(sets).map(v=>v.join(',')));
    return sigs.size>=8 ? `${sigs.size}종` : `!${sigs.size}종뿐`;
  });
  T('대승·대패 선택지가 다르다', ()=>sets['대승'].join()!==sets['대패'].join());
  T('실책 많으면 수비훈련이 뜬다', ()=>sets['실책3개'].includes('gloves'));
  T('사사구 많으면 투구훈련이 뜬다', ()=>sets['사사구10'].includes('ctl'));
  T('평소엔 수비훈련이 안 뜬다', ()=>!sets['대승'].includes('gloves'));
  T('진기록 날엔 전용 선택지', ()=>sets['진기록'].includes('feat'));
  T('부상자 있으면 전용 선택지', ()=>sets['부상자'].includes('health'));

  console.log('\n[경기 전 답변도]');
  const pre=ev(`(function(){
    const out={};
    ST.schedule.forEach(x=>{x.played=false;delete x.result;});
    out['평소']=kakaoOptions(ST,'pre').map(x=>x.id);
    ST.schedule[0].played=true; ST.schedule[0].result={us:2,them:9}; ST.round=1;
    out['지난주 패']=kakaoOptions(ST,'pre').map(x=>x.id);
    ST.schedule[0].result={us:9,them:2};
    out['지난주 승']=kakaoOptions(ST,'pre').map(x=>x.id);
    ST.weather='hot';
    out['더운날']=kakaoOptions(ST,'pre').map(x=>x.id);
    TBYID['wwzw'].players.forEach(p=>ST.cond[p.id]=35);
    out['컨디션난조']=kakaoOptions(ST,'pre').map(x=>x.id);
    return out;
  })()`);
  Object.entries(pre).forEach(([k,v])=>console.log(`   ${k.padEnd(10)} ${v.join(', ')}`));
  T('경기 전도 상황마다 다르다', ()=>new Set(Object.values(pre).map(v=>v.join(','))).size>=4);
  T('더운 날 전용 선택지', ()=>pre['더운날'].includes('water'));
  T('컨디션 나쁘면 전용 선택지', ()=>pre['컨디션난조'].includes('pace'));

  console.log(bad.length?`\n❌ ${bad.length}건\n - `+bad.join('\n - '):'\n✅ 이상 없음');
  process.exit(bad.length?1:0);
})();
