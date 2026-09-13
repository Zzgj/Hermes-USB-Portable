/** Dual-channel update model: Hermes kernel uses the official updater; the Portable shell uses an independent package channel.
 Neither channel auto-applies; both require explicit user confirmation after a read-only check.
 Compatibility unknown does not auto-block but must be surfaced. Offline backoff prevents hammering the network. */
export type UpdateChannel='kernel'|'shell';
export type CheckOutcome='idle'|'checking'|'up-to-date'|'available'|'not-available'|'incompatible'|'offline'|'failed';
export interface UpdateSummary{
 readonly channel:UpdateChannel;
 readonly outcome:CheckOutcome;
 readonly currentVersion:string;
 readonly latestVersion?:string;
 readonly releaseNotes?:string;
 readonly checkedAt:string;
 readonly retryAfterMs:number;
}
export interface UpdatePlan{
 readonly channel:UpdateChannel;
 readonly targetVersion:string;
 readonly backup:boolean;
 readonly changelogSummary:string;
 readonly compatibilityGate:'passed'|'unknown'|'blocked';
}
const MIN_RETRY_MS=60_000,MAX_RETRY_MS=3_600_000;
export function nextRetryDelay(failures:number):number{
 const base=Math.min(MAX_RETRY_MS,MIN_RETRY_MS*Math.pow(2,Math.min(failures,5)));
 return base+Math.floor(Math.random()*5_000);
}
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const versionText=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=128;
export function decodeUpdateCheck(value:unknown,channel:UpdateChannel,currentVersion:string,failures:number):UpdateSummary{
 if(!object(value)||!versionText(value.currentVersion))throw new Error('Invalid update check');
 if(!['up-to-date','available','not-available','incompatible','offline'].includes(value.outcome as string))throw new Error('Invalid update check');
 const outcome=value.outcome as CheckOutcome;
 return {
  channel,
  outcome,
  currentVersion:value.currentVersion,
  ...(versionText(value.latestVersion)?{latestVersion:value.latestVersion}:{}),
  ...(typeof value.releaseNotes==='string'&&value.releaseNotes.length<=4000?{releaseNotes:value.releaseNotes}:{}),
  checkedAt:new Date().toISOString(),
  retryAfterMs:outcome==='offline'||outcome==='failed'?nextRetryDelay(failures):0,
 };
}
export function deriveUpdateOutcome(raw:{readonly ok:boolean;readonly status?:number;readonly body?:unknown},channel:UpdateChannel,currentVersion:string,failures:number):UpdateSummary{
 if(!raw.ok){
  if(raw.status===0||raw.status===undefined)return {channel,outcome:'offline',currentVersion,checkedAt:new Date().toISOString(),retryAfterMs:nextRetryDelay(failures)};
  return {channel,outcome:'failed',currentVersion,checkedAt:new Date().toISOString(),retryAfterMs:nextRetryDelay(failures)};
 }
 return decodeUpdateCheck(raw.body,channel,currentVersion,failures);
}
export function shouldRetry(last:UpdateSummary|null,now:number):boolean{
 if(!last)return true;
 if(last.outcome==='up-to-date'||last.outcome==='available'||last.outcome==='incompatible')return false;
 return now-Date.parse(last.checkedAt)>=last.retryAfterMs;
}
export function decodeUpdatePlan(value:unknown,channel:UpdateChannel):UpdatePlan{
 if(!object(value)||!versionText(value.targetVersion)||typeof value.backup!=='boolean'||!['passed','unknown','blocked'].includes(value.compatibilityGate as string)||typeof value.changelogSummary!=='string'||value.changelogSummary.length>4000)throw new Error('Invalid update plan');
 return {channel,targetVersion:value.targetVersion,backup:value.backup,changelogSummary:value.changelogSummary,compatibilityGate:value.compatibilityGate as 'passed'|'unknown'|'blocked'};
}
export function canInstall(plan:UpdatePlan|null):boolean{
 return !!plan&&plan.compatibilityGate!=='blocked';
}
