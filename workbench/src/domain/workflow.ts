/** Pure simulation: no system execution or authorization. */
export type RunStatus = 'pending'|'running'|'waiting-approval'|'succeeded'|'failed'|'cancelled';
export type Action = 'start'|'approve'|'finish'|'cancel'|'fail'|'reset';
export interface Step {readonly id:string; readonly label:string; readonly approval?:string;}
export interface Workflow {readonly id:string; readonly version:string; readonly name:string; readonly description:string; readonly inputs:readonly string[]; readonly steps:readonly Step[];}
export interface Event {readonly stepId:string; readonly status:RunStatus;}
export interface Run {readonly workflowId:string; readonly version:string; readonly status:RunStatus; readonly cursor:number; readonly steps:readonly RunStatus[]; readonly events:readonly Event[]; readonly inputs:Readonly<Record<string,string>>;}
export function missingInputs(def:Workflow,inputs:Readonly<Record<string,string>>):readonly string[] {
 return def.inputs.filter(key=>!inputs[key]?.trim());
}
export function bindInputs(def:Workflow,run:Run,inputs:Readonly<Record<string,string>>):Run {
 if(run.status!=='pending') return run;
 return {...run,inputs:Object.fromEntries(def.inputs.map(key=>[key,inputs[key]??'']))};
}
export function createRun(def:Workflow):Run {
 if(!def.steps.length || new Set(def.steps.map(s=>s.id)).size!==def.steps.length) throw new Error('Workflow requires unique, nonempty steps');
 return {workflowId:def.id,version:def.version,status:'pending',cursor:0,steps:def.steps.map(()=>'pending'),events:[],inputs:{}};
}
export function actionsFor(run:Run):readonly Action[] {
 switch(run.status){
  case 'pending':return ['start'];
  case 'waiting-approval':return ['approve','cancel'];
  case 'running':return ['finish','fail','cancel'];
  default:return ['reset'];
 }
}
export function transition(def:Workflow,run:Run,action:Action):Run {
 if(run.workflowId!==def.id || run.version!==def.version) throw new Error('Definition does not match execution snapshot');
 if(!actionsFor(run).includes(action)) return run;
 if(action==='start' && missingInputs(def,run.inputs).length) return run;
 if(action==='reset') return createRun(def);
 let cursor=run.cursor;
 const steps=[...run.steps],events=[...run.events];
 const record=(status:RunStatus)=>{steps[cursor]=status;events.push({stepId:def.steps[cursor].id,status});};
 const enter=():RunStatus=>def.steps[cursor].approval?'waiting-approval':'running';
 let status:RunStatus;
 if(action==='start'){status=enter();record(status);}
 else if(action==='approve'){status='running';record(status);}
 else if(action==='finish'){
  record('succeeded');
  if(cursor===def.steps.length-1) status='succeeded';
  else {cursor++;status=enter();record(status);}
 } else {status=action==='cancel'?'cancelled':'failed';record(status);}
 return {...run,cursor,status,steps,events};
}
