import type { ReactNode } from 'react';
interface PanelProps {readonly title?:string;readonly children:ReactNode;readonly className?:string;readonly 'aria-busy'?:boolean;}
export function Panel({title,children,className='','aria-busy':ariaBusy}:PanelProps){return <section className={`panel ${className}`} aria-busy={ariaBusy||undefined}>{title&&<h2 className="panel-title">{title}</h2>}<div className="p-5">{children}</div></section>;}
