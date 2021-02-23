const _fs_ = require('fs');
const _es_ = require('event-stream');


var ut = require("./Utils.js"); 
var OPCODE = require("./Opcode.js");
var CONST = require("./CoreConst.js");
const CLASS = require("./CoreClass.js");
const Event = require("./Event.js");
const Logger = require("./Logger.js")();
const Accessor = require("./AccessFlags");

const EOL = require('os').EOL;

const SML_MAIN=0;
const SML_METH=1;
const SML_ANNO=2;
const SML_PSWITCH=3;

const ERR_PARSE=0;
const LOG_DBG = false;

var LEX = CONST.LEX;

// todo voir WABT, square attack, mesh

var LOG = {
    DEBUG: function(txt){
        if(LOG_DBG) console.log(txt); 
    }
};

// end of core class

var Checker = {
    isBasicType: function(c){
        return (CONST.TYPES[c] != undefined);
    },
    isObjectType: function(c){
        return c=="L";
    },
    makeFnHashcode: function(modif,cls,name,args,ret){
        let xargs = "";
        for(let i in args) xargs+="<"+args[i]._hashcode+">";
        return modif._name+"|"+cls.name+"|"+name+"|"+xargs+"|"+ret._hashcode;
    },
    makeFieldHashcode: function(modif,cls,name,type){
        //console.log(type);
        return modif._name+"|"+cls.name+"|"+name+"|"+type._hashcode;
    }
};


/** 
 * Represent the Smali parser 
 * @class
 */
class SmaliParser
{
    constructor(context=null){
        this.ctx = context;
        this.state = null; //  state of the parser
        this.subject = null; // parsed smali file
        
        this.obj = null;
        this.objReady = false;

        this.__tmp_meth = null;
        this.__tmp_block = null;

        this.__instr_ctr = null;
        this.__instr_line = null;

        this.currentLine = null;

        let self = this;
        this.__appendBlock_callback = {
            // disabled for perform reasons
            /*basicblock: function(meth,block){
                this.ctx.bus.send(new Event.Event({
                    type: "disass.bb.new" 
                }));
            },*/
            datablock: function(meth,block){
                self.ctx.bus.send(new Event.Event({
                    type: "disass.datablock.new",
                    data: block 
                }));
            }
        };
    }

    setContext(context){
        this.ctx = context;
    }

    isModifier(name){
        for(let i in LEX.MODIFIER) 
            if(LEX.MODIFIER[i]==name) 
                return true;
        return false;
    }

    modifier(src){
        if(src instanceof String) src=src.split(LEX.TOKEN.SPACE);
        let mod = new Accessor.AccessFlags() , next=true;

        //if(src.length<2) return ERR_PARSE;
        for(let i=0; i<src.length && next; i++){
            mod._match++;
            switch(ut.trim(src[i])){
                case LEX.MODIFIER.PRIVATE:
                    mod.private = true;
                    break;
                case LEX.MODIFIER.PROTECTED:
                    mod.protected = true;
                    break;
                case LEX.MODIFIER.PUBLIC:
                    mod.public = true;
                    break;
                case LEX.MODIFIER.STATIC:
                    mod.static = true;
                    break;
                case LEX.MODIFIER.VOLATILE:
                    mod.volatile = true;
                    break;
                case LEX.MODIFIER.ABSTRACT:
                    mod.abstract = true;
                    break;
                case LEX.MODIFIER.FINAL:
                    mod.final = true;
                    break;
                case LEX.MODIFIER.CONSTR:
                    mod.construct = true;
                    break;
                case LEX.MODIFIER.SYNTHETIC:
                    mod.synth = true;
                    break;
                case LEX.MODIFIER.ENUM:
                    mod.enum = true;
                    break;
                case LEX.MODIFIER.TRANSIENT:
                    mod.transient = true;
                    break;
                case LEX.MODIFIER.DECLSYNC:
                    mod.declsync = true;
                    break;
                case LEX.MODIFIER.BRIDGE:
                    mod.bridge = true;
                    break;
                case LEX.MODIFIER.VARARG:
                    mod.varargs = true;
                    break;
                case LEX.MODIFIER.NATIVE:
                    mod.native = true;
                    break;
                case LEX.MODIFIER.INTERFACE:
                    mod.interface = true;
                    break;
                case LEX.MODIFIER.ANNOTATION:
                    mod.annotation = true;
                    break;
                case LEX.MODIFIER.STRICTFP:
                    mod.strictfp = true;
                    break;
                case LEX.MODIFIER.SYNCHRONIZED:
                    mod.synchronized = true;
                    break;
                default:
                    next=false;
                    mod._match--;
                    break;
            }
        }

        if(LOG_DBG){
            LOG.DEBUG("[parser::modifier] "+mod.sprint());
        }
        return mod;
    }

