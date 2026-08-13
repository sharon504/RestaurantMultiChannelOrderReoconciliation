import { readFileSync } from 'node:fs'; import { ReconciliationService } from './engine.js'; import { fixture, writeFixtures } from './fixtures.js';
const svc=new ReconciliationService();const cmd=process.argv[2];const json=(file:string)=>JSON.parse(readFileSync(file,'utf8'));
if(cmd==='generate'){writeFixtures();console.log('Generated deterministic feeds in data/');}
else if(cmd==='ingest-orders'){svc.ingestOrders(json('data/orders.json'));console.log('Orders ingested');}
else if(cmd==='ingest-kitchen'){svc.ingestKitchen(json('data/kitchen.json'));console.log('Kitchen confirmations ingested');}
else if(cmd==='reconcile')console.log(JSON.stringify(svc.reconcile(process.argv[3]||fixture.date),null,2));
else if(cmd==='close')console.log(JSON.stringify(svc.close(process.argv[3]||fixture.date),null,2));
else if(cmd==='ingest-settlement'){svc.ingestSettlements(json(process.argv[3]||'data/settlements.json'));console.log('Settlement file ingested');}
else if(cmd==='adjust')console.log(JSON.stringify(svc.adjust(),null,2));
else if(cmd==='validate'){const d=svc.list(), truth=json('data/ground-truth.json');const reasons=new Set(d.exceptions.map((x:any)=>x.reason));const ok=truth.exceptionReasons.every((x:string)=>reasons.has(x))&&d.adjustments.some((x:any)=>x.amount===truth.adjustmentAmount);console.log(JSON.stringify({valid:ok,closes:d.closes.length,adjustments:d.adjustments.length},null,2));if(!ok)process.exitCode=1;}
else if(cmd==='demo'){svc.store.reset();writeFixtures();svc.ingestOrders(fixture.orders);svc.ingestKitchen(fixture.kitchen.map(([externalId,orderRef])=>({source:'kitchen',externalId,orderRef,cookedAt:`${fixture.date}T18:00:00.000Z`})));const close=svc.close(fixture.date);svc.ingestSettlements(fixture.settlements);const adjustments=svc.adjust();console.log(JSON.stringify({close,adjustments,validation:'run pnpm validate'},null,2));}
else console.log('Commands: generate, ingest-orders, ingest-kitchen, reconcile, close, ingest-settlement, adjust, validate, demo');
