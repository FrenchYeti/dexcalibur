var FRIDA = null; 
const co = require("co");
const fs = require("fs");
const md5 = require("md5");
const Chalk = require("chalk");
const Path = require("path");

const CLASS = require("./CoreClass.js");
const CONST = require("./CoreConst.js");
const UT = require("./Utils.js");
const Logger = require("./Logger.js")();
const JSHelper = require("./JavaScriptHelper.js");
const FridaHelper = require("./FridaHelper");

var HOOK_TYPE = {
    AFTER: 0x1,
    BEFORE: 0x2,
    OVERLOAD: 0x3
};

const HM_SPAWN = 1;
const HM_ATTACH_GADGET = 2;
const HM_ATTACH_APP = 3;
const HM_ATTACH_PID = 4;

function getLetterFromType(typename){
    for(let i in CONST.WORDS){
        if(CONST.WORDS[i]==typename) return i;
    }
    return null;
}

class VariableArray
{
    constructor(data){
        this.data = data;
        return this;
    }

    getData(){
        return this.data;
    }

    write(){
        let str=` [
            `;
        for(let i=0; i<this.data.length; i++){
            if(typeof this.data[i] == 'string'){
                str += "'"+this.data[i]+"',";
            }else if(typeof this.data[i] == 'object'){
                str += JSON.stringify(this.data[i])+",";
            }else if(typeof this.data[i] == 'int'){
                str += this.data[i]+",";
            }else{
                Logger.error('Unsupported hook variable : type of nested data not supported.');
            }
        }
        
        return str.substr(0,str.length-1)+`
            ],`;
    }
}

/*
DO NOT USE
*/
class VariableObject
{
    constructor(data){
        this.data = data;
        return this;
    }

    write(){
        return JSON.stringify(this.data)+",";
    }
}

/**
 * Represente un hook (actif ou non)
 * @param {string} name The hook name
 * @param {string} src The hook script source code
 * @constructor 
 */
function Hook(context){
    this.id = null;

    // ! important
    // It is used in order to link in-hook method call with method declared outside of the hook
    this.parentID = null;
    this.customName = false;
    this.method = null;
    this.name = null; //name;
    this.description = null;
    this.script = null;//src;
    this.enabled = true;
    this.native = false;
    this.isIntercept = false;
    this.onMatch = null;

    this.context = context;
    this.edited = false;

    this.method = null;
    
    this.when = false;

    this.after = false;
    this.before = false;

    this.color = null;

    this.variables = null,
    this.code = {
        varID: null,
        before: null,
        after: null,
        replace: null,
        custom: null
    }
    return this;
}


/**
 * Set enable flag with the given boolean. 
 * @deprecated
 */
Hook.prototype.setEnable = function(bool){
    this.enabled = bool;
    this.context.trigger({
        type: (bool==true? "probe.enable":"probe.disable"),
        data: {            
            hook: this
        }
    });
}
Hook.prototype.enable = function(){
    this.enabled = true;
    this.context.trigger({
        type: "probe.enable",
        data: {            
            hook: this
        }
    });
}
Hook.prototype.disable = function(){
    this.enabled = false;
    this.context.trigger({
        type: "probe.disable",
        data: {            
            hook: this
        }
    });
}
Hook.prototype.isEnable = function(){
    return this.enabled;
}

Hook.prototype.modifyScript = function(script){

    this.script = script;
    this.edited = true;

    this.context.trigger({
        type: "probe.post_code_change",
        data: {            
            hook: this,
            method: this.method 
        }
    });
} 

Hook.prototype.hasVariables = function(){
    return (this.variables!=null);
}

Hook.prototype.setupVariables = function(){
    let code="\t\tvar "+this.code.varID+` = {
        `;
    for(let i in this.variables){
        code += "\t\t"+i+":";
        code += this.variables[i].write();
    }
    return code+`
        };`;
}

Hook.prototype.getVariable = function(name){
    return this.variables[name];
}

Hook.prototype.isModified = function(){
    return this.edited;
} 

Hook.prototype.isCustomHook = function(){
    return this.code.custom != null;
}

Hook.prototype.getCustomCode = function(){
    return this.code.custom;
}

Hook.prototype.setCustomCode = function(script){
    this.code.custom = script;
}


/**
 * To check if it is a native hook
 * @returns {boolean} Returns TRUE if it hooks a native function, else FALSE
 * @function
 */
Hook.prototype.isNative = function(){
    return this.isNative;
}

/**
 * To check if the hook is called before the hooked function
 * @returns {boolean} Returns TRUE if the hook is called before the function, else FALSE
 * @deprecated
 * @function
 */
Hook.prototype.isBefore = function(){
    return this.when <= 0;
}

/**
 * To check if the hook is called after the hooked function
 * @returns {boolean} Returns TRUE if the hook is called after the function, else FALSE
 * @deprecated
 * @function
 */
Hook.prototype.isAfter = function(){
    return this.when>0;
}

/**
 * To check if the hook perform an intercept (it modifiy value or execution path)
 * @returns {boolean} Returns TRUE if the hook is an intercept, else FALSE
 * @function
 */
Hook.prototype.isIntercept = function(){
    return this.isIntercept;
}

/**
 * To set the Unique ID of the hook
 * @param {string} id The Unique ID of the hook
 * @returns {Hook} The instance of this hook
 * @function 
 */
Hook.prototype.setID = function(id){
    this.id = id;
    return this;
}

/**
 * To get the Unique ID of the hook
 * @returns {string} id The Unique ID of this hook
 * @function
 */
Hook.prototype.getID = function(){
    return this.id;
}

/**
 * To set the parent ID if available, like an HookSet ID.
 * @param {string} id The parent ID 
 * @returns {Hook} The instance of this hook
 * @function
 */
Hook.prototype.setParentID = function(id){
    this.parentID = id;
    return this;
}

/**
 * To get the parent ID if available, like an HookSet ID.
 * @returns {String} The parent ID
 * @function
 */
Hook.prototype.getParentID = function(){
    return this.parentID;
}

/**
 * To set the name of the hook. 
 * By default, it's the signature of the hooked method
 * @param {string} id The parent ID 
 * @returns {Hook} The instance of this hook
 * @function
 */
Hook.prototype.setName = function(name){
    this.name = name;
    this.customName = true;
    return this;
}

/**
 * To set the built hook code to exec BEFORE the hooked function.
 * @param {string} code The built source code of the hook
 * @returns {Hook} The instance of this hook
 * @function
 */
Hook.prototype.setInterceptBefore = function(code){
    this.code.before = code;
    return this;
}

