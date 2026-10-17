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
const ASSET_LABELS:Record<AssetState,string>={present:'预期资产存在；运行条件未验证',missing:'指定位置未发现预期资产',invalid:'资产类型或路径不符合检查要求',unknown:'资产状态未知；不代表未安装'};
const HELP_TEXT='分别检查本工作台、CLI、TUI、原生 Dashboard 和 Desktop 的预期文件或目录。依赖未验证、运行状态未知；本检测列表不管理生命周期，原生入口状态以独立控制区为准。本列表不代表四入口可用性验收。';
const PANEL_TITLE='备用入口与能力检测';
const LOADING_TEXT='正在检测入口文件…';
const FAILED_TEXT='检测失败，可重试';
const NOT_INSPECTED_TEXT='尚未检测入口文件';
const UNAUTH_TEXT='未认证：请先在 AI 对话页输入管理令牌并读取服务状态；无需连接实例即可检测。';
const RESULTS_TEXT='资产检查结果（不代表运行可用）：';
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
