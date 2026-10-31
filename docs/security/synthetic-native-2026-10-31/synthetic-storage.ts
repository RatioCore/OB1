// Disposable in-memory storage only. No network or credentials.
export type Row = Record<string, any>;
export const tables: Record<string, Row[]> = {};
export const calls: Row[] = [];
export function reset() { for (const k of Object.keys(tables)) delete tables[k]; calls.length=0; }
class Query {
  filters: ((r:Row)=>boolean)[]=[]; operation='select'; payload:any; one=false; offset=0; count=Infinity; columns='*'; result:any;
  constructor(public table:string) {}
  select(columns='*') {this.columns=columns;return this;}
  eq(k:string,v:any){this.filters.push(r=>r[k]===v);return this;}
  in(k:string,v:any[]){this.filters.push(r=>v.includes(r[k]));return this;}
  like(k:string,v:string){this.filters.push(r=>String(r[k]||'').startsWith(v.replace(/%$/,'')));return this;}
  order(..._args:any[]){return this;}
  limit(n:number){this.count=n;return this;}
  range(a:number,b:number){this.offset=a;this.count=b-a+1;return this;}
  insert(p:any){this.operation='insert';this.payload=p;return this;}
  update(p:any){this.operation='update';this.payload=p;return this;}
  single(){this.one=true;return this;}
  maybeSingle(){this.one=true;return this;}
  then<TResult1 = any, TResult2 = never>(resolve?: ((value:any)=>TResult1|PromiseLike<TResult1>)|null,reject?: ((reason:any)=>TResult2|PromiseLike<TResult2>)|null): Promise<TResult1|TResult2> { try {
    if(!this.result){
      const rows=tables[this.table] ||= [];
      let found=rows.filter(r=>this.filters.every(f=>f(r)));
      if(this.operation==='insert') {found=(Array.isArray(this.payload)?this.payload:[this.payload]).map((r:any)=>({id:`synthetic-${this.table}-${rows.length+1}`,request_id:`request-${rows.length+1}`,...r}));rows.push(...found);}
      if(this.operation==='update') for(const row of found)Object.assign(row,this.payload);
      found=found.slice(this.offset,this.offset+this.count);
      let data=structuredClone(found);
      if(this.columns.includes('agent_memories('))data=data.map((r:any)=>({...r,agent_memories:structuredClone((tables.agent_memories||[]).find(m=>m.id===r.memory_id))}));
      calls.push({table:this.table,operation:this.operation,count:found.length});
      this.result={data:this.one?(data[0]||null):data,error:null};
    }
    return Promise.resolve(this.result).then(resolve,reject);
  }catch(e){return Promise.reject(e).then(resolve,reject);}}
}
export function createClient(url:string,key:string): any {
  if(url!=='https://synthetic.invalid'||key!=='synthetic-fixture-only') throw Error('Non-synthetic client refused');
  return {from:(name:string)=>new Query(name),rpc:(name:string)=>{
    if(name!=='match_thoughts')throw Error('Unexpected RPC '+name);
    return Promise.resolve({data:(tables.agent_memories||[]).map(m=>({id:m.thought_id,similarity:0.9})),error:null});
  }};
}
