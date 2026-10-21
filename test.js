const C = require('./engine.js'); const assert = require('assert');
let n=0; const eq=(a,b,m)=>{n++; assert.deepStrictEqual(a,b,m);};
function T(mode, bets, point=null){ const t=C.newTable(mode); t.point=point; Object.assign(t.bets,bets); return t; }

// Craps come-out
let t=T('craps',{pass:1000,dp:1000}); let r=C.roll(t,3,4); eq(r.back,1000,'7 pays pass profit, keeps flat'); eq(t.bets,{pass:1000},'dp lost');
t=T('craps',{pass:1000,dp:1000}); r=C.roll(t,6,6); eq(t.bets,{dp:1000}); eq(r.back,0,'12: pass loses, dp push');
t=T('craps',{pass:1000,dp:1000}); r=C.roll(t,1,2); eq(t.bets,{dp:1000}); eq(r.back,1000);
t=T('craps',{pass:1000}); C.roll(t,2,4); eq(t.point,6);
// Pass odds on 6, 5x cap
eq(C.add(t,'passOdds',10000).added,5000);
r=C.roll(t,4,2); eq(r.back,1000+5000+6000,'point made: flat profit + odds back + 6:5'); eq(t.point,null); eq(t.bets,{pass:1000});
// seven out
t=T('craps',{pass:1000,passOdds:2000,dp:1000,dpOdds:2000},4); r=C.roll(t,3,4); eq(r.back,1000+2000+1000,'dp profit, lay odds 2000 wins 1000'); eq(t.bets,{dp:1000});
eq(C.canAdd(T('craps',{},4),'pass')!=='',true); eq(C.canAdd(T('crapless',{}),'dp')!=='',true);
// Place/buy/lay
t=T('craps',{'place:6':600,'place:4':500,'buy:4':2000,'lay:10':4000},6);
r=C.roll(t,2,2); eq(r.back,900+4000-100,'place4 9:5, buy4 2:1 minus $1'); eq(Object.keys(t.bets).length,4);
r=C.roll(t,3,4); eq(r.back,2000-100,'lay10 wins 2000 minus 5%'); eq(t.bets,{'lay:10':4000});
// place off on come-out
t=T('craps',{'place:6':600,'hard:6':500}); r=C.roll(t,3,4); eq(r.back,0); eq(t.bets,{'place:6':600,'hard:6':500});
// hardways
t=T('craps',{'hard:6':500,'hard:8':500},5); r=C.roll(t,3,3); eq(r.back,4500); r=C.roll(t,2,4); eq(t.bets,{'hard:8':500});
// come bets
t=T('craps',{come:1000},5); r=C.roll(t,5,6); eq(r.back,2000); eq(t.bets,{});
t=T('craps',{come:1000},5); C.roll(t,4,4); eq(t.bets,{'comeOn:8':1000});
eq(C.add(t,'comeOdds:8',9000).added,5000,'5x on 8'); r=C.roll(t,4,4); eq(r.back,1000+1000+5000+6000); eq(t.bets,{});
// come odds off on come-out
t=T('craps',{'comeOn:9':1000,'comeOdds:9':2000}); r=C.roll(t,5,2); eq(r.back,2000,'odds returned, flat lost'); eq(t.bets,{});
t=T('craps',{'comeOn:9':1000,'comeOdds:9':2000}); r=C.roll(t,5,4); eq(r.back,2000+2000); eq(t.point,9);
// new come bet does not get paid on same roll as existing come bet on number
t=T('craps',{'comeOn:5':1000,come:1000},8); r=C.roll(t,2,3); eq(r.back,2000); eq(t.bets,{'comeOn:5':1000});
// don't come
t=T('craps',{dc:1000},5); C.roll(t,6,6); eq(t.bets,{dc:1000});
C.roll(t,2,2); eq(t.bets,{'dcOn:4':1000}); C.add(t,'dcOdds:4',100000); eq(t.bets['dcOdds:4'],12000,'lay 4 to win 6x');
r=C.roll(t,3,4); eq(r.back,1000+1000+12000+6000);
// odds caps: regular craps runs flat 5x, crapless keeps the 3-4-5x ladder
for (const [mode,n,x] of [['craps',4,5],['craps',10,5],['craps',5,5],['craps',9,5],['craps',6,5],['craps',8,5],['crapless',2,3],['crapless',3,3],['crapless',11,3],['crapless',12,3],['crapless',5,4],['crapless',8,5]]) {
  const t=T(mode,{pass:1000},n); eq(C.add(t,'passOdds',100000).added,1000*x,mode+' pass odds on '+n);
  const u=T(mode,{['comeOn:'+n]:1000},4); eq(C.add(u,'comeOdds:'+n,100000).added,1000*x,mode+' come odds on '+n);
  eq(C.add(t,'passOdds',100).ok,false);
}
for (const [n,lay] of [[4,12000],[10,12000],[5,9000],[9,9000],[6,7200],[8,7200]]) { const t=T('craps',{dp:1000},n); eq(C.add(t,'dpOdds',100000).added,lay,'dp lay on '+n); }
// table limits: $25,000 on the line, $50,000 per place or buy. Everything
// else is capped only by the bankroll, and odds stay a multiple of the flat.
{ const t=T('craps',{}); let a=C.add(t,'pass',600000); eq([a.added, !!a.capped],[600000,false],'a bet under the line max is not capped');
  eq(C.add(T('craps',{}),'pass',9e8).added,2500000,'pass line caps at $25,000');
  eq(C.add(T('craps',{}),'dp',9e8).added,2500000,"don't pass caps at $25,000");
  eq(!!C.add(T('craps',{}),'pass',9e8).capped,true,'and it says so');
  const u=T('craps',{},6);
  eq(C.add(u,'come',9e8).added,2500000,'come caps at $25,000');
  eq(C.add(u,'dc',9e8).added,2500000,"don't come caps at $25,000");
  eq(C.add(u,'place:6',9e8).added,5000000,'place caps at $50,000');
  eq(C.add(T('craps',{},6),'buy:4',9e8).added,5000000,'buy caps at $50,000');
  eq(C.maxFor(u,'place:8'),5000000,'each number carries its own $50,000');
  eq(C.add(T('craps',{},6),'field',9e8).added,1000000,'field caps at $10,000');
  eq(C.add(T('craps',{},6),'hard:8',9e8).added,1000000,'hardways cap at $10,000');
  eq(C.add(T('craps',{},6),'prop:horn',9e8).added,500000,'props cap at $5,000');
  // a lay is capped by what it wins, so the stake it allows follows the number
  for (const [n,stake] of [[4,10000000],[10,10000000],[5,7500000],[9,7500000],[6,6000000],[8,6000000]])
    eq(C.add(T('craps',{},6),'lay:'+n,9e8).added,stake,'lay '+n+' may risk '+stake/100+' to win $50,000');
  // odds are a multiple of the flat bet, which is a rule rather than a limit,
  // so a maxed line bet can still back up 5x behind it
  const v=T('craps',{pass:2500000},6);
  eq(C.add(v,'passOdds',9e9).added,2500000*5,'a $25,000 pass line backs up $125,000 on the 6'); }
{ const t=T('craps',{}); eq(C.add(t,'ats:all',9e8).added,500000,"make 'em all carries the $5,000 prop limit"); }
{ const t=T('crapless',{},4);
  // the extra crapless numbers are long odds against, so the stake that wins
  // $50,000 is correspondingly large
  eq(C.add(t,'lay:2',9e8).added,30000000,'crapless lay 2 may risk $300,000 to win $50,000');
  eq(C.add(t,'lay:11',9e8).added,15000000,'crapless lay 11 may risk $150,000 to win $50,000');
  eq(C.add(t,'place:12',9e8).added,5000000,'crapless place 12 carries the same $50,000 cap'); }
