// Bootstrap the imported design-system gate without retroactively linting
// either repository's existing UI. After the sync reaches the base branch,
// use upstream's ordinary changed-file check without an extra baseline.
import {execFileSync,spawnSync} from 'node:child_process';

const base=process.argv[2];
if(!base)throw Error('Usage: node scripts/check-sync-ui.mjs BASE');
const imported='4da3a2e3de568c5ad12717783db9cf3c9ddd8933';
const gitSucceeds=(...args)=>spawnSync('git',args,{stdio:'ignore'}).status===0;
const checker='design-system/checks/check-changed.mjs';
function check(ref){
 const result=spawnSync(process.execPath,[checker,'--base',ref],{encoding:'utf8',maxBuffer:64*1024*1024});
 const summary=result.stdout?.match(/^Checked .*; (\d+) new errors; .*$/m);
 if(result.error||![0,1].includes(result.status)||!summary)throw Error(result.error?.message||result.stderr||'UI checker failed to produce a report');
 const errors=result.stdout.split('\n').filter(line=>/^.+:\d+:\d+ (?!ds-allow\b)[\w-]+ /.test(line));
 if(errors.length!==Number(summary[1]))throw Error('Unrecognized UI checker output');
 return {result,errors};
}
// Validate the requested revision before testing for the historic submodule.
execFileSync('git',['rev-parse','--verify',`${base}^{commit}`],{stdio:'ignore'});
const baseHasDesignSystem=/^160000 commit /m.test(execFileSync('git',['ls-tree',base,'--','design-system'],{encoding:'utf8'}));
const initialSync=!baseHasDesignSystem
 &&gitSucceeds('merge-base','--is-ancestor',imported,'HEAD');
const primary=check(base);
if(!initialSync){
 process.stdout.write(primary.result.stdout);
 process.exitCode=primary.result.status;
}else{
 const upstream=check(imported),upstreamErrors=new Set(upstream.errors);
 // Locations describe the same working tree in both reports. A finding is
 // new only when neither pre-existing history supplies its allowance.
 const added=primary.errors.filter(error=>upstreamErrors.has(error));
 for(const error of added)console.log(error);
 console.log(`Initial upstream sync: ${primary.errors.length-added.length} inherited findings; ${added.length} new errors against both ${base} and ${imported}.`);
 process.exitCode=added.length?1:0;
}
