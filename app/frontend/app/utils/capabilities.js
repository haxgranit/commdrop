import $ from 'jquery';
import stashes from './_stashes';
import tts_voices from './tts_voices';

// ;/*! IndexedDBShim - v0.1.2 - 2014-10-21 */
// "use strict";var idbModules={},cleanInterface=!1;(function(){var e={test:!0};if(Object.defineProperty)try{Object.defineProperty(e,"test",{enumerable:!1}),e.test&&(cleanInterface=!0)}catch(t){}})(),function(e){function t(e,t,n,o){n.target=t,"function"==typeof t[e]&&t[e].apply(t,[n]),"function"==typeof o&&o()}function n(t,n,o){var r;try{r=new DOMException.prototype.constructor(0,n)}catch(i){r=Error(n)}throw r.name=t,r.message=n,e.DEBUG&&(console.log(t,n,o,r),console.trace&&console.trace()),r}var o=function(){this.length=0,this._items=[],cleanInterface&&Object.defineProperty(this,"_items",{enumerable:!1})};if(o.prototype={contains:function(e){return-1!==this._items.indexOf(e)},item:function(e){return this._items[e]},indexOf:function(e){return this._items.indexOf(e)},push:function(e){this._items.push(e),this.length+=1;for(var t=0;this._items.length>t;t++)this[t]=this._items[t]},splice:function(){this._items.splice.apply(this._items,arguments),this.length=this._items.length;for(var e in this)e===parseInt(e,10)+""&&delete this[e];for(e=0;this._items.length>e;e++)this[e]=this._items[e]}},cleanInterface)for(var r in{indexOf:!1,push:!1,splice:!1})Object.defineProperty(o.prototype,r,{enumerable:!1});e.util={throwDOMException:n,callback:t,quote:function(e){return"'"+e+"'"},StringList:o}}(idbModules),function(idbModules){var Sca=function(){return{decycle:function(object,callback){function checkForCompletion(){0===queuedObjects.length&&returnCallback(derezObj)}function readBlobAsDataURL(e,t){var n=new FileReader;n.onloadend=function(e){var n=e.target.result,o="blob";updateEncodedBlob(n,t,o)},n.readAsDataURL(e)}function updateEncodedBlob(dataURL,path,blobtype){var encoded=queuedObjects.indexOf(path);path=path.replace("$","derezObj"),eval(path+'.$enc="'+dataURL+'"'),eval(path+'.$type="'+blobtype+'"'),queuedObjects.splice(encoded,1),checkForCompletion()}function derez(e,t){var n,o,r;if(!("object"!=typeof e||null===e||e instanceof Boolean||e instanceof Date||e instanceof Number||e instanceof RegExp||e instanceof Blob||e instanceof String)){for(n=0;objects.length>n;n+=1)if(objects[n]===e)return{$ref:paths[n]};if(objects.push(e),paths.push(t),"[object Array]"===Object.prototype.toString.apply(e))for(r=[],n=0;e.length>n;n+=1)r[n]=derez(e[n],t+"["+n+"]");else{r={};for(o in e)Object.prototype.hasOwnProperty.call(e,o)&&(r[o]=derez(e[o],t+"["+JSON.stringify(o)+"]"))}return r}return e instanceof Blob?(queuedObjects.push(t),readBlobAsDataURL(e,t)):e instanceof Boolean?e={$type:"bool",$enc:""+e}:e instanceof Date?e={$type:"date",$enc:e.getTime()}:e instanceof Number?e={$type:"num",$enc:""+e}:e instanceof RegExp&&(e={$type:"regex",$enc:""+e}),e}var objects=[],paths=[],queuedObjects=[],returnCallback=callback,derezObj=derez(object,"$");checkForCompletion()},retrocycle:function retrocycle($){function dataURLToBlob(e){var t,n,o,r=";base64,";if(-1===e.indexOf(r))return n=e.split(","),t=n[0].split(":")[1],o=n[1],new Blob([o],{type:t});n=e.split(r),t=n[0].split(":")[1],o=window.atob(n[1]);for(var i=o.length,a=new Uint8Array(i),s=0;i>s;++s)a[s]=o.charCodeAt(s);return new Blob([a.buffer],{type:t})}function rez(value){var i,item,name,path;if(value&&"object"==typeof value)if("[object Array]"===Object.prototype.toString.apply(value))for(i=0;value.length>i;i+=1)item=value[i],item&&"object"==typeof item&&(path=item.$ref,value[i]="string"==typeof path&&px.test(path)?eval(path):rez(item));else if(void 0!==value.$type)switch(value.$type){case"blob":case"file":value=dataURLToBlob(value.$enc);break;case"bool":value=Boolean("true"===value.$enc);break;case"date":value=new Date(value.$enc);break;case"num":value=Number(value.$enc);break;case"regex":value=eval(value.$enc)}else for(name in value)"object"==typeof value[name]&&(item=value[name],item&&(path=item.$ref,value[name]="string"==typeof path&&px.test(path)?eval(path):rez(item)));return value}var px=/^\$(?:\[(?:\d+|\"(?:[^\\\"\u0000-\u001f]|\\([\\\"\/bfnrt]|u[0-9a-zA-Z]{4}))*\")\])*$/;return rez($),$},encode:function(e,t){function n(e){t(JSON.stringify(e))}this.decycle(e,n)},decode:function(e){return this.retrocycle(JSON.parse(e))}}}();idbModules.Sca=Sca}(idbModules),function(e){var t=["","number","string","boolean","object","undefined"],n=function(){return{encode:function(e){return t.indexOf(typeof e)+"-"+JSON.stringify(e)},decode:function(e){return e===void 0?void 0:JSON.parse(e.substring(2))}}},o={number:n("number"),"boolean":n(),object:n(),string:{encode:function(e){return t.indexOf("string")+"-"+e},decode:function(e){return""+e.substring(2)}},undefined:{encode:function(){return t.indexOf("undefined")+"-undefined"},decode:function(){return void 0}}},r=function(){return{encode:function(e){return o[typeof e].encode(e)},decode:function(e){return o[t[e.substring(0,1)]].decode(e)}}}();e.Key=r}(idbModules),function(e){var t=function(e,t){return{type:e,debug:t,bubbles:!1,cancelable:!1,eventPhase:0,timeStamp:new Date}};e.Event=t}(idbModules),function(e){var t=function(){this.onsuccess=this.onerror=this.result=this.error=this.source=this.transaction=null,this.readyState="pending"},n=function(){this.onblocked=this.onupgradeneeded=null};n.prototype=t,e.IDBRequest=t,e.IDBOpenRequest=n}(idbModules),function(e,t){var n=function(e,t,n,o){this.lower=e,this.upper=t,this.lowerOpen=n,this.upperOpen=o};n.only=function(e){return new n(e,e,!1,!1)},n.lowerBound=function(e,o){return new n(e,t,o,t)},n.upperBound=function(e){return new n(t,e,t,open)},n.bound=function(e,t,o,r){return new n(e,t,o,r)},e.IDBKeyRange=n}(idbModules),function(e,t){function n(n,o,r,i,a,s){!n||n instanceof e.IDBKeyRange||(n=new e.IDBKeyRange(n,n,!1,!1)),this.__range=n,this.source=this.__idbObjectStore=r,this.__req=i,this.key=t,this.direction=o,this.__keyColumnName=a,this.__valueColumnName=s,this.__valueDecoder="value"===s?e.Sca:e.Key,this.source.transaction.__active||e.util.throwDOMException("TransactionInactiveError - The transaction this IDBObjectStore belongs to is not active."),this.__offset=-1,this.__lastKeyContinued=t,this["continue"]()}n.prototype.__find=function(n,o,r,i,a){a=a||1;var s=this,c=["SELECT * FROM ",e.util.quote(s.__idbObjectStore.name)],u=[];c.push("WHERE ",s.__keyColumnName," NOT NULL"),!s.__range||s.__range.lower===t&&s.__range.upper===t||(c.push("AND"),s.__range.lower!==t&&(c.push(s.__keyColumnName+(s.__range.lowerOpen?" >":" >= ")+" ?"),u.push(e.Key.encode(s.__range.lower))),s.__range.lower!==t&&s.__range.upper!==t&&c.push("AND"),s.__range.upper!==t&&(c.push(s.__keyColumnName+(s.__range.upperOpen?" < ":" <= ")+" ?"),u.push(e.Key.encode(s.__range.upper)))),n!==t&&(s.__lastKeyContinued=n,s.__offset=0),s.__lastKeyContinued!==t&&(c.push("AND "+s.__keyColumnName+" >= ?"),u.push(e.Key.encode(s.__lastKeyContinued)));var d="prev"===s.direction||"prevunique"===s.direction?"DESC":"ASC";c.push("ORDER BY ",s.__keyColumnName," "+d),c.push("LIMIT "+a+" OFFSET "+s.__offset),e.DEBUG&&console.log(c.join(" "),u),s.__prefetchedData=null,o.executeSql(c.join(" "),u,function(n,o){o.rows.length>1?(s.__prefetchedData=o.rows,s.__prefetchedIndex=0,e.DEBUG&&console.log("Preloaded "+s.__prefetchedData.length+" records for cursor"),s.__decode(o.rows.item(0),r)):1===o.rows.length?s.__decode(o.rows.item(0),r):(e.DEBUG&&console.log("Reached end of cursors"),r(t,t))},function(t,n){e.DEBUG&&console.log("Could not execute Cursor.continue"),i(n)})},n.prototype.__decode=function(t,n){var o=e.Key.decode(t[this.__keyColumnName]),r=this.__valueDecoder.decode(t[this.__valueColumnName]),i=e.Key.decode(t.key);n(o,r,i)},n.prototype["continue"]=function(n){var o=e.cursorPreloadPackSize||100,r=this;this.__idbObjectStore.transaction.__addToTransactionQueue(function(e,i,a,s){r.__offset++;var c=function(e,n,o){r.key=e,r.value=n,r.primaryKey=o,a(r.key!==t?r:t,r.__req)};return r.__prefetchedData&&(r.__prefetchedIndex++,r.__prefetchedIndex<r.__prefetchedData.length)?(r.__decode(r.__prefetchedData.item(r.__prefetchedIndex),c),t):(r.__find(n,e,c,s,o),t)})},n.prototype.advance=function(n){0>=n&&e.util.throwDOMException("Type Error - Count is invalid - 0 or negative",n);var o=this;this.__idbObjectStore.transaction.__addToTransactionQueue(function(e,r,i,a){o.__offset+=n,o.__find(t,e,function(e,n){o.key=e,o.value=n,i(o.key!==t?o:t,o.__req)},a)})},n.prototype.update=function(n){var o=this,r=this.__idbObjectStore.transaction.__createRequest(function(){});return e.Sca.encode(n,function(i){o.__idbObjectStore.transaction.__pushToQueue(r,function(r,a,s,c){o.__find(t,r,function(t,a,u){var d=o.__idbObjectStore,l=o.__idbObjectStore.transaction.db.__storeProperties,_=[i],f="UPDATE "+e.util.quote(d.name)+" SET value = ?",p=l[d.name]&&l[d.name].indexList;if(p)for(var h in p){var b=p[h];f+=", "+h+" = ?",_.push(e.Key.encode(n[b.keyPath]))}f+=" WHERE key = ?",_.push(e.Key.encode(u)),e.DEBUG&&console.log(f,i,t,u),r.executeSql(f,_,function(e,n){o.__prefetchedData=null,1===n.rowsAffected?s(t):c("No rows with key found"+t)},function(e,t){c(t)})},c)})}),r},n.prototype["delete"]=function(){var n=this;return this.__idbObjectStore.transaction.__addToTransactionQueue(function(o,r,i,a){n.__find(t,o,function(r,s,c){var u="DELETE FROM  "+e.util.quote(n.__idbObjectStore.name)+" WHERE key = ?";e.DEBUG&&console.log(u,r,c),o.executeSql(u,[e.Key.encode(c)],function(e,o){n.__prefetchedData=null,1===o.rowsAffected?(n.__offset--,i(t)):a("No rows with key found"+r)},function(e,t){a(t)})},a)})},e.IDBCursor=n}(idbModules),function(idbModules,undefined){function IDBIndex(e,t){this.indexName=this.name=e,this.__idbObjectStore=this.objectStore=this.source=t;var n=t.transaction.db.__storeProperties[t.name],o=n&&n.indexList;this.keyPath=o&&o[e]&&o[e].keyPath||e,["multiEntry","unique"].forEach(function(t){this[t]=!!(o&&o[e]&&o[e].optionalParams&&o[e].optionalParams[t])},this)}IDBIndex.prototype.__createIndex=function(indexName,keyPath,optionalParameters){var me=this,transaction=me.__idbObjectStore.transaction;transaction.__addToTransactionQueue(function(tx,args,success,failure){me.__idbObjectStore.__getStoreProps(tx,function(){function error(){idbModules.util.throwDOMException(0,"Could not create new index",arguments)}2!==transaction.mode&&idbModules.util.throwDOMException(0,"Invalid State error, not a version transaction",me.transaction);var idxList=JSON.parse(me.__idbObjectStore.__storeProps.indexList);idxList[indexName]!==undefined&&idbModules.util.throwDOMException(0,"Index already exists on store",idxList);var columnName=indexName;idxList[indexName]={columnName:columnName,keyPath:keyPath,optionalParams:optionalParameters},me.__idbObjectStore.__storeProps.indexList=JSON.stringify(idxList);var sql=["ALTER TABLE",idbModules.util.quote(me.__idbObjectStore.name),"ADD",columnName,"BLOB"].join(" ");idbModules.DEBUG&&console.log(sql),tx.executeSql(sql,[],function(tx,data){tx.executeSql("SELECT * FROM "+idbModules.util.quote(me.__idbObjectStore.name),[],function(tx,data){(function initIndexForRow(i){if(data.rows.length>i)try{var value=idbModules.Sca.decode(data.rows.item(i).value),indexKey=eval("value['"+keyPath+"']");tx.executeSql("UPDATE "+idbModules.util.quote(me.__idbObjectStore.name)+" set "+columnName+" = ? where key = ?",[idbModules.Key.encode(indexKey),data.rows.item(i).key],function(){initIndexForRow(i+1)},error)}catch(e){initIndexForRow(i+1)}else idbModules.DEBUG&&console.log("Updating the indexes in table",me.__idbObjectStore.__storeProps),tx.executeSql("UPDATE __sys__ set indexList = ? where name = ?",[me.__idbObjectStore.__storeProps.indexList,me.__idbObjectStore.name],function(){me.__idbObjectStore.__setReadyState("createIndex",!0),success(me)},error)})(0)},error)},error)},"createObjectStore")})},IDBIndex.prototype.openCursor=function(e,t){var n=new idbModules.IDBRequest;return new idbModules.IDBCursor(e,t,this.source,n,this.indexName,"value"),n},IDBIndex.prototype.openKeyCursor=function(e,t){var n=new idbModules.IDBRequest;return new idbModules.IDBCursor(e,t,this.source,n,this.indexName,"key"),n},IDBIndex.prototype.__fetchIndexData=function(e,t){var n=this;return n.__idbObjectStore.transaction.__addToTransactionQueue(function(o,r,i,a){var s=["SELECT * FROM ",idbModules.util.quote(n.__idbObjectStore.name)," WHERE",n.indexName,"NOT NULL"],c=[];e!==undefined&&(s.push("AND",n.indexName," = ?"),c.push(idbModules.Key.encode(e))),idbModules.DEBUG&&console.log("Trying to fetch data for Index",s.join(" "),c),o.executeSql(s.join(" "),c,function(e,n){var o;o="count"===t?n.rows.length:0===n.rows.length?undefined:"key"===t?idbModules.Key.decode(n.rows.item(0).key):idbModules.Sca.decode(n.rows.item(0).value),i(o)},a)})},IDBIndex.prototype.get=function(e){return this.__fetchIndexData(e,"value")},IDBIndex.prototype.getKey=function(e){return this.__fetchIndexData(e,"key")},IDBIndex.prototype.count=function(e){return this.__fetchIndexData(e,"count")},idbModules.IDBIndex=IDBIndex}(idbModules),function(idbModules){var IDBObjectStore=function(e,t,n){this.name=e,this.transaction=t,this.__ready={},this.__setReadyState("createObjectStore",n===void 0?!0:n),this.indexNames=new idbModules.util.StringList;var o=t.db.__storeProperties;if(o[e]&&o[e].indexList){var r=o[e].indexList;for(var i in r)r.hasOwnProperty(i)&&this.indexNames.push(i)}};IDBObjectStore.prototype.__setReadyState=function(e,t){this.__ready[e]=t},IDBObjectStore.prototype.__waitForReady=function(e,t){var n=!0;if(t!==void 0)n=this.__ready[t]===void 0?!0:this.__ready[t];else for(var o in this.__ready)this.__ready[o]||(n=!1);if(n)e();else{idbModules.DEBUG&&console.log("Waiting for to be ready",t);var r=this;window.setTimeout(function(){r.__waitForReady(e,t)},100)}},IDBObjectStore.prototype.__getStoreProps=function(e,t,n){var o=this;this.__waitForReady(function(){o.__storeProps?(idbModules.DEBUG&&console.log("Store properties - cached",o.__storeProps),t(o.__storeProps)):e.executeSql("SELECT * FROM __sys__ where name = ?",[o.name],function(e,n){1!==n.rows.length?t():(o.__storeProps={name:n.rows.item(0).name,indexList:n.rows.item(0).indexList,autoInc:n.rows.item(0).autoInc,keyPath:n.rows.item(0).keyPath},idbModules.DEBUG&&console.log("Store properties",o.__storeProps),t(o.__storeProps))},function(){t()})},n)},IDBObjectStore.prototype.__deriveKey=function(tx,value,key,callback){function getNextAutoIncKey(){tx.executeSql("SELECT * FROM sqlite_sequence where name like ?",[me.name],function(e,t){1!==t.rows.length?callback(0):callback(t.rows.item(0).seq)},function(e,t){idbModules.util.throwDOMException(0,"Data Error - Could not get the auto increment value for key",t)})}var me=this;me.__getStoreProps(tx,function(props){if(props||idbModules.util.throwDOMException(0,"Data Error - Could not locate defination for this table",props),props.keyPath)if(key!==void 0&&idbModules.util.throwDOMException(0,"Data Error - The object store uses in-line keys and the key parameter was provided",props),value)try{var primaryKey=eval("value['"+props.keyPath+"']");void 0===primaryKey?"true"===props.autoInc?getNextAutoIncKey():idbModules.util.throwDOMException(0,"Data Error - Could not eval key from keyPath"):callback(primaryKey)}catch(e){idbModules.util.throwDOMException(0,"Data Error - Could not eval key from keyPath",e)}else idbModules.util.throwDOMException(0,"Data Error - KeyPath was specified, but value was not");else key!==void 0?callback(key):"false"===props.autoInc?idbModules.util.throwDOMException(0,"Data Error - The object store uses out-of-line keys and has no key generator and the key parameter was not provided. ",props):getNextAutoIncKey()})},IDBObjectStore.prototype.__insertData=function(tx,encoded,value,primaryKey,success,error){var paramMap={};primaryKey!==void 0&&(paramMap.key=idbModules.Key.encode(primaryKey));var indexes=JSON.parse(this.__storeProps.indexList);for(var key in indexes)try{paramMap[indexes[key].columnName]=idbModules.Key.encode(eval("value['"+indexes[key].keyPath+"']"))}catch(e){error(e)}var sqlStart=["INSERT INTO ",idbModules.util.quote(this.name),"("],sqlEnd=[" VALUES ("],sqlValues=[];for(key in paramMap)sqlStart.push(key+","),sqlEnd.push("?,"),sqlValues.push(paramMap[key]);sqlStart.push("value )"),sqlEnd.push("?)"),sqlValues.push(encoded);var sql=sqlStart.join(" ")+sqlEnd.join(" ");idbModules.DEBUG&&console.log("SQL for adding",sql,sqlValues),tx.executeSql(sql,sqlValues,function(){success(primaryKey)},function(e,t){error(t)})},IDBObjectStore.prototype.add=function(e,t){var n=this,o=n.transaction.__createRequest(function(){});return idbModules.Sca.encode(e,function(r){n.transaction.__pushToQueue(o,function(o,i,a,s){n.__deriveKey(o,e,t,function(t){n.__insertData(o,r,e,t,a,s)})})}),o},IDBObjectStore.prototype.put=function(e,t){var n=this,o=n.transaction.__createRequest(function(){});return idbModules.Sca.encode(e,function(r){n.transaction.__pushToQueue(o,function(o,i,a,s){n.__deriveKey(o,e,t,function(t){var i="DELETE FROM "+idbModules.util.quote(n.name)+" where key = ?";o.executeSql(i,[idbModules.Key.encode(t)],function(o,i){idbModules.DEBUG&&console.log("Did the row with the",t,"exist? ",i.rowsAffected),n.__insertData(o,r,e,t,a,s)},function(e,t){s(t)})})})}),o},IDBObjectStore.prototype.get=function(e){var t=this;return t.transaction.__addToTransactionQueue(function(n,o,r,i){t.__waitForReady(function(){var o=idbModules.Key.encode(e);idbModules.DEBUG&&console.log("Fetching",t.name,o),n.executeSql("SELECT * FROM "+idbModules.util.quote(t.name)+" where key = ?",[o],function(e,t){idbModules.DEBUG&&console.log("Fetched data",t);try{if(0===t.rows.length)return r();r(idbModules.Sca.decode(t.rows.item(0).value))}catch(n){idbModules.DEBUG&&console.log(n),r(void 0)}},function(e,t){i(t)})})})},IDBObjectStore.prototype["delete"]=function(e){var t=this;return t.transaction.__addToTransactionQueue(function(n,o,r,i){t.__waitForReady(function(){var o=idbModules.Key.encode(e);idbModules.DEBUG&&console.log("Fetching",t.name,o),n.executeSql("DELETE FROM "+idbModules.util.quote(t.name)+" where key = ?",[o],function(e,t){idbModules.DEBUG&&console.log("Deleted from database",t.rowsAffected),r()},function(e,t){i(t)})})})},IDBObjectStore.prototype.clear=function(){var e=this;return e.transaction.__addToTransactionQueue(function(t,n,o,r){e.__waitForReady(function(){t.executeSql("DELETE FROM "+idbModules.util.quote(e.name),[],function(e,t){idbModules.DEBUG&&console.log("Cleared all records from database",t.rowsAffected),o()},function(e,t){r(t)})})})},IDBObjectStore.prototype.count=function(e){var t=this;return t.transaction.__addToTransactionQueue(function(n,o,r,i){t.__waitForReady(function(){var o="SELECT * FROM "+idbModules.util.quote(t.name)+(e!==void 0?" WHERE key = ?":""),a=[];e!==void 0&&a.push(idbModules.Key.encode(e)),n.executeSql(o,a,function(e,t){r(t.rows.length)},function(e,t){i(t)})})})},IDBObjectStore.prototype.openCursor=function(e,t){var n=new idbModules.IDBRequest;return new idbModules.IDBCursor(e,t,this,n,"key","value"),n},IDBObjectStore.prototype.index=function(e){var t=new idbModules.IDBIndex(e,this);return t},IDBObjectStore.prototype.createIndex=function(e,t,n){var o=this;n=n||{},o.__setReadyState("createIndex",!1);var r=new idbModules.IDBIndex(e,o);o.__waitForReady(function(){r.__createIndex(e,t,n)},"createObjectStore"),o.indexNames.push(e);var i=o.transaction.db.__storeProperties[o.name];return i.indexList[e]={keyPath:t,optionalParams:n},r},IDBObjectStore.prototype.deleteIndex=function(e){var t=new idbModules.IDBIndex(e,this,!1);return t.__deleteIndex(e),t},idbModules.IDBObjectStore=IDBObjectStore}(idbModules),function(e){var t=0,n=1,o=2,r=function(o,r,i){if("number"==typeof r)this.mode=r,2!==r&&e.DEBUG&&console.log("Mode should be a string, but was specified as ",r);else if("string"==typeof r)switch(r){case"readwrite":this.mode=n;break;case"readonly":this.mode=t;break;default:this.mode=t}this.storeNames="string"==typeof o?[o]:o;for(var a=0;this.storeNames.length>a;a++)i.objectStoreNames.contains(this.storeNames[a])||e.util.throwDOMException(0,"The operation failed because the requested database object could not be found. For example, an object store did not exist but was being opened.",this.storeNames[a]);this.__active=!0,this.__running=!1,this.__requests=[],this.__aborted=!1,this.db=i,this.error=null,this.onabort=this.onerror=this.oncomplete=null};r.prototype.__executeRequests=function(){if(this.__running&&this.mode!==o)return e.DEBUG&&console.log("Looks like the request set is already running",this.mode),void 0;this.__running=!0;var t=this;window.setTimeout(function(){2===t.mode||t.__active||e.util.throwDOMException(0,"A request was placed against a transaction which is currently not active, or which is finished",t.__active),t.db.__db.transaction(function(n){function o(t,n){n&&(a.req=n),a.req.readyState="done",a.req.result=t,delete a.req.error;var o=e.Event("success");e.util.callback("onsuccess",a.req,o),s++,i()}function r(){a.req.readyState="done",a.req.error="DOMError";var t=e.Event("error",arguments);e.util.callback("onerror",a.req,t),s++,i()}function i(){return s>=t.__requests.length?(t.__active=!1,t.__requests=[],void 0):(a=t.__requests[s],a.op(n,a.args,o,r),void 0)}t.__tx=n;var a=null,s=0;try{i()}catch(c){e.DEBUG&&console.log("An exception occured in transaction",arguments),"function"==typeof t.onerror&&t.onerror()}},function(){e.DEBUG&&console.log("An error in transaction",arguments),"function"==typeof t.onerror&&t.onerror()},function(){e.DEBUG&&console.log("Transaction completed",arguments),"function"==typeof t.oncomplete&&t.oncomplete()})},1)},r.prototype.__addToTransactionQueue=function(t,n){this.__active||this.mode===o||e.util.throwDOMException(0,"A request was placed against a transaction which is currently not active, or which is finished.",this.__mode);var r=this.__createRequest();return this.__pushToQueue(r,t,n),r},r.prototype.__createRequest=function(){var t=new e.IDBRequest;return t.source=this.db,t.transaction=this,t},r.prototype.__pushToQueue=function(e,t,n){this.__requests.push({op:t,args:n,req:e}),this.__executeRequests()},r.prototype.objectStore=function(t){return new e.IDBObjectStore(t,this)},r.prototype.abort=function(){!this.__active&&e.util.throwDOMException(0,"A request was placed against a transaction which is currently not active, or which is finished",this.__active)},r.prototype.READ_ONLY=0,r.prototype.READ_WRITE=1,r.prototype.VERSION_CHANGE=2,e.IDBTransaction=r}(idbModules),function(e){var t=function(t,n,o,r){this.__db=t,this.version=o,this.objectStoreNames=new e.util.StringList;for(var i=0;r.rows.length>i;i++)this.objectStoreNames.push(r.rows.item(i).name);for(this.__storeProperties={},i=0;r.rows.length>i;i++){var a=r.rows.item(i),s=this.__storeProperties[a.name]={};s.keyPath=a.keypath,s.autoInc="true"===a.autoInc,s.indexList=JSON.parse(a.indexList)}this.name=n,this.onabort=this.onerror=this.onversionchange=null};t.prototype.createObjectStore=function(t,n){var o=this;n=n||{},n.keyPath=n.keyPath||null;var r=new e.IDBObjectStore(t,o.__versionTransaction,!1),i=o.__versionTransaction;i.__addToTransactionQueue(function(i,a,s){function c(){e.util.throwDOMException(0,"Could not create new object store",arguments)}o.__versionTransaction||e.util.throwDOMException(0,"Invalid State error",o.transaction);var u=["CREATE TABLE",e.util.quote(t),"(key BLOB",n.autoIncrement?", inc INTEGER PRIMARY KEY AUTOINCREMENT":"PRIMARY KEY",", value BLOB)"].join(" ");e.DEBUG&&console.log(u),i.executeSql(u,[],function(e){e.executeSql("INSERT INTO __sys__ VALUES (?,?,?,?)",[t,n.keyPath,n.autoIncrement?!0:!1,"{}"],function(){r.__setReadyState("createObjectStore",!0),s(r)},c)},c)}),o.objectStoreNames.push(t);var a=o.__storeProperties[t]={};return a.keyPath=n.keyPath,a.autoInc=!!n.autoIncrement,a.indexList={},r},t.prototype.deleteObjectStore=function(t){var n=function(){e.util.throwDOMException(0,"Could not delete ObjectStore",arguments)},o=this;!o.objectStoreNames.contains(t)&&n("Object Store does not exist"),o.objectStoreNames.splice(o.objectStoreNames.indexOf(t),1);var r=o.__versionTransaction;r.__addToTransactionQueue(function(){o.__versionTransaction||e.util.throwDOMException(0,"Invalid State error",o.transaction),o.__db.transaction(function(o){o.executeSql("SELECT * FROM __sys__ where name = ?",[t],function(o,r){r.rows.length>0&&o.executeSql("DROP TABLE "+e.util.quote(t),[],function(){o.executeSql("DELETE FROM __sys__ WHERE name = ?",[t],function(){},n)},n)})})})},t.prototype.close=function(){},t.prototype.transaction=function(t,n){var o=new e.IDBTransaction(t,n||1,this);return o},e.IDBDatabase=t}(idbModules),function(e){var t=4194304;if(window.openDatabase){var n=window.openDatabase("__sysdb__",1,"System Database",t);n.transaction(function(e){e.executeSql("CREATE TABLE IF NOT EXISTS dbVersions (name VARCHAR(255), version INT);",[])},function(){e.DEBUG&&console.log("Error in sysdb transaction - when creating dbVersions",arguments)});var o={open:function(o,r){function i(){if(!c){var t=e.Event("error",arguments);s.readyState="done",s.error="DOMError",e.util.callback("onerror",s,t),c=!0}}function a(a){var c=window.openDatabase(o,1,o,t);s.readyState="done",r===void 0&&(r=a||1),(0>=r||a>r)&&e.util.throwDOMException(0,"An attempt was made to open a database using a lower version than the existing version.",r),c.transaction(function(t){t.executeSql("CREATE TABLE IF NOT EXISTS __sys__ (name VARCHAR(255), keyPath VARCHAR(255), autoInc BOOLEAN, indexList BLOB)",[],function(){t.executeSql("SELECT * FROM __sys__",[],function(t,u){var d=e.Event("success");s.source=s.result=new e.IDBDatabase(c,o,r,u),r>a?n.transaction(function(t){t.executeSql("UPDATE dbVersions set version = ? where name = ?",[r,o],function(){var t=e.Event("upgradeneeded");t.oldVersion=a,t.newVersion=r,s.transaction=s.result.__versionTransaction=new e.IDBTransaction([],2,s.source),e.util.callback("onupgradeneeded",s,t,function(){var t=e.Event("success");e.util.callback("onsuccess",s,t)})},i)},i):e.util.callback("onsuccess",s,d)},i)},i)},i)}var s=new e.IDBOpenRequest,c=!1;return n.transaction(function(e){e.executeSql("SELECT * FROM dbVersions where name = ?",[o],function(e,t){0===t.rows.length?e.executeSql("INSERT INTO dbVersions VALUES (?,?)",[o,r||1],function(){a(0)},i):a(t.rows.item(0).version)},i)},i),s},deleteDatabase:function(o){function r(t){if(!s){a.readyState="done",a.error="DOMError";var n=e.Event("error");n.message=t,n.debug=arguments,e.util.callback("onerror",a,n),s=!0}}function i(){n.transaction(function(t){t.executeSql("DELETE FROM dbVersions where name = ? ",[o],function(){a.result=void 0;var t=e.Event("success");t.newVersion=null,t.oldVersion=c,e.util.callback("onsuccess",a,t)},r)},r)}var a=new e.IDBOpenRequest,s=!1,c=null;return n.transaction(function(n){n.executeSql("SELECT * FROM dbVersions where name = ?",[o],function(n,s){if(0===s.rows.length){a.result=void 0;var u=e.Event("success");return u.newVersion=null,u.oldVersion=c,e.util.callback("onsuccess",a,u),void 0}c=s.rows.item(0).version;var d=window.openDatabase(o,1,o,t);d.transaction(function(t){t.executeSql("SELECT * FROM __sys__",[],function(t,n){var o=n.rows;(function a(n){n>=o.length?t.executeSql("DROP TABLE __sys__",[],function(){i()},r):t.executeSql("DROP TABLE "+e.util.quote(o.item(n).name),[],function(){a(n+1)},function(){a(n+1)})})(0)},function(){i()})},r)})},r),a},cmp:function(t,n){return e.Key.encode(t)>e.Key.encode(n)?1:t===n?0:-1}};e.shimIndexedDB=o}}(idbModules),function(e,t){e.openDatabase!==void 0&&(e.shimIndexedDB=t.shimIndexedDB,e.shimIndexedDB&&(e.shimIndexedDB.__useShim=function(){e.indexedDB=t.shimIndexedDB,e.IDBDatabase=t.IDBDatabase,e.IDBTransaction=t.IDBTransaction,e.IDBCursor=t.IDBCursor,e.IDBKeyRange=t.IDBKeyRange,e.indexedDB!==t.shimIndexedDB&&Object.defineProperty&&Object.defineProperty(e,"indexedDB",{value:t.shimIndexedDB})},e.shimIndexedDB.__debug=function(e){t.DEBUG=e})),"indexedDB"in e||(e.indexedDB=e.indexedDB||e.webkitIndexedDB||e.mozIndexedDB||e.oIndexedDB||e.msIndexedDB);var n=!1;if((navigator.userAgent.match(/Android 2/)||navigator.userAgent.match(/Android 3/)||navigator.userAgent.match(/Android 4\.[0-3]/))&&(navigator.userAgent.match(/Chrome/)||(n=!0)),void 0!==e.indexedDB&&!n||void 0===e.openDatabase){e.IDBDatabase=e.IDBDatabase||e.webkitIDBDatabase,e.IDBTransaction=e.IDBTransaction||e.webkitIDBTransaction,e.IDBCursor=e.IDBCursor||e.webkitIDBCursor,e.IDBKeyRange=e.IDBKeyRange||e.webkitIDBKeyRange,e.IDBTransaction||(e.IDBTransaction={});try{e.IDBTransaction.READ_ONLY=e.IDBTransaction.READ_ONLY||"readonly",e.IDBTransaction.READ_WRITE=e.IDBTransaction.READ_WRITE||"readwrite"}catch(o){}}else e.shimIndexedDB.__useShim()}(window,idbModules);

