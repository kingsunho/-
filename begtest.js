/* 인원 부족 대응 — 사정하기 확률·순서·부상자 제외 · 라인업 보존 */
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
  catch(e){console.log('  ❌ '+n+' :: '+e.message);bad.push(n)}};
(async()=>{
  await wait(700);
  d.querySelectorAll('.pickcard')[0].click(); await wait(60);
  [...d.querySelectorAll('#view .btn')].find(b=>b.textContent==='이 선수로 시작').click();
  await wait(300); ev("ST.tutDone=true");

  console.log('[성공 확률 20%]');
  const rate=ev(`(function(){
    let yes=0, n=0;
    for(let i=0;i<4000;i++){
      ST.absent={}; ST.injury={}; ST.begAsked={};
      TBYID['wwzw'].players.slice(0,6).forEach(p=>ST.absent[p.id]='개인 사정');
      const r=begForPlayer(); n++; if(r.ok)yes++;
    }
    return {yes,n,pct:(yes/n*100).toFixed(1)};
  })()`);
  console.log(`   ${rate.n}번 물어서 ${rate.yes}번 성공 (${rate.pct}%)`);
  T('20% 근처', ()=>Math.abs(rate.pct-20)<2.5 ? `${rate.pct}%` : `!${rate.pct}%`);

  console.log('\n[오버롤 높은 순으로 묻는가]');
  const order=ev(`(function(){
    ST.absent={}; ST.injury={}; ST.begAsked={};
    const ids=TBYID['wwzw'].players.map(p=>p.id);
    ids.forEach(id=>ST.absent[id]='개인 사정');
    const asked=[];
    for(let i=0;i<ids.length+2;i++){
      const before=Object.keys(ST.begAsked).length;
      const r=begForPlayer();
      const now=Object.keys(ST.begAsked);
      if(now.length>before) asked.push(now[now.length-1]);
      if(r.done) break;
      // 성공하면 absent 가 풀리므로 다시 넣어 순서만 본다
      if(r.ok) ST.absent[now[now.length-1]]='개인 사정';
    }
    return {asked, ca:asked.map(id=>Math.round(effCA(id))), names:asked.map(nameOf)};
  })()`);
  console.log('   ', order.names.slice(0,6).map((n,i)=>`${n}(${order.ca[i]})`).join(' → '));
  T('오버롤 내림차순', ()=>{
    const c=order.ca;
    return c.every((v,i)=>i===0||c[i-1]>=v) ? `${c[0]} → ${c[c.length-1]}` : '!'+c.join(',');
  });
  T('같은 사람을 두 번 안 묻는다', ()=>new Set(order.asked).size===order.asked.length);

  console.log('\n[부상자는 안 부른다]');
  const inj=ev(`(function(){
    ST.absent={}; ST.injury={}; ST.begAsked={};
    const us=TBYID['wwzw'].players;
    // 오버롤 1위를 부상 + 결장으로
    const top=us.slice().sort((a,b)=>effCA(b.id)-effCA(a.id))[0];
    ST.absent[top.id]='부상'; ST.injury[top.id]={name:'발목 접질림',games:2,sev:2};
    const second=us.slice().sort((a,b)=>effCA(b.id)-effCA(a.id))[1];
    ST.absent[second.id]='개인 사정';
    const r=begForPlayer();
    return {topName:top.name, asked:Object.keys(ST.begAsked).map(nameOf), msg:r.msg};
  })()`);
  console.log('   부상자:', inj.topName, '| 물어본 사람:', inj.asked.join(', '));
  T('부상자는 후보에서 빠진다', ()=>inj.asked.indexOf(inj.topName)<0 ? true : '!부상자에게 물었다');
  T('부상자만 남으면 그렇게 알려준다', ()=>ev(`(function(){
    ST.absent={}; ST.injury={}; ST.begAsked={};
    const p=TBYID['wwzw'].players[0];
    ST.absent[p.id]='부상'; ST.injury[p.id]={name:'어깨 통증',games:3,sev:2};
    return begForPlayer().msg;
  })()`).includes('부상자'));

  console.log('\n[라인업이 안 망가지나]');
  const lu=ev(`(function(){
    ST.absent={}; ST.injury={}; ST.begAsked={};
    ST.useDH=false;
    ST.lineup=recommendLineup(); applyDHRule();
    const before=JSON.parse(JSON.stringify(ST.lineup));
    // 라인업 밖의 한 명을 결장 처리했다가 부른다
    const outsider=TBYID['wwzw'].players.find(p=>!ST.lineup.some(s=>s.id===p.id));
    ST.absent[outsider.id]='개인 사정';
    let r=null;
    for(let i=0;i<200;i++){ ST.begAsked={}; r=begForPlayer(); if(r.ok)break;
      ST.absent[outsider.id]='개인 사정'; }
    const after=JSON.parse(JSON.stringify(ST.lineup));
    return {before,after,outsider:outsider.name, ok:!!(r&&r.ok),
      useDH:ST.useDH, dhInLineup:ST.lineup.some(s=>s.pos==='DH')};
  })()`);
  T('돌아오게 만들었다', ()=>lu.ok ? lu.outsider : '!실패');
  T('타순이 그대로다', ()=>JSON.stringify(lu.before)===JSON.stringify(lu.after)
    ? `${lu.after.length}명 그대로` : '!라인업이 바뀌었다');
  T('지명타자가 멋대로 안 켜진다', ()=>!lu.useDH&&!lu.dhInLineup ? 'DH 꺼진 채 유지' : '!DH 가 켜졌다');

  console.log('\n[빈자리가 있으면 채운다]');
  const fill=ev(`(function(){
    ST.absent={}; ST.injury={}; ST.begAsked={}; ST.useDH=false;
    ST.lineup=recommendLineup(); applyDHRule();
    const victim=ST.lineup[3];
    ST.absent[victim.id]='개인 사정';
    const outsider=TBYID['wwzw'].players.find(p=>!ST.lineup.some(s=>s.id===p.id));
    ST.absent[outsider.id]='개인 사정';
    // outsider 만 남기고 victim 은 안 부르게 begAsked 로 막는다
    ST.begAsked[victim.id]=true;
    let r=null;
    for(let i=0;i<300;i++){ ST.begAsked={}; ST.begAsked[victim.id]=true;
      r=begForPlayer(); if(r.ok)break; ST.absent[outsider.id]='개인 사정'; }
    const slot=ST.lineup.find(s=>s.id===outsider.id);
    // 라인업 전원이 설 수 있는 자리에 있는지도 본다
    const badFit=ST.lineup.filter(x=>x.pos!=='DH'&&isAvailable(x.id)&&posFit(x.id,x.pos)<=0)
      .map(x=>nameOf(x.id)+'/'+x.pos);
    return {ok:!!(r&&r.ok), filled:!!slot, pos:slot?slot.pos:null,
      fit:slot?Math.round(posFit(outsider.id,slot.pos)):null, name:outsider.name,
      n:ST.lineup.length, badFit};
  })()`);
  T('빈자리에 들어간다', ()=>fill.ok&&fill.filled ? `${fill.name} → ${fill.pos}`
    : (fill.ok?`벤치에 남음(설 자리 없음) — 라인업 ${fill.n}명`:'!안 돌아옴'));
  T('설 수 있는 자리만 준다', ()=>fill.fit===null||fill.fit>0 ? `적합도 ${fill.fit}` : `!적합도 ${fill.fit}`);
  T('아무도 못 서는 자리에 안 선다', ()=>fill.badFit.length===0 ? true : '!'+fill.badFit.join(', '));

  console.log('\n[라인업 화면에서 바로 부를 수 있나]');
  ev(`(function(){
    ST.absent={}; ST.injury={}; ST.begAsked={};
    TBYID['wwzw'].players.slice(0,6).forEach(p=>ST.absent[p.id]='개인 사정');
  })()`);
  w.go('lineup'); await wait(120);
  const t=d.getElementById('view').textContent;
  T('인원 부족 카드가 뜬다', ()=>/인원이 모자란다/.test(t));
  T('사정하기 버튼', ()=>[...d.querySelectorAll('#view .btn')].some(b=>/사정해본다/.test(b.textContent)));
  T('용병 버튼', ()=>[...d.querySelectorAll('#view .btn')].some(b=>/용병 부른다/.test(b.textContent)));
  T('확률 안내', ()=>/성공 확률 20%/.test(t)&&/부상자는 부를 수 없다/.test(t));
  T('남은 인원 수를 보여준다', ()=>/사정해본다 \(\d+명 남음\)/.test(t));
  T('undefined 없음', ()=>!/undefined|NaN/.test(t));
  T('눌러도 안 터진다', ()=>{
    const b=[...d.querySelectorAll('#view .btn')].find(x=>/사정해본다/.test(x.textContent));
    if(!b) return '!버튼 없음';
    b.click(); return true;
  });
  await wait(120);
  T('누른 뒤에도 화면이 멀쩡하다', ()=>{
    const tt=d.getElementById('view').textContent;
    return tt.length>50 && !/undefined|NaN/.test(tt);
  });
  T('다 물어보면 버튼이 잠긴다', ()=>ev(`(function(){
    for(let i=0;i<20;i++){ const r=begForPlayer(); if(r.done) break; }
    go('lineup');
    const b=[...document.querySelectorAll('#view .btn')].find(x=>/사정해본다/.test(x.textContent));
    return !b || b.disabled;
  })()`));

  console.log(bad.length?`\n❌ ${bad.length}건\n - `+bad.join('\n - '):'\n✅ 이상 없음');
  process.exit(bad.length?1:0);
})();
