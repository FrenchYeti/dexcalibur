
# Dexcalibur

## 1. Installation

## 1.a First, get the minimal requirements

Install this requirements before to continue.

Desktop requirements :
-   NodeJS
-   Frida > 11.0.2
-   Java 
-   APKTool

Device requirements :
-   Frida-server > 11.0.2 (if injected)

## 1.b Next, build the dependencies

First, you need to rebuild the dependencies for your version of node.

Execute the following command from the repository containing the INSTALL.md file.
```
npm rebuild
``` 

## 1.c Next, extract and convert Android APIs

You need to get and convert the **android.jar** file for each API version needed to a .dex file and store it in a folder using the call convention :
```
<DEXCALIBUR_HOME>/APIs/android_<api_version>/android.dex
```

You can use the ApiHelper from the command line, by using the script : 
```
./export_android --src=<SDK_HOME> --out=<DEXCALIBUR_HOME> [--api=<verion>] 
```

## 1.d Finally, you can run the application

When you run the application you need to specify a value of --api corresponding to this exported previously.

```
./dexcalibur --app=com.app.test --port=8000 --pull
```

## Or by using the Dexcalibur script :


The *dexcalibur* script can scan an app, installed on the connected device or downloaded in the dexcalibur workspace 
```
$ ./dexcalibur  --app=com.app.test --port=8000
```

Installer les dependances NodeJS
```
npm install
```

## 2. Get starting

### 2.a Using the Dexcalibur (GUI) launcher 

The Dexcalibur GUI can be launch from the console by using the *dexcalibur* script.

The example below shows how start to scan an application: 
```
./dexcalibur --api=<Android API> --app=<appname> --port=<webapp_port>
```

For each arguments taking a value, the arguments value should be separated from the argument
name by an equal like :
```
--api=android:7.0.0
```

All available arguments are explained below :
```
--api=<android>         Specify the android API version to use
--app=<appname>         Specify the application package name 
--port=<port>           If specified, the web server will start after scan. The value is the listening port
--no-frida              Disable Frida dynamic binary instrumentation (useful if frida is not installed or bugged)
--buildClass=<package>  If specified, for each class contained into the package, a "Java.use" statement will be generated. It allows to generate Frida script.
--buildOut=<path>       Required if --buildClass is specified. It is the file path where the generated script will be write.
```

Advanced use
```
./dexcalibur --api=android:7.0.0 --buildClass=java.io --buildPath=./scripts/io.js
```



### 2.b Using the quickstart Nodejs module 

```
:~$ node --v8-pool-size=4 --max-old-space-size=8192
> var project = require("./quickstart.js").START("com.app.test");
...
> project.find.class().count()
```

### 2.c [Old] Using the step by step from the NodeJS terminal

First, open a Node.JS terminal and import the Dexcalibur tool. 
Depending of the application size, the memory space and thread allow should be customized. (Here 4 threads, 8Gb of memory, see chapter 4 for more details). 
 
```
:~$ node --v8-pool-size=4 --max-old-space-size=8192

> var Dexcalibur = require("./src/project.js")
> var project = new Dexcalibur("com.targeted.app")


███████╗ ███████╗██╗  ██╗ ██████╗ █████╗ ██╗     ██╗██████╗ ██╗   ██╗██████╗
██╔═══██╗██╔════╝╚██╗██╔╝██╔════╝██╔══██╗██║     ██║██╔══██╗██║   ██║██╔══██╗
██║   ██║█████╗   ╚███╔╝ ██║     ███████║██║     ██║██████╔╝██║   ██║██████╔╝
██║   ██║██╔══╝   ██╔██╗ ██║     ██╔══██║██║     ██║██╔══██╗██║   ██║██╔══██╗
███████╔╝███████╗██╔╝ ██╗╚██████╗██║  ██║███████╗██║██████╔╝╚██████╔╝██║  ██║
╚══════╝ ╚══════╝╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝

╔══════════════════════════════════════════════════════════════════╗
║ How to use ?                                                     ║
║ > var project = new Dexcalibur.Project('com.example.test')       ║
║ > project.analyze()                                              ║
║ > project.find.invoke('calleed.name:loadLibrary')                ║
║                                                                  ║
║ Read *.help() ! =)                                               ║
╚══════════════════════════════════════════════════════════════════╝
```

### 2.a Use CLI Analyze an existing application (CLI)


To generate a "Java.use" call for each class from a given package.  
```
./dexcalibur --api=android:7.0.0 --app=net.atos.hce.visa.facto --buildClass=java.lang --buildOut=../javaLang.js 
```



### 2.b Create a new project (from node term)

The application package name as it appears on the device should be 
```
> var project = new Dexcalibur("com.sample.app")    // instanciate a new project
```

```
> var project = new Dexcalibur("com.sample.app")    // instanciate a new project
> project.pull()    // download remote APK associated to the target application
> project.useAPI("android:7.0.0").analyze()     // decompile the APK, perform Smali statical analysis 
```


