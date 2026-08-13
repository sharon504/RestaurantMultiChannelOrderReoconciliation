import { mkdirSync, writeFileSync } from 'node:fs'; import { order } from './engine.js';
const date='2026-08-10';
export const fixture={date,orders:[
 order('pos','P-100','pos',date,'Ada','09:00',{gross:1200,platformDiscount:0,commission:0,paid:1200}),
 order('app','A-200','app',date,'Ben','10:00',{gross:1500,platformDiscount:100,commission:0,paid:1400}),
 order('agg1','G1-300','agg1',date,'Cy','11:00',{gross:2000,platformDiscount:200,commission:300,paid:1500}),
 order('agg2','G2-400','agg2',date,'Dee','12:00',{gross:1800,platformDiscount:0,commission:270,paid:1530}),
 order('app','A-500','app',date,'Eve','13:00',{gross:900,platformDiscount:0,commission:0,paid:0}),
 order('pos','P-600','pos',date,'Fox','14:00',{gross:800,platformDiscount:0,commission:0,paid:800}),
 order('agg1','G1-700','agg1',date,'Gia','15:00',{gross:1000,platformDiscount:0,commission:150,paid:850},'cancelled'),
 order('app','A-801','app',date,'Ivy','16:00',{gross:500,platformDiscount:0,commission:0,paid:500}),
 order('app','A-802','app',date,'Ivy','16:03',{gross:500,platformDiscount:0,commission:0,paid:500})],
 kitchen:[['K-1','P-100'],['K-2','A-200'],['K-3','G1-300'],['K-4','G2-400'],['K-5','A-500'],['K-6','G1-700'],['K-7','A-801'],['K-8','A-802']],
 settlements:[{source:'agg1',externalId:'S-300',orderRef:'G1-300',businessDate:date,settled:1500,commission:250,platformDiscount:200,receivedAt:'2026-08-12T09:00:00.000Z'},{source:'agg2',externalId:'S-400',orderRef:'G2-400',businessDate:date,settled:1480,commission:270,platformDiscount:50,receivedAt:'2026-08-12T09:00:00.000Z'},{source:'agg1',externalId:'S-UNKNOWN',orderRef:'G1-NOT-INGESTED',businessDate:date,settled:700,commission:100,platformDiscount:0,receivedAt:'2026-08-13T09:00:00.000Z'}]};
export function writeFixtures(){mkdirSync('data',{recursive:true});writeFileSync('data/orders.json',JSON.stringify(fixture.orders,null,2));writeFileSync('data/kitchen.json',JSON.stringify(fixture.kitchen.map(([externalId,orderRef])=>({source:'kitchen',externalId,orderRef,cookedAt:`${date}T18:00:00.000Z`})),null,2));writeFileSync('data/settlements.json',JSON.stringify(fixture.settlements,null,2));writeFileSync('data/ground-truth.json',JSON.stringify({date,close:{orderCount:9,gross:10200,platformDiscount:300,commission:720,paid:8280,revenue:7560,exceptionReasons:{COOKED_UNPAID:1,PAID_UNCOOKED:1,CANCELLED_AFTER_COOKING:1,AMBIGUOUS_DUPLICATE:2}},postSettlement:{exceptionReasons:{COMMISSION_MISMATCH:1,DISCOUNT_MISMATCH:1,UNMATCHED_SETTLEMENT:1,SETTLEMENT_TIMING:1,SETTLEMENT_VARIANCE:2},adjustments:[{settlementId:'settlement_agg1_S-300',orderId:'order_agg1_G1-300',component:'commission',reason:'COMMISSION_MISMATCH',amount:50},{settlementId:'settlement_agg2_S-400',orderId:'order_agg2_G2-400',component:'discount',reason:'DISCOUNT_MISMATCH',amount:-50}],adjustmentTotal:0}},null,2));}
