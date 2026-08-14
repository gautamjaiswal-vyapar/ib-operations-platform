function configurationMap_(){var result={};new SheetRepository_('configuration').all().forEach(function(row){result[row.key]=String(row.value);});return result;}
function normalizeSpreadsheetId_(value){var text=String(value||'').trim();var match=text.match(/\/spreadsheets\/d\/([A-Za-z0-9_-]+)/);return match?match[1]:text;}
function normalizedHeader_(value){return String(value||'').trim().toLowerCase().replace(/[^a-z0-9]/g,'');}
function platformTimeZone_(){try{return Session.getScriptTimeZone()||'Asia/Kolkata';}catch(error){return'Asia/Kolkata';}}
function dateOnly_(value){if(value instanceof Date&&!isNaN(value.getTime()))return Utilities.formatDate(value,platformTimeZone_(),'yyyy-MM-dd');var text=String(value||'').trim();if(!text)return'';if(/^\d{4}-\d{2}-\d{2}/.test(text))return text.slice(0,10);if(/^\d{4}-\d{2}$/.test(text))return text+'-01';var date=new Date(text);return isNaN(date.getTime())?'':Utilities.formatDate(date,platformTimeZone_(),'yyyy-MM-dd');}
function monthOnly_(value){if(value instanceof Date&&!isNaN(value.getTime()))return Utilities.formatDate(value,platformTimeZone_(),'yyyy-MM');var text=String(value||'').trim();if(/^\d{4}-\d{2}/.test(text))return text.slice(0,7);var date=dateOnly_(value);return date?date.slice(0,7):'';}

function readConnectedTable_(sheet,aliases,required){
  var lastRow=sheet.getLastRow();var lastColumn=sheet.getLastColumn();
  if(lastRow<1||lastColumn<1)throw apiError_(400,'Connection tab '+sheet.getName()+' is empty.');
  var values=sheet.getRange(1,1,lastRow,lastColumn).getValues();
  var headers=values[0].map(function(value){return aliases[normalizedHeader_(value)]||'';});
  required.forEach(function(field){if(headers.indexOf(field)<0)throw apiError_(400,'Connection tab '+sheet.getName()+' is missing header: '+field);});
  var rows=values.slice(1).filter(function(row){return row.some(function(value){return value!=='';});}).map(function(row,index){var record={sourceRow:index+2};headers.forEach(function(header,column){if(header)record[header]=row[column];});return record;});
  return{rows:rows,headers:headers,sourceSheet:sheet.getName()};
}

function resolveSheetConnection_(options){
  var config=configurationMap_();var spreadsheetId=normalizeSpreadsheetId_(config[options.spreadsheetKey]||requiredProperty_('SPREADSHEET_ID'));var spreadsheet=SpreadsheetApp.openById(spreadsheetId);var configuredName=String(config[options.sheetKey]||'').trim();
  if(configuredName){var configured=spreadsheet.getSheetByName(configuredName);if(configured){try{var configuredTable=readConnectedTable_(configured,options.aliases,options.required);configuredTable.spreadsheetId=spreadsheetId;configuredTable.configured=true;return configuredTable;}catch(error){console.warn('Configured '+options.label+' tab is unavailable or incompatible; using discovery: '+error.message);}}else console.warn('Configured '+options.label+' tab was not found; using discovery: '+configuredName);}
  var names=[];(options.candidates||[]).forEach(function(name){if(names.indexOf(name)<0)names.push(name);});spreadsheet.getSheets().forEach(function(sheet){if(names.indexOf(sheet.getName())<0&&(!options.exclude||!options.exclude[sheet.getName()]))names.push(sheet.getName());});
  var emptyMatch=null;for(var index=0;index<names.length;index++){var name=names[index];var sheet=spreadsheet.getSheetByName(name);if(!sheet)continue;try{var table=readConnectedTable_(sheet,options.aliases,options.required);table.spreadsheetId=spreadsheetId;table.configured=false;if(table.rows.length)return table;if(!emptyMatch)emptyMatch=table;}catch(error){console.warn('Skipping incompatible connection tab '+name+': '+error.message);}}
  if(emptyMatch)return emptyMatch;throw apiError_(404,'No compatible '+options.label+' connection was found. Configure a spreadsheet and tab with the required headers.');
}

function saveConnectionConfiguration_(context,prefix,spreadsheetId,sheetName,label){
  var normalizedId=normalizeSpreadsheetId_(spreadsheetId||requiredProperty_('SPREADSHEET_ID'));if(!normalizedId||!sheetName)throw apiError_(400,label+' spreadsheet and tab name are required.');var spreadsheet=SpreadsheetApp.openById(normalizedId);if(!spreadsheet.getSheetByName(sheetName))throw apiError_(404,label+' tab was not found: '+sheetName);
  return withWriteLock_(function(){var repo=new SheetRepository_('configuration');var rows=repo.all();var stamp=now_();var values={};values[prefix+'SpreadsheetId']=normalizedId;values[prefix+'SheetName']=sheetName;Object.keys(values).forEach(function(key){var index=rows.findIndex(function(row){return row.key===key;});var record={key:key,value:values[key],description:label+' sheet connection',updatedAt:stamp,updatedBy:context.email};if(index>=0)rows[index]=record;else rows.push(record);});repo.replaceAll(rows);audit_(context,'configuration','Connections','CONFIGURE','',null,{type:prefix,spreadsheetId:normalizedId,sheetName:sheetName},label+' sheet connection updated',1);return{spreadsheetId:normalizedId,sheetName:sheetName};});
}