Utiliser l'analyseur pour explorer les resultat de l'analyse statis + securite

```
> project.find.class("*ssl*")
> project.find.field("*root*")
> project.find.string("*/su*")
```

## 3. Documentation

### 3.a Project

#### 3.a.I Device auto-detection

If the device are not connected while project initializing, don't worry ! Just plug it, and recall your last failed command. The device will be automatically detected and set as default device. 

In this case you could show something like it before your command output :
```
> project.pull()
[!] Warning ! : device not selected. Searching ...
╔═══════════════════════════[ Android devices ]═══════════════════════════════╗
║ G3AZFG01D802A3B   :ASUS_Z00AD                                               ║
╚═════════════════════════════════════════════════════════════════════════════╝
[*] Device selected : G3AZFG01D802A3B

[*] Package found
[*] Package downloaded to /tmp/com.whatsapp.apk
[*] APK decompiled in /tmp/ws/com.whatsapp_dex
```

### 3.b Analyzer

This is one of the main components of Dexcalibur. It performs statical analysis by parsing the original binaries and making a modelisation of the application. 

This component takes avantage of the Search API and Security Scanner in order to hook obfuscator methods and dynamically update his modelisation at runtime. It allows the analyzer to discover definition contained in encrypted Dex file, and make a more complete image of the application.


#### 3.b.I Analyze with a single connected device

If a single device/emulator is connected and installed the packages *com.targeted.app*, the analyzer can be call as it : 

```
> var project = new Dexcalibur("com.targeted.app")
> project.pull()
> project.useAPI("android:7.0.0").scan()
```

#### 3.b.II Analyze with several connected devices

If several device/emulator are connected, you should use the Device Manager  in order to select the default device for the project :

```
> var project = new Dexcalibur("com.targeted.app")
...
> project.devices.scan()
╔═══════════════════════════[ Android devices ]═══════════════════════════════╗
║ 1234567890abcdef   :Nexus_6                                                 ║
║ 1234567890aaaaaa   :LG                                                      ║
╚═════════════════════════════════════════════════════════════════════════════╝
> project.devices.setDefault("1234567890abcdef")
> project.scan()
```

#### 3.b.III Analyze a directory containing .smali files


```
> project.scan('./output_apktool/')
```

#### 3.b.IV Analyze from an APK file


```
> project.scanFile('./target.apk')
```


### 3.c Search API

Search API is one of the more complete feature of Dexcalibur. It is the search engine to request the Analyzer database.

Some aims of the search engine are :
- to select a subset of method/field to hook automatically
- to select a subset of string or instruction to patch
- to inspect a method by searching his callers or properties  
- to identify string used and interresting assets
- to understand control flow 

The search engine is based on two type of search :
- to search into the graph by following cross reference and properties from a set of node
- to filter one or more search results 

#### 3.c.I Search from a set of node


The search engine use to 

#### 3.c.I Operation on results

#### 3.c.1 Search cross-reference to a read or write operation 

```
project.find.nocase().calls.getter("calleed.name:login").show()
```



#### 3.c.I Filtering results

Sometimes there is too much matches and you would like filter the results by some characteristics like a AND clause into the last search request.    

```
> projet.find.()
```


#### 3.c.I Use case



### 3.a Security Scanner

```
> project.security.*
```

This feature use the Search API in order to identified security mechanism and sort it by type. 

If the device is connected, each identified mechanisms can be hooked or patched automatically by following a predefined pattern, or can be attacked manually.


All tests can be invoked in one way style by the method *scan()* 
```
> project.security.scan()
```




### 3.a Disassembler


### 3.a Device Manager
### 3.a Hook Manager
### 3.a Patch Manager
### 3.e Backup Manager


## 4. API

### 4.a Project



### 4.a FinderResult


```
.filter(<FinderResult>)
```


```
.ifilter(<FinderResult>)
```


```
.get(<FinderResult>)
```


```
.count(<FinderResult>)
```


```
.select(<FinderResult>)
```

```
.intersect(<FinderResult>)
```
Returns : FinderJoin


### 4.a FinderJoin
```
.on(<search_pattern>)
```



## 4. Troobleshooting

### 4.a Heap overflow during *.fullscan() calls

It appears when Dexcalibur does the static analysis of the target application, and solves references to Class/Field/Method/String. Depending of the application size (quantity of call, instruction, system method inherited, ...). Use the array in order to find good parameter

| App sector | classes | method | call | instruction | thread | memory required |
|------|---------|--------|------|-------------|--------|--------|
|  Messaging | 10423  | 49017  |  265 404 | 1 084 284|4| 8192 |
|  Messaging | 28070  |   |   | 2 070 000|4| 8192 |
|  Transport | 8630 | 46163 | 133643 |630 732|4| 4096 |
|  Bank | 11000  |   |   |  1 000 000|4|8192|

Node.JS can be launch with *V8 engine*'s custom parameters (choose value in the) : 
```
:~$ node --v8-pool-size=<thread> --max-old-space-size=<memory>
```

