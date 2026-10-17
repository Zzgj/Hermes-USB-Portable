import {startNativeOwnedProcess} from './native-owned-process.mjs';

// Internal Windows transport: callers provide a reviewed, fixed entry command.
// Host exit alone is NOT evidence that Job descendants have finished teardown.
// No HTTP input, shell interpretation, global process lookup or lock release here.
export function startNativeConsoleProcess({python,args,cwd,environment}){
 const process=startNativeOwnedProcess({kind:'cli',python,args,cwd,environment});
 return {...process,started:process.ready};
}
