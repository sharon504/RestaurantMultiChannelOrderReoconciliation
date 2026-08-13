import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path'; import { StoreData, emptyStore } from './domain.js';
export class Store { data:StoreData; constructor(public file='data/store.json'){ this.data=existsSync(file)?JSON.parse(readFileSync(file,'utf8')):emptyStore(); }
 save(){mkdirSync(dirname(this.file),{recursive:true});writeFileSync(this.file,JSON.stringify(this.data,null,2)+'\n');}
 reset(){this.data=emptyStore();this.save();}
}