// field & props
t=T('craps',{field:1000,'prop:twelve':100,'prop:horn':400,'prop:ce':200,'prop:anyCraps':100}); r=C.roll(t,6,6);
eq(r.back,3000+3000+2700+600+700,'field 3x, twelve 30, horn 27u, ce 3x, craps 7x');
t=T('craps',{field:1000,'prop:any7':100}); r=C.roll(t,3,4); eq(r.back,400); eq(t.bets,{'prop:any7':100});
t=T('craps',{'prop:ce':100,'prop:horn':400}); r=C.roll(t,5,6); eq(r.back,700+1200);
// crapless
t=T('crapless',{pass:1000}); C.roll(t,1,1); eq(t.point,2); eq(C.add(t,'passOdds',5000).added,3000); r=C.roll(t,1,1); eq(r.back,1000+3000+18000);
t=T('crapless',{pass:1000}); r=C.roll(t,5,6); eq(t.point,11); eq(r.back,0);
t=T('crapless',{come:1000},4); C.roll(t,6,6); eq(t.bets,{'comeOn:12':1000});
t=T('crapless',{'place:3':400,'place:12':200,'buy:2':1000},6); r=C.roll(t,1,2); eq(r.back,1100); r=C.roll(t,1,1); eq(r.back,6000-50);
r=C.roll(t,6,6); eq(r.back,1100);
// ATS
t=T('craps',{'ats:small':100,'ats:all':100}); for (const [a,b] of [[1,1],[1,2],[2,2],[2,3],[3,3]]) r=C.roll(t,a,b);
eq(r.back,100+3400); eq(C.canAdd(t,'ats:tall')!=='',true); eq(C.canRemove(t,'ats:all')!=='',true);
r=C.roll(t,3,4); eq(t.bets,{}); eq(t.atsHits,[]); eq(C.canAdd(t,'ats:tall'),'');
// moving bets between numbers
{ const t=T('craps',{'place:9':600},4); let r=C.moveBet(t,'place:9','place:4'); eq([r.ok,r.moved],[true,600]); eq(t.bets,{'place:4':600});
  eq(C.moveBet(t,'place:9','place:5').ok,false,'nothing on 9 to move');
  // with no table max a move always goes in full, however big the target already is
  t.bets['place:5']=2500000; r=C.moveBet(t,'place:4','place:5');
  eq([r.ok,r.moved,r.left],[true,600,0],'the whole bet moves');
  eq(C.amt(t,'place:5'),2500600,'and lands on top of what was there'); }
{ const t=T('crapless',{'buy:12':1000},5); eq(C.moveBet(t,'buy:12','buy:2').moved,1000); eq(C.moveBet(t,'buy:2','buy:7').ok,false); }
// removal
t=T('craps',{pass:1000,passOdds:2000,'place:6':600},6); eq(C.remove(t,'pass').ok,false); eq(C.removeAll(t),2600); eq(t.bets,{pass:1000});
t=T('craps',{pass:1000,passOdds:0}); eq(C.remove(t,'pass').removed,1000);
// random sim: money conservation (bank + on table changes only by net)
function rnd(){return 1+Math.floor(Math.random()*6);}
for (const mode of ['craps','crapless']) { const t=C.newTable(mode); let bank=1e9;
  const keys=['pass','passOdds','dp','dpOdds','come','dc','field','hard:4','hard:10','prop:horn','prop:ce','prop:any7','ats:all','ats:small',
   ...C.MODES[mode].points.flatMap(n=>['place:'+n,'buy:'+n,'lay:'+n,'comeOdds:'+n,'dcOdds:'+n])];
  for (let i=0;i<200000;i++){ for (let j=0;j<3;j++){ const k=keys[Math.floor(Math.random()*keys.length)]; const a=C.add(t,k,100*(1+Math.floor(Math.random()*20))); if(a.ok) bank-=a.added; }
    if (Math.random()<.05){ bank+=C.removeAll(t);} 
    const before=bank+C.onTable(t); const r=C.roll(t,rnd(),rnd()); bank+=r.back;
    assert.strictEqual(bank+C.onTable(t)-before, r.net, 'conservation '+mode+' '+JSON.stringify(r));
    for (const k in t.bets) assert.ok(t.bets[k]>0 && Number.isInteger(t.bets[k]), k);
  }
}
/* ---- working and off ---- */
{
  const T = () => { const t = C.newTable('craps'); C.add(t, 'place:6', 1200); return t; };
  // the default: off on the come-out, so a six neither pays nor a seven takes it
  let t = T();
  eq(C.isWorking(t, 'place:6'), false, 'place bets sit off on the come-out by default');
  eq(C.roll(t, 3, 3).net, 0, 'a six on the come-out pays nothing when the bet is off');
  eq(C.amt(T(), 'place:6'), 1200, 'and the bet is still there');
  t = T();
  eq(C.roll(t, 3, 4).net, 0, 'a seven on the come-out costs nothing when the bet is off');
  eq(C.amt(t, 'place:6'), 1200, 'the bet survives the seven');

  // turned on for the come-out, it plays for real both ways
  t = T(); t.working = true;
  eq(C.isWorking(t, 'place:6'), true, 'the table can be set to working');
  eq(C.roll(t, 3, 3).net, 1400, 'a working six on the come-out pays 7 to 6');
  t = T(); t.working = true;
  eq(C.roll(t, 3, 4).net, -1200, 'and a working bet loses to the seven');

  // calling one bet off by hand, with a point on
  t = T(); t.point = 8;
  eq(C.isWorking(t, 'place:6'), true, 'bets work once a point is set');
  eq(C.toggleOff(t, 'place:6'), true, 'a place bet can be called off');
  eq(C.isWorking(t, 'place:6'), false, 'and then it is off');
  eq(C.roll(t, 3, 4).net, 0, 'an off bet is not lost to the seven');
  t = T(); t.point = 8; C.toggleOff(t, 'place:6');
  eq(C.roll(t, 3, 3).net, 0, 'nor does it get paid');
  C.toggleOff(t, 'place:6');
  eq(C.isWorking(t, 'place:6'), true, 'tapping again turns it back on');

  // lays keep working on the come-out, the way they do on a real table
  const l = C.newTable('craps');
  C.add(l, 'lay:4', 2000);
  eq(C.isWorking(l, 'lay:4'), true, 'lay bets work on the come-out');
  eq(C.roll(l, 3, 4).net > 0, true, 'so a come-out seven pays the lay');

  // line bets are never off
  const pl = C.newTable('craps');
  C.add(pl, 'pass', 500);
  eq(C.isWorking(pl, 'pass'), true, 'the pass line is always working');
  eq(C.canToggle(pl, 'pass'), false, 'and cannot be called off');

  // come odds come back rather than being lost when they are off
  const co = C.newTable('craps');
  co.point = 5; C.add(co, 'come', 500);
  C.roll(co, 3, 3);                      // the come bet travels to the six
  C.add(co, 'comeOdds:6', 600);
  co.point = null;                       // back to a come-out
  eq(C.isWorking(co, 'comeOdds:6'), false, 'come odds are off on the come-out');
  const r = C.roll(co, 3, 4);
  eq(r.ev.some(e => e.k === 'comeOdds:6' && e.r === 'push'), true, 'off odds are returned, not lost');

  // taking a bet down clears its off flag
  const rm = T(); rm.point = 8; C.toggleOff(rm, 'place:6');
  C.remove(rm, 'place:6');
  eq(!rm.off['place:6'], true, 'removing a bet forgets that it was off');
}

