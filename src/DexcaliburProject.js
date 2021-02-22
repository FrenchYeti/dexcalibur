var Process = require("child_process");
const _path_ = require("path");
const Fs = require("fs");

var Logger = require("./Logger.js")();
var Analyzer = require("./Analyzer.js");
var AnalysisHelper = require("./AnalysisHelper.js");
var Finder = require("./Finder.js");
var PackagePatcher = require("./PackagePatcher.js");
var HookHelper = require("./HookManager.js");
var DexHelper = require("./DexHelper.js");
var Inspector = require("./Inspector");
var InspectorManager = require("./InspectorManager.js");
var Workspace = require("./Workspace.js");
var DataAnalyzer = require("./DataAnalyzer.js");
const DeviceManager = require('./DeviceManager');
const AndroidAppAnalyzer = require("./AndroidAppAnalyzer.js");
var GraphMaker = require("./Graph.js");
var Bus = require("./Bus.js");
var Event = require("./Event.js");
var ApkHelper = require("./ApkHelper.js");
const Platform = require("./Platform.js");
const SYSCALLS = require("./Syscalls.js");
const PlatformManager = require("./PlatformManager");
const DexcaliburWorkspace = require("./DexcaliburWorkspace");
const Device = require('./Device');
const APK = require('./APK');
const ConnectorFactory = require('./ConnectorFactory');


var g_builtinHookSets = {};

/**
 * To represent an instance of a running application.
 * 
 * It can be used in order to pause/resume an application running on a remote device. 
 * 
 * @param {int} pid The Remote PID of the application 
 * @constructor
 */
function ApplicationInstance(pid){
    this.pid = null;
}

/**
 * @class
 * @author Georges-B. MICHEL
 */
class DexcaliburProject
{

    /**
     * 
     * @param {DexcaliburEngine} pEngine  Instance of the DexcaliburEngine (holding the context)
     * @param {String} pUID The UID of the project, an unique name for this project
     * @constructor
     */
    constructor( pEngine, pUID){

        /**
         * @type {DexcaliburEngine}
         * @field Dexcalibur engine (context)
         */
        this.engine = pEngine;

        /**
         * @type {String}
         * @field Project UID
         */
        this.uid = pUID;

        /**
         * @type {String}
         * @field Package name of the target
         */
        this.pkg = null;

        /**
         * @field Instance of project's configuration
         */
        this.config = null;

        /**
         * @field Flag 
         */
        this.nofrida = false;

        /**
         * @field the default android API version to use.
         */
        this.apiVersion = null;

        // set the Search API which allow the user to perform search
        /**
         *
         * @type {Finder}
         * @field the finder API configured for this project
         */
        this.find = null;

        // set SC analyzer
        /**
         * @type {Analyzer}
         * @field The static analyzer for this project
         */
        this.analyze = null;

        // dex helper
        this.dexHelper = null;

        //package Patcher
        this.packagePatcher = null;

        // hook
        this.hook = null;

        // set the workspace API
        /**
         * @type {Workspace}
         * @field Project workspace
         */
        this.workspace = null;

        // setup File Analyzer
        /**
         * @type {DataAnalyzer}
         * @field Raw data analyzer unit
         */
        this.dataAnalyser = null;

        /**
         * @type {Bus}
         * @field The event bus
         */
        this.bus = null;

        /**
         * @type {AndroidAppAnalyzer}
         * @field Application topology analyzer unit (depend of application type : apk,bin, ...)
         */
        this.appAnalyzer = null;

        /**
         * @type {Inspector[]}
         * @field All inspectors
         */
        this.inspectors = null;

        // FridaBuilder make Frida script chunk from cls
        this.fridaBuilder = null;

        // 
        this.graph = null;

        // NEW

        /**
         * Ready flag 
         * @field
         */
        this.ready = false;

        /**
         * Target platform 
         * @field
         */
        this.platform = null;

        /**
         * Default device
         */
        this.device = null;

        /**
         * @field Class representing target application
         */
        this.application = null;

        /**
         * @type {*}
         * @field Connector
         */
        this.connector = null;
    }

    /**
     * To select the way to store the internal data
     *
     * @param {String} pConnectorType Connector type
     * @method
     */
    setConnector( pConnectorType){
        this.connector = ConnectorFactory.getInstance().newConnector( pConnectorType, this);
    }

    /**
     * To get DexcaliburEngine instance associated to this project
     *
     * @returns {DexcaliburEngine} DexcaliburEngine instance
     * @method
     */
    getContext(){
        return this.engine;
    }