/**
 * To set the built hook code to exec AFTER the hooked function.
 * @param {string} code The built source code of the hook
 * @returns {Hook} The instance of this hook
 * @function
 */
Hook.prototype.setInterceptAfter = function(code){
    this.code.after = code;
    return this;
}

/**
 * To set the built hook code to exec in place of the hooked function.
 * @param {string} code The builnt source code of the hook
 * @returns {Hook} The instance of this hook
 * @function
 */
Hook.prototype.setInterceptReplace = function(code){
    this.code.replace = code;
    return this;
}

/**
 * To make an instance of Object which not contain circular reference
 * and which are ready to be serialized.
 * @returns {Object} - Returns an Object instance representing the type
 */
Hook.prototype.toJsonObject = function(){
    let o = new Object();
    o.id = this.id;
    o.parentID = this.parentID;
    o.color = this.color;
    o.customName = this.customName;
    o.name = this.name;
    o.enable = this.enabled;
    o.method = this.method.signature();
    o.script = UT.b64_encode(UT.encodeURI(this.script));
    o.edited = this.edited;
    o.isIntercept = this.isIntercept;
    if(this.variables != null){
        o.variables = {
            id: this.code.varID,
            data: {}
        };
        //console.log(this.variables);
        for(let i in this.variables){
            o.variables.data[i] = this.variables[i].write();
        }
    }
    o.code = {
        //variable: (this.code.variable!=null)? UT.b64_decode(this.code.dynamic) : null,
        before: (this.code.before!=null)? UT.b64_encode(this.code.before) : null,
        after: (this.code.after!=null)? UT.b64_encode(this.code.after) : null,
        replace: (this.code.replace!=null)? UT.b64_encode(this.code.replace) : null,
    };
    return o;
}

Hook.prototype.updateWith = function(object,method){
    this.id = object.id;
    this.parentID = object.parentID;
    this.customName = object.customName;
    this.name = object.name;
    this.enabled = object.enable;

    // resolve method
    this.method = method;

    this.script = UT.decodeURI(UT.b64_decode(object.script));
    this.edited = object.edited;
    this.isIntercept = object.isIntercept;
    this.code = {
        dynamic: (object.code.dynamic!=null)? UT.b64_decode(object.code.dynamic) : null,
        before: (object.code.before!=null)? UT.b64_decode(object.code.before) : null,
        after: (object.code.after!=null)? UT.b64_decode(object.code.after) : null,
        replace: (object.code.replace!=null)? UT.b64_decode(object.code.replace) : null,
    };
    return this;
}

Hook.prototype.dataObjAutoCast = function(argtype, argname){
    let val = null;

    switch(argtype){
        case "java.lang.String":
            val = argname;
            break;
        case "java.lang.CharSequence":
            val = argname; //".toString()";
            break;
    }

    return val;
};
Hook.prototype.dataPrimAutoCast = function(argtype,argname){
    let val = null;

    switch(argtype){
        case "int":
            val = argname;
            break;
    }

    return val;
};


/**
 * To build the code source corresponding an array of parameters 
 * 
 * It builds :
 *  - Argument part of the signature needed by Frida in order 
 *    to identtfy good function to overload 
 *  - Source code of the object send by the hook to the frida client
 *  
 * @param {ObjectType|BasicType} args_arr An array of Types
 * @function
 * 
 */
Hook.prototype.makeArgsHelper = function(args_arr){
    if(args_arr.length ==0) return null;
    let raw_name = null;
    let helper = {
        // Value to pass to the "overload()" method of Frida
        call_signature: "",
        // Value to set as parameters name in the hook and in the call
        // to the hooked function
        hook_args: "",
        // Format string for the logger
        logger: "",
        // TODO 
        data: "",
    };
    let v = 0, arg=null, dataval="";

    for(let i in args_arr){
        
        arg = "arg"+v;

        if(args_arr[i] instanceof CLASS.BasicType){

            raw_name = getLetterFromType(args_arr[i]._name);

            if(args_arr[i].arr){
                helper.call_signature += "'["+raw_name+"',";
            }else{
                helper.call_signature += "'"+args_arr[i]._name+"',";
            }

            dataval = this.dataPrimAutoCast(args_arr[i]._name,arg);
            if(dataval != null)
                helper.data += arg+":"+dataval+",";

            helper.hook_args +=  arg+",";
        }
        else if(args_arr[i] instanceof CLASS.ObjectType){

            if(args_arr[i].arr){
                // frida 11.0.2
                // helper.call_signature += "'[L"+args_arr[i]._name+"',";
                // frida 12.2.26
                helper.call_signature += "'[L"+args_arr[i]._name+";',";
            }else{
                //helper.call_signature += "'L"+args_arr[i]._name+";',";
                helper.call_signature += "'"+args_arr[i]._name+"',";
            }

            dataval = this.dataObjAutoCast(args_arr[i]._name,arg);
            if(dataval != null)
                helper.data += arg+":"+dataval+",";

            helper.hook_args +=  arg+",";
        }
        v++;
    }

    helper.call_signature = helper.call_signature.substr(0,helper.call_signature.length-1);
    helper.hook_args = helper.hook_args.substr(0,helper.hook_args.length-1);
    return helper;
};

Hook.prototype.makeRetHelper = function(ret){
    if(ret == null) return null;

    let helper = {
        // Format string for the logger
        logger: "",
        // TODO 
        data: "",
    };
    let dataval="";


    if(ret instanceof CLASS.BasicType){

        dataval = this.dataPrimAutoCast(ret._name,"ret");
        if(dataval != null)
            helper.data += "ret:"+dataval;
    }
    else if(ret instanceof CLASS.ObjectType){

        dataval = this.dataObjAutoCast(ret._name,"ret");
        if(dataval != null)
            helper.data += "ret:"+dataval;
    }
     
    return helper;
};


/**
 * To create the Frida hook script for a specific method.
 * Each token starting and ending by "@@" will be replaced by his value 
 * in the final script.
 * 
 * The available tokens are :
        "@@__CLSDEF__@@": md5(method.enclosingClass.name),
        "@@__FQCN__@@": method.enclosingClass.name,
        "@@__METHDEF__@@": md5(method.__signature__),
        "@@__METHNAME__@@": (method.name=='<init>')? '$init' : method.name,
        "@@__METHSIGN__@@": method.__signature__,
        "@@__ARGS__@@": "",
        "@@__HOOK_ARGS__@@": "",
        "@@__HOOK_ARGS2__@@": "",
        "@@__RET__@@": "",
        "@@__ARGS_VAL__@@": "",
        "@@__HOOK_ID__@@": UT.b64_encode(this.id),
        "@@__CTX__@@":"",
        "@@__ARGS_DATA__@@":"null",
        "@@__RET_DATA__@@":"",
 * 
 * The resulting script is stored into the 'script' field of 
 * the 'Hook' instance.
 *
 * @param {Method} method The method to hook
 * @function
 */
