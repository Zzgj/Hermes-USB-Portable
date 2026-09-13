import {useEffect,useRef,useState,type ChangeEvent,type FormEvent} from 'react';
import {connectHermes,decodeSession,decodeInterrupt,type SessionIdentity} from '../domain/rpc';
import {beginTurn,reduceChatEvent,appendChatPrompt,type ChatRecord,type ChatTurn} from '../domain/chat-events';
import {decodeApproval,approvalParams,approvalResolved,type ApprovalRequest} from '../domain/approval';
import {decodeSessionList,type StoredSession} from '../domain/session-list';
import {decodeAvailableSkills,type AvailableSkill} from '../domain/skills';
import {decodeProfiles,profileListRequest,type ProfileSummary} from '../domain/profiles';
import {readTranscript,type SessionTranscript} from '../domain/session-history';
import {learningMatches,type LearnDraft} from '../domain/learn';
import {readInstanceCatalogCards,readInstanceEvidence,environmentFingerprint,importVerificationDrafts,capabilityStatus,type Capability,type ImportedEvidence} from '../domain/capability';
import {verifyMethodFingerprint,buildExecutionPrompt,deriveExecutionPhase,type ExecutionState} from '../domain/capability-execution';
export function useLiveChat(){
 const [port,setPort]=useState('9119'),[token,setToken]=useState(''),[input,setInput]=useState('');
 const [phase,setPhase]=useState<'idle'|'connecting'|'session'|'ready'|'closed'|'failed'>('idle');
 const [error,setError]=useState(false),[approval,setApproval]=useState(false),[stopping,setStopping]=useState(false);
 const [requests,setRequests]=useState<readonly ApprovalRequest[]>([]),[responding,setResponding]=useState(false);
 const approvalBusy=useRef(false);
 const [sessions,setSessions]=useState<readonly StoredSession[]>([]),[listing,setListing]=useState(false),[listed,setListed]=useState(false);
 const listBusy=useRef(false);
 const [skills,setSkills]=useState<readonly AvailableSkill[]>([]),[skillsLoading,setSkillsLoading]=useState(false),[skillsLoaded,setSkillsLoaded]=useState(false);
 const skillsBusy=useRef(false);
 const [profiles,setProfiles]=useState<readonly ProfileSummary[]>([]),[profilesLoading,setProfilesLoading]=useState(false),[profilesLoaded,setProfilesLoaded]=useState(false);
 const profilesBusy=useRef(false);
 const [learnDraft,setLearnDraft]=useState<LearnDraft|null>(null),[learnConfirmed,setLearnConfirmed]=useState(false);
 const [instanceCards,setInstanceCards]=useState<readonly Capability[]>([]),[catalogLoading,setCatalogLoading]=useState(false),[catalogLoaded,setCatalogLoaded]=useState(false);
 const catalogBusy=useRef(false),catalogRequest=useRef<AbortController|null>(null);
 const [execution,setExecution]=useState<ExecutionState|null>(null);
 const [evidence,setEvidence]=useState<readonly ImportedEvidence[]>([]),[evidenceLoading,setEvidenceLoading]=useState(false),[evidenceLoaded,setEvidenceLoaded]=useState(false);
 const evidenceBusy=useRef(false),evidenceRequest=useRef<AbortController|null>(null),envFingerprint=useRef<string|null>(null);
 const [transcript,setTranscript]=useState<SessionTranscript|null>(null),[transcriptLoading,setTranscriptLoading]=useState(false);
 const transcriptRequest=useRef<AbortController|null>(null),historyAccess=useRef<{port:number;token:string}|null>(null);
 const [history,setHistory]=useState<readonly ChatRecord[]>([]),[turn,setTurn]=useState<ChatTurn|null>(null);
 const connection=useRef<ReturnType<typeof connectHermes>|null>(null),session=useRef<SessionIdentity|null>(null);
 const epoch=useRef(0),current=useRef<ChatTurn|null>(null),sequence=useRef(-1);
 const end=()=>{epoch.current++;connection.current?.close();connection.current=null;session.current=null;approvalBusy.current=false;listBusy.current=false;skillsBusy.current=false;profilesBusy.current=false;transcriptRequest.current?.abort();transcriptRequest.current=null;historyAccess.current=null;catalogRequest.current?.abort();catalogRequest.current=null;catalogBusy.current=false;setInstanceCards([]);setCatalogLoading(false);setCatalogLoaded(false);setExecution(null);setEvidence([]);setEvidenceLoading(false);setEvidenceLoaded(false);evidenceBusy.current=false;evidenceRequest.current=null;envFingerprint.current=null;};
 useEffect(()=>()=>{end();},[]);
 const disconnect=()=>{end();setPhase('closed');setToken('');setStopping(false);setApproval(false);setTranscriptLoading(false);setTranscript(null);setLearnDraft(null);setLearnConfirmed(false);};
 const connectTo=({port:targetPort,token:targetToken}:{port:number;token:string})=>{
  if(!Number.isInteger(targetPort)||targetPort<1||targetPort>65535||!targetToken.trim())return;
  setPort(String(targetPort));
  end();const generation=epoch.current;setPhase('connecting');setError(false);setHistory([]);setTurn(null);current.current=null;sequence.current=-1;
  setApproval(false);setRequests([]);setResponding(false);setStopping(false);
  setSessions([]);setListing(false);setListed(false);
  setSkills([]);setSkillsLoading(false);setSkillsLoaded(false);
  setProfiles([]);setProfilesLoading(false);setProfilesLoaded(false);
  setLearnDraft(null);setLearnConfirmed(false);
  setTranscript(null);setTranscriptLoading(false);historyAccess.current={port:targetPort,token:targetToken.trim()};
  const endpoint=`ws://127.0.0.1:${targetPort}/api/ws?token=${encodeURIComponent(targetToken.trim())}`;setToken('');
  const live=()=>epoch.current===generation;
  try{connection.current=connectHermes({endpoint,onState:state=>{
   if(!live())return;
   if(state==='ready'){
    setPhase('session');
    void connection.current?.request('session.create',{close_on_disconnect:true}).then(value=>{
     if(!live())return;const identity=decodeSession(value);
     if(identity.contract!==6)throw new Error('Unsupported contract');
     session.current=identity;setPhase('ready');
    }).catch(()=>{if(live()){end();setPhase('failed');setError(true);}});
   }else if(state==='closed'||state==='failed'){historyAccess.current=null;transcriptRequest.current?.abort();transcriptRequest.current=null;setTranscriptLoading(false);setPhase(state);setStopping(false);setApproval(false);}
  },onEvent:event=>{
   if(!live()||event.sessionId!==session.current?.runtimeId)return;
   if(event.seq!==undefined&&event.seq<=sequence.current)return;
   if(event.seq!==undefined)sequence.current=Math.max(sequence.current,event.seq);
   if(event.type==='approval.request'){
    setApproval(true);
    try{const request=decodeApproval(event.payload);setRequests(old=>old.some(item=>item.id===request.id)?old:[...old,request]);}
    catch{end();setPhase('failed');setError(true);}
    return;
   }
   if(!current.current)return;
   const next=reduceChatEvent(current.current,event);current.current=next;setTurn(next);
   if(next.status!=='streaming'){setStopping(false);setApproval(false);setRequests([]);}
  }});}catch{setPhase('failed');setError(true);}
 };
 const viewTranscript=(id:string)=>{
  const access=historyAccess.current,generation=epoch.current;
  if(!access||phase!=='ready'||transcriptRequest.current||!sessions.some(item=>item.id===id))return;
  const controller=new AbortController();transcriptRequest.current=controller;setTranscriptLoading(true);setTranscript(null);setError(false);
  const timeout=setTimeout(()=>controller.abort(),15000);
  void readTranscript(access,id,controller.signal).then(value=>{
   if(epoch.current===generation&&transcriptRequest.current===controller)setTranscript(value);
  }).catch(()=>{if(epoch.current===generation&&transcriptRequest.current===controller)setError(true);}).finally(()=>{
   clearTimeout(timeout);if(transcriptRequest.current===controller){transcriptRequest.current=null;setTranscriptLoading(false);}
  });
 };
 const hideTranscript=()=>{transcriptRequest.current?.abort();transcriptRequest.current=null;setTranscript(null);setTranscriptLoading(false);};
 const loadProfiles=()=>{
  const client=connection.current,generation=epoch.current;
  if(!client||phase!=='ready'||profilesBusy.current||current.current?.status==='streaming')return;
  profilesBusy.current=true;setProfilesLoading(true);setError(false);
  void client.request('profiles.list',profileListRequest()).then(value=>{
   if(epoch.current!==generation)return;setProfiles(decodeProfiles(value));setProfilesLoaded(true);
  }).catch(()=>{if(epoch.current===generation)setError(true);}).finally(()=>{
   if(epoch.current===generation){profilesBusy.current=false;setProfilesLoading(false);}
  });
 };
 const loadSkills=()=>{
  const client=connection.current,generation=epoch.current;
  if(!client||phase!=='ready'||skillsBusy.current||current.current?.status==='streaming')return;
  skillsBusy.current=true;setSkillsLoading(true);setError(false);
  void client.request('skills.manage',{action:'list'}).then(value=>{
   if(epoch.current!==generation)return;setSkills(decodeAvailableSkills(value));setSkillsLoaded(true);
  }).catch(()=>{if(epoch.current===generation)setError(true);}).finally(()=>{
   if(epoch.current===generation){skillsBusy.current=false;setSkillsLoading(false);}
  });
 };
 const listSessions=()=>{
  const client=connection.current,generation=epoch.current;
  if(!client||phase!=='ready'||listBusy.current||current.current?.status==='streaming')return;
  listBusy.current=true;setListing(true);setError(false);
  void client.request('session.list',{limit:50,include_hidden:false}).then(value=>{
   if(epoch.current!==generation)return;setSessions(decodeSessionList(value));setListed(true);
  }).catch(()=>{if(epoch.current===generation)setError(true);}).finally(()=>{
   if(epoch.current===generation){listBusy.current=false;setListing(false);}
  });
 };
 const respond=(choice:'once'|'deny')=>{
  const identity=session.current,client=connection.current,request=requests[0],generation=epoch.current;
  if(!approval||!request||!identity||!client||phase!=='ready'||approvalBusy.current||stopping||!request.choices.includes(choice))return;
  approvalBusy.current=true;setResponding(true);setError(false);
  void client.request('approval.respond',approvalParams(identity.runtimeId,request,choice)).then(value=>{
   if(epoch.current!==generation)return;
   if(!approvalResolved(value))throw new Error('Unconfirmed approval');
   setRequests(old=>old.filter(item=>item.id!==request.id));
  }).catch(()=>{if(epoch.current===generation){end();setPhase('failed');setError(true);}}).finally(()=>{
   if(epoch.current===generation){approvalBusy.current=false;setResponding(false);}
  });
 };
 const submitText=(text:string,display=text,opts?:{readonly preserveExecution?:boolean})=>{
  const identity=session.current,client=connection.current;
  if(!text||phase!=='ready'||!identity||!client||current.current?.status==='streaming')return;
  if(!opts?.preserveExecution)setExecution(null);
  const previous=current.current;
  setHistory(old=>appendChatPrompt(old,previous,display));
  current.current=beginTurn(identity.runtimeId,sequence.current);setTurn(current.current);setInput('');setError(false);
  const generation=epoch.current;
  void client.request('prompt.submit',{session_id:identity.runtimeId,text}).catch(()=>{
   if(epoch.current!==generation)return;
   // A timeout can leave a live server-side turn. Require reconnect rather than permitting duplicate sends.
   end();setPhase('failed');setError(true);
  });
 };
 const draftEpoch=epoch.current;
 const acceptLearnDraft=(draft:LearnDraft)=>{
  if(epoch.current!==draftEpoch||phase!=='ready'||!learningMatches(draft,historyAccess.current)||current.current?.status==='streaming'){setError(true);return;}
  setLearnDraft(draft);setLearnConfirmed(false);
 };
 const submitLearning=()=>{
  if(!learnDraft||!learnConfirmed||phase!='ready'||current.current?.status==='streaming'||!learningMatches(learnDraft,historyAccess.current))return;
  submitText(learnDraft.prompt,`/learn\n${learnDraft.source}\n${learnDraft.scope}`);setLearnDraft(null);setLearnConfirmed(false);
 };
 const loadInstanceCatalog=()=>{
  const access=historyAccess.current,generation=epoch.current;
  if(!access||phase!='ready'||catalogBusy.current)return;
  catalogBusy.current=true;setCatalogLoading(true);setError(false);
  const controller=new AbortController();catalogRequest.current=controller;const timer=setTimeout(()=>controller.abort(),15000);
  void readInstanceCatalogCards({port:access.port,token:access.token},controller.signal).then(async cards=>{
   if(epoch.current!==generation)return;
   setInstanceCards(cards);setCatalogLoaded(true);setExecution(null);
   try{envFingerprint.current=await environmentFingerprint(cards);}catch{envFingerprint.current=null;}
  }).catch(()=>{if(epoch.current===generation)setError(true);}).finally(()=>{
   clearTimeout(timer);
   if(epoch.current===generation){catalogBusy.current=false;setCatalogLoading(false);}
  });
 };
 const prepareExecution=(card:Capability,params:Readonly<Record<string,string>>)=>{
  if(phase!='ready'||!instanceCards.length||card.method.kind!='skill')return;
  const check=verifyMethodFingerprint(card,instanceCards);
  const prompt=buildExecutionPrompt(card,params);
  setExecution({capabilityId:card.id,check,prompt,confirmed:false});
 };
 const confirmExecution=()=>{
  const exec=execution;
  if(!exec||exec.confirmed||phase!='ready'||current.current?.status==='streaming'||exec.check.status!='match')return;
  setExecution({...exec,confirmed:true});
  submitText(exec.prompt,`[能力] ${exec.capabilityId}`,{preserveExecution:true});
 };
 const clearExecution=()=>setExecution(null);
 const loadInstanceEvidence=()=>{
  const access=historyAccess.current,generation=epoch.current;
  if(!access||phase!='ready'||evidenceBusy.current||!instanceCards.length)return;
  evidenceBusy.current=true;setEvidenceLoading(true);setError(false);
  const controller=new AbortController();evidenceRequest.current=controller;const timer=setTimeout(()=>controller.abort(),15000);
  void readInstanceEvidence({port:access.port,token:access.token},controller.signal).then(records=>{
   if(epoch.current!==generation)return;
   setEvidence(records);setEvidenceLoaded(true);
  }).catch(()=>{if(epoch.current===generation)setError(true);}).finally(()=>{
   clearTimeout(timer);
   if(epoch.current===generation){evidenceBusy.current=false;setEvidenceLoading(false);}
  });
 };
 const cardVerification=(card:Capability):'draft'|'unverified'|'verified'|'reverify'|'unknown'=>{
  if(!envFingerprint.current||!evidenceLoaded)return 'unknown';
  return capabilityStatus(card,evidence,envFingerprint.current);
 };
 const executionPhase=deriveExecutionPhase(execution,turn,phase!='ready');
 const stop=()=>{
  const identity=session.current,client=connection.current,generation=epoch.current;
  if(!identity||!client||phase!=='ready'||stopping)return;setStopping(true);
  void client.request('session.interrupt',{session_id:identity.runtimeId}).then(value=>{
   if(epoch.current!==generation)return;
   if(decodeInterrupt(value)==='not-interrupted'){setStopping(false);setError(true);}
  }).catch(()=>{if(epoch.current===generation){setStopping(false);setError(true);}});
 };
 return {port,token,input,phase,error,approval,requests,responding,respond,stopping,history,turn,sessions,listing,listed,listSessions,skills,skillsLoading,skillsLoaded,loadSkills,profiles,profilesLoading,profilesLoaded,loadProfiles,transcript,transcriptLoading,viewTranscript,hideTranscript,
  learnDraft,learnConfirmed,acceptLearnDraft,submitLearning,confirmLearning:(value:boolean)=>setLearnConfirmed(value),dismissLearning:()=>{setLearnDraft(null);setLearnConfirmed(false);},
  instanceCards,catalogLoading,catalogLoaded,loadInstanceCatalog,execution,executionPhase,prepareExecution,confirmExecution,clearExecution,
  evidence,evidenceLoading,evidenceLoaded,loadInstanceEvidence,cardVerification,
  busy:turn?.status==='streaming',connect:(event:FormEvent)=>{event.preventDefault();connectTo({port:Number(port),token});},connectTo,disconnect,submit:(event:FormEvent)=>{event.preventDefault();submitText(input.trim());},stop,
  changePort:(e:ChangeEvent<HTMLInputElement>)=>setPort(e.target.value),changeToken:(e:ChangeEvent<HTMLInputElement>)=>setToken(e.target.value),changeInput:(e:ChangeEvent<HTMLTextAreaElement>)=>setInput(e.target.value)};
}
