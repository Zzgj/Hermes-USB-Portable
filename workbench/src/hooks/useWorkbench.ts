import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { copy, workflows } from '../data/mockData';
import { createRun, transition, actionsFor, bindInputs, missingInputs, type Action } from '../domain/workflow';
export function useTheme(){const [dark,setDark]=useState(false);useEffect(()=>{document.documentElement.classList.toggle('dark',dark)},[dark]);return {dark,toggle:()=>setDark(x=>!x)};}
export function useCatalog(){const [query,setQuery]=useState('');const [selected,setSelected]=useState<string|null>(null);return {query,selected,change:(e:ChangeEvent<HTMLInputElement>)=>setQuery(e.target.value),select:(name:string)=>setSelected(name)};}
export function useWizard(){const [step,setStep]=useState(0);return {step,next:()=>setStep(x=>Math.min(5,x+1)),back:()=>setStep(x=>Math.max(0,x-1))};}
export function useChat(){
  const [input,setInput]=useState('');const [messages,setMessages]=useState([{role:'assistant',text:copy.greeting}]);
  const change=(e:ChangeEvent<HTMLTextAreaElement>)=>setInput(e.target.value);
  const submit=(e:FormEvent)=>{e.preventDefault();if(!input.trim())return;setMessages(m=>[...m,{role:'user',text:input.trim()},{role:'assistant',text:copy.reply}]);setInput('');};
  const reset=()=>{setInput('');setMessages([{role:'assistant',text:copy.greeting}]);};
  return {input,messages,change,submit,reset};
}
export function useTask(){
 const [state,setState]=useState(()=>({definition:workflows[0],run:createRun(workflows[0])}));
 const active=state.run.status==='running'||state.run.status==='waiting-approval';
 const select=(event:ChangeEvent<HTMLSelectElement>)=>{const id=event.target.value;setState(old=>{
  if(old.run.status==='running'||old.run.status==='waiting-approval')return old;
  const definition=workflows.find(w=>w.id===id);return definition?{definition,run:createRun(definition)}:old;
 });};
 const act=(action:Action)=>setState(old=>({...old,run:transition(old.definition,old.run,action)}));
 const changeInput=(event:ChangeEvent<HTMLInputElement>)=>{
  const {name,value}=event.target;
  setState(old=>({...old,run:bindInputs(old.definition,old.run,{...old.run.inputs,[name]:value})}));
 };
 return {...state,active,select,act,changeInput,missing:missingInputs(state.definition,state.run.inputs),actions:actionsFor(state.run)};
}