Hook.prototype.makeHookFor = function(method){
    /*if(method instanceof CLASS.MissingReference){
        console.log(Chalk.bold.yellow("TODO : implement MissingReference probing"));
        this.enable = false;
        return null;
    }*/

    let tags = {
        "@@__CLSDEF__@@": md5(method.enclosingClass.name),
        "@@__FQCN__@@": method.enclosingClass.name,
        "@@__METHDEF__@@": md5(method.__signature__),
        "@@__METHNAME__@@": (method.name=='<init>')? '$init' : method.name,
        "@@__METHSIGN__@@": method.__signature__,
        "@@__ARGS__@@": "",
        "@@__HOOK_ARGS__@@": "",
        "@@__HOOK_ARGS2__@@": "",
        "@@__RET__@@": "",
        "@@__ARGS_VAL__@@": "",
        "@@__HOOK_ID__@@": UT.b64_encode(this.id),
        "@@__CTX__@@":"",
        "@@__ARGS_DATA__@@":"null",
        "@@__RET_DATA__@@":"",
        "@@__VAR__@@":""
    }; 

    tags["@@__VAR__@@"] = md5(this.id)+"_VAR";
    this.code.varID = tags["@@__VAR__@@"];

    let retHelp = this.makeRetHelper(method.ret);
    tags["@@__RET_DATA__@@"] = "{"+retHelp.data+"}";

    if(this.parentID != null){
        tags["@@__CTX__@@"] = "ctx_"+md5(this.parentID);
    }
    if(method.args.length > 0){
        let argHelp = this.makeArgsHelper(method.args);
        if(argHelp.data=="") argHelp.data = "pass:''";
        tags["@@__ARGS__@@"] = argHelp.call_signature;
        tags["@@__ARGS_DATA__@@"] = "{"+argHelp.data+"}";
        tags["@@__HOOK_ARGS__@@"] = argHelp.hook_args;
        tags["@@__HOOK_ARGS2__@@"] = ", "+argHelp.hook_args;
    }else{

        tags["@@__ARGS_DATA__@@"] = "{pass:''}";
    }
    
    /*
    if(method.ret != null){
        if(!(method.ret instanceof CLASS.BasicType) || !method.ret.isVoid()){
            tags["@@__RET__@@"] = ", ret:ret";
        }
    }
    */

    // TODO : dont redifine cls_$$ and meth_$$ when another hook has already defiened it.

    let script = `

        var cls_@@__CLSDEF__@@ = Java.use('@@__FQCN__@@');

        var meth_@@__METHDEF__@@ = cls_@@__CLSDEF__@@.@@__METHNAME__@@.overload(@@__ARGS__@@);

        meth_@@__METHDEF__@@.implementation = function(@@__HOOK_ARGS__@@) {
    `;
    
    if(this.code.replace != null){
        script += this.code.replace;
        script += `
        }

        `;

        // replace token
        for(let i in tags){
            do{
                script = script.replace(i,tags[i]);
            }while(script.indexOf(i)>-1);
        }

        this.method = method;
        this.name = method.__signature__;
        this.enable();
        this.script = script;

        return true;
    }

    // BEFORE insert
    if(this.isIntercept && this.code.before!=null){
        script += this.code.before;
    }else if(this.isIntercept == false){
        // __METHSIGN__
        script += `
            send({ id:"@@__HOOK_ID__@@", msg:"@@__METHSIGN__@@", data:@@__ARGS_DATA__@@, action:"None before", after:false @@__ARGS_VAL__@@ });
        `;
        /*script += `
            send({ id:"@@__HOOK_ID__@@", msg:"@@__FQCN__@@.@@__METHNAME__@@()", data:@@__ARGS_DATA__@@, action:"None before", after:false @@__ARGS_VAL__@@ });
        `;*/

    }

    script += `            var ret = meth_@@__METHDEF__@@.call(this @@__HOOK_ARGS2__@@);`;

    //  AFTER insert
    if(this.isIntercept && this.code.after!=null){
        script += this.code.after;
    }else if(this.isIntercept == false){
        script += `
            send({ id:"@@__HOOK_ID__@@", msg:"@@__METHSIGN__@@", data:@@__RET_DATA__@@, action:"None before", after:true @@__ARGS_VAL__@@ });
        `;
    }

    script += `
        return ret;
    }
    `;
    
    // replace token
    for(let i in tags){
        do{
            script = script.replace(i,tags[i]);
        }while(script.indexOf(i)>-1);
    }

    this.method = method;
    method.probing = true;
    this.name = method.__signature__;
    this.enable();
    this.script = script;
    return true;
    //console.log(script);
}



Hook.prototype.buildCustomScript = function(method){
    if(method instanceof CLASS.MissingReference){
        console.log(Chalk.bold.yellow("TODO : implement MissingReference probing"));
        this.enable = false;
        return null;
    }

    let builtScript = this.code.custom;
    let tags = {
        "@@__CLSDEF__@@": md5(method.enclosingClass.name),
        "@@__FQCN__@@": method.enclosingClass.name,
        "@@__METHDEF__@@": md5(method.__signature__),
        "@@__METHNAME__@@": (method.name=='<init>')? '$init' : method.name,
        "@@__METHSIGN__@@": method.__signature__,
        "@@__ARGS__@@": "",
        "@@__HOOK_ARGS__@@": "",
        "@@__HOOK_ARGS2__@@": "",
        "@@__RET__@@": "",
        "@@__ARGS_VAL__@@": "",
        "@@__HOOK_ID__@@": UT.b64_encode(this.id),
        "@@__CTX__@@":"",
        "@@__ARGS_DATA__@@":"null",
        "@@__RET_DATA__@@":""
    }; 

    tags["@@__VAR__@@"] = tags["@@__HOOK_ID__@@"]+"_VAR";
    this.code.varID = tags["@@__VAR__@@"];


    let retHelp = this.makeRetHelper(method.ret);
    tags["@@__RET_DATA__@@"] = "{"+retHelp.data+"}";

    if(this.parentID != null){
        tags["@@__CTX__@@"] = "ctx_"+md5(this.parentID);
    }
    if(method.args.length > 0){
        let argHelp = this.makeArgsHelper(method.args);
        if(argHelp.data=="") argHelp.data = "pass:1";
        tags["@@__ARGS__@@"] = argHelp.call_signature;
        tags["@@__ARGS_DATA__@@"] = "{"+argHelp.data+"}";
        tags["@@__HOOK_ARGS__@@"] = argHelp.hook_args;
        tags["@@__HOOK_ARGS2__@@"] = ", "+argHelp.hook_args;
    }else{
        tags["@@__ARGS_DATA__@@"] = "{ pass: 1 }";
    }
    
    for(let i in tags){
        while(builtScript.indexOf(i)>-1){
            builtScript = builtScript.replace(i,tags[i]);
        }
    }

    this.script = builtScript;
    this.method = method;
    method.probing = true;
    this.name = method.__signature__;
    this.enable();
    return true;
}   

