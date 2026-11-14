import * as esbuild from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
const js=await esbuild.build({entryPoints:['src/app.ts'],bundle:true,write:false,format:'iife',target:['chrome100','safari15','firefox100'],minify:true,legalComments:'none'});
const css=await readFile('src/style.css','utf8'); const template=await readFile('src/template.html','utf8');
await writeFile('ClearHot_Local.html',template.replace('/*STYLES*/',css).replace('/*SCRIPT*/',()=>js.outputFiles[0].text.replace(/<\/script/gi,'<\\/script')));
await esbuild.build({entryPoints:['src/core.ts'],bundle:true,platform:'node',format:'cjs',outfile:'tests/core.cjs',target:'node18'});
console.log('Built self-contained ClearHot_Local.html');
