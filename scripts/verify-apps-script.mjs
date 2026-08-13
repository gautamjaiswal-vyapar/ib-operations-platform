import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const directory=path.resolve('apps-script');
const files=fs.readdirSync(directory).filter(name=>name.endsWith('.gs')).sort();
if(files.length<8)throw new Error('Apps Script service files are missing.');
const source=files.map(name=>fs.readFileSync(path.join(directory,name),'utf8')).join('\n');
new vm.Script(source,{filename:'ib-operations-apps-script.gs'});
['doGet','doPost','configurePlatform','setupPlatform','setOwnerPassword','installPlatformTriggers','dailyAgentDataRefreshJob','login_','authenticate_','batchMonthlyMappings_','batchTargets_','resolveSheetConnection_','previewAgentDump_','importAgentDump_','importRevenueSheet_'].forEach(name=>{if(!new RegExp(`function\\s+${name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\s*\\(`).test(source))throw new Error(`Missing required Apps Script function: ${name}`);});
const manifest=JSON.parse(fs.readFileSync(path.join(directory,'appsscript.json'),'utf8'));
if(manifest.runtimeVersion!=='V8')throw new Error('Apps Script V8 runtime is required.');
if(!source.includes("email='gautam.jaiswal@vyapar.com'"))throw new Error('Configured OWNER account is missing.');
console.log(`Verified ${files.length} Apps Script files and ${Object.keys(manifest).length} manifest sections.`);
