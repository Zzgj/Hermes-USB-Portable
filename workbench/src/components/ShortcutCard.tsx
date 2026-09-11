import {Link} from 'react-router-dom';
interface ShortcutCardProps {readonly title:string;readonly subtitle:string;readonly to:string;readonly icon:string;}
export function ShortcutCard({title,subtitle,to,icon}:ShortcutCardProps){return <Link className="shortcut" to={to}><span className="text-2xl" aria-hidden="true">{icon}</span><h2 className="font-semibold mt-5">{title}</h2><p className="text-sm opacity-75 mt-1">{subtitle}</p></Link>;}
