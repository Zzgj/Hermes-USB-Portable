import type { ReactNode } from 'react';
interface PanelProps {readonly title?:string;readonly children:ReactNode;readonly className?:string;}
export function Panel({title,children,className=''}:PanelProps){return <section className={`panel ${className}`}>{title&&<h2 className="panel-title">{title}</h2>}<div className="p-5">{children}</div></section>;}