/* ---- each bet carries its own working setting ---- */
{
  // work just the hard four on the come-out, leave everything else alone
  const t = C.newTable('craps');
  C.add(t, 'hard:4', 500); C.add(t, 'place:6', 1200); C.add(t, 'place:8', 1200);
  eq(C.setState(t, 'hard:4', 'working'), true, 'a single bet can be set working');
  eq(C.isWorking(t, 'hard:4'), true, 'the hard four works on the come-out');
  eq(C.isWorking(t, 'place:6'), false, 'while the place bets stay off');
  eq(C.isWorking(t, 'place:8'), false, 'all of them');
  eq(C.roll(t, 2, 2).net, 3500, 'a come-out hard four pays 7 to 1 on its own');

  const u = C.newTable('craps');
  C.add(u, 'hard:4', 500); C.add(u, 'place:6', 1200);
  C.setState(u, 'hard:4', 'working');
  eq(C.roll(u, 3, 4).net, -500, 'the seven takes only the working bet');
  eq(C.amt(u, 'place:6'), 1200, 'the off place bet survives it');

  // the three states cycle in order
  const c = C.newTable('craps');
  C.add(c, 'place:5', 1000);
  eq(C.betState(c, 'place:5'), 'auto', 'bets start on the house default');
  eq(C.cycleState(c, 'place:5'), 'working', 'first tap sets it working');
  eq(C.cycleState(c, 'place:5'), 'off', 'second tap turns it off');
  eq(C.cycleState(c, 'place:5'), 'auto', 'third tap puts it back to default');

  // a bet set off stays off even once a point is on
  const o = C.newTable('craps');
  C.add(o, 'place:9', 1000);
  C.setState(o, 'place:9', 'off');
  o.point = 6;
  eq(C.isWorking(o, 'place:9'), false, 'an off bet stays off with a point on');
  eq(C.roll(o, 3, 4).net, 0, 'and the seven cannot take it');

  // a bet set working stays working through a point, which is the default anyway
  const w = C.newTable('craps');
  C.add(w, 'place:9', 1000);
  C.setState(w, 'place:9', 'working');
  w.point = 6;
  eq(C.isWorking(w, 'place:9'), true, 'a working bet is live with a point on too');

  // the table-wide switch only moves bets left on auto
  const g = C.newTable('craps');
  C.add(g, 'place:6', 1200); C.add(g, 'place:8', 1200);
  C.setState(g, 'place:8', 'off');
  g.working = true;
  eq(C.isWorking(g, 'place:6'), true, 'the come-out switch turns on the auto bet');
  eq(C.isWorking(g, 'place:8'), false, 'but leaves a bet you set off alone');

  // settings do not outlive the bet
  const r = C.newTable('craps');
  C.add(r, 'place:4', 1000);
  C.setState(r, 'place:4', 'working');
  C.remove(r, 'place:4');
  eq(C.betState(r, 'place:4'), 'auto', 'taking a bet down forgets its setting');
}

