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
// 3-4-5x caps
for (const [mode,n,x] of [['craps',4,3],['craps',10,3],['craps',5,4],['craps',9,4],['craps',6,5],['crapless',2,3],['crapless',3,3],['crapless',11,3],['crapless',12,3],['crapless',5,4],['crapless',8,5]]) {
  const t=T(mode,{pass:1000},n); eq(C.add(t,'passOdds',100000).added,1000*x,mode+' pass odds on '+n);
  const u=T(mode,{['comeOn:'+n]:1000},4); eq(C.add(u,'comeOdds:'+n,100000).added,1000*x,mode+' come odds on '+n);
  eq(C.add(t,'passOdds',100).ok,false);
}
for (const [n,lay] of [[4,12000],[10,12000],[5,9000],[9,9000],[6,7200],[8,7200]]) { const t=T('craps',{dp:1000},n); eq(C.add(t,'dpOdds',100000).added,lay,'dp lay on '+n); }
// table limits
{ const t=T('craps',{}); let a=C.add(t,'pass',600000); eq([a.added, !!a.capped],[500000,true]); eq(C.add(t,'pass',100).ok,false);
  eq(C.add(t,'dp',900000).added,500000);
  t.point=6; eq(C.add(t,'come',700000).added,500000); eq(C.add(t,'dc',500001).added,500000);
  eq(C.add(t,'place:6',3000000).added,2500000); eq(C.add(t,'buy:4',2600000).added,2500000);
  eq(C.add(t,'lay:4',9e9).added,5000000,'lay 4 to win 25k'); eq(C.add(t,'lay:6',9e9).added,3000000); eq(C.add(t,'lay:9',9e9).added,3750000);
  eq(C.add(t,'passOdds',9e9).added,2500000,'5x of 5k on 6');
  eq(C.add(t,'field',9e9).added,500000); eq(C.add(t,'hard:8',9e9).added,100000); eq(C.add(t,'prop:horn',9e9).added,100000); eq(C.add(t,'prop:any7',9e9).added,100000); eq(C.add(t,'prop:ce',9e9).added,100000); }
{ const t=T('craps',{}); eq(C.add(t,'ats:all',9e9).added,100000); eq(C.add(t,'ats:small',150000).capped!=='',true); }
{ const t=T('crapless',{},4); eq(C.add(t,'lay:2',9e9).added,15000000); eq(C.add(t,'lay:11',9e9).added,7500000); eq(C.add(t,'place:12',9e9).added,2500000); }
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
  eq(C.moveBet(t,'place:9','place:5').ok,false);
  t.bets['place:5']=2500000; r=C.moveBet(t,'place:4','place:5'); eq(r.ok,false,'target at table max');
  t.bets['place:5']=2499900; r=C.moveBet(t,'place:4','place:5'); eq([r.moved,r.left],[100,500],'partial move'); }
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

console.log('all passed', n, 'asserts + 400k sim rolls');
