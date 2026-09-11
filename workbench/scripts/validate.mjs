// Structural checks use TypeScript AST; source references are never executed.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const arg=process.argv[2];
const files=arg?[arg]:['src/components','src/pages'].flatMap(dir=>fs.readdirSync(dir).filter(x=>x.endsWith('.tsx')).map(x=>path.join(dir,x)));
const errors=[];
for(const file of files){
 const text=fs.readFileSync(file,'utf8');const name=path.basename(file,'.tsx');
 const tree=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 const props=tree.statements.find(s=>ts.isInterfaceDeclaration(s)&&s.name.text===name+'Props');
 if(!props||props.members.some(m=>!m.modifiers?.some(x=>x.kind===ts.SyntaxKind.ReadonlyKeyword)))errors.push(`${file}: missing readonly Props interface`);
 const walk=node=>{if(ts.isJsxAttribute(node)&&node.name.getText(tree)==='href'&&node.initializer?.getText(tree)==='"#"')errors.push(`${file}: placeholder link`);if(ts.isJsxText(node)&&node.text.trim())errors.push(`${file}: static JSX text belongs in mockData.ts`);ts.forEachChild(node,walk);};walk(tree);
 if(/#[0-9a-f]{3,8}\b/i.test(text))errors.push(`${file}: literal hex color`);
}
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}else console.log(`Validated ${files.length} component files.`);
