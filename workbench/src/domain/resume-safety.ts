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
  // Absence of observed incomplete tools does not rule out automatic continuation.
  mayContinueExecution:true,
  lastActivity,
  warning:hasIncompleteTools
   ?'恢复此会话可能继续未完成的工具执行。必须在聊天页面明确确认后才可恢复；不自动重发或重放。'
   :'没有观察到未完成的工具不代表恢复不会继续执行。必须核对真实状态并明确确认；不自动恢复或重放消息。',
 };
}
