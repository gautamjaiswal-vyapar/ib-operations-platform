var PLATFORM = Object.freeze({
  NAME: 'IB Operations Platform',
  SPREADSHEET_ID: '1m4xZqI-Y5UHBgaYPed_kbAPaUqqeDQWT3JzlhJOo6W4',
  ROLES: ['OWNER','ADMIN','EDITOR','VIEWER'],
  WRITE_ROLES: ['OWNER','ADMIN','EDITOR'],
  SHEETS: Object.freeze({
    configuration:['key','value','description','updatedAt','updatedBy'],
    users:['id','email','fullName','role','status','passwordHash','passwordSalt','failedAttempts','lockedUntil','activationCodeHash','activationExpiresAt','createdAt','updatedAt','lastLoginAt'],
    sessions:['id','tokenHash','email','createdAt','expiresAt','lastSeenAt','revokedAt'],
    loginEvents:['id','email','fullName','signedInAt','correlationId'],
    accessRequests:['id','email','fullName','requestedRole','reason','status','reviewNote','reviewedBy','reviewedAt','createdAt'],
    sources:['id','name','code','description','active','createdAt','createdBy','updatedAt','updatedBy'],
    executives:['id','employeeId','name','email','doj','status','manager','source','tenurity','active','createdAt','updatedAt'],
    managerMappings:['id','employeeId','manager','effectiveFrom','effectiveTo','active','createdAt','createdBy'],
    monthlyMappings:['id','month','executiveId','employeeId','name','email','manager','source','tenurity','status','frozenAt','createdAt','createdBy','selectedWeeks'],
    weeklyMappings:['id','weekStart','executiveId','employeeId','name','manager','source','tenurity','status','frozenAt','createdAt'],
    targetVersions:['id','source','tenurity','version','effectiveFrom','effectiveTo','revenue','login','demo','license','proPlatform','arpl','status','createdAt','createdBy'],
    weeklyTargets:['id','weekStart','executiveId','source','tenurity','targetVersion','revenue','login','demo','license','proPlatform','arpl','createdAt'],
    monthlyTargets:['id','month','executiveId','source','tenurity','targetVersion','revenue','login','demo','license','proPlatform','arpl','createdAt'],
    weeklySnapshots:['id','weekStart','status','rowCount','createdAt','createdBy'],
    monthlySnapshots:['id','month','status','rowCount','createdAt','createdBy'],
    performance:['id','periodType','period','executiveId','revenue','login','demo','license','proPlatform','manualRevenue','updatedAt','updatedBy'],
    weeklyIncentives:['id','month','weekStart','executiveId','executiveName','manager','target','eligibleRevenue','achievement','bonus','incentive','calculationVersion','createdAt','createdBy'],
    incentives:['id','month','executiveId','executiveName','manager','target','eligibleRevenue','achievement','bonus','incentive','calculationVersion','createdAt','createdBy'],
    bonusRules:['id','name','minAchievement','maxAchievement','incentiveRate','bonusMultiplier','managerRule','effectiveFrom','effectiveTo','active'],
    auditLogs:['id','timestamp','user','sheet','module','action','recordId','oldValue','newValue','reason','version','correlationId'],
    sheetImports:['id','type','fileName','status','rowCount','errorCount','createdAt','createdBy'],
    agentDataDump:['data_month','employee_id','executive_name','email','doj','manager'],
    notifications:['id','recipient','type','subject','body','status','createdAt','sentAt']
  })
});

function configurePlatform(spreadsheetId) {
  if (!spreadsheetId) throw new Error('Spreadsheet ID is required.');
  PropertiesService.getScriptProperties().setProperty('SPREADSHEET_ID',String(spreadsheetId));
  return setupPlatform();
}

function setupPlatform() {
  var spreadsheet = SpreadsheetApp.openById(requiredProperty_('SPREADSHEET_ID'));
  migrateLegacyAgentSheet_(spreadsheet);
  Object.keys(PLATFORM.SHEETS).forEach(function(name){ ensureSheet_(spreadsheet,name,PLATFORM.SHEETS[name]); });
  var defaultSheet=spreadsheet.getSheetByName('Sheet1');if(defaultSheet&&defaultSheet.getLastRow()===0&&spreadsheet.getSheets().length>1)spreadsheet.deleteSheet(defaultSheet);
  seedConfiguration_();
  bootstrapAdministrator_();
  return {spreadsheetId:spreadsheet.getId(),sheets:Object.keys(PLATFORM.SHEETS),status:'READY'};
}

function migrateLegacyAgentSheet_(spreadsheet){var current=spreadsheet.getSheetByName('agentDataDump');var legacy=spreadsheet.getSheetByName('bigQueryAgentDump');if(current)return;if(!legacy||legacy.getLastRow()>1)return;if(legacy.getMaxColumns()<PLATFORM.SHEETS.agentDataDump.length)legacy.insertColumnsAfter(legacy.getMaxColumns(),PLATFORM.SHEETS.agentDataDump.length-legacy.getMaxColumns());legacy.getRange(1,1,1,Math.max(legacy.getLastColumn(),PLATFORM.SHEETS.agentDataDump.length)).clearContent();legacy.setName('agentDataDump');}

function requiredProperty_(name){var value=PropertiesService.getScriptProperties().getProperty(name);if(!value&&name==='SPREADSHEET_ID')value=PLATFORM.SPREADSHEET_ID;if(!value)throw new Error('Missing Script Property: '+name);return value;}
function now_(){return new Date().toISOString();}
function id_(){return Utilities.getUuid();}
function normalizeEmail_(value){return String(value||'').trim().toLowerCase();}
function safeJson_(value){try{return JSON.stringify(value);}catch(error){return JSON.stringify({serializationError:String(error)});}}
function seedConfiguration_(){var repo=new SheetRepository_('configuration');if(repo.all().length)return;repo.insertMany([{key:'platformName',value:PLATFORM.NAME,description:'Display name',updatedAt:now_(),updatedBy:'SYSTEM'},{key:'timeZone',value:Session.getScriptTimeZone(),description:'Business time zone',updatedAt:now_(),updatedBy:'SYSTEM'}]);}
function bootstrapAdministrator_(){var email='gautam.jaiswal@vyapar.com';var repo=new SheetRepository_('users');if(repo.find(function(row){return row.email===email;}).length)return;var stamp=now_();repo.insertMany([{id:id_(),email:email,fullName:'Gautam Jaiswal',role:'OWNER',status:'INVITED',passwordHash:'',passwordSalt:'',failedAttempts:0,lockedUntil:'',activationCodeHash:'',activationExpiresAt:'',createdAt:stamp,updatedAt:stamp,lastLoginAt:''}]);}
function setOwnerPassword(password){setupPlatform();var result=setUserPassword_('gautam.jaiswal@vyapar.com',password,'OWNER');audit_(systemContext_(),'users','Authentication','OWNER_PASSWORD_SET','',null,{email:result.email,role:result.role},'Initial owner credential configured',1);return result;}