/* ---- keeping come bets up ---- */
{
  const setup = keep => { const t = C.newTable('craps'); t.point = 5;
    t.bets = { 'comeOn:8': 1000, 'comeOdds:8': 5000 }; t.keepCome = keep; return t; };

  // off: the flat and the odds both come back
  let t = setup(false), r = C.roll(t, 4, 4);
  eq(r.back, 1000 + 1000 + 6000 + 5000, 'come win returns flat, odds and both profits');
  eq(t.bets, {}, 'and nothing is left on the number');

  // on: the flat rides again, so only the profit comes back
  t = setup(true); r = C.roll(t, 4, 4);
  eq(r.back, 1000 + 6000 + 5000, 'keeping it up returns the profits and the odds, not the flat');
  eq(r.kept, 1000, 'the flat is the part kept up');
  eq(t.bets, { come: 1000 }, 'the flat waits in the come box');

  // it must not travel again on the roll it won on
  t = setup(true); C.roll(t, 4, 4);
  eq(C.amt(t, 'comeOn:8'), 0, 'the kept bet does not jump straight back onto the 8');
  r = C.roll(t, 3, 3);
  eq(C.amt(t, 'comeOn:6'), 1000, 'it travels on the next roll like any come bet');

  // a kept bet behaves like a normal come bet from there, including a seven out
  t = setup(true); C.roll(t, 4, 4); C.roll(t, 3, 3);
  r = C.roll(t, 3, 4);
  eq(C.amt(t, 'comeOn:6'), 0, 'and it can be lost to the seven');

  // keeping up does not change what a losing come bet does
  t = setup(true); r = C.roll(t, 3, 4);
  eq(r.kept, 0, 'nothing is kept up when the come bet loses');
}



