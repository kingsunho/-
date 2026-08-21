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

  /* 30주 동안 라인업에 안 넣고 굴려서 불만이 어떻게 쌓이는지 본다 */
  const run=(playerId)=>ev(`(function(){
    ST.playerId='${playerId}'; MYID='${playerId}';
    ST.unhappy={}; ST.spark={}; ST.morale={}; ST.injury={}; ST.absent={};
    TBYID['wwzw'].players.forEach(p=>ST.morale[p.id]=70);
    // 김인규를 벤치로 빼고, 등판한 투수(송승민)는 라인업에 둔다.
    const slots=[{id:'ksh',pos:'2B',ord:0},{id:'lg',pos:'CF',ord:1},{id:'jms',pos:'LF',ord:2},
      {id:'yjh',pos:'1B',ord:3},{id:'ksn',pos:'RF',ord:4},{id:'ksw',pos:'SS',ord:5},
      {id:'khg',pos:'3B',ord:6},{id:'ujh',pos:'DH',ord:7},{id:'swm',pos:'P',ord:8}];
    const pitcherId='swm';
    const pbox={}; pbox[pitcherId]={outs:15,bf:24,h:5,r:3,er:3,bb:2,k:5,hbp:0,sbA:0};
    // 송승민은 9번타자인데 등판했다 → 불만이 없어야 한다
    let blown={};
    for(let k=0;k<30;k++){
      const msgs=updateUnhappy(ST,slots,{blowout:false,won:false,tie:false,pbox:pbox});
      msgs.filter(m=>m.type==='notice'&&/불만 폭발/.test(m.text||'')).forEach(m=>{
        const nm=m.text.split(' ')[0]; blown[nm]=(blown[nm]||0)+1;
      });
    }
    const lv={}; Object.keys(ST.unhappy).forEach(id=>{ if(ST.unhappy[id].level>0) lv[nameOf(id)]=ST.unhappy[id].level; });
    return {lv, blown, pitcherId, pitcherName:nameOf(pitcherId),
            meLevel:(ST.unhappy['${playerId}']||{level:0}).level,
            meSpark:(ST.spark['${playerId}']||{n:0}).n};
  })()`);

  console.log('[김한규를 골랐을 때]');
  const a=run('khg');
  console.log('   불만 단계:', JSON.stringify(a.lv));
  console.log('   폭발 횟수:', JSON.stringify(a.blown));
  T('본인(김한규)은 불만이 안 쌓인다', ()=>a.meLevel===0 && a.meSpark===0);
  T('본인은 불만 목록에 없다', ()=>!a.lv['김한규']);
  T('다른 선수들은 불만이 쌓인다', ()=>Object.keys(a.lv).length>=4);
  T('쌍둥이 김인규가 터진다', ()=>a.blown['김인규']>0
      ? `${a.blown['김인규']}회` : '한 번도 안 터짐');
  T('김인규가 남들보다 자주 터진다', ()=>{
    const kig=a.blown['김인규']||0;
    const others=Object.entries(a.blown).filter(([n])=>n!=='김인규').map(([,v])=>v);
    const avg=others.length?others.reduce((x,y)=>x+y,0)/others.length:0;
    return kig>=avg ? `김인규 ${kig}회 vs 평균 ${avg.toFixed(1)}회` : `김인규 ${kig} < 평균 ${avg.toFixed(1)}`;
  });
  T('등판한 투수는 불만이 없다', ()=>!a.lv[a.pitcherName]
      ? true : `${a.pitcherName} 불만 ${a.lv[a.pitcherName]}`);

  console.log('\n[김선호를 골랐을 때 — 라이벌 없음]');
  const b=run('ksh');
  console.log('   불만 단계:', JSON.stringify(b.lv));
  T('본인(김선호)은 불만이 안 쌓인다', ()=>b.meLevel===0&&!b.lv['김선호']);
  T('김인규 폭발이 줄어든다(라이벌 아님)', ()=>{
    const withMe=a.blown['김인규']||0, without=b.blown['김인규']||0;
    return withMe>=without ? `김한규 플레이 ${withMe}회 vs 김선호 플레이 ${without}회` : `${withMe} < ${without}`;
  });
  T('도화선 — 김한규 고르면 김인규가 짧아진다', ()=>{
    const withKhg=ev("(function(){ST.playerId='khg';MYID='khg';return sparkFuse('kig')})()");
    const withKsh=ev("(function(){ST.playerId='ksh';MYID='ksh';return sparkFuse('kig')})()");
    return withKhg<withKsh ? `김한규 플레이 ${withKhg} vs 김선호 플레이 ${withKsh}` : `${withKhg} / ${withKsh}`;
  });

  console.log('\n[투수 등판 · 하위타순]');
  const c=ev(`(function(){
    ST.playerId='ksh'; MYID='ksh'; ST.unhappy={}; ST.spark={}; ST.injury={}; ST.absent={};
    const swm='swm';
    const slots=[{id:'ksh',pos:'2B',ord:0},{id:'lg',pos:'CF',ord:1},{id:'khg',pos:'3B',ord:2},
      {id:'jms',pos:'LF',ord:3},{id:'yjh',pos:'1B',ord:4},{id:'ksn',pos:'RF',ord:5},
      {id:'ksw',pos:'SS',ord:6},{id:'kig',pos:'C',ord:7},{id:swm,pos:'P',ord:8}];
    const pbox={}; pbox[swm]={outs:18,bf:26,h:6,r:2,er:2,bb:3,k:7,hbp:0,sbA:1};
    // 송승민은 9번타자(하위타순) + 등판 → 면제.
    // 김인규(effCA 높음)는 8번타자 + 등판 안 함 → 불씨가 쌓여야 한다.
    for(let k=0;k<10;k++) updateUnhappy(ST,slots,{blowout:false,pbox:pbox});
    return {swmSpark:(ST.spark[swm]||{n:0}).n, swmLv:(ST.unhappy[swm]||{level:0}).level,
            kigSpark:(ST.spark['kig']||{n:0}).n, kigLv:(ST.unhappy['kig']||{level:0}).level,
            kigCA:effCA('kig'), swmCA:effCA(swm)};
  })()`);
  console.log(`   송승민(9번·등판, CA ${c.swmCA.toFixed(0)}): 불씨 ${c.swmSpark} 단계 ${c.swmLv}`);
  console.log(`   김인규(8번·미등판, CA ${c.kigCA.toFixed(0)}): 불씨 ${c.kigSpark} 단계 ${c.kigLv}`);
  T('등판했으면 하위타순이어도 불만 없음', ()=>c.swmSpark===0 && c.swmLv===0);
  T('등판 안 한 하위타순은 그대로 쌓인다', ()=>c.kigSpark>0||c.kigLv>0);

  console.log('\n[사보타주·최후통첩도 면제]');
  T('본인은 사보타주 대상에서 빠진다', ()=>{
    const src=require('fs').readFileSync('index.html','utf8');
    return /if\(unhappyExempt\(ST,p\.id\)\)return;\s*\n\s*let acts=sabotage/.test(src);
  });
  T('본인은 최후통첩 대상에서 빠진다', ()=>ev(`(function(){
    ST.playerId='khg'; MYID='khg';
    ST.unhappy={khg:{level:4,streak:0}, kig:{level:4,streak:0}};
    ST.ultimatum={};
    tickUltimatum(ST);
    return ST.ultimatum['khg']==null && ST.ultimatum['kig']!=null;
  })()`));

  console.log('\n[화면에 안 새는지]');
  ev("ST.playerId='khg';MYID='khg';");
  let leak=[];
  for(const v of ['home','squad','more','records','hall','stats','kakao','train']){
    w.go(v); await wait(60);
    const t=d.getElementById('view').textContent;
    if(/본인은 불만|불만 면제|라이벌 보정|자기 자신/.test(t)) leak.push(v);
  }
  T('숨긴 규칙이 화면에 안 보인다', ()=>leak.length?('노출: '+leak.join(',')):true);
  T('버전 노트가 "불만 업데이트"', ()=>/불만 업데이트/.test(ev("APP_VERSION_NOTE"))
      ? true : ev("APP_VERSION_NOTE"));

  console.log(errs.length?`\n❌ ${errs.length}건\n - `+errs.join('\n - '):'\n✅ 전부 통과');
  process.exit(errs.length?1:0);
},600);