    /**
     * To suggest a new project name
     * 
     * @param {*} pUID 
     * @method
     */
    static suggests( pUID){
        let original = pUID;
        let i = 0;

        while( DexcaliburProject.exists(original+"_"+i) ) i++;

        return original+"_"+i;
    }

    /**
     * To detect if there is a project with the specified UID
     *
     * @param {String} pUID Project UID
     * @returns {Boolean} TRUE if a project exists, else FALSE
     * @method
     */
    static exists( pUID){
        let proj = DexcaliburWorkspace.getInstance().listProjects();
        let status = false;

        proj.map((vProject)=>{
            if(vProject === pUID)
                status = true;
        });

        return status;
    }

    /**
     * To init the project
     *
     * @method
     */
    init(){
        let im = InspectorManager.getInstance();

        // init config
        // TODO remove engine configuration
        if(this.config === null) {
            this.config = this.engine.getConfiguration();
        }

        // init project workspace
        if(this.workspace === null){
            this.workspace = new Workspace(
                _path_.join( this.engine.workspace.getLocation(), this.uid )
            );

            this.workspace.init();
        }

        // init connector
        if(this.connector === null){
            this.connector = ConnectorFactory.getInstance().newConnector('inmemory', this);
        }

        // set the Search API which allow the user to perform search
        this.find = new Finder.SearchAPI();

        // set SC analyzer
        this.analyze = new Analyzer(this.config.encoding, this.find, this);
        
        // set syscall list (bionic) 
        this.analyze.useSyscalls(SYSCALLS);
        this.analyze.addTagCategory(
            "hash",
            ["md5","sha1","sha256","sha512"]
        );
        this.analyze.addTagCategory(
            "key",
            ["256","1024","2048","4096"]
        );

        // todo : move to context free
        this.dexHelper = new DexHelper(this);

        // pkgName => uid => read project.json
        // todo : move as inspector
        //this.packagePatcher = new PackagePatcher(this.uid, this.config);

        this.hook = new HookHelper.Manager(this, this.nofrida);
        //this.hook.refreshScanner();


        // file analyzer 
        this.dataAnalyser = new DataAnalyzer.Analyzer(this);

        // create main event bus of this project 
        this.bus = new Bus(this); //.setContext(this);

        // manifest / app analyzer
        this.appAnalyzer = new AndroidAppAnalyzer(this);

        // plugins
        im.createInspectorsFor(this);
        im.deployInspectors(this, Inspector.STEP.BOOT);
        this.inspectors = im.getInspectorsOf(this);
        
        this.graph = new GraphMaker(this);


    }

    /**
     * To deploy all inspectors starting at the specified step
     *
     * Supported step :
     * - BOOT
     * - POST_PLATFORM_SCAN
     * - POST_APP_SCAN
     * - POST_DEV_SCAN
     * - ON_DEMAND
     *
     * @param {String} pStep Inspector step
     * @method
     */
    deployInspectors(pStep){
        let im = InspectorManager.getInstance();

        im.deployInspectors(this, pStep);
        this.inspectors = im.getInspectorsOf(this);
    }

    /**
     * To get the project UID
     *
     * @returns {String} ProjectUID
     * @method
     */
    getUID(){
        return this.uid;
    }

    /**
     * To get the inspector with specified name
     *
     * @param {String} Inspector name
     * @returns {Inspector} Inspector instance
     * @method
     */
    getInspector( pName){
        return this.inspectors[pName];
    }

    /**
     * To set default device
     * @method
     */
    setDevice( pDevice){
        this.device = pDevice;
    }
    

    /**
     * To get device target of the project
     * 
     * @method
     */
    getDevice(){
        return this.device;
    }


    /**
     * 
     * @param {*} pPath 
     */
    async useAPK( pPath){

        // copy the APK into project workspace
        this.workspace.changeMainAPK(pPath);

        // load it : decompress file, disass dex files
        return await ApkHelper.extract( 
            this.workspace.getApkPath(),
            this.workspace.getApkDir(),
            {
                force: true,
                match: true
            }
        );
    }