// iOS8 home screen apps are doing weird things with indexeddb
var indexedDBSafe = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB || window.shimIndexedDB;
if(navigator.standalone) {
  if(window.shimIndexedDB) {
    window.shimIndexedDB.__useShim();
  }
  // indexedDBSafe = window.shimIndexedDB;
}

var capabilities;
(function() {
  var console_debug = function(str) {
    if(console.debug) {
      console.debug(str);
    } else {
      console.log(str);
    }
  };
  var ajax = $.ajax;
  var chrome;
  
  function message_client(message) {
    if(window.coughDropExtras) {
      window.coughDropExtras.extension_message(message);
    }
  }
  function storage_result(success, id, data) {
    message_client({
      type: 'storage_result', 
      id: id,
      result_type: (success ? "success" : "failure"), 
      result: data
    });
  }

  var bg = {
    send_message: function(message) {
      // try to use Chrome's bg if available, it provides slightly better
      // protections of the data and typically has cooler friends.
      if(bg.listening) {
        message.host = location.protocol + "//" + location.host;
        message.bg_call = true;
        window.postMessage(message, '*');
      } else {
        // otherwise fall back to internal defaults
        // logout, page_action, init, access_token
        if(message.type == 'logout') {
          bg.callback({type: 'logout'});
        } else if(message.type == 'page_action') {
          // just used for updating the plugin icon in chrome, feel free to ignore
        } else if(message.type == 'init') {
          // generate a db_key if none provided
          // send the db_key along with any stashed information for the current user
          stashes.persist_raw('cd_db_key', stashes.get_raw('cd_db_key') || ("db_" + Math.random().toString() + "_" + (new Date()).getTime().toString()));
          var auth_settings = stashes.get_object('auth_settings', true) || {};
          var options = {
            type: 'init',
            db_key: stashes.get_raw('cd_db_key'),
            enabled: true,
            fake_listener: true,
            access_token: auth_settings.access_token,
            user_name: auth_settings.user_name,
            host: capabilities.system_host,
            credentials: capabilities.auth_credentials
          };
          bg.callback(options);
        } else if(message.type == 'access_token') {
          // similar to init except allows for setting the access_token
          var auth_settings = stashes.get_object('auth_settings', true) || {};
          if(message.access_token) {
            auth_settings.access_token = message.access_token;
            auth_settings.user_name = message.user_name;
            stashes.persist_object('auth_settings', auth_settings, true);
          }
          bg.callback({
            type: 'access_token', 
            access_token: auth_settings.access_token,
            user_name: auth_settings.user_name,
            credentials: capabilities.auth_credentials
          });
        }
      }
    },
    handle_message: function(message) {
      if(message.type == 'init') {
        if(message.enabled) {
          var initialize = function() {
            window.capabilities = capabilities;
            if(capabilities.client_initialized) { return; }
            capabilities.client_initialized = true;
            capabilities.host = message.host;
            if(message.host) {
              console_debug("COUGHDROP: extension connected, pointing requests to " + message.host);
            } else {
              console_debug("COUGHDROP: no extension connected");
            }
            bg.listening = !message.fake_listener;
            message_client({type: 'coughDropExtras', ready: true});
            capabilities.db_key = message.db_key;
            if(indexedDBSafe) {
              setup_database();
            }
            capabilities.credentials = message.credentials;
            capabilities.access_token = message.access_token;
            access_token(message.access_token, message.user_name);
          };
          if(capabilities.client_ready) {
            initialize();
          } else {
            capabilities.when_client_ready = initialize;
          }
        }
      } else if(message.type == 'access_token') {
        access_token(message.access_token, message.user_name);
      } else if(message.type == 'reload') {
        location.reload();
      } else if(message.type == 'logout') {
        var prefix = location.protocol + "//" + location.host;
        if(capabilities.host) {
          prefix = capabilities.host;
        }
        ajax(prefix + '/oauth2/token', {type: 'POST', data: {'access_token': message.access_token, '_method': 'DELETE'}}).always(function() {
          stashes.flush('auth_');
            
          location.reload();
        });
      }
    },
    listen: function() {
      bg.callback = function(message) {
        bg.handle_message(message);
      };
      window.addEventListener('message', function(event) {
        if(event.source != window) { return; }
        if(event.data && event.data.bg_response) {
          bg.handle_message(event.data);
        }
      });
    }
  };
  
  capabilities = window.capabilities || {};
  capabilities.installed_app = !!capabilities.installed_app;
  capabilities.browserless = !!(capabilities.installed_app || navigator.standalone);
  capabilities.queued_db_actions = [];
  capabilities.encryption_enabled = !!window.CryptoJS; //|| !navigator.userAgent.match(/Android|iPhone|iPad/); // TODO: real mobile browser check
  if(!capabilities.system) {
    capabilities.system = "Desktop";
    capabilities.browser = "Web browser";
    if(navigator.userAgent.match(/ipod|ipad|iphone/i)) {
      capabilities.mobile = true;
      capabilities.system = "iOS";
      if(capabilities.installed_app) {
        capabilities.browser = "App";
      } else if(navigator.userAgent.match(/crios/i)) {
        capabilities.browser = "Chrome";
      } else if(navigator.userAgent.match(/safari/i)) {
        capabilities.browser = "Safari";
      }
      var version = navigator.userAgent.match(/OS\s+([\d_]+)\s+like/)[1];
      version = parseInt(version && version.split(/_/)[0], 10);
      if(version && isFinite(version)) {
        capabilities.system_version = version;
      }
    } else if(navigator.userAgent.match(/android/i)) {
      capabilities.mobile = true;
      capabilities.system = "Android";
      if(capabilities.installed_app) {
        capabilities.browser = "App";
      } else if(navigator.userAgent.match(/chrome/i)) {
        capabilities.browser = "Chrome";
      }
    } else if(navigator.userAgent.match(/windows phone/i)) {
      capabilities.mobile = true;
      capabilities.system = "Windows Phone";
    } else {
      if(navigator.userAgent.match(/macintosh/i)) {
        capabilities.system = "Mac";
      } else if(navigator.userAgent.match(/windows\snt/i)) {
        capabilities.system = "Windows";
      }
      if(navigator.userAgent.match(/chrome/i)) {
        capabilities.browser = "Chrome";
      } else if(navigator.userAgent.match(/firefox/i)) {
        capabilities.browser = "Firefox";
      } else if(navigator.userAgent.match(/msie/i)) {
        capabilities.browser = "IE";
      } else if(navigator.userAgent.match(/edge/i)) {
        capabilities.browser = "Edge";
      }
    }
    capabilities.readable_device_name = capabilities.readable_device_name || (capabilities.browser + " for " + capabilities.system);
  }
  if(!window.CryptoJS) {
//     console_debug("COUGHDROP: indexedDB encryption is not enabled");
  }
  (function() {
    var functions = {
      init: function() {
        if(this.client_ready) { return; }
        this.client_ready = true;
        if(this.when_client_ready) {
          this.when_client_ready();
          this.when_client_ready = null;
        }
      },
      eye_gaze: {
        listen: function() {
        },
        stop_listening: function() {
        }
      },
      encrypt: function(obj) {
        if(capabilities.encryption_enabled) {
          return window.CryptoJS.AES.encrypt(JSON.stringify(obj), capabilities.db_key).toString();
        } else {
          return JSON.stringify(obj);
        }
      },
      decrypt: function(obj) {
        if(capabilities.encryption_enabled) {
          return JSON.parse(window.CryptoJS.AES.decrypt(obj, capabilities.db_key).toString(window.CryptoJS.enc.Utf8));
        } else {
          return JSON.parse(obj);
        }
      },
      share: function(options) {
        message_client({
          type: 'share',
          result_type: 'not_supported',
          options: options
        });
      },
      tts: {
        tts_exec: function(method, args, callback) {
          var promise = capabilities.mini_promise();
          if(window.cordova && window.cordova.exec) {
            var all_args = [];
            if(args) { all_args = [args]; }
            window.cordova.exec(function(res) {
              callback(promise, res);
            }, function(err) {
              promise.reject({error: 'cordova exec failed'});
            }, 'ExtraTTS', method, all_args);
          } else if(window.node_tts) {
            args = args || {};
            args.success = function(res) {
              callback(promise, res);
            };
            args.error = function(str) {
              promise.reject({error: str});
            };
            window.node_tts[method](args);
          } else {
            promise.reject({erorr: 'platform-level tts not available'});
          }
          return promise;
        },
        downloadable_voices: function() {
          return tts_voices.all();
        },
        init: function() {
          return capabilities.tts.tts_exec('init', null, function(promise, res) {
            promise.resolve(res);
          });
        },
        status: function() {
          return capabilities.tts.tts_exec('status', null, function(promise, res) {
            promise.resolve(res);
          });
        },
        available_voices: function() {
          return capabilities.tts.tts_exec('getAvailableVoices', null, function(promise, res) {
            promise.resolve(res);
          });
        },
        download_voice: function(voice_id, voice_url, progress) {
          return capabilities.tts.tts_exec('downloadVoice', 
            {
              voice_id: voice_id,
              voice_url: voice_url
            }, 
            function(promise, res) {
              if(res.done) {
                promise.resolve(res);
              } else {
                if(progress) {
                  progress(res);
                }
              }
            }
          );
        },
        delete_voice: function(voice_id) {
          var voice = capabilities.tts.downloadable_voices().find(function(v) { return v.voice_id == voice_id; });
          if(voice) {
            return capabilities.tts.tts_exec('deleteVoice',
            {
              voice_id: voice.voice_id,
              voice_dir: voice.voice_dir
            },
            function(promise, res) {
              promise.resolve(res);
            });
          } else {
            var promise = capabilities.mini_promise();
            promise.reject("voice not recognized");
            return promise;
          }
        },
        speak_text: function(text, opts) {
          var args = {
            text: text.toString(),
            voice_id: opts.voice_id,
            pitch: opts.pitch,
            rate: opts.rate,
            volume: opts.volume
          };
          return capabilities.tts.tts_exec('speakText', args, function(promise, res) {
            promise.resolve(res);
          });
        },
        stop_text: function() {
          return capabilities.tts.tts_exec('stopSpeakingText', null, function(promise, res) {
            promise.resolve(res);
          });
        }
      },
      wakelock_capable: function() {
        return !!(window.chrome && window.chrome.power && window.chrome.power.requestKeepAwake);
      },
      wakelock: function(type, enable) {
        capabilities.wakelocks = capabilities.wakelocks || {};
        capabilities.wakelocks[type] = !!enable;
        var any_wakes = false;
        for(var idx in capabilities.wakelocks) {
          if(capabilities.wakelocks[idx]) {
            any_wakes = true;
          }
        }
        if(window.chrome && window.chrome.power && window.chrome.power.requestKeepAwake) {
          if(any_wakes) {
            window.chrome.power.requestKeepAwake('display');
          } else {
            window.chrome.power.releaseKeepAwake();
          }
          return true;
        } else {
          return false;
        }
      },
      volume_check: function() {
        var res = capabilities.mini_promise();
        if(window.plugin && window.plugin.volume && window.plugin.volume.getVolume) {
          window.plugin.volume.getVolume(function(vol) {
            res.resolve(vol);
          });
        } else {
          res.reject();
        }
        return res;
      },
      fullscreen_capable: function() {
        return (window.AndroidFullScreen && window.AndroidFullScreen.isSupported()) || 
                document.body.requestFullscreen || document.body.msRequestFullscreen || 
                document.body.mozRequestFullScreen || document.body.webkitRequestFullscreen;
      },
      fullscreen: function(enable) {
        var res = capabilities.mini_promise();
        if(enable) {
          if(window.AndroidFullScreen && window.AndroidFullScreen.isSupported()) {
            window.AndroidFullScreen.immersiveMode(function() { }, function() { });
          } else if (document.body.requestFullscreen) {
            document.body.requestFullscreen();
          } else if (document.body.msRequestFullscreen) {
            document.body.msRequestFullscreen();
          } else if (document.body.mozRequestFullScreen) {
            document.body.mozRequestFullScreen();
          } else if (document.body.webkitRequestFullscreen) {
            document.body.webkitRequestFullscreen();
          }
          setTimeout(function() {
            if(document.fullScreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
              res.resolve();
            } else {
              res.reject();
            }
          }, 500);  
        } else {
          if(window.AndroidFullScreen && window.AndroidFullScreen.isSupported()) {
            window.AndroidFullScreen.showSystemUI(function() { }, function() { });
          } else if (document.exitFullscreen) {
            document.exitFullscreen();
          } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
          } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
          } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
          }
          setTimeout(function() {
            if(document.fullScreenElement || document.webkitFullscreenElement || document.mozFullScreenElement || document.msFullscreenElement) {
              res.reject();
            } else {
              res.resolve();
            }
          }, 500);  
        }
        return res;
      },
      storage_clear: function(options) {
        if(capabilities.dbman.not_ready(capabilities.storage_clear, options)) { return; }
        
        capabilities.dbman.clear(options.store, function(record) {
          storage_result(true, options.store, record);
        }, function(error) {
          storage_result(false, options.store, error);
        });
      },
      storage_find_changed: function(options) {
        // TODO: needs to clear out deletions table
        var dbs = ['image', 'sound', 'board', 'user'];
        var getters = [];
        var changes = [];
        for(var idx = 0; idx < dbs.length; idx++) {
          getters.push({
            store: dbs[idx],
            index: 'changed',
            value: true
          });
        }
        getters.push({
          store: 'deletion',
          index: null
        });
        
        function next_getter() {
          var getter = getters.shift();
          if(!getter) {
            return clear_deletions();
          }
          capabilities.dbman.find_all(getter.store, getter.index, getter.value, function(res) {
            changes = changes.concat(res);
            next_getter();
          }, function() {
            storage_result(false, options.id, {error: "error retrieving changes from db for " + getter.store});
          });
        }
        next_getter();
        
        function clear_deletions() {
//           // this belongs as a separate call in sync, not part of find_changed
//           capabilities.dbman.clear('deletion', function() {
            storage_result(true, options.id, changes);
//           }, function() {
//             storage_result(false, options.id, {error: 'error cleaning deletions'});
//           });
        }
      },
      mini_promise: function() {
        var promise = {
          resolve: function(result) {
            if(promise.resolved || promise.rejected) { return; }
            promise.resolved = true;
            promise.result = result;
            promise.resolves.forEach(function(resolve) {
              if(resolve) {
                var res = resolve(result);
                if(resolve.next_promise) {
                  resolve.next_promise.resolve(res);
                }
              }
            });
          },
          reject: function(result) {
            if(promise.resolved || promise.rejected) { return; }
            promise.rejected = true;
            promise.result = result;
            promise.rejects.forEach(function(reject) {
              if(reject) {
                var res = reject(result);
                if(reject.next_promise) {
                  reject.next_promise.reject(res);
                }
              }
            });
          },
          resolves: [],
          rejects: [],
          then: function(resolve, reject) {
            var next_promise = capabilities.mini_promise();
            resolve = resolve || function(res) {
              return res;
            };
            reject = reject || function(res) {
              return res;
            };
            if(promise.resolved) {
              if(resolve) {
                var res = resolve(promise.result);
                next_promise.resolve(res);
              }
            } else if(promise.rejected) {
              if(reject) {
                var res = reject(promise.result);
                next_promise.reject(res);
              }
            } else {
              resolve.next_promise = next_promise;
              promise.resolves.push(resolve);
              reject.next_promise = next_promise;
              promise.rejects.push(reject);
            }
            return next_promise;
          }
        };
        return promise;
      },
      storage_find: function(options) {
        if(capabilities.dbman.not_ready(capabilities.storage_find, options)) { return; }
        
        var res = capabilities.mini_promise();
        capabilities.dbman.find(options.store, options.key, function(record) {
          storage_result(true, options.id, record);
          res.resolve(record);
        }, function(error) {
          storage_result(false, options.id, error);
          res.reject(error);
        });
        return res;
      },
      storage_store: function(options) {
        if(capabilities.dbman.not_ready(capabilities.storage_store, options)) { return; }
        
        capabilities.dbman.store(options.store, options.record, function(record) {
          storage_result(true, options.id, record);
        }, function(error) {
          storage_result(false, options.id, error);
        }); 
      },
      storage_remove: function(options) {
        if(capabilities.dbman.not_ready(capabilities.storage_remove, options)) { return; }
        
        capabilities.dbman.remove(options.store, options.record_id, function(record) {
          storage_result(true, options.id, record);
        }, function(error) {
          storage_result(false, options.id, error);
        });
      },
      push_messaging: function() {
        // https://developer.chrome.com/extensions/pushMessaging.html
      },
      notify: function() {
        // https://developer.chrome.com/extensions/notifications.html
      },
      logout: function() {
        bg.send_message({type: 'logout'});
      },
      invoke: function(message) {
        if(capabilities[message.method]) {
          capabilities[message.method](message.options);
        } else {
          console_debug("capabilities method not found: " + message.method);
        }
      }
    };
    var function_maker = function(obj, key, fn) {
      obj[key] = function() {
        return fn.apply(capabilities, arguments);
      };
    };
    for(var idx in functions) {
      if(typeof functions[idx] == 'function') {
        function_maker(capabilities, idx, functions[idx]);
      } else {  
        capabilities[idx] = {};
        for(var jdx in functions[idx]) {
          function_maker(capabilities[idx], jdx, functions[idx][jdx]);
        }
      }
    }
    
    bg.listen();
    window.addEventListener('popstate', function() {
      bg.send_message({type: 'page_action'});
    });
  })();
  window.postMessage({type: 'init', host: (location.protocol + "//" + location.host), bg_call: true}, '*');
  setTimeout(function() {
    if(!bg.listening) {
      bg.send_message({type: "init"});
    }
  }, 500);
  



  // TODO: When you start separating chunks of code with multiple line breaks, it's 
  // time to split into multiple files.
  function params_from_url(url) {
    var query = url.split(/#/)[0].split(/\?/)[1] || "";
    var list = query.split(/&/);
    var params = {};
    for(var idx = 0; idx < list.length; idx++) {
      var args = list[idx].toString().split(/=/);
      if(args[0] && args[1]) {
        params[decodeURIComponent(args[0])] = decodeURIComponent(args[1]);
      }
    }
    return params;
  }

  var stashed_oauth_status = null;
  if(location.hash && location.hash.match(/^#code=/)) {
    stashed_oauth_status = {
      code: decodeURIComponent(location.hash.replace(/^#code=/, ''))
    };
  } else if(location.hash && location.hash.match(/^#error=/)) {
    stashed_oauth_status = {
      error: decodeURIComponent(location.hash.replace(/^#error=/, ''))
    };
  }
  window.addEventListener('message', function(event) {
    if(capabilities.auth_message_handler && event.data && event.data.type == 'oauth_status') {
      capabilities.auth_message_handler(event.data);
    }
  });
  function access_token(token, user_name, url) {
    if(url || stashed_oauth_status) {
      var params = stashed_oauth_status || params_from_url(url);
      stashed_oauth_status = null;
      if(params.code) {
        var prefix = capabilities.host;
        if(!prefix) { debugger; }
        ajax(prefix + "/oauth2/token", {
          method: "POST",
          data: {
            client_id: capabilities.credentials[0],
            client_secret: capabilities.credentials[1],
            redirect_uri: capabilities.credentials[2],
            code: params.code
          }
        }).then(function(data) {
          access_token(data.access_token, data.user_name);
          bg.send_message({type: 'access_token', access_token: data.access_token, user_name: data.user_name});
//           console.log(JSON.stringify(data));
        }, function(xhr) {
          console_debug("COUGHDROP: oauth token exchange failed");
          console_debug(xhr);
          message_client({type: 'access_token', error: 'token_exchange_failed'});
        });
        // ajax call to swap
      } else if(params.error) {
        console_debug("COUGHDROP: oauth response was error: " + params.error);
        message_client({type: 'access_token', error: params.error});
      } else {
        console_debug("COUGHDROP: oauth response provided neither code nor error");
        message_client({type: 'access_token', error: 'invalid_response'});
      }
    } else if(token) {
      var auth_settings = stashes.get_object('auth_settings', true) || {};
      if(auth_settings.access_token != token) {
        auth_settings.access_token = token;
        auth_settings.user_name = user_name;
        auth_settings.token_type = 'bearer';
        auth_settings.authenticator = 'authenticator:coughdrop';
        stashes.persist_object('auth_settings', auth_settings, true);
        if(capabilities.installed_app) {
          location.href = '#/';
          location.reload();
        } else {
          location.href = '/';
        }
      }
    } else if(capabilities.credentials && !location.pathname.match(/^\/oauth2/) && !location.pathname.match(/resque/) && !location.pathname.match(/jasmine/) && !location.pathname.match(/forgot_password/) && !location.pathname.match(/register/)) {
      var path = "/oauth2/token?client_id=" + capabilities.credentials[0] + "&redirect_uri=" + capabilities.credentials[2];
      if(capabilities.browserless) {
        if(capabilities.auth_window || capabilities.uninitialized) { return; }
        var window_url = capabilities.host + path;
        var auth = window.open(window_url, '_blank', 'location=no,toolbar=no');
        capabilities.auth_window = auth;
        capabilities.auth_message_handler = function(message) {
          if(message.code) {
            auth.close();
            capabilities.auth_window = null;
            capabilities.auth_message_handler = null;
            stashed_oauth_status = message;
            access_token();
          }
        };
        auth.addEventListener('loadstart', function(e) {
          var url = e.url;
          if(url.match(/code=/)) {
            auth.close();
            capabilities.auth_window = null;
            capabilities.auth_message_handler = null;
            access_token(null, null, url);
          }
        });
      } else {
        location.href = path;
      }
    } else {
      console_debug("COUGHDROP: using client (not extension) access token");
    }
  }

  var eyeTracker = {};
  (function() {
    var functions = {
      init: function() {
        if(this.websocket) {
          this.disable();
        }
//         return;
//         var websocket = new WebSocket("ws://127.0.0.1:7777/", ['binary', 'base64']);
//         this.websocket = websocket;
//         websocket.onopen = this.init_message;
//         websocket.onclose = this.disable;
//         websocket.onerror = this.disable;
//         websocket.onmessage = this.handle_message;
//         this.readyNotified = false;
//         this.heartbeatCounter = 0;
//         this.scannerWidth = screen.width; //1366;
//         this.scannerHeight = screen.height; //768;
//         this.tolerance = 20;
//         this.measuring = {};
//         this.$pin = null;
//         window.screenInnerOffsetX = window.screenInnerOffsetX || stashes.get('screenInnerOffsetX') || 0;
//         window.screenInnerOffsetY = window.screenInnerOffsetY || stashes.get('screenInnerOffsetY') || 0;
      },
      init_message: function() {
        var json = {
          "category": "tracker",
          "request" : "get",
          "values": [ "push", "iscalibrated", "screenresw", "screenresh" ]
        };
        this.websocket.send(JSON.stringify(json));
      },
      disable: function() {
        console_debug("COUGHDROP: eye tracker disabled");
        if(this.websocket && this.websocket.readyState < 2) {
          this.websocket.close();
        } else {
          message_client({type: "eye_gaze_event", event_type: "tracker_disabled"});
        }
      },
      handle_message: function(evt) {
        var reader = new FileReader();
        var _this = this;
        reader.onload = function(data) {
          data = JSON.parse(data.target.result);
          if(data.values && data.values.frame) {
            var trackState = data.values.frame.state;
            if(!_this.readyNotified) {
              _this.readyNotified = true;
              console_debug("COUGHDROP: eye tracker state changed to \"tracker_ready\"");
              message_client({type: "eye_gaze_event", event_type: "tracker_ready"});
            } else if(_this.lastTrackState != trackState) {
              _this.lastTrackState = trackState;
              var state = "not_tracking";
              if(trackState < 8) {
                state = "fully_tracking";
                if(trackState < 7) {
                  state = "partial_tracking";
                }
              }
              console_debug("COUGHDROP: eye tracker state changed to \"" + state + "\"");
              message_client({type: "eye_gaze_event", event_type: "tracker", tracking: (trackState < 8), track_type: state});
            }
            // console.log(data.values.frame.state + "  " + data.values.frame.avg.x + "," + data.values.frame.avg.y);
            if(!_this.$pin) {
              _this.$pin = $("<div/>", {id: 'eye_gaze', style: 'left: 50px; top: 50px;'});
              $("body").append(_this.$pin);
            }
            if(data.values.frame.state < 8) {
              _this.$pin.hide();
              var x = (data.values.frame.avg.x) * (screen.width / (_this.scannerWidth));
              var y = (data.values.frame.avg.y) * (screen.height / (_this.scannerHeight));
              if(_this.measuring.x == null || Math.abs(_this.measuring.x - x) > _this.tolerance || Math.abs(_this.measuring.y - y) > _this.tolerance) {
                _this.measuring = {
                  x: x,
                  y: y,
                  count: -5
                };
              }
              _this.measuring.count++;
              _this.$pin.attr('class', 'dwell_for_' + _this.measuring.count);
              // top 
              var clientX = x - window.screenInnerOffsetX;
              var clientY = y - window.screenInnerOffsetY;
              var elem = document.elementFromPoint(clientX, clientY);
              _this.$pin.show();
              var scrollTop = $(window).scrollTop();
              var event = $.Event("gazeover");
              event.clientX = clientX;
              event.clientY = clientY;
              event.pageX = clientX;
              event.pageY = clientY + scrollTop;
              // top left: 205, 280
              // bottom left: 120, 1140
              // top right: 1755, 248
              // bottom right: 1790, 1080
              // center: 900, 530
              // chrome dimensions: 1280 x 720
              // tracker dimensions: 1920 x 1080
              // top left: 128, 196
              // bottom left: 116, 750
              // top right: 1133, 202
              // bottom right: 1200, 730
              // center: 670, 380
              _this.$pin.css({left: event.pageX, top: event.pageY});
              $(elem).trigger(event);
              if(_this.measuring.count > 15) {
                event.type = "gazedwell";
                $(elem).trigger(event);
                _this.measuring = {
                  x: x,
                  y: y,
                  count: -15
                };
              }
            } else {
              _this.$pin.hide();
            }
          } else {
            //console.log(data);
          }
          _this.heartbeatCounter++;
          if(data.request == "get" && data.values && data.values.push === false) {
            console_debug("COUGHDROP: eye tracker connected. state: " + JSON.stringify(data.values));
            _this.scannerWidth = data.values.screenresw; //* 1.5;
            _this.scannerHeight = data.values.screenresh; //* 1.5;
            _this.websocket.send(JSON.stringify({category: "tracker", request: "set", values: {"push": true}}));
            alert("ratios: " + (screen.width / _this.scannerWidth) + ", " + (screen.height / _this.scannerHeight));
          } else if(_this.heartbeatCounter > 5) {
            _this.heartbeatCounter = 0;
            _this.websocket.send(JSON.stringify({category: "heartbeat"}));
          }
        };
        reader.readAsText(evt.data);
      }
    };
    var function_maker = function(key) {
      eyeTracker[key] = function() {
        functions[key].apply(eyeTracker, arguments);
      };
    };
    for(var idx in functions) {
      function_maker(idx);
    }
  })();
  function setup_database() {
    delete capabilities['db'];
    var user_name = stashes.get_db_id();
    var key = "coughDropStorage::" + (user_name || "__") + "===" + capabilities.db_key;
    capabilities.db_name = key;
    var request = {};
    var errored = false;
    try {
      request = indexedDBSafe.open(key, 1);
    } catch(e) {
      console.error("COUGHDROP: unexpected db throw");
      console.log(e);
      errored = true;
    }
    request = request || {};
    request.onerror = function(event) {
      if(!setup_database.already_tried) {
        console.log('COUGHDROP: db failed once, trying again');
        setup_database.already_tried = true;
        setTimeout(function() {
          setup_database();
        }, 1500);
      } else {
        console.log(event);
        console.error("COUGHDROP: db failed to initialize");
        capabilities.db_error_event = event;
        capabilities.db = false;
      }
    };
    request.onsuccess = function(event) {
      console.log("COUGHDROP: db succeeded");
      capabilities.db = request.result;
      setTimeout(function() {
        use_database(capabilities.db);
      }, 10);
    };

    request.onupgradeneeded = function(event) { 
      var indexes_allowed = capabilities.system && capabilities.system != 'iOS';
      console.log("COUGHDROP: db upgrade needed");
      var db = event.target.result;

      if(event.oldVersion < 1 || event.oldVersion > 99999) {
        try {
          var store_names = db.objectStoreNames || [];
          var index_names;
          if(!store_names.contains('board')) {
            var boards = db.createObjectStore("board", { keyPath: "id" });
            index_names = boards.indexNames || [];
            if(!index_names.contains('key') && indexes_allowed) {
              boards.createIndex("key", "key", {unique: false});
            }
            if(!index_names.contains('tmp_key') && indexes_allowed) {
              boards.createIndex("tmp_key", "tmp_key", {unique: false});
            }
            if(!index_names.contains('changed') && indexes_allowed) {
              boards.createIndex("changed", "changed", {unique: false});
            }
          }
          if(!store_names.contains('image')) {
            var images = db.createObjectStore("image", { keyPath: "id" });
            index_names = images.index_names || [];
            if(!index_names.contains('changed') && indexes_allowed) {
              images.createIndex("changed", "changed", {unique: false});
            }
          }
          if(!store_names.contains('sound')) {
            var sounds = db.createObjectStore("sound", { keyPath: "id" });
            index_names = sounds.index_names || [];
            if(!index_names.contains('changed') && indexes_allowed) {
              sounds.createIndex("changed", "changed", {unique: false});
            }
          }
          if(!store_names.contains('user')) {
            var users = db.createObjectStore("user", { keyPath: "id" });
            index_names = users.index_names || [];
            if(!index_names.contains('changed') && indexes_allowed) {
              users.createIndex("changed", "changed", {unique: false});
            }
            if(!index_names.contains('key') && indexes_allowed) {
              users.createIndex("key", "key", {unique: false});
            }
          }
          if(!store_names.contains('settings')) {
            var settings = db.createObjectStore("settings", { keyPath: "storageId" });
            index_names = settings.index_names || [];
            if(!index_names.contains('changed') && indexes_allowed) {
              settings.createIndex("changed", "changed", {unique: false});
            }
          }
          if(!store_names.contains('dataCache')) {
            var dataCache = db.createObjectStore("dataCache", { keyPath: "id" });
            index_names = dataCache.index_names || [];
          }
          if(!store_names.contains('deletion')) {
            var deletion = db.createObjectStore("deletion", { keyPath: "storageId" });
            index_names = deletion.index_names || [];
          }
        } catch(e) {
          console.error("COUGHDROP: db migrations failed");
          console.error(e);
          request.onerror();
          db = null;
        }
        if(db) {
          setTimeout(function() {
            if(!capabilities.db) {
              capabilities.db = db;
              console.log("COUGHDROP: db succeeded through onupgradeneeded");
              use_database(capabilities.db);
            }
          }, 100);
        }
      }
//       setTimeout(function() {
//         capabilities.db = capabilities.db || db;
//       }, 100)
    };

    request.onblocked = function(event) {
      // If some other tab is loaded with the database, then it needs to be closed
      // before we can proceed.
      alert("Please close all other tabs with this site open!");
    };
    
    if(errored) {
      request.onerror();
    }
  }

  function use_database(db) {
    console_debug("COUGHDROP: using indexedDB for offline sync"); // - " + capabilities.db_name);
    stashes.db_connect(capabilities);
    capabilities.db.onerror = function(event) {
      // Generic error handler for all errors targeted at this database's
      // requests!
      var error = event.target && event.target.errorCode;
      error = error || (event.target && event.target.error && event.target.error.message);
      error = error || (event.target && event.target.__versionTransaction && event.target.__versionTransaction.error && event.target.__versionTransaction.error.message);
      error = error || "unknown error";
      console.error("Database error: " + error);
      // capabilities.db = false;
    };

    capabilities.db.onversionchange = function(event) {
      capabilities.db.close();
      alert("A new version of this page is ready. Please reload!");
      capabilities.db = false;
    };

    setTimeout(function() {
      for(var idx = 0; idx < (capabilities.queued_db_actions || []).length; idx++) {
        var m = capabilities.queued_db_actions[idx];
        m[0](m[1]);
      }
      capabilities.queued_db_actions = [];
    }, 100);
    // https://developer.mozilla.org/en-US/docs/IndexedDB/Using_IndexedDB
  }
  capabilities.dbman = {
    not_ready: function(method, options) {
      if(capabilities.db === undefined) {
        capabilities.queued_db_actions.push([method, options]);
        return true;
      } else if(capabilities.db === false) {
        storage_result(false, options.id, {error: "db not initialized"});
        return true;
      }
      return false;
    },
    success: function(record) {
      console.log(record);
    },
    error: function(err) {
      console.error(err);
    },
    find: function(store, key, success, error) {
      success = success || capabilities.dbman.success;
      error = error || capabilities.dbman.error;

      if(store == 'board' && key && key.match(/\//)) {
        var index = key.match(/^tmp_/) ? 'tmp_key' : 'key';
        return capabilities.dbman.find_all(store, index, key, function(list) {
          if(list[0] && list[0].data) {
            success(list[0].data);
          } else {
            error({error: "no record found for " + store + ":" + key});
          }
        }, error);
      } else if(store == 'user' && key && !key.match(/^\d+_\d+$/)) {
        var index = 'key';
        return capabilities.dbman.find_all(store, index, key, function(list) {
          if(list[0] && list[0].data) {
            success(list[0].data);
          } else {
            error({error: "no record found for " + store + ":" + key});
          }
        }, error);
      }
      return capabilities.dbman.find_one(store, key, success, error);
    },
    uniqify_key: function(key, store, index) {
      if(index == 'id' || index == 'storageId') {
        key = store + "::" + key;
      }
      return key;
    },
    normalize_record: function(record, store) {
      if(record.raw) {
        record.raw = record.raw && capabilities.decrypt(record.raw);
      }
      if(record.id) {
        record.id = record.id.replace(new RegExp("^" + store + "::"), '');
      }
      if(record.storageId) {
        record.storageId = record.storageId.replace(new RegExp("^" + store + "::"), '');
      }
      return record;
    },
    find_one: function(store, key, success, error) {
      key = capabilities.dbman.uniqify_key(key, store, 'id');
      capabilities.dbman.find_one_internal(store, key, function(record) {
        success(capabilities.dbman.normalize_record(record, store));
      }, error);
    },
    find_one_internal: function(store, key, success, error) {
      success = success || capabilities.dbman.success;
      error = error || capabilities.dbman.error;

      // TODO: this is raising some kind of error mobile safari 8
      var transaction = null;
      try {
        transaction = capabilities.db.transaction([store], 'readonly');
      } catch(e) { 
        capabilities.db_error = {
          message: e.message || e.getMessage(),
          store: store,
          key: key
        };
          error({error: "db transaction error for " + store + ", " + key + ": " + (e.message || e.getMessage())});
        return;
      }
      var getter = transaction.objectStore(store);
      var res = getter.get(key);
      res.onsuccess = function(event) {
        var record = event.target.result;
        if(record) {
          success(record);
        } else {
          error({error: "no record found for " + store + ":" + key});
        }
      };
      res.onerror = function() {
        error({error: "error retrieving record from db"});
      };
    },
    store: function(store, record, success, error) {
      success = success || capabilities.dbman.success;
      error = error || capabilities.dbman.error;
      if(record.id) {
        record.id = capabilities.dbman.uniqify_key(record.id, store, 'id');
      }
      if(record.storageId) {
        record.storageId = capabilities.dbman.uniqify_key(record.storageId, store, 'id');
      }
      record.persisted = record.persisted || (new Date()).getTime();
      record.raw = capabilities.encrypt(record.raw);
      record.changed = record.changed || false;
      capabilities.dbman.store_internal(store, record, function(new_record) {
        success(capabilities.dbman.normalize_record(record, store));
      }, error);
    },
    store_internal: function(store, record, success, error) {
      var transaction = capabilities.db.transaction([store], 'readwrite');
      try {
        var res = transaction.objectStore(store).put(record);
        res.onsuccess = function(event) {
          success(record);
        };
        res.onerror = function(event) {
          error({error: "error storing record in db"});
        };
      } catch(e) { debugger; }
    },
    remove: function(store, key, success, error) {
      success = success || capabilities.dbman.success;
      error = error || capabilities.dbman.error;
      capabilities.dbman.find(store, key, function(res) {
        var id = capabilities.dbman.uniqify_key(res.id, store, 'id');
        capabilities.dbman.remove_internal(store, id, function() {
          success({id: key});
        }, error);
      }, function() {
        success({id: key});
      });
    },
    remove_internal: function(store, id, success, error) {
      var transaction = capabilities.db.transaction([store], 'readwrite');
      try {
        var res = transaction.objectStore(store).delete(id);
        res.onsuccess = function(event) {
          if(capabilities.dbman.deletes) {
            capabilities.dbman.deletes.push({id: id});
          }
          success({id: id});
        };
        res.onerror = function(event) {
          error({error: "error removing record in db"});
        };
      } catch(e) { debugger; }
    },
    clear: function(store, success, error) {
      success = success || capabilities.dbman.success;
      error = error || capabilities.dbman.error;

      var transaction = capabilities.db.transaction([store], 'readwrite');
      var res = transaction.objectStore(store).clear();
      res.onsuccess = function(event) {
        success({store: store});
      };
      res.onerror = function() {
        error({error: "error clearing store"});
      };
    },
    find_all: function(store, index, key, success, error) {
      success = success || capabilities.dbman.success;
      error = error || capabilities.dbman.error;
      key = capabilities.dbman.uniqify_key(key, store, index);
      capabilities.dbman.find_all_internal(store, index, key, function(list) {
        var new_list = [];
        list.forEach(function(record) {
          var new_result = {
            store: record.store,
            data: capabilities.dbman.normalize_record(record.data, store)
          };
          new_list.push(new_result);
        });
        success(new_list);
      }, error);
    },
    find_all_internal: function(store, index, key, success, error) {

      var transaction = capabilities.db.transaction([store], 'readonly');
      var list = [];

      var s = transaction.objectStore(store);
      var res = s.openCursor();
      res.onsuccess = function(event) {
        var cursor = event.target.result;
        if(cursor) {
          if(!index || cursor.value[index] == key) {
            var data = cursor.value;
            list.push({
              store: store,
              data: data
            });
          }
          cursor.continue();
        } else {
          success(list);
        }
      };
      res.onerror = function() {
        error({error: "error retrieving records from db for " + store});
      };
    }
  };
  capabilities.original_dbman = capabilities.dbman;
})();

export default capabilities;