    fqcn(src){
        if(src.length==0) return ERR_PARSE;
        let raw="";
        raw = (src instanceof Array)? src[0] : src;

        // remove additional chars : "L"  at begin and ";" at end. 
        // console.log("PARSER::FQCN > ",src);
        let s=raw.substr(1,raw.length-2);
        while(s.indexOf("/")>-1) s=s.replace("/",".");
        
        LOG.DEBUG("[parser::fqcn] "+s);
        return s; 
    }

    fspath(src){
        let s=src;
        s = s.substr(s.indexOf(LEX.TOKEN.DELIMITER)+1);
        s = s.substr(0,s.indexOf(LEX.TOKEN.DELIMITER));
        LOG.DEBUG("[parser::fspath] "+s);
        return s;
    }

    // char 
    basicTypes(c){
        return CONST.TYPES[c];
    }

    class(src){
        let fqcn=null,end=-1;
        LOG.DEBUG("---------------------------------------------\n[parser::class] Start ");

        //console.log("[?] Instruction parsed : "+OPCODE.CTR);
        if(src instanceof String)
            src=ut.trim(src).split(LEX.STRUCT.SPACE); 
        
        if(src[0]==LEX.STRUCT.CLASS)   src.shift();

        this.obj = new CLASS.Class();
        //console.log(src);
        // parse modifiers
        this.obj.modifiers = this.modifier(src);
        //console.log(src);

        // clean src with identified modifier
        for(let i=0; i<this.obj.modifiers._match; i++) src.shift();

        // console.log(src);
        // parse nam
        fqcn = this.fqcn(src);
        end = fqcn.lastIndexOf(".");
        this.obj.fqcn = this.obj.name = fqcn;
        this.obj.package = fqcn.substr(0,end); 
        this.obj.simpleName = fqcn.substr(end+1); 
        if(this.obj.name.indexOf(LEX.TOKEN.INNER_FQCN)>-1){
            this.obj.simpleName = this.obj.simpleName.substr(this.obj.simpleName.indexOf(LEX.TOKEN.INNER_FQCN)+1);
            this.obj.innerClass = true;
            this.obj.enclosingClass = this.obj.name.substr(0,this.obj.name.indexOf(LEX.TOKEN.INNER_FQCN));
        } 

        this.obj._hashcode = this.obj.hashCode();

        LOG.DEBUG("[parser::class] End\n---------------------------------------------");
        return this.obj;
    }


    type(src){
        let i=0,l=-1,types=[],s=src,fqn=null,isArray=false;

        while(i<src.length){
            if(src[i]==LEX.TOKEN.ARRAY){
                isArray=true;
                i++;
                continue;
            }

            if(src[i]==LEX.TOKEN.OBJREF){
                l=src.indexOf(";",i);
                fqn=this.fqcn(src.substr(i,l-i+1));
                //console.log(fqn);
                types.push(new CLASS.ObjectType(fqn, isArray));
                i=l+1;
                isArray=false;
                continue;

            }else if(Checker.isBasicType(src[i])){
                types.push(new CLASS.BasicType(src[i], isArray));
                i++;
                isArray = false;
                continue;
            }
            else{
                console.log("[!] Unknow type : "+src[i]+" (in "+src+")");
                break;
            }
        }

        return types;
    }


