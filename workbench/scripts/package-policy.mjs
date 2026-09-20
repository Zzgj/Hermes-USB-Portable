export const packageFiles=[
 'workbench/scripts/prepare-capability.mjs',
 'workbench/scripts/skill-catalog.mjs',
 'workbench/scripts/prepare-learn.mjs','workbench/scripts/prepare-learn.py',
 'scripts/start-p2-workbench.ps1','scripts/install-p2-package.ps1','workbench/hermes-compatibility.json',
 ...['launch-managed.mjs','portable-layout.mjs','check-hermes-baseline.mjs','control-server.mjs','hermes-instance.mjs','hermes-health.mjs','managed-instance.mjs','instance-lock.mjs','owned-process.mjs','windows-job-host.py','package-policy.mjs','install-p2-package.mjs'].map(name=>'workbench/scripts/'+name),
 'docs/project_plan.md','docs/AI_GUIDE.md',
 ...['PROGRESS.md','ENGINEERING.md','ACCEPTANCE.md'].map(name=>'docs/p0/'+name),
 ...['PROGRESS-GUIDE.md','ENGINEERING.md','ACCEPTANCE.md','VALIDATION.md','HANDOFF.md'].map(name=>'docs/p2/'+name),
 ...['p1','p3','p4'].map(phase=>'docs/'+phase+'/PLAN.md'),
];
export function allowedPackagePath(path){
 return typeof path==='string'&&(packageFiles.includes(path)||/^workbench\/dist\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(html|js|css|svg|png|woff2)$/.test(path))&&!path.split('/').some(part=>part==='.'||part==='..');
}