Hook.prototype.generateDynamicCode = function(){
    //this.code.dynamic = 
}

Hook.prototype.setMethod = function(method){
    this.method = method;
}
Hook.prototype.getMethod = function(){
    return this.method;
}




/**
 * To represent a message sent by a hook from the device to the desktop
 * @constructor 
 */
function HookMessage(){
    this.data = null;
    this.msg = null;
    this.match = null;
    this.isIntercept = false;
    this.hook = null;
    this.when = null;
    this.action = "";
    this.tags = null;
    return this;
}

HookMessage.prototype.isBefore = function(){
    return this.when <= 0;
}

HookMessage.prototype.isAfter = function(){
    return this.when>0;
}

HookMessage.prototype.getHook = function(){
    return this.hook;
}

HookMessage.prototype.setTags = function(tags){
    this.tags = tags;
}

HookMessage.prototype.getTags = function(tags){
    return this.tags;
}

HookMessage.prototype.addTag = function(tag){
    if(this.tags == null) this.tags = [];
    this.tags.push(tag);
}
/**
 * To make an instance of Object which not contain circular reference
 * and which are ready to be serialized.
 * @returns {Object} Returns an Object instance representing the type
 */
HookMessage.prototype.toJsonObject = function(){
    let o = new Object();
    o.data = this.data;
    o.hook = this.hook;
    o.msg = this.msg;
    o.match = this.match;
    o.action = this.action;
    o.isIntercept = this.isIntercept;
    
    if(this.tags != null && this.tags.length > 0)
        o.tags = this.tags;

//    if(this.hook!=null)
//        o.hook = this.hook.toJsonObject();
    o.after = this.isAfter();
    o.before = this.isBefore();
    return o;
}

/**
 * To represent a hook primitive.
 * A hook primitive is like a hook template, it allows a developer or a user
 * to define hooks in different files and combine it in order to be injected 
 * by using a single script.   
 * @constructor
 */
function HookPrimitive(config){
    this.when = null;
    this.method_signature = null;
    this.isIntercept = false;
    this.isCustom = false;
    this.interceptBefore = null;
    this.interceptAfter = null;
    this.interceptReplace = null;
    this.onMatch = null;
    this.custom = false;
    this.variables = null;
    this.raw = null;

    for(let i in config){
        if(i!="multiple_method" && i!="method")
            this[i] = config[i];
    }
    if(config.method!=null) this.method_signature = config.method;
    return this;
}


/**
 * Create a object shared with others hook callback
 * @param {Object} config Shared object config 
 */
/*HookPrimitive.prototype.addVariable = function(config){
    this.variable = config;
    return this;
}*/

/**
 * Get the shared object from this hookset
 * @returns {Object} Shared object
 * @function
 */
HookPrimitive.prototype.getVariables = function(){
    return this.variables;
}



HookPrimitive.prototype.setMethod = function(method){
    this.method_signature = method;
}

HookPrimitive.prototype.buildRawMethod = function(raw){
    raw.__signature__ = raw.signature();
    return raw;
}

/**
 * To built a probing hook from the current primitive 
 * @param {DexcaliburProject} context The reference to the current Project instance
 * @param {HookSet} set The hookset where the hook primitive is defined
 * @returns {Hook} The hook ready to be injected
 * @function
 */
HookPrimitive.prototype.toProbe = function(context,set){
    let hook = new Hook(context), method=null;
    
    hook.variables = this.variables;

    if(this.raw == null)
        method = context.find.get.method(this.method_signature);
    else
        method = this.buildRawMethod(this.raw);

    if(method==undefined){
        Logger.error("[HOOK] Method not found by signature");
        console.log(this);
    }
        //hook.setID( context.hook.nextHookIdFor(method));
    hook.setID( md5(context.hook.nextHookIdFor(method)));
    
    hook.setParentID(set.id);//name);
    hook.makeHookFor(method);

    return hook;
}


/**
 * To built an intercepting hook from the current primitive 
 * @param {Project} context The reference to the current Project instance
 * @param {HookSet} set The hookset where the hook primitive is defined
 * @returns {Hook} The hook ready to be injected
 * @function
 */
HookPrimitive.prototype.toIntercept = function(context,set){

    let hook = new Hook(context);

    hook.variables = this.variables;

    if(this.raw == null)
        method = context.find.get.method(this.method_signature);
    else{
        method = this.buildRawMethod(this.raw);
        //console.log(method, context.hook.nextHookIdFor(method));
    }

    hook.setID( md5(context.hook.nextHookIdFor(method)));
    hook.setParentID(set.id);//name);
    hook.isIntercept = true;
    hook.onMatch = this.onMatch;

    //console.log(this);
    if(this.interceptBefore != null){
        hook.setInterceptBefore(this.interceptBefore);
    }
    if(this.interceptAfter != null){
        hook.setInterceptAfter(this.interceptAfter);
    }
    if(this.interceptReplace != null){
        hook.setInterceptReplace(this.interceptReplace);
    }
    if(this.customCode != null){
        hook.setCustomCode(this.customCode);
    }
    

    if(!hook.isCustomHook()){
        hook.makeHookFor(method);
    }else{
        hook.buildCustomScript(method);
    }

    hook.color = this.color;
    //console.log(hook);
    return hook;          
}

/**
 * To make an instance of Object which not contain circular reference
 * and which are ready to be serialized.
 * @returns {Object} Returns an Object instance representing the type
 */
HookPrimitive.prototype.toJsonObject = function(){
    let o = new Object();
    o.when = this.when;
    o.method = this.method_signature;
    o.interceptBefore = (this.interceptBefore!=null)?this.interceptBefore:null; 
    o.interceptAfter = (this.interceptAfter!=null)?this.interceptAfter:null;
    o.interceptReplace = (this.interceptReplace!=null)?this.interceptReplace:null;
    // o.onMatch
    return o;
}