    /**
     * To parse a method header
     */
    methodHeader(src){
        let mod = this.modifier(src), raw=null, tmp=null, args=null, ret=null, sa=0, ea=0;
        let argTypes = null;
        // clean src with identified modifier
        for(let i=0; i<mod._match; i++) src.shift();

        if(src.length > 1){
            console.log(src,mod);
            console.log("[!] Method has more modifiers");
        }

        this.__tmp_meth.modifiers = mod;
        raw = ut.trim(src[src.length-1]);

        // risque d'UTF8 / autre dans le nom, quid des regexp;
        tmp = raw.substr(0,sa=raw.indexOf(LEX.TOKEN.METH_ARG_B));  
        this.__tmp_meth.name = tmp;
        
        args = raw.substr(sa+1,(ea=raw.indexOf(LEX.TOKEN.METH_ARG_E))-sa-1)
        argTypes = this.type(ut.trim(args));
        this.__tmp_meth.args = argTypes;
        this.__tmp_meth.argsNb = this.__tmp_meth.args.length;

        ret=raw.substr(ea+1);
        ret = this.type(ut.trim(ret))
        if(ret.length == 0)
            console.log("[!] this.method error : return type of '"+tmp+"("+args+")' cannot be parsed.")
            //exit(0);

        this.__tmp_meth.enclosingClass = this.obj;
        this.__tmp_meth.ret = ret[0];

        this.__tmp_meth._hashcode = this.__tmp_meth.hashCode();
    }

    instr(src, raw_src, src_line){
        let inst = null;//new Instruction();

        inst = OPCODE.parse(src,raw_src, src_line);

        if(inst != null){
            //console.log(inst);
        }
        //inst.operands = inst.opcode.parse(src);
        //console.log('"'+src[0]+'"',inst.opcode);
        // todo
        return inst;
    }

    field(src_arr, src_line){
        let f=new CLASS.Field(), type=null, tmp=null;

        // parse modifiers
        f.modifiers = this.modifier(src_arr);
        //console.log(f.modifiers);

        // clean src with identified modifier
        for(let i=0; i<f.modifiers._match; i++) src_arr.shift();
        // parse name and type
        tmp=src_arr[0].split(":");
        
        f.name=tmp[0];

        type=this.type(tmp[1]);
        if(type.length>0) f.type=type[0];

        //console.log(type.type[0]._hashcode);

        f.enclosingClass = this.obj;
        f._hashcode = f.hashCode();//Checker.makeFieldHashcode(f.modifiers,this.obj,f.name,f.type);
        
        f.signature();
        f.oline = src_line;

        LOG.DEBUG("[parser::field] Hashcode : "+f._hashcode);

        src_arr.shift();

        // parse value if available
        if(src_arr.length>0){
            // TODO : parse value
            f.value = src_arr.pop();
        }
        return f;
    }