/* ---- hand length ----------------------------------------------------------
   A hand runs from a come-out to a seven-out, counting every roll including
   the seven. The milestone odds are checked here against an exact Markov walk
   over {come-out, 4, 5, 6, 8, 9, 10} rather than a simulation, so a typo in
   the table fails the suite instead of looking plausible. */
{
  const P = s => [0,0,1,2,3,4,5,6,5,4,3,2,1][s] / 36;
  const PTS = [4,5,6,8,9,10];
  // state 0 is the come-out; 1..6 are the points above
  let v = [1,0,0,0,0,0,0], alive = [1];
  for (let k = 1; k <= 400; k++) {
    const w = [0,0,0,0,0,0,0];
    w[0] += v[0] * (P(7)+P(11)+P(2)+P(3)+P(12));          // come-out survives
    PTS.forEach((p,i) => { w[i+1] += v[0] * P(p); });      // point established
    PTS.forEach((p,i) => {
      w[0] += v[i+1] * P(p);                               // point made, back to come-out
      w[i+1] += v[i+1] * (1 - P(p) - P(7));                // nothing doing
    });                                                    // P(7) leaks out: seven out
    v = w;
    alive.push(v.reduce((a,b)=>a+b,0));
  }
  const mean = alive.reduce((a,b)=>a+b,0);
  eq(Math.abs(mean - 8.5255) < 0.001, true, 'mean hand is 8.53 rolls');

  // alive[n-1] is P(hand reaches n rolls)
  C.MILESTONES.filter(m => m <= 200).forEach(m => {
    const exact = 1 / alive[m-1];
    // the table stores rounded integers, so a half either way is fine
    const slack = Math.max(0.5, exact * 0.005);
    eq(Math.abs(C.handOdds(m) - exact) <= slack, true,
      m + ' rolls is 1 in ' + Math.round(exact) + ', table says ' + C.handOdds(m));
  });
  eq(C.handOdds(10), 3, '10 rolls is 1 in 3, so the reaction there stays small');
  eq(C.handOdds(20), 14, '20 rolls is 1 in 14');
  eq(C.handOdds(50), 1161, '50 rolls is 1 in 1,161');
  eq(C.handOdds(100) > 1.8e6 && C.handOdds(100) < 2e6, true, '100 rolls is about 1 in 1.9 million');
  // past the table it extrapolates off the tail ratio, which must stay monotonic
  eq(C.handOdds(250) > C.handOdds(200), true, 'the extrapolation keeps climbing');
  eq(C.handOdds(201) > C.handOdds(200), true, 'and it climbs one roll at a time');

  // the counter itself
  let h = C.newTable('craps');
  eq(h.hand, 0, 'a new table has no hand going');
  let rr = C.roll(h, 3, 4); eq([rr.hand, rr.handOver], [1, false], 'a come-out seven is one roll, hand alive');
  rr = C.roll(h, 2, 2); eq([rr.hand, h.point], [2, 4], 'point established on roll two');
  rr = C.roll(h, 2, 2); eq([rr.hand, rr.pointMade, h.point], [3, true, null], 'point made, hand still going');
  rr = C.roll(h, 3, 4); eq([rr.hand, rr.handOver], [4, false], 'a seven back on the come-out is a winner, not a seven out');
  rr = C.roll(h, 2, 3); eq([rr.hand, h.point], [5, 5], 'new point on roll five');
  rr = C.roll(h, 3, 4); eq([rr.hand, rr.handOver], [6, true], 'now the seven ends it, on roll six');
  rr = C.roll(h, 2, 2); eq(rr.hand, 1, 'and the next roll starts a fresh hand');
}
console.log('all passed', n, 'asserts + 400k sim rolls');
