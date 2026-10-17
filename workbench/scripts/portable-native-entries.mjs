import {createNativeEntryManager} from './native-entry-manager.mjs';
import {createNativeEntryAdapters} from './native-entry-adapters.mjs';
import {assertPortableEntryGuard} from './portable-entry-guard.mjs';

// The only production composition for native entries. Config is derived from
// the selected portable root, never from request bodies or query parameters.
export async function createPortableNativeEntries(options,{makeAdapters=createNativeEntryAdapters}={}){
 const adapters=makeAdapters(options);
 return createNativeEntryManager({home:options.home,adapters,
  beforePrepare:()=>assertPortableEntryGuard(options.root,options.home)});
}
