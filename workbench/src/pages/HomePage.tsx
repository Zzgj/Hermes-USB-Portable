import {Link} from 'react-router-dom';
import {copy,recentTasks,shortcuts,telemetry} from '../data/mockData';
import {Panel} from '../components/Panel';import {ShortcutCard} from '../components/ShortcutCard';import {StatusBadge} from '../components/StatusBadge';
interface HomePageProps {readonly compact?:boolean;}
export function HomePage(_:HomePageProps){return <><div className="page-heading"><div><h1>{copy.title}</h1><p>{copy.intro}</p></div><Link className="button primary" to="/tasks/demo">{copy.newTask}</Link></div>
 <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">{shortcuts.map(s=><ShortcutCard key={s.to} {...s}/>)}</div>
 <div className="grid xl:grid-cols-[2fr_1fr] gap-5"><Panel title={copy.recent}><div className="overflow-x-auto"><table><thead><tr>{copy.headers.map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{recentTasks.map(t=><tr key={t.id}><td className="font-mono">{t.id}</td><td><Link to="/tasks/demo">{t.name}</Link></td><td><StatusBadge status={t.status}/></td></tr>)}</tbody></table></div></Panel>
 <Panel title={copy.context}><dl className="space-y-5">{telemetry.map(t=><div className="flex justify-between gap-4" key={t.label}><dt>{t.label}</dt><dd className="font-mono text-sm">{t.value}</dd></div>)}</dl></Panel></div></>;}
