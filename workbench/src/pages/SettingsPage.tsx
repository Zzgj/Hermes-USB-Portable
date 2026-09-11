import {copy,updates} from '../data/mockData';import {Panel} from '../components/Panel';
interface SettingsPageProps {readonly demo?:boolean;}
export function SettingsPage(_:SettingsPageProps){return <><div className="page-heading"><div><h1>{copy.updateTitle}</h1><p>{copy.updateIntro}</p></div></div><div className="grid md:grid-cols-2 gap-5">{updates.map(u=><Panel key={u.name} title={u.name}><p>{u.description}</p><p className="my-5">{copy.unavailable}</p><button className="button" disabled>{copy.check}</button></Panel>)}</div></>;}
