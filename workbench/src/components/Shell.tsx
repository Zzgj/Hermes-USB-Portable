import type { ReactNode } from 'react';
import {Link,NavLink} from 'react-router-dom';
import {copy,navigation} from '../data/mockData';
import {useTheme} from '../hooks/useWorkbench';
interface ShellProps {readonly children:ReactNode;}
export function Shell({children}:ShellProps){const theme=useTheme();return <div className="shell">
 <a className="skip-link" href="#main">{copy.skip}</a>
 <aside className="sidebar"><Link className="brand" to="/"><span className="brand-mark" aria-hidden="true">{copy.mark}</span><span>{copy.brand}<small>{copy.subtitle}</small></span></Link>
 <nav aria-label={copy.navLabel}>{navigation.map(n=><NavLink end={n.path==='/'} className="nav-item" key={n.path} to={n.path}><span aria-hidden="true">{n.icon}</span>{n.label}</NavLink>)}</nav></aside>
 <div className="workspace"><header className="topbar"><span className="font-mono text-xs">{copy.workspace}</span><div className="flex items-center gap-4"><span className="badge">{copy.preview}</span><button className="button" onClick={theme.toggle} aria-pressed={theme.dark}>{copy.toggle}</button></div></header>
 <p className="notice">{copy.disclaimer}</p><main id="main" tabIndex={-1}>{children}</main><footer className="footer">{copy.footer}</footer></div>
 </div>;}