    /**
     * To synchronize project platform used during analysis with device and APK
     * 
     * @param {Platform | string} pName 
     * @method
     * @async
     */
    async synchronizePlatform( pName){
        let pm = PlatformManager.getInstance(), res=false;

        // select platform
        switch(pName){
            case 'dev':
                this.platform = this.device.getPlatform();
                break;
            case 'min':
                this.platform = pm.getFromAndroidApiVersion(this.application.getMinApiVersion());
                break;
            case 'max':
                this.platform = pm.getFromAndroidApiVersion(this.application.getMaxApiVersion());
                break;
            default:
                if(((pName instanceof Platform) === false) && (typeof pName == 'string' )){
                    //if(this.device instanceof Device){
                    //    this.platform = this.device.getPlatform(pName);
                    //}else{
                        this.platform = pm.getPlatform(pName); //getFromAndroidApiVersion(this.application.getMaxApiVersion());
                    //}
                }else{
			this.platform = pName;
		}
                break;
        }

        // check if platform is installed
        if(this.platform == null){
            throw new Error("[PROJECT] synchronizePlatform : unkow platform. Aborted")
        }

        // install platform
        if(this.platform.checkInstall() === false){
            Logger.info("[PROJECT] synchronizePlatform : Target platform is not installed. Installing ...")
            res = await pm.install(this.platform);
            if(res == true){
                Logger.info("[PROJECT] synchronizePlatform : Platform installed successfully");
            }else{
                throw new Error("[PROJECT] synchronizePlatform : failed to install platform. Aborted")
            }
        }else{
            Logger.success("[PROJECT] Project uses platform : "+this.platform.getUID());
        }

        // save project
        this.save();

        return true;
    }
    /**
     * To get Search Engine   
     * 
     * @returns {Finder.SearchAPI} Search engine for this project
     * @method
     */
    getSearchEngine(){
        return this.find;
    }


    /**
     * To open an existing project
     * 
     * Read `project.json` file
     * 
     * @method
     */
    async open(){
        // re-scan
        return this.fullscan();
    }

    /**
     * 
     * @param {*} pContext 
     * @param {*} pProjectUID 
     * @param {*} pConfigPath 
     */
    static load( pContext, pProjectUID, pConfigPath = null){
        
        let project = new DexcaliburProject( pContext, pProjectUID);
        let data = null;

        // Load project from workspace
        project.config = pContext.getConfiguration();

        project.workspace = new Workspace(
            _path_.join( pContext.workspace.getLocation(), pProjectUID )
        );

        project.workspace.init();


        if(pConfigPath == null){
            pConfigPath = project.workspace.getProjectCfgPath();
        }

        data = Fs.readFileSync( pConfigPath);
        data = JSON.parse(data);

        for(let i in data){
            switch(i)
            {
                case "device":
                    project.device = DeviceManager.getInstance().getDevice(data.device);
                    break;
                case "package":
                case "nofrida":
                    project[i] = data[i];
                    break;
                case "apk":
                    project.workspace.setApk( APK.fromJsonObject(data.apk));
                    break;
                case "connector":
                    if(data[i].hasOwnProperty('type')){
                        project.connector = ConnectorFactory.getInstance().newConnector(data[i].type, this, data[i]);
                    }else{
                        project.connector = ConnectorFactory.getInstance().newConnector('inmemory', this);
                    }
                    break;
            }
        }

        if(data.platform != null){
            project.platform = PlatformManager.getInstance().getPlatform(data.platform);
        }
        else if(project.device != null){
            project.platform = project.device.getPlatform(data.platform);
        }

        // init other properties
        project.init();

        return project;
    }

    /**
     * To save project metadata into 'project.json'
     *  
     * @param {*} pExportPath 
     */
    save( pExportPath = null){
        if(pExportPath == null){
            pExportPath = this.workspace.getProjectCfgPath();
        }

        Fs.writeFileSync(
            pExportPath, 
            JSON.stringify(this.toJsonObject())
        );
    }

    toJsonObject(){
        let o = new Object();

        // add last modified, user, etc ...
        o.uid = this.uid;
        o.package = this.pkg;
        o.device = this.device!=null? this.device.getUID() : null;
        o.platform = this.platform!=null? this.platform.getUID() : null;
        o.nofrida = this.nofrida;

        o.connector = this.connector.constructor.getProperties();

        if(this.workspace.getApk() !== null){
            o.apk = this.workspace.getApk().toJsonObject();
        }else{
            o.apk = null;
        }
        
        return o;
    }
    /**
     * To get the data analyzer.
     * 
     * @returns {DataAnalyzer} The data analyzer 
     * @method
     */
    getDataAnalyzer(){
        return this.dataAnalyser;
    }


    /**
     * To get the application analyzer, which includes manifest and permission analysis.
     * 
     * @returns {AndroidAppAnalyzer} The application analyzer 
     * @method
     */
    getAppAnalyzer(){
        return this.appAnalyzer;
    }


