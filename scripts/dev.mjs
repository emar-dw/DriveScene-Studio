import {context} from 'esbuild';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const port=Number(process.env.DRIVESCENE_PORT||8000);
if(!Number.isInteger(port)||port<0||port>65535)throw new Error('DRIVESCENE_PORT must be a port number between 0 and 65535.');
const build=await context({
 absWorkingDir:root,entryPoints:['app.js'],bundle:true,format:'esm',
 outfile:'app.bundle.js',write:false,sourcemap:'inline',minify:false,
 target:['chrome110','safari17','firefox115']
});
try{
 await build.rebuild();
 await build.watch();
 const server=await build.serve({servedir:root,host:'127.0.0.1',port});
 console.log(`DriveScene ready at http://127.0.0.1:${server.port}`);
 console.log('Source maps enabled. Save source changes, then refresh the browser.');
}catch(error){await build.dispose();throw error;}

let stopping=false;
async function stop(){if(stopping)return;stopping=true;await build.dispose();process.exit(0);}
process.once('SIGINT',stop);process.once('SIGTERM',stop);
