import {statusLabels,type TaskStatus} from '../data/mockData';
interface StatusBadgeProps {readonly status:TaskStatus;}
const statusClasses: Record<TaskStatus,string> = {
 pending:'status-pending',running:'status-running','waiting-approval':'status-waiting-approval',
 succeeded:'status-succeeded',failed:'status-failed',cancelled:'status-cancelled','rolled-back':'status-rolled-back',
};
export function StatusBadge({status}:StatusBadgeProps){return <span className={`badge ${statusClasses[status]}`}>{statusLabels[status]}</span>;}
