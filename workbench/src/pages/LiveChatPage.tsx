import {Link} from 'react-router-dom';
import {Panel} from '../components/Panel';
import {ServiceControls} from '../components/ServiceControls';
import {LiveTurn} from '../components/LiveTurn';
import type {useLiveChat} from '../hooks/useLiveChat';
import {liveCopy,learnCopy} from '../data/mockData';
import {deriveResumeWarning} from '../domain/resume-safety';
interface LiveChatPageProps {readonly chat:ReturnType<typeof useLiveChat>;}
export function LiveChatPage({chat}:LiveChatPageProps){
 const connected=chat.phase==='ready'||chat.phase==='connecting'||chat.phase==='session';
 const resumeWarn=chat.transcript?deriveResumeWarning(chat.transcript.sessionId,new Date().toISOString(),false):null;
 return <>
  <div className="page-heading"><div><h1>{liveCopy.title}</h1><p>{liveCopy.warning}</p></div><Link className="button" to="/chat">{liveCopy.demo}</Link></div>
  <p className="mb-4">{liveCopy.navigationHelp}</p><Link className="button mb-4" to="/tasks">{liveCopy.tasks}</Link>
  <ServiceControls canConnect={!connected} onConnected={chat.connectTo} onStopped={chat.disconnect} onLearnPrepared={chat.acceptLearnDraft}/>
  {chat.learnDraft&&<Panel title={learnCopy.reviewTitle} className="mb-4"><p>{learnCopy.reviewHelp}</p>
   <dl className="my-3 whitespace-pre-wrap break-words"><dt>{learnCopy.source}</dt><dd>{chat.learnDraft.source}</dd><dt>{learnCopy.scope}</dt><dd>{chat.learnDraft.scope}</dd><dt>{learnCopy.fingerprint}</dt><dd className="break-all">{chat.learnDraft.fingerprint}</dd></dl>
   <details><summary>{learnCopy.prompt}</summary><pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words">{chat.learnDraft.prompt}</pre></details>
   <label className="block my-3"><input type="checkbox" checked={chat.learnConfirmed} onChange={event=>chat.confirmLearning(event.target.checked)}/>{learnCopy.confirm}</label>
   <button className="button" disabled={!chat.learnConfirmed||chat.phase!=='ready'||chat.busy} onClick={chat.submitLearning}>{learnCopy.submit}</button><button className="button ml-3" onClick={chat.dismissLearning}>{learnCopy.dismiss}</button>
  </Panel>}
  <Panel title={liveCopy.connection} className="mb-5">
   <p role="status">{liveCopy.phases[chat.phase]}</p>
   <form onSubmit={chat.connect} className="grid md:grid-cols-3 gap-4 mt-4">
    <label>{liveCopy.port}<input className="workflow-input" inputMode="numeric" value={chat.port} onChange={chat.changePort} disabled={connected} required/></label>
    <label>{liveCopy.token}<input className="workflow-input" type="password" autoComplete="off" value={chat.token} onChange={chat.changeToken} disabled={connected} required/></label>
    <button className="button primary" disabled={connected||!chat.token.trim()}>{liveCopy.connect}</button>
   </form>
   {connected&&<button className="button mt-4" onClick={chat.disconnect}>{liveCopy.disconnect}</button>}
  </Panel>
  {chat.error&&<p role="alert" className="mb-4">{liveCopy.error}</p>}
  <Panel title={liveCopy.profiles} className="mb-4">
   <p>{liveCopy.profilesHelp}</p>
   {chat.profilesLoaded&&chat.profiles.length>0&&<p className="my-3 text-sm">{liveCopy.profileSideEffects}</p>}
   <button className="button my-3" disabled={chat.phase!=='ready'||chat.busy||chat.profilesLoading} onClick={chat.loadProfiles}>{chat.profilesLoading?liveCopy.profilesLoading:liveCopy.loadProfiles}</button>
   {chat.profilesLoaded&&chat.profiles.length===0&&<p>{liveCopy.noProfiles}</p>}
   <ul className="max-h-64 overflow-auto">{chat.profiles.map(profile=><li key={profile.name} className="my-3 break-all">
    <h3>{profile.displayName||profile.name}{profile.isDefault&&<span className="badge ml-2">{liveCopy.defaultProfile}</span>}</h3>
    <p>{profile.name}</p><dl><dt>{liveCopy.profileModel}</dt><dd>{profile.model||liveCopy.notConfigured}</dd><dt>{liveCopy.profileProvider}</dt><dd>{profile.provider||liveCopy.notConfigured}</dd><dt>{liveCopy.profileSkills}</dt><dd>{profile.skillCount}</dd></dl>
   </li>)}</ul>
  </Panel>
  <Panel title={liveCopy.skills} className="mb-4">
   <p>{liveCopy.skillsHelp}</p>
   {chat.skillsLoaded&&chat.skills.length>0&&<p className="my-3 text-sm">{liveCopy.skillSideEffects}</p>}
   <button className="button my-3" disabled={chat.phase!=='ready'||chat.busy||chat.skillsLoading} onClick={chat.loadSkills}>{chat.skillsLoading?liveCopy.skillsLoading:liveCopy.loadSkills}</button>
   {chat.skillsLoaded&&chat.skills.length===0&&<p>{liveCopy.noSkills}</p>}
   {chat.skills.length>0&&<ul className="max-h-64 overflow-auto">{chat.skills.map(skill=><li key={skill.name} className="my-2 break-all">{skill.name}{' · '}{skill.category}</li>)}</ul>}
  </Panel>
  <Panel title={liveCopy.sessions} className="mb-4">
   <p>{liveCopy.sessionHelp}</p>
   {chat.listed&&chat.sessions.length>0&&<p className="my-3 text-sm">{liveCopy.resumeWarning}</p>}
   <button className="button my-3" disabled={chat.phase!=='ready'||chat.busy||chat.listing} onClick={chat.listSessions}>{chat.listing?liveCopy.listing:liveCopy.listSessions}</button>
   {chat.listed&&chat.sessions.length===0&&<p>{liveCopy.emptySessions}</p>}
   <ul>{chat.sessions.map(item=><li key={item.id} className="my-2 break-all">{item.title||liveCopy.untitled}{' · '}{item.messages} {liveCopy.messages}<button className="button ml-3" disabled={chat.phase!=='ready'||chat.transcriptLoading} onClick={()=>chat.viewTranscript(item.id)}>{liveCopy.viewTranscript}</button></li>)}</ul>
   <p className="my-3">{liveCopy.transcriptHelp}</p>
   {chat.transcriptLoading&&<p role="status">{liveCopy.transcriptLoading}</p>}
   {(chat.transcript||chat.transcriptLoading)&&<button className="button" onClick={chat.hideTranscript}>{liveCopy.hideTranscript}</button>}
   {chat.transcript&&<section className="mt-4"><h3>{liveCopy.transcriptTitle}</h3><p className="break-all">{chat.transcript.sessionId}</p>
   {resumeWarn&&<p role="alert" className="my-2 text-sm">{resumeWarn.warning}</p>}
   {chat.transcript.messages.length===0&&<p>{liveCopy.noTranscript}</p>}
    <ol className="max-h-96 overflow-auto space-y-4">{chat.transcript.messages.map((message,index)=><li key={index}><strong>{liveCopy.transcriptRoles[message.role]}</strong><p className="whitespace-pre-wrap break-words">{message.text}</p></li>)}</ol>
    {chat.transcript.omitted&&<p>{liveCopy.transcriptOmitted}</p>}
   </section>}
  </Panel>
  {chat.approval&&chat.requests[0]&&<Panel title={liveCopy.approval} className="mb-4"><p>{liveCopy.approvalHelp}</p>
   <pre className="whitespace-pre-wrap break-all my-4">{chat.requests[0].command}</pre>
   {chat.requests[0].reason&&<p>{chat.requests[0].reason}</p>}
   <div className="flex gap-3 mt-4">{chat.requests[0].choices.map(choice=><button key={choice} className="button" disabled={chat.phase!=='ready'||chat.responding||chat.stopping} onClick={()=>chat.respond(choice)}>{liveCopy.approvalChoices[choice]}</button>)}</div>
  </Panel>}
  <section className="panel chat-panel"><div className="messages" role="log" aria-live="polite">
   {chat.history.map((message,index)=>message.role==='user'?<p key={index} className="message user">{message.text}</p>:<LiveTurn key={index} turn={message.turn}/>)}
   {chat.turn&&<LiveTurn turn={chat.turn} disconnected={chat.phase!=='ready'}/>}
  </div><form className="composer" onSubmit={chat.submit}><label className="sr-only" htmlFor="live-message">{liveCopy.message}</label><textarea id="live-message" value={chat.input} onChange={chat.changeInput} maxLength={4000} disabled={chat.phase!=='ready'||chat.busy} placeholder={liveCopy.placeholder}/><button className="button primary" disabled={chat.phase!=='ready'||chat.busy||!chat.input.trim()}>{liveCopy.send}</button></form>
  {chat.busy&&chat.phase==='ready'&&<button className="button m-4" onClick={chat.stop} disabled={chat.stopping}>{chat.stopping?liveCopy.stopping:liveCopy.stop}</button>}
  </section>
 </>;
}
