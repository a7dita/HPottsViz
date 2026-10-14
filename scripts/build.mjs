import { mkdir,cp,rm } from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist');
for(const file of ['index.html','style.css','app.js','worker.js','favicon.svg','lib'])await cp(file,`dist/${file}`,{recursive:true});
console.log('Built static HPottsViz → dist');
