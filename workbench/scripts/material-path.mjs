// Portable relative material paths, not URLs or shell arguments. Spaces and
// parentheses occur in the pinned Python distribution's setuptools resources.
export function isMaterialPath(path){
 return typeof path==='string'&&/^[A-Za-z0-9_.@+() /-]+$/.test(path)&&
  !path.split('/').some(part=>!part||part==='.'||part==='..'||part.endsWith('.')||part.endsWith(' ')||
   /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part));
}