    method(src, raw_src, src_line){
        if(this.state != SML_METH) return null;
        
        let sml=src, hdl=null, catchStmt=null, tmp=null;


        switch(ut.trim(sml[0])){
            case LEX.STRUCT.METHOD_BEG:
                LOG.DEBUG("---------------------------------------------\n[parser::method] Start ");    
                this.__tmp_meth = new CLASS.Method();
                sml.shift();

                this.methodHeader(sml,src_line);  
            
                this.__tmp_meth.__$in_annot = false;
                this.__tmp_block = new CLASS.BasicBlock();
                this.__instr_ctr = 0;
                break;
            case LEX.STRUCT.LOCALS:
                this.__tmp_meth.locals = parseInt(sml[1],10);
                break;
            case LEX.STRUCT.PARAMS:
                // this.__tmp_meth.params = parseInt(sml[1],10);
                this.__tmp_meth.params.push(
                    OPCODE.parseParam(sml[1],raw_src)
                );
                
                break;
            case LEX.STRUCT.REG:
                this.__tmp_meth.registers = parseInt(sml[1],10);
                break;
            case ".prologue":
                break;
            case LEX.STRUCT.LINE:
                
                // .line is just a metadata associated to an instruction
                /*if(this.__tmp_block != null && this.__tmp_block.stack.length > 0){

                    this.__tmp_meth.appendBlock(this.__tmp_block, this.__appendBlock_callback);
                    this.__tmp_block = new CLASS.BasicBlock();
                }*/
                //  && this.__tmp_block.line != null
                this.__tmp_block.line = parseInt(sml[1],10);
                this.currentLine = parseInt(sml[1],10);

                // source line number
                this.__tmp_block.srcln = parseInt(sml[1],10);
                
                break;
            case LEX.STRUCT.PSWITCH:
                
                if(sml[1] != undefined){
                    this.__tmp_block.setupPackedSwitchStatement(parseInt(sml[1],16));
                }

                break;
            case LEX.STRUCT.SSWITCH:
                
                this.__tmp_block.setupSparseSwitchStatement();
                
                break;
            case LEX.STRUCT.ARRAY:
                this.__tmp_block.setDataWidth(parseInt(sml[1],10));
                
                break;
            case LEX.STRUCT.END:

                if(sml[1]!=undefined && sml[1]==LEX.STRUCT.METHOD_NAME){
                    //hdl = this.__tmp_meth._hashcode;
                    this.state=SML_MAIN;   
                    this.__tmp_meth.appendBlock(this.__tmp_block, this.__appendBlock_callback);   
                    
                    this.obj.methods[ this.__tmp_meth.signature()] = this.__tmp_meth;
                    this.obj._methCount++;
                    LOG.DEBUG("[parser::method] End\n---------------------------------------------");
                }else if(sml[1]!=undefined && sml[1]==LEX.STRUCT.ANNOTATION_NAME){
                    this.__tmp_meth.__$in_annot = false;
                }/*
                else if(sml[1]!=undefined && sml[1]==LEX.STRUCT.PSWITCH_NAME){
                    // nothing to do
                    //console.log("End of packed switch");
                }xs
                else if(sml[1]!=undefined && sml[1]==LEX.STRUCT.ARRAY_NAME){

                }*/
                break;
            case LEX.STRUCT.ANNOT_BEG:
                // ignore
                this.__tmp_meth.__$in_annot = true;
                break;
            default: 
                if(this.__tmp_meth.__$in_annot){
                    // ignore
                    break;
                }

                if(sml[0].indexOf(':cond_')>-1){
                    if(this.__tmp_block instanceof CLASS.DataBlock || this.__tmp_block.stack.length>0){
                        this.__tmp_meth.appendBlock(this.__tmp_block, this.__appendBlock_callback);
                        this.__tmp_block = new CLASS.BasicBlock();
                    }

                    //this.__tmp_block.tag = sml[0];
                    this.__tmp_block.setAsConditionalBlock(sml[0].split('_')[1]);

                }else if(sml[0].indexOf(':goto_')>-1){
                    if(this.__tmp_block instanceof CLASS.DataBlock || this.__tmp_block.stack.length>0){
                        this.__tmp_meth.appendBlock(this.__tmp_block, this.__appendBlock_callback);
                        this.__tmp_block = new CLASS.BasicBlock();
                    }
                    //this.__tmp_block.tag = sml[0];
                    this.__tmp_block.setAsGotoBlock(sml[0].split('_')[1]);

                }
                else if(sml[0].indexOf(':try_start')>-1){
                    if(this.__tmp_block instanceof CLASS.DataBlock || this.__tmp_block.stack.length>0){
                        this.__tmp_meth.appendBlock(this.__tmp_block, this.__appendBlock_callback);
                        this.__tmp_block = new CLASS.BasicBlock();
                    }
                    //   this.__tmp_block.tag = sml[0];
                    this.__tmp_block.setAsTryBlock(sml[0]);
                    
                }
                else if(sml[0].indexOf(':try_end')>-1){
                    this.__tmp_block.setTryEndName(sml[0]);

                    if(this.__tmp_block != null){
                        this.__tmp_meth.appendBlock(this.__tmp_block, this.__appendBlock_callback);
                        this.__tmp_block = new CLASS.BasicBlock();
                    }
                }
                // >-1
                else if(sml[0].indexOf(LEX.LABEL.PSWITCH_DATA)==0 || sml[0].indexOf(LEX.LABEL.SSWITCH_DATA)==0){

                    if(this.__tmp_block != null){
                        this.__tmp_meth.appendBlock(this.__tmp_block, this.__appendBlock_callback);
                        this.__tmp_block = new CLASS.BasicBlock();
                    }
                    
                    this.__tmp_block.setAsSwitchStatement(sml[0]);
                }
                // >-1
                else if(sml[0].indexOf(LEX.LABEL.PSWITCH)==0){
    
                    if(this.__tmp_block.isSwitchStatement()){
                            this.__tmp_block.switch.appendCase(sml[0]);
                    }else{  
                        this.__tmp_block.setAsSwitchCase(sml[0]);
                    }   

                }
                // >-1 
                else if(sml[0].indexOf(LEX.LABEL.SSWITCH)==0){

                    if(this.__tmp_block != null
                        && (this.__tmp_block instanceof CLASS.DataBlock 
                            || this.__tmp_block.stack.length > 0)){
                        this.__tmp_meth.appendBlock(this.__tmp_block, this.__appendBlock_callback);
                        this.__tmp_block = new CLASS.BasicBlock();
                    }
                        
                    this.__tmp_block.setAsSwitchCase(sml[0]);
                }
                else if(sml.length > 2 && sml[2].indexOf(LEX.LABEL.SSWITCH)>-1 && sml[0].indexOf("p")==-1){
                    if(this.__tmp_block.isSwitchStatement()){
                     //   console.log(sml);
                        this.__tmp_block.switch.appendCase(sml[0],sml[2]);
                    } 

                }
                else if(sml[0].indexOf(LEX.LABEL.ARRAY)>-1){
                    // check if tmp block not empty (data or bb)
                    if(this.__tmp_block != null){
                        this.__tmp_meth.appendBlock(this.__tmp_block, this.__appendBlock_callback);
                    }
                    this.__tmp_block = new CLASS.DataBlock();
                    this.__tmp_block.name = sml[0];
                }
                else if(sml[0].indexOf(LEX.STRUCT.CATCH_ALL)>-1){
                    catchStmt = new CLASS.CatchStatement();
                    catchStmt.setTryStart(sml[1].substr(1,sml[1].length));
                    catchStmt.setTryEnd(sml[3].substr(0,sml[3].length-1));
                    catchStmt.setTarget(sml[4]);


                    tmp = this.__tmp_meth.getBasicBlocks();
                    tmp[tmp.length-1].addCatchStatement(catchStmt);

                    //this.__tmp_block.addCatchStatement(catchStmt);
                }
                else if(sml[0].indexOf(LEX.STRUCT.CATCH)>-1){
                    catchStmt = new CLASS.CatchStatement();
                    catchStmt.setException(this.type(sml[1])[0]);
                    catchStmt.setTryStart(sml[2].substr(1,sml[2].length));
                    catchStmt.setTryEnd(sml[4].substr(0,sml[4].length-1));
                    catchStmt.setTarget(sml[5]);

                    //console.log(sml);
                    tmp = this.__tmp_meth.getBasicBlocks();
                    tmp[tmp.length-1].addCatchStatement(catchStmt);
                    /*if(this.__tmp_block != null){
                        this.__tmp_meth.appendBlock(this.__tmp_block, this.__appendBlock_callback);
                        this.__tmp_block = new CLASS.BasicBlock();
                    }

                    this.__tmp_block.addCatchStatement(catchStmt);*/
                }
                else if(sml[0].indexOf(LEX.LABEL.CATCH)>-1){
                    if(this.__tmp_block != null 
                        && ( this.__tmp_block instanceof CLASS.DataBlock 
                            || this.__tmp_block.stack.length > 0 )){
                        this.__tmp_meth.appendBlock(this.__tmp_block, this.__appendBlock_callback);              
                        this.__tmp_block = new CLASS.BasicBlock();
                    }

                    this.__tmp_block.setCatchCond(raw_src);
                }
                else if(sml[0].indexOf(':catchall')>-1){

                    if(this.__tmp_block != null 
                        && ( this.__tmp_block instanceof CLASS.DataBlock 
                            || this.__tmp_block.stack.length > 0 )){
                        this.__tmp_meth.appendBlock(this.__tmp_block, this.__appendBlock_callback);              
                        this.__tmp_block = new CLASS.BasicBlock();
                    }
                    this.__tmp_block.setAsCatchBlock(sml[0]);

                }
                else if(this.__tmp_block instanceof CLASS.DataBlock){

                    hdl = CONST.RE.ARRAY_VALUE.exec(sml[0]);
                    if(hdl ==null) break; 
                    this.__tmp_block.pushData("0x"+hdl[2], (hdl[1] != undefined), (hdl[3]=='s'));
                }
                else{

                    if(this.__tmp_block instanceof CLASS.DataBlock) console.log("Error : DataBlock instead of BasicBlock",this.__tmp_meth);
                    if(this.__tmp_block == null) console.log("Error : tmpBlock is null",this.__tmp_meth);
                    hdl = this.instr(sml,raw_src,src_line);


                    if(hdl !== null){

                        this.__instr_ctr++;
                        hdl.offset = this.__instr_ctr;
                        hdl.oline = this.__instr_ctr;
                        if(this.currentLine != null){
                            hdl.iline = this.currentLine;
                            this.currentLine = null;
                        }
                        this.__tmp_block.stack.push(hdl);

                        if(hdl.opcode.type == CONST.INSTR_TYPE.IF || hdl.opcode.type == CONST.INSTR_TYPE.GOTO ) {

                            
                            if(this.__tmp_block instanceof CLASS.DataBlock || this.__tmp_block.stack.length>0){
                                this.__tmp_meth.appendBlock(this.__tmp_block, this.__appendBlock_callback);
                                this.__tmp_block = new CLASS.BasicBlock();
                            }

                        }
                    }


                    // add end of basic block on If / Goto
/*                    else if(this.isJumpInstruction(sml)){
                        if(this.__tmp_block instanceof CLASS.DataBlock || this.__tmp_block.stack.length>0){
                            this.__tmp_meth.appendBlock(this.__tmp_block, this.__appendBlock_callback);
                            this.__tmp_block = new CLASS.BasicBlock();
                        }

                        if(this.__tmp_block == null) console.log("Error : tmpBlock is null",this.__tmp_meth);
                        hdl = this.instr(sml,raw_src,src_line);

                        if(hdl !== null){
                            this.__instr_ctr++;
                            hdl.offset = this.__instr_ctr;
                            hdl.oline = this.__instr_ctr;
                            this.__tmp_block.stack.push(hdl);
                        }
                        //this.__tmp_block.tag = sml[0];
                        //this.__tmp_block.setAsGotoBlock(sml[0].split('_')[1]);
                    }*/
                    
                }



                break;
        }

        return true;
    }

