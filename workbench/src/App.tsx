import {Routes,Route,Navigate,useLocation} from 'react-router-dom';
import {Shell} from './components/Shell';import {HomePage} from './pages/HomePage';import {ChatPage} from './pages/ChatPage';import {TasksPage} from './pages/TasksPage';import {CatalogPage} from './pages/CatalogPage';import {SettingsPage} from './pages/SettingsPage';import {OnboardingPage} from './pages/OnboardingPage';import {catalogs} from './data/mockData';
interface AppProps {readonly demo?:boolean;}
import {LiveChatPage} from './pages/LiveChatPage';
import {CapabilitiesPage} from './pages/CapabilitiesPage';
import {LiveTasksPage} from './pages/LiveTasksPage';
import {useLiveChat} from './hooks/useLiveChat';
export function App(_:AppProps){
 const chat=useLiveChat(),location=useLocation();
 // Keep controls mounted: their in-memory management credential must survive internal navigation.
 // Hidden content is not interactive; no connection or service is started merely by mounting it.
 return <Shell><div hidden={location.pathname!=='/chat/live'}><LiveChatPage chat={chat}/></div><Routes>
  <Route path="/" element={<HomePage/>}/><Route path="/capabilities" element={<CapabilitiesPage/>}/><Route path="/chat" element={<ChatPage/>}/><Route path="/chat/live" element={null}/>
  <Route path="/tasks" element={<LiveTasksPage chat={chat}/>}/><Route path="/tasks/demo" element={<TasksPage/>}/>
  {Object.keys(catalogs).map(kind=><Route key={kind} path={`/${kind}`} element={<CatalogPage key={kind} kind={kind}/>}/>)}
  <Route path="/settings" element={<SettingsPage/>}/><Route path="/onboarding" element={<OnboardingPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes></Shell>;
}
