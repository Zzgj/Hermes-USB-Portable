import type {Capability} from './capability';
import type {ChatTurn} from './chat-events';

export type FingerprintStatus='match'|'mismatch'|'missing';
export interface FingerprintCheck{
 readonly status:FingerprintStatus;
 readonly skillName:string;
 readonly expected:string;
 readonly actual?:string;
}
/** Re-verify the card's declared fingerprint against the live instance catalog; never trust imported JSON. */
export function verifyMethodFingerprint(card:Capability,catalog:readonly Capability[]):FingerprintCheck{
 const found=catalog.find(item=>item.method.name===card.method.name);
 if(!found)return {status:'missing',skillName:card.method.name,expected:card.method.fingerprint};
 return {
  status:found.method.fingerprint===card.method.fingerprint?'match':'mismatch',
  skillName:card.method.name,
  expected:card.method.fingerprint,
  ...(found.method.fingerprint!==card.method.fingerprint?{actual:found.method.fingerprint}:{})
 };
}
/** Build a natural-language prompt for prompt.submit; this is NOT a command.dispatch wrapper. */
export function buildExecutionPrompt(card:Capability,params:Readonly<Record<string,string>>):string{
 const lines=card.inputs.map(input=>`- ${input.label}: ${params[input.id]??''}`);
 return [
  `能力: ${card.name}`,
  `目标: ${card.goal}`,
  card.method.kind==='skill'?`引用 Skill: ${card.method.name}`:`引用 Bundle: ${card.method.name}`,
  '',
  '本次参数:',
  ...lines,
 ].join('\n');
}
export type ExecutionPhase='idle'|'verified'|'mismatch'|'missing'|'observing'|'complete'|'failed'|'interrupted'|'unknown';
export interface ExecutionState{
 readonly capabilityId:string;
 readonly check:FingerprintCheck;
 readonly prompt:string;
 readonly confirmed:boolean;
}
/** Derive the observed execution phase from execution state, current turn and connection.
 *  Model turn completion is NOT business verification; disconnection during streaming is unknown. */
export function deriveExecutionPhase(execution:ExecutionState|null,turn:ChatTurn|null,disconnected:boolean):ExecutionPhase{
 if(!execution)return 'idle';
 if(!execution.confirmed)return execution.check.status==='match'?'verified':execution.check.status;
 if(!turn)return 'unknown';
 if(disconnected&&turn.status==='streaming')return 'unknown';
 switch(turn.status){
  case 'streaming':return 'observing';
  case 'complete':return 'complete';
  case 'failed':return 'failed';
  case 'interrupted':return 'interrupted';
  default:return 'unknown';
 }
}
