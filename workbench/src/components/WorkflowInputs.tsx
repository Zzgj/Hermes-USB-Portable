import type { ChangeEvent } from 'react';
import type { Workflow,Run } from '../domain/workflow';
import {copy} from '../data/mockData';
interface WorkflowInputsProps {
 readonly definition:Workflow;
 readonly run:Run;
 readonly onChange:(event:ChangeEvent<HTMLInputElement>)=>void;
 readonly incomplete:boolean;
}
export function WorkflowInputs({definition,run,onChange,incomplete}:WorkflowInputsProps){
 return <fieldset className="mt-5" disabled={run.status!=='pending'}>
  <legend>{copy.inputRequirements}</legend>
  <p id="workflow-input-hint" className="mt-2 mb-3">{copy.inputHint}</p>
  <div className="grid md:grid-cols-2 gap-4">{definition.inputs.map((name,index)=><label key={name} className="block" htmlFor={`workflow-input-${index}`}>
   <span>{name}</span><input id={`workflow-input-${index}`} className="workflow-input mt-2" name={name} value={run.inputs[name]??''} onChange={onChange} required maxLength={500} aria-describedby="workflow-input-hint"/>
  </label>)}</div>
  {incomplete&&run.status==='pending'&&<p className="mt-3" role="status">{copy.missingInputs}</p>}
 </fieldset>;
}
