/** Session resume safety: resume may continue execution; the UI must not auto-resume.
 This module models the safety check without performing any network request. */
export interface ResumeWarning{
 readonly sessionId:string;
 readonly mayContinueExecution:boolean;
 readonly lastActivity:string;
 readonly warning:string;
}
export function deriveResumeWarning(sessionId:string,lastActivity:string,hasIncompleteTools:boolean):ResumeWarning{
 if(!sessionId.trim()||sessionId.length>256||!Number.isFinite(Date.parse(lastActivity)))throw new Error('Invalid resume input');
 return {
  sessionId,
  mayContinueExecution:hasIncompleteTools,
  lastActivity,
  warning:hasIncompleteTools
   ?'恢复此会话可能继续未完成的工具执行。必须在聊天页面明确确认后才可恢复；不自动重发或重放。'
   :'此会话没有已知未完成的工具。恢复后仍需在聊天页面核对状态，不自动发送消息。',
 };
}
