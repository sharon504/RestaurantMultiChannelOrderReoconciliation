export type Channel = 'pos'|'app'|'agg1'|'agg2';
export type Status = 'paid'|'cancelled';
export type Reason = 'COOKED_UNPAID'|'PAID_UNCOOKED'|'CANCELLED_AFTER_COOKING'|'COMMISSION_MISMATCH'|'DISCOUNT_MISMATCH'|'AMBIGUOUS_DUPLICATE'|'SETTLEMENT_TIMING'|'SETTLEMENT_VARIANCE';
export interface Money { gross:number; platformDiscount:number; commission:number; paid:number }
export interface Order { id:string; source:string; externalId:string; channel:Channel; businessDate:string; occurredAt:string; customer:string; status:Status; money:Money; ingestedAt:string }
export interface Kitchen { id:string; source:string; externalId:string; orderRef:string; cookedAt:string; ingestedAt:string }
export interface Settlement { id:string; source:string; externalId:string; orderRef:string; businessDate:string; settled:number; commission:number; platformDiscount:number; receivedAt:string }
export interface Exception { id:string; date:string; reason:Reason; orderId?:string; kitchenId?:string; settlementId?:string; sourceIds:string[]; detail:string; createdAt:string }
export interface Close { id:string; date:string; createdAt:string; orderIds:string[]; revenue:number; gross:number; platformDiscount:number; commission:number; paid:number; exceptionIds:string[] }
export interface Adjustment { id:string; closeId:string; settlementId:string; orderId:string; amount:number; reason:Reason; createdAt:string }
export interface StoreData { orders:Order[]; kitchens:Kitchen[]; settlements:Settlement[]; exceptions:Exception[]; closes:Close[]; adjustments:Adjustment[] }
export const emptyStore=():StoreData=>({orders:[],kitchens:[],settlements:[],exceptions:[],closes:[],adjustments:[]});
export const id=(kind:string, source:string, external:string)=>`${kind}_${source}_${external}`.replace(/[^a-zA-Z0-9_:-]/g,'_');
