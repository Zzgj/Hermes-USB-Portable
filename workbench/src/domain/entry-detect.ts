/** Detects available Hermes entry points (CLI/TUI/Desktop/Web) via the control server.
 The workbench does not replace these entries; it only surfaces them for quick navigation.
 Detection is read-only and has no side effects. */
export type EntryKind='cli'|'tui'|'desktop'|'web';
export interface EntryStatus{
 readonly kind:EntryKind;
 readonly available:boolean;
 readonly path?:string;
 readonly note:string;
}
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
const text=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=512;
const ENTRY_LABELS:Record<EntryKind,string>={cli:'CLI',tui:'TUI',desktop:'Desktop',web:'Web Dashboard'};
export function entryLabel(kind:EntryKind):string{return ENTRY_LABELS[kind];}
export function decodeEntryStatus(value:unknown):EntryStatus{
 if(!object(value)||!['cli','tui','desktop','web'].includes(value.kind as string))throw new Error('Invalid entry status');
 const kind=value.kind as EntryKind;
 if(typeof value.available!=='boolean')throw new Error('Invalid entry status');
 return {
  kind,
  available:value.available,
  ...(text(value.path)?{path:value.path}:{}),
  note:typeof value.note==='string'&&value.note.length<=256?value.note:'',
 };
}
export function decodeEntryList(value:unknown):readonly EntryStatus[]{
 if(!object(value)||!Array.isArray(value.entries)||value.entries.length>20)throw new Error('Invalid entry list');
 const seen=new Set<EntryKind>();
 const result=value.entries.map(item=>{
  const entry=decodeEntryStatus(item);
  if(seen.has(entry.kind))throw new Error('Duplicate entry');
  seen.add(entry.kind);
  return entry;
 });
 return result;
}