    /**
     * To get the bytecode static code analyzer which contains the internal database.
     * 
     * @returns {Analyzer} The internal bytecode analyzer 
     * @method
     */
    getAnalyzer(){
        return this.analyze;
    }

    /**
     * To set target platform to use during analysis
     * 
     * Replace `Project.useAPI()`
     * 
     * @param {String} pVersion 
     */
    async usePlatform( pVersion){
        // old
        // this.config.platform_target = pVersion;
        let pm = this.engine.getPlatformManager(), platform = null;

        //new
        this.platform = pm.getLocalPlatform(pVersion);
 
        if(this.platform !== null){
            return this;
        }

        // this platform is not yet installed
        platform = pm.getRemotePlatform(pVersion);

        // if the platform is available remotely, download it
        if(platform !== null){
            status = await pm.install(platform);
            if(status === true){
                this.platform = pm.getLocalPlatform(pVersion)
            }else{
                // TODO : throw exception. platform exists remotely, but install fails.  
            }
            return this;
        }else{
            // TODO : throw exception. unknow platform
        }
        return this;
    };


    /**
     * To perform a scan of the application byetcode only.
     * 
     * All reference to Android system classes will be tagged MissingReference or VMBinding
     * 
     * @param {string} path Optional, the path of the folder containing the decompiled smali code. 
     * @returns {Project} Returns the instance of this project
     * @deprecated ?
     * @method
     */
    scan( pPath){
        // make IR 
        if(pPath !== undefined){   
            this.analyze.path( pPath);
        }else{
            let apkctnPath = this.workspace.getApkDir();

            fs.mkdirSync(apkctnPath, {recursive: true});
            Logger.info("Scanning default path : "+apkctnPath);

            // bytecode analysis (from smali file)
            this.analyze.path( apkctnPath);

            // TODO : improve this step
            // files analysis (signature, ...)
            this.dataAnalyser.scan( apkctnPath);

            // update internal DB with file analyzer DB
            this.analyze.insertFiles( this.dataAnalyser.getDB, false);
        }
    }

    /**
     * To perform a scan of the set of files (not bytecode/dex/smali).
     * 
     * @param {string} path Optional, the path of the folder containing the decompiled smali code. 
     * @returns {Project} Returns the instance of this project
     * @method
     * @deprecated
     */
    scanForFiles(path){

        if(path == null){   
            Logger.error("Invalid filepaths to scan");
            return null;
        }

        let files = this.dataAnalyzer.scan(path);
        
        this.analyze.updateFiles( files.getDb().getFiles());
        this.analyze.updateBuffers( files.getDb().getBuffers());
        
        return this;
    };