/**
 * To configure and manage a static part of the hook code 
 * shared by all hooks and where class are searched.
 * Each hook set can define one custom prologue and several dependencies.
 * 
 * 
 * @param {*} config 
 */
function HookPrologue(config){
    this.parentID = null;
    this.script = null;
    this.builtScript = null;
    this.context = null;

    for(let i in config) this[i]=config[i];
    return false;
}

/**
 * To check if the prologue is enable of not. 
 * It is disabled when the parent is disabled 
 *  
 * @return {Boolean} Returns TRUE if enabled, else FALSE
 * @function
 */
HookPrologue.prototype.isEnable = function(){
    for(let i in this.context.hook.hooksets)
        console.log(i,this.parentID);

    return this.context.hook.getHookSet(this.parentID).isEnable();
}

/**
 * To build the prologue Frida script
 * 
 * In order to differentiate several prologues and avoid
 * conflicts, the @@__CTX__@@ token will be replaced by the hash 
 * of the parent HookSet.
 * 
 * @function
 */
HookPrologue.prototype.buildScript = function(){
    let script=this.script;
    let tags = {
        "@@__CTX__@@": "ctx_"+md5(this.parentID)
    };

    for(let i in tags){
        do{
            script = script.replace(i,tags[i]);
        }while(script.indexOf(i)>-1);
    }

    this.builtScript = script;
}

/**
 * To inject dependencies into HookPrologue
 * 
 * @param {Project} ctx The context of the project 
 * @function
 */
HookPrologue.prototype.injectContext = function(ctx){
    this.context = ctx;
    this.buildScript();
    return this;
}

/**
 * 
 */
HookPrologue.prototype.toJsonObject = function(){
    let o = new Object();
    o.parentID = this.parentID;
    o.script = this.script;
    return o;
}



/**
 * Represents a session of hooking.
 * 
 * A session comonly starts when the Frida final script is loaded and 
 * finish at the next start. 
 * 
 * (TODO : or when the device is disconnected) 
 *   
 * @param {*} manager 
 */
class HookSession
{
    constructor(manager) {
        /**
         * The stack containing the received message
         * @var 
         */
        this.message = [];

        /**
         * The associated HookManager
         * (TODO : 1 hookManager by device)
         * @var 
         */
        this.hookManager = manager;

        /**
         * Follow hookset matches
         */
        this.sets_matches = {};

        /**
         * The timestamp of the session
         * @var
         */
        this.time = UT.time();

        /**
         * To hold some references from frida-node 
         */
        this.frida = {
            session: null,
            device: null,
            script: null,
            pid: null
        };
    }

    set fridaSession( pSession){ this.frida.session = pSession; }

    get fridaSession(){  return this.frida.session; }


    set fridaDevice( pDevice){
        this.frida.device = pDevice;
    }

    get fridaDevice(){
        return this.frida.device;
    }


    set fridaScript( pScript){
        this.frida.script = pScript;
    }

    get fridaScript(){
        return this.frida.script;
    }


    set pid( pPID){
        this.frida.pid = pPID;
    }

    get pid(){
        return this.frida.pid;
    }

    /**
     * To push a new message from a hook into the session.
     * Each message are an instance of HookMessage
     * 
     * @method
     */
    push(msg){
        let hm = new HookMessage();

        if(msg.type == "error") return null;

        // TODO : mettre tout 'msg' dans 'hm' ou 'hm.data'

        // console.log(msg);
        if(msg.payload.id != undefined && msg.payload.id != null){
            //hook = this.hookManager.findHook(UT.b64_decode(msg.payload.id));
            hm.hook = msg.payload.id;
        }

        hm.match = (msg.payload.match!=null)? msg.payload.match : false; 
        hm.msg = msg.payload.msg;
        hm.data = msg.payload.data;
        hm.action = msg.payload.action;
        hm.when = (msg.after)? 1 : 0;


        if(msg.payload.tags != null) hm.setTags(msg.payload.tags);

        this.message.push(hm)
        
        if(hm.match)
        this.hookManager.trigger(hm);

        return hm;
    }

    /**
     * 
     * @param {*} hookset 
     * @param {*} name 
     * @param {*} value 
     * @method
     */
    addMatch(hookset,name,value=null){
        if(this.sets_matches[hookset]==null) this.sets_matches[hookset] = {};
        if(this.sets_matches[hookset][name]==null) this.sets_matches[hookset][name] = {};

        if(value!=null)
            for(let i in value)
                this.sets_matches[hookset][name][i] = value[i];
    }

    /**
     * @method
     */
    hasMessages( pOffset=0){
        return this.message.length > pOffset;
    }

    /**
     * @method
     */
    messages(){
        return this.message;
    }

    getMessages( pOffset, pSize ){
        let arr = [];
        for(let i=pOffset; i<pOffset+pSize; i++){
            // not null and not undefined
            if(this.message[i] != null){
                arr.push(this.message[i]);
            }
        }

        return arr;
    }
    /**
     * @method
     */
    toJsonObject( pOffset=0, pSize=-1){
        let o = new Object(), limit=pSize;
        o.message = [];

        if(limit==-1) 
            limit = this.message.length;

        limit += pOffset;
        for(let i=pOffset; i<limit; i++){
            if(this.message[i] != null)
                o.message.push(this.message[i].toJsonObject());
        }

        o.size = o.message.length;
        return o;
    }
}


/**
 * 
 * @param {DexcaliburProject} ctx The project instance
 * @param {Boolean} nofrida If equals to 1 then the Frida script will not be loaded and Frida library not include  
 */
class HookManager
{
    /**
     * 
     * @param {*} pProject 
     * @param {*} nofrida 
     * @constructor
     */
    constructor(pProject, pNofrida=0){
        this.context = pProject;
        this.logs = [];
        this.hooks = [];
        this.hooksets = {};
        this.prologues = [];
        this.sessions = [];
        this.requires = [];
        //this.requiresNode = [];
        this.listeners = {};
        this.scanners = {};
        this._sess = null;
        this.frida_disabled = pNofrida;

        if(this.frida_disabled==false){
            FRIDA = require("frida");
            //FRIDA_LOAD = require("frida-load");
        }

        return this;
    }



    /**
     * To get frida_disabled status.
     * 
     * @return {Boolean} Frida-feature status
     * @method
     */
    isFridaDisabled(){
        return (this.frida_disabled!=0);
    }

    /**
     * To print help into CLI
     * 
     * @method
     */
    help(){
        console.log(`Module :
    NativeObserver
    Reflect
    RootBypass`);
    }

