export const packageFiles=[
 'workbench/scripts/skill-catalog.mjs',
 'workbench/scripts/prepare-learn.mjs','workbench/scripts/prepare-learn.py',
 'scripts/start-p2-workbench.ps1','scripts/install-p2-package.ps1','workbench/hermes-compatibility.json',
 ...['launch-managed.mjs','portable-layout.mjs','check-hermes-baseline.mjs','control-server.mjs','hermes-instance.mjs','hermes-health.mjs','managed-instance.mjs','instance-lock.mjs','owned-process.mjs','windows-job-host.py','package-policy.mjs','install-p2-package.mjs'].map(name=>'workbench/scripts/'+name),
 ...['EXPERIMENTAL-LAUNCH.md','SERVICE-LIFECYCLE.md','BASELINE.md','VALIDATION.md'].map(name=>'docs/p2/'+name),
];
export function allowedPackagePath(path){
 return typeof path==='string'&&(packageFiles.includes(path)||/^workbench\/dist\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(html|js|css|svg|png|woff2)$/.test(path))&&!path.split('/').some(part=>part==='.'||part==='..');
}