    annotation(src){
        if(this.state != SML_ANNO) return null;

        let sml=[], hdl=null;

        sml=(src instanceof String)? src.split(LEX.TOKEN.SPACE) : src ;
        
        // search lexeme
        switch(ut.trim(sml[0])){
            case LEX.STRUCT.END:
                if(sml[1]!=undefined && sml[1]=="annotation"){
                    this.state=SML_MAIN;    
                }
                break;
        }
        //console.log("[!] this.annotation not implemented");
    }

    parse(src){
        let ls=src.split(EOL), ln=null, sml=null, obj=null;
    
        //console.log(ls);
        for(let l=0; l<ls.length; l++){
            ln=ut.trim(ls[l]);
            if(ln.length==0){
                continue;
            }
            sml=ln.split(LEX.TOKEN.SPACE);
            switch(sml[0]){
                case LEX.STRUCT.CLASS:
                    sml.shift();
                    this.class(sml);
                    break;
                case LEX.STRUCT.IMPLEMENTS:
                    sml.shift();
                    this.obj.implements.push(this.fqcn(sml[0]));
                    break;
                case LEX.STRUCT.SUPER:
                    sml.shift();
                    this.obj.extends = this.fqcn(sml[0]);
                    break;
                case LEX.STRUCT.SRC: 
                    this.obj.source = this.fspath(sml[1]);
                    break;
                case LEX.STRUCT.FIELD:
                    sml.shift();
                    obj=this.field(sml,l);
                    // use an internal name which combine visibility and field name
                    //this.obj.fields[obj._hashcode] = obj;
                    this.obj.fields[obj.signature()] = obj;
                    this.obj._fieldCount++;
                    
                    break;
                case LEX.STRUCT.METHOD_BEG:
                    this.state = SML_METH;
                    this.method(sml,ln,l);
                    break;
                case LEX.STRUCT.ANNOT_BEG:
                    if(this.state != SML_METH){
                        this.state = SML_ANNO;
                        this.annotation(sml);
                    }
                    break;
                default:
                    switch(this.state){
                        case SML_METH:
                            this.method(sml,ln,l);
                            break;
                        case SML_PSWITCH:
                            this.pswitch(sml,ln,l);
                            break;
                        case SML_ANNO:
                            this.annotation(sml);
                            break;
                    }
                    break;
            }
        }
        //console.log(this.obj);
        //this.obj.dump();
        return this.obj;
    }