    /**
     * @deprecated
     */
    refreshScanner(){

        let self = this;
        UT.forEachFileOf(
            Path.join(__dirname, "..", "scanner"),
            function(path,file){
                let s = file.substr(0,file.lastIndexOf("."));
                if(self.scanners[s]==null){
                    self.scanners[s] = require(path);
                    self.scanners[s].injectContext(self.context);
                    Logger.info("[HookManager:refreshScanner] New scanner added : "+s);
                }
            },false);
    }

    /**
     * 
     * @param {*} requires
     * @method 
     */
    addRequires(requires){
        for(let i=0; i<requires.length; i++){
            if(this.requires.indexOf(requires[i])==-1){
                this.requires.push(requires[i]);
            }
        }
    };

    /**
     * 
     * @param {*} requires
     * @method 
     */
    removeRequires(requires){
        let offset=-1;
        for(let i=0; i<requires.length; i++){
            offset = this.requires.indexOf(requires[i]);
            if(offset>-1) this.requires[offset] = null;
        }
    };

    /**
     * To insert required modules into the generated Frida script
     * 
     * DEXC_MODULE = {};
     * 
     * @method
     */
    prepareRequires(){
        let req = "", loaded = {};   
        for(let i=0; i<this.requires.length; i++){
            if(this.requires[i]!=null && loaded[this.requires[i]]==null){
                req += fs.readFileSync(Path.join(__dirname,"requires",this.requires[i]+".js"));
                loaded[this.requires[i]] = true;
            }
        }  

        return req;
    }


    /**
     * To build global hook scripts
     * 
     * @returns {String} Hook script
     * @method
     */
    prepareHookScript(){
        let script = `Java.perform(function() {
            var DEXC_MODULE = {};
        `;

        // include hookset requirements
        //if(this.requiresNode.length > 0)
        //   script = this.prepareRequiresNode()+"\n"+script;
        
        script += this.prepareRequires();
        
        for(let i in this.prologues){
            if(this.prologues[i].isEnable()){
                script += this.prologues[i].builtScript;
            }
        }


        for(let i in this.hooks){
            if(this.hooks[i].isEnable()){
                if(this.hooks[i].hasVariables()){
                    script += this.hooks[i].setupVariables();                
                }
                script += this.hooks[i].script;
            }
        }

        script += "});"
        return script;
    }

    /**
     * To create a new hook session
     * 
     * @returns {HookSession} Current - freshly created - hooking session
     * @method
     */
    newSession(){
        var sess =new HookSession(this)
        // TODO : add configuration flush/keep previous sessions 
        this.sessions.push(sess);
        return sess;
    }


    /**
     * To start hooking by spawning the target application
     *  
     * @param {String} pHookScript Hook script
     * @param {String} pAppName Application UID
     * @method 
     */
    startBySpawn(pAppName, pHookScript= null){
        this.start(pHookScript, HM_SPAWN, pAppName);
    }

    /**
     * 
     * @param {*} pAppName 
     * @param {*} pHookScript 
     */
    startByAttachToGadget(pAppName, pHookScript= null){
        this.start(pHookScript, HM_ATTACH_GADGET, pAppName);
    }

    /**
     * 
     * @param {*} pPID 
     * @param {*} pHookScript 
     */
    startByAttachTo(pPID=null, pHookScript= null){
        this.start(pHookScript, HM_ATTACH_PID, pPID);
    }

    /**
     * 
     * @param {*} pAppName 
     * @param {*} pHookScript 
     */
    startByAttachToApp(pAppName, pHookScript= null){
        this.start(pHookScript, HM_ATTACH_APP, pAppName);
    }



    /**
     * To start hooking
     * 
     * start -> script ? -> NO : prepareHookScipt()
     *                   -> YES: use given script
     *       -> 
     
      * @param {*} hook_script 
      * @param {*} pType 
      * @param {*} pExtra 
      * @param {*} pDevice 
      * 
      * @method
      */
     start(hook_script, pType=null, pExtra=null, pDevice=null){
        
        let target = null;
        let PROBE_SESSION = this.newSession();
        
        if(hook_script == null){
            hook_script = this.prepareHookScript();
        }

        if(this.frida_disabled){
            Logger.info("[HOOK MANAGER] Frida is disabled ! Hook and session prepared but not start() ignored");
            return null;
        } 

        // retrieve default  device from project
        if(pDevice == null){
            target = this.context.getDevice();
        }
        // else, it uses specified device
        else{
            target = pDevice;
        }

        // start Frida
        // do spawn + attach
        var hookRoutine = co.wrap(function *() {
            let session = null, pid=null, applications=null, bridge=null;
            
            let device = null;

            device = yield FridaHelper.getDevice(target);
/*
            bridge = target.getDefaultBridge();
            
            if(bridge.isNetworkTransport()){
                device = yield FRIDA.getDeviceManager().addRemoteDevice(bridge.ip+':'+bridge.port);
            }else{
                device = yield FRIDA.getDevice(bridge.deviceID);
            }
  */          
            
            PROBE_SESSION.fridaDevice = device;

            switch(pType){
                case HM_SPAWN:
                    pid = yield device.spawn([pExtra]);
                    PROBE_SESSION.pid = pid;
                    
                    session = yield device.attach(pid);
                    PROBE_SESSION.fridaSession = session;

                    Logger.info('spawned:', pid);
                    break;
                case HM_ATTACH_APP:
                    applications = yield device.enumerateApplications();
                    for(let i=0; i<applications.length; i++){
                        if(applications[i].identifier == pExtra)
                            pid = applications[i].pid;
                    }

                    if(pid > -1) {
                        PROBE_SESSION.pid = pid;
                        session = yield device.attach(pid);
                        PROBE_SESSION.fridaSession = session;

                        Logger.info('attached to '+pExtra+" (pid="+pid+")");
                    }else{
                        throw new Error('Failed to attach to application ('+pExtra+' not running).');
                    }
                    
                    break;
                case HM_ATTACH_GADGET:
                    applications = yield device.enumerateApplications();
                    if(applications.length == 1 && applications[0].name == "Gadget") {
                        PROBE_SESSION.pid = applications[0].pid;

                        session = yield device.attach(applications[0].pid);
                        PROBE_SESSION.fridaSession = session;

                        Logger.info('attached to Gadget:', pid);
                    }else
                        Logger.error('Failed to attach to Gadget.');

                    break;
                case HM_ATTACH_PID:
                    PROBE_SESSION.pid = pid;

                    session = yield device.attach(pid);
                    PROBE_SESSION.fridaSession = session;

                    Logger.info('spawned:', pid);
                    break;
                default:
                    Logger.error('Failed to attach/spawn');
                    return;
                    break;
            }

            const script = yield session.createScript(hook_script);

             // For frida-node > 11.0.2
             script.message.connect(message => {
                PROBE_SESSION.push(message);//{ msg:message, d:data });
                //console.log('[*] Message:', message);
            });    
            
        
            yield script.load();


            PROBE_SESSION.fridaScript = script;

            console.log('script loaded', script);
            yield device.resume(pid);
        });

        hookRoutine()
            .catch(error => {
            console.log(error);
            console.log('error:', error.message);
            });
    }


    addHookSet(set){
        if(this.hooksets[set.getID()]!=null){
            console.log("[Error] HookManager : An hook set already exists for this ID");
            return false;
        }
        this.hooksets[set.getID()] = set;
        return true;   
    }
    getHookSets(){
        return this.hooksets;   
    }
    getHookSet(id){
        return this.hooksets[id];   
    }
    hasListener(hookid){
        return (this.listeners[hookid] != null);
    }

    // add a listener to call when the HookSession receive a HookMessage with match=true
    addMatchListener(hookid,callback,weight=-1){
        if(this.listeners[hookid]==null)
            this.listeners[hookid] = [];

        this.listeners[hookid].push(callback);  
        return this;
    }
    trigger(event){

        // INFO : event.hook = HookMessage.hook = msg.id
        let hookid = UT.b64_decode(event.hook);
        if(!this.hasListener(hookid)) return false;

        for(let i=0; i<this.listeners[hookid].length; i++){
            this.listeners[hookid][i](this.context,event);
        }
    }
    isProbing(method){
        for(let i in this.hooks){
            if(this.hooks[i].name == method.__signature__ && this.hooks[i].enable){
                return true;
            }
        }
        return false;
    }

    /**
     * 
     */
    getProbe(method){
        for(let i in this.hooks){
            if(this.hooks[i].name == method.__signature__){
                return this.hooks[i];
            }
        }
        return null;
    }

    /**
     * To get all hooks
     * @returns {Hook[]} An array containing all hooks
     */
    getHooks(){
        return this.hooks;
    }

    /**
     * To get a hook by its ID.
     * 
     * @param {String} id The hook ID as provide by the hook trace
     * @return {Hook} The matching hook, then null. 
     * @function
     */
    getHookByID(id){
        for(let i in this.hooks){
            if(this.hooks[i].id == id){
                return this.hooks[i];
            }
        }
        return null;
    }
    removeHook(hook){
        let res=[], pop=null;
        for(let i in this.hooks){
            if(this.hooks[i].id != hook.getID()){
                res.push(this.hooks[i]);
            }else{
                pop = this.hooks[i];
            }
        }
        this.hooks = res;
        return pop;
    }
    findHook(hookId){
        for(let i in this.hooks){
            if(this.hooks[i].id == hookId){
                return this.hooks[i];
            }
        }
        return null;
    }
    findHookByMethod(method){
        let match = [];
        for(let i in this.hooks){
            if(this.hooks[i].name == method.__signature__){
                match.push(this.hooks[i]);
            }
        }
        return match;
    }
    nextHookIdFor(method){
    //    return method.__signature__+"@@"+this.findHookByMethod(method).length;
        return method.signature()+"@@"+this.findHookByMethod(method).length;

    }
    probe(method){
        let hook = null;
        if(method instanceof CLASS.Class){
            console.log("TODO");
        }else if(method instanceof CLASS.Method){
            hook = new Hook(this.context);

            //hook.setID( this.nextHookIdFor(method));
            hook.setID( md5(this.nextHookIdFor(method)));
            
            //hook.makeProbeFor(method);
            hook.makeHookFor(method);

            //hook.setMethod(method);
            // method.setProbing(true);
            method.probing = true;

            console.log("[PROBE] Add : ",hook.name)
            this.hooks.push(hook);
        }
        return hook;
    }

    addPrologue(prologue){
        return this.prologues.push( this.prologue.injectContext(this.context));
    }
    removePrologueOf(hookset){
        let npro = [];
        for(let i=0; i<this.prologues.length; i++){
            if(this.prologues[i].parentID != hookset.getID()){
                npro.push(this.prologues[i]);
            }   
        }
        this.prologues = npro;
    }


    removeHooksOf(hookset){
        let npro = [];
        for(let i=0; i<this.hooks.length; i++){
            if(this.hooks[i].parentID != hookset.getID()){
                npro.push(this.hooks[i]);
            }   
        }
        this.prologues = npro;
    }

    /**
     * To list hooks
     * 
     * @method
     */
    list(){
        return this.hooks;
    }

    /**
     * To get latest hook session
     * 
     * @returns {HookSession} Latest hook session
     * @method
     */
    lastSession(){
        if(this.sessions.length == null){
            return null;
        }
        return this.sessions[this.sessions.length-1];
    }
}

/**
 * Group of hook 
 * 
 * @param {*} config 
 */
function HookSet(config){
    this.id = null;
    this.name = null;
    this.description = null;
    this.prologue = null;
    this.intercepts = [];
    this.probes = [];
    this.context = null;
    this.enable = false;
    this.requires = [];
    this.color = null;
   // this.requiresNode = [];

    for(let i in config) this[i] = config[i];
    return this;
}
HookSet.prototype.isEnable = function(){
    return this.enable;
}
HookSet.prototype.getID = function(){
    return this.id;
}
HookSet.prototype.injectContext = function(context){
    this.context = context;

    // forward to the prologue
    if(this.prologue!=null)
        this.prologue.context = this.context;
    
    // register the hookset to the HookManager
    this.context.hook.addHookSet(this);

    return this; 
}
HookSet.prototype.addPrologue = function(code){
    //this.prologue = code;
    this.prologue = new HookPrologue({
        parentID: this.id,
        script: code
    });

    return this;
}
HookSet.prototype.require = function(module){
    this.requires.push(module);
}
/*
HookSet.prototype.requireNodeModule = function(module){
    this.requiresNode.push(module);
}*/
/**
 * Create a object shared with others hook callback
 * @param {Object} config Shared object config 
 */
HookSet.prototype.addHookShare = function(config){
    this.share = config;
    return this;
}



/**
 * Get the shared object from this hookset
 * @returns {Object} Shared object
 * @function
 */