    /**
     * To perform a fullsacn of the application. It  performs :
     *      - Android API bytecode scan (for the specified API version - by default it's API 25)
     *      - Application bytecode scan
     *      - Application package scan
     * @param {string} path Optional, the path of the folder containing the decompiled smali code. 
     * @returns {Project} Returns the instance of this project
     * @method
     */
    async fullscan( pPath){
        let elemnt=null;
        let success  = false;

        // scan OS/Platform
        Logger.info("Scanning platform "+this.platform.getUID());

        this.analyze.path(this.platform.getLocalPath());

        this.analyze.updateDataBlock();    

        this.analyze.tagAllAsInternal();

        this.deployInspectors(Inspector.STEP.POST_PLATFORM_SCAN);


        //this.analyze.path(this.config.platform_available[this.config.platform_target].getBinPath());

        // scan files  
        if(pPath !== undefined){   
            this.analyze.path( pPath);
            this.dataAnalyser.scan( pPath, ["smali"]);
            
        // this.analyze.scanManifest(Path.join(path,"AndroidManifest.xml"));
            success = await this.appAnalyzer.importManifest(_path_.join(pPath,"AndroidManifest.xml"));

        }else{
            //        let dexPath = this.workspace.getWD()+"dex";
            let apkPath = this.workspace.getApkDir();

            Logger.info("Scanning default path : "+apkPath);
            
            this.analyze.path( apkPath);
            this.dataAnalyser.scan( apkPath, ["smali"]);
    //        this.analyze.scanManifest(Path.join(dexPath,"AndroidManifest.xml"));
            success = await this.appAnalyzer.importManifest(_path_.join(apkPath,"AndroidManifest.xml"));
        }

        if(success){
            this.setPackageName( this.appAnalyzer.getPackageName());
        }


        // index static array 
        this.analyze.updateDataBlock();    

        this.analyze.tagAllIf(
            function(k,x){ 
                return x.hasTag(AnalysisHelper.TAG.Discover.Internal)==false; 
            }, 
            AnalysisHelper.TAG.Discover.Statically);


        // scan bytecode gathered during previous instrumentation session
        // if there is not path specified
        if(pPath == null){

            let dir=Fs.readdirSync(this.workspace.getRuntimeBcDir());
            for(let i in dir){
                elemnt = _path_.join(this.workspace.getRuntimeBcDir(),dir[i],"smali");
                if(Fs.existsSync(elemnt) && Fs.lstatSync(elemnt).isDirectory()){
                    Logger.info("Scanning previously discovered dex chunk : "+elemnt);
                    this.analyze.path(elemnt);
                }
            }  


            this.analyze.tagAllIf(
                function(k,x){ 
                    return (x.hasTag(AnalysisHelper.TAG.Discover.Internal)==false) 
                        && (x.hasTag(AnalysisHelper.TAG.Discover.Statically)==false); 
                }, 
                AnalysisHelper.TAG.Discover.Dynamically);
            
            this.dataAnalyser.scan(this.workspace.getRuntimeFilesDir());
        }



        this.bus.send(new Event.Event({
            type: "dxc.fullscan.post" 
        }));

        // deploy inspector's hooksets
        this.deployInspectors(Inspector.STEP.POST_APP_SCAN);

        this.bus.send(new Event.Event({
            type: "dxc.fullscan.post_deploy"
        }));
        
        // trigger event
        this.bus.send(new Event.Event({
            type: "dxc.appview.new" 
        }));

        this.analyze.insertIn( "files", this.dataAnalyser.getDB().getFiles());
        
        this.bus.send(new Event.Event({
            type: "filescan.new" 
        }));


        this.bus.send(new Event.Event({
            type: "dxc.initialized" 
        }));

        this.ready = true;

        // make CFG
        //this.analyze.cfg();
        return this;
    };

    /**
     * To get 'ready' status
     * 
     * @returns {Boolean} TRUE if the project has been successully opened and analyzed, else FALSE
     * @method
     */
    isReady(){
        return this.ready;
    }

    /**
     * To create an event and push it to the queue.
     * The argulent should be given by using the format expected by the Event constructor.
     * 
     * @param {Object} eventData The description of the event to use with the Event constructor.
     * @function
     */
    trigger(eventData){
        this.bus.send(new Event.Event(eventData));
    }

    // Make a backup of the project 
    /*
    Project.prototype.saveDB = function(file){
        if(file===undefined){
            return Backup.save(this.analyze.db,this.workspace.getNewSavefilePath());
        }else{
            return Backup.save(this.analyze.db,file);
        }
    }

    // Load a backup
    /*
    Project.prototype.loadDB = function(savePath){
        //this.analyze.db = Backup.restore(savePath);
        return Backup.restore(savePath);
    }*/


    /**
     * To use the emulator by default instead of an USB device
     * @deprecated
     * @function
     */
    useEmulator(){
        this.config.useEmulator = true;
    }

    /**
     * To start the application from a specific Activity.
     * Use the default device. It can used in order to force application crawl. 
     * @param {String} activity The activity to start
     * @returns {ApplicationInstance}  A reference to the process running the Application
     * @function
     * @deprecated
     */
    start(activity){
        let adb=this.config.adbPath, ret="", path="", i=0;
        
        if(this.config.useEmulator) adb+=" -e";
        if(this.device instanceof Device) adb+=" -s "+this.device.getUID();
        
        // to do change
        ret = Process.execSync(adb+" shell am start "+this.pkg+"/"+activity).toString("ascii");

        
        return new ApplicationInstance(0);
    };

    /** 
     * To start the web server
     * 
     * @deprecated
     * @param {int} port Optional - The port number to use. By default, the port number from configuration is used.
     * @function
     */
    startWebserver( pPort=null){
        // if port is undefined or null
        let port = null;
        if(process.env.DEXCALIBUR_PORT!=null)
            port = process.env.DEXCALIBUR_PORT
        else if(pPort != null)
            port = pPort;
        else
            port = this.config.getWebPort();

        this.web.useProductionMode();
        // start 
        this.web.start(port);
    }

    /**
     * To get application package name
     * 
     * @returns {String} Applciation package name
     * @function
     */
    getPackageName(){
        return this.pkg;
    }

    setPackageName( pPackageName){
        this.pkg = pPackageName;
    }
}

module.exports = DexcaliburProject;