    parseStream( pFilePath, pEncoding, pCallback){

        let _self = this, rs=null, stream=null;
        _self.obj = null;
        _self.objReady = false;

        stream =_fs_.createReadStream(pFilePath)
        .pipe(_es_.split())
        .pipe(_es_.mapSync(function(line){
    
                // pause the readstream
                stream.pause();
        
                
                // process line here and call s.resume() when rdy
                // function below was for logging memory usage
                console.log(line);
        
                // resume the readstream, possibly from a callback
                stream.resume();
            })
            .on('error', function(err){
                console.log('Error while reading file.', err);
            })
            .on('end', function(){
                console.log('Read entire file.')
            })
        );

        //stream = _fs_.createReadStream(pFilePath,{ encoding: 'utf8' });

        //stream = LineStream(stream);

        /*
        stream.on('resume', function(){
            console.log('resume');
        });*/

     
        
/*
        stream.on('pause', function(){
            console.log('paused');
        });

        stream.on('close', function(){
            console.log("close", _self.obj)
            pCallback(_self.obj);
        });

        stream.on('data', function(pLine){
            let ln=null, sml=null, obj=null;

            console.log(pLine);

            ln=ut.trim(pLine);
            if(ln.length==0){
                return;
            }

            sml=ln.split(LEX.TOKEN.SPACE);
            switch(sml[0]){
                case LEX.STRUCT.CLASS:
                    sml.shift();
                    _self.class(sml);
                    break;
                case LEX.STRUCT.IMPLEMENTS:
                    sml.shift();
                    _self.obj.implements.push(_self.fqcn(sml[0]));
                    break;
                case LEX.STRUCT.SUPER:
                    sml.shift();
                    _self.obj.extends = _self.fqcn(sml[0]);
                    break;
                case LEX.STRUCT.SRC: 
                    _self.obj.source = _self.fspath(sml[1]);
                    break;
                case LEX.STRUCT.FIELD:
                    sml.shift();
                    obj=_self.field(sml,l);
                    // use an internal name which combine visibility and field name
                    //this.obj.fields[obj._hashcode] = obj;
                    _self.obj.fields[obj.signature()] = obj;
                    _self.obj._fieldCount++;
                    
                    break;
                case LEX.STRUCT.METHOD_BEG:
                    _self.state = SML_METH;
                    _self.method(sml,ln,l);
                    break;
                case LEX.STRUCT.ANNOT_BEG:
                    if(_self.state != SML_METH){
                        _self.state = SML_ANNO;
                        _self.annotation(sml);
                    }
                    break;
                default:
                    switch(_self.state){
                        case SML_METH:
                            _self.method(sml,ln,l);
                            break;
                        case SML_PSWITCH:
                            _self.pswitch(sml,ln,l);
                            break;
                        case SML_ANNO:
                            _self.annotation(sml);
                            break;
                    }
                    break;
            }
        });*/
    }
}


module.exports = SmaliParser;    