HookSet.prototype.getHookShare = function(){
    return this.share;
}
HookSet.prototype.addProbe = function(probeConfig){
    if(probeConfig.method != null){
        if(typeof probeConfig.method != "string"){
            let probe = null;
            for(let i=0; i<probeConfig.method.length; i++){
                probe = new HookPrimitive(probeConfig);
                probe.setMethod( probeConfig.method[i]);
                this.probes.push( probe);            
            }
        }else{
            probe = new HookPrimitive(probeConfig);
            probe.setMethod( probeConfig.method);
            this.probes.push( probe); 
            //this.probes.push( new HookPrimitive(probeConfig));
        }    
    }else{
        probe = new HookPrimitive(probeConfig);
        this.probes.push( probe); 
    }
     return this;
}

/*
HookSet.prototype.addProbe = function(probeConfig){
    if(probeConfig.multiple_method != null){
        let probe = null;
        for(let i=0; i<probeConfig.multiple_method.length; i++){
            probe = new HookPrimitive(probeConfig);
            probe.setMethod( probeConfig.multiple_method[i]);
            this.probes.push( probe);            
        }
    }else
        this.probes.push( new HookPrimitive(probeConfig));
    
    return this;
}
*/
HookSet.prototype.addIntercept = function(interceptConfig){
    if(interceptConfig.method == null && interceptConfig.raw == null){
        Logger.error("[HOOK MANAGER] addIntercept(): The method to hook is not defined");
        return null;
    }

    let primitive;

    if(interceptConfig.method !=null){
        if(typeof interceptConfig.method != "string"){
            for(let i=0; i<interceptConfig.method.length; i++){
                primitive = new HookPrimitive(interceptConfig);
                primitive.setMethod( interceptConfig.method[i]);
                primitive.isIntercept = true;
                primitive.color = this.color;

                this.intercepts.push( primitive);            
            }
        }else{
            primitive = new HookPrimitive(interceptConfig);
            primitive.isIntercept = true;
            primitive.setMethod( interceptConfig.method);
            primitive.color = this.color;

            this.intercepts.push( primitive);
        }
    }
    else{
        primitive = new HookPrimitive(interceptConfig);
        primitive.color = this.color;
        this.intercepts.push( primitive); 
    }


    return this;
}

HookSet.prototype.addCustomHook = function(config){
    if(config.method == null && config.raw == null){
        Logger.error("[HOOK MANAGER] addCustomHook(): The method to hook is not defined");
        return null;
    }

    if(config.method !=null){
        if(typeof config.method != "string"){
            for(let i=0; i<config.method.length; i++){
                config.custom = true;
                primitive = new HookPrimitive(config);
                primitive.isIntercept = true;
                primitive.isCustom = true;
                primitive.setMethod( config.method);
                primitive.color = this.color;

                this.intercepts.push( primitive);           
            }
        }else{
            config.custom = true;
            primitive = new HookPrimitive(config);
            primitive.isIntercept = true;
            primitive.isCustom = true;
            primitive.setMethod( config.method);
            primitive.color = this.color;

            this.intercepts.push( primitive);
        }
        
    }
}

/*
HookSet.prototype.addIntercept = function(interceptConfig){
    let primitive = null;
    if(interceptConfig.multiple_method != null){
        for(let i=0; i<interceptConfig.multiple_method.length; i++){
            primitive = new HookPrimitive(interceptConfig);
            primitive.setMethod( interceptConfig.multiple_method[i]);
            primitive.isIntercept = true;
            this.intercepts.push( primitive);            
        }
    }else{
        primitive = new HookPrimitive(interceptConfig);
        primitive.isIntercept = true;
        this.intercepts.push( primitive);
    }

    return this;
}*/
/*
HookSet.prototype.addSyscallProbe = function(probeConfig){
    this.native_probes.push( new HookPrimitive(probeConfig));
    return this;
}
HookSet.prototype.addSyscallIntercept = function(probeConfig){
    this.native_intercepts.push( new HookPrimitive(probeConfig));
    return this;
}*/
HookSet.prototype.disable = function(){
    let hookManager = this.context.hook; //ctx.hook;
    let hook, method, hconfig;

    if(this.prologue != null)
        hookManager.removePrologueOf(this);

    hookManager.removeHooksOf(this);
    this.enable = false;
}

HookSet.prototype.deploy = function(){
    let hookManager = this.context.hook; //ctx.hook;
    let hook, method, hconfig;

    // if the hookset is already deployed only not deployed hooks are generated
    if(this.enable === false){
        hookManager.addRequires(this.requires);
        //hookManager.addRequiresNode(this.requiresNode);

        if(this.prologue != null)
            hookManager.prologues.push(
                this.prologue.injectContext(this.context)
            );
    }

    /*
    if(this.shares != null)
        hookManager.shares.push(
            this.prologue.injectContext(this.context)
        );
            */

    for(let i in this.probes){
        if(!(this.probes[i] instanceof Hook)){
            hook = this.probes[i].toProbe(this.context, this);

            console.log("[PROBE][HOOK SET] Add : ",hook.name)
            this.probes[i] = hook;
            hookManager.hooks.push(this.probes[i]);

            if(hook.onMatch != null)
                hookManager.addMatchListener(hook.getID(),hook.onMatch);
        }
    }
  
    for(let i in this.intercepts){
        if(!(this.intercepts[i] instanceof Hook)){
            hook = this.intercepts[i].toIntercept(this.context, this);

            if(hook.isCustomHook())
                Logger.info("[INTERCEPT][HOOK SET][CUSTOM] Add : ",hook.name)
            else
                Logger.info("[INTERCEPT][HOOK SET] Add : ",hook.name)
            
            this.intercepts[i] = hook;    
            hookManager.hooks.push(this.intercepts[i]);   
            
            if(hook.onMatch != null)
                hookManager.addMatchListener(hook.getID(),hook.onMatch);
        }
    }

    this.enable = true;
}
HookSet.prototype.toJsonObject = function(){
    let o = new Object();
    for(let i in this){
        switch(i){
            case "id":
            case "name":
            case "enable":
            case "description":
                o[i] = this[i];
                break;
            case "prologue":
                if(this[i]!=null)
                    o[i] = this[i].toJsonObject();
                else
                    o[i] = "";
                break;
            case "probes":
            case "intercepts":
                o[i] = [];
                for(let j=0;  j<this[i].length; j++)
                    o[i].push(this[i][j].toJsonObject());
                break;
            case "context":
                break;
        }
    }
    return o;
}

module.exports = {
    Manager: HookManager,
    Hook: Hook,
    HookPrimitive: HookPrimitive,
    HookMessage: HookMessage,
    HookSession: HookSession,
    HookSet: HookSet,
    VariableArray: VariableArray,
    VariableObject: VariableObject,
};
