import {Panel} from './Panel';

export type EntryKind='workbench'|'cli'|'tui'|'dashboard'|'desktop';
export type AssetState='present'|'missing'|'invalid'|'unknown';
export interface EntryCapabilityRow{readonly kind:EntryKind;readonly assetState:AssetState;}

interface EntryCapabilitiesPanelProps{
 readonly rows:readonly EntryCapabilityRow[]|null;
 readonly loading:boolean;
 readonly failed:boolean;
 readonly canInspect:boolean;
 readonly onInspect:()=>void;
}

const KIND_LABELS:Record<EntryKind,string>={workbench:'本工作台',cli:'CLI',tui:'TUI',dashboard:'原生 Dashboard',desktop:'Desktop'};
const ASSET_LABELS:Record<AssetState,string>={present:'入口文件存在；运行条件未验证',missing:'未发现入口文件',invalid:'检测异常',unknown:'探测尚未接入；不代表未安装'};
const HELP_TEXT='分别检测本工作台、CLI、TUI、原生 Dashboard 和 Desktop 的入口文件。依赖未验证、运行状态未知、生命周期未接入；本列表不代表四入口可用性验收。';
const PANEL_TITLE='备用入口与能力检测';
const LOADING_TEXT='正在检测入口文件…';
const FAILED_TEXT='检测失败，可重试';
const NOT_INSPECTED_TEXT='尚未检测入口文件';
const UNAUTH_TEXT='未认证：请先在 AI 对话页连接实例获取管理令牌';
const RESULTS_TEXT='检测到以下入口文件：';
const BUTTON_LABEL='检测入口';
const BUTTON_LOADING='正在检测…';

function entryLine(r:EntryCapabilityRow){return KIND_LABELS[r.kind]+': '+ASSET_LABELS[r.assetState];}

export function EntryCapabilitiesPanel({rows,loading,failed,canInspect,onInspect}:EntryCapabilitiesPanelProps){
 let statusText:string;
 let showRows=false;
 if(!canInspect)statusText=UNAUTH_TEXT;
 else if(loading)statusText=LOADING_TEXT;
 else if(failed)statusText=FAILED_TEXT;
 else if(rows&&rows.length>0){statusText=RESULTS_TEXT;showRows=true;}
 else statusText=NOT_INSPECTED_TEXT;
 const buttonLabel=loading?BUTTON_LOADING:BUTTON_LABEL;
 const buttonDisabled=loading||!canInspect;
 return <Panel title={PANEL_TITLE} className="mb-5">
  <p>{HELP_TEXT}</p>
  {showRows&&rows?<div className="my-3"><p>{statusText}</p><ul>{rows.map(r=><li key={r.kind}>{entryLine(r)}</li>)}</ul></div>:<p role="status" className="my-3">{statusText}</p>}
  <button className="button" disabled={buttonDisabled} onClick={onInspect}>{buttonLabel}</button>
 </Panel>;
}
