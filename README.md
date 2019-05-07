
# Dexcalibur

## 1. Installation

Follow installation guide : https://github.com/FrenchYeti/dexcalibur/wiki/Installation-guide

## 2. Getting started

![search engine](https://raw.githubusercontent.com/FrenchYeti/dexcalibur-doc/master/pictures/find_class.png)

### 2.a Using the Dexcalibur (GUI) launcher 

The Dexcalibur GUI can be launch from the console by using the *dexcalibur* script.

The example below shows how start to scan an application: 
```
./dexcalibur --app=<appname> --port=<webapp_port>
```

For each arguments taking a value, the arguments value should be separated from the argument
name by an 'equal' symbol like :
```
--api=android:7.0.0
```

All available arguments are explained below :
```
-Usage: dexcalibur [--api][--pull][--devices][--app][--apk][--port][--config][--help|-h||] [--no-frida][--buildClass][--buildOut][--buildApi]

	--api	The Android API version to use. It should be one entry of platform_available config option.
	--pull	To pull the APK file of the targeted application from the device
	--devices	To list connected devices
	--app	The targeted application name (if already analyzed)
	--apk	The path to the target APK file
	--port	The web server port number
	--config	The path to a custom config file. Default : ./config.js
	--help,-h,,	This menu
	--no-frida	To disable Frida part. It allows to run Dexcalibur to analyze purpose even if Frida is not installed
	--buildClass	To generate Frida script with a Java.use for each class contained into the specified package (see docs)
	--buildOut	The output directory
	--buildApi	To build the representation of the specified Android API
```

Actually, the analysis is based on the Android API 24 (7.0.0). However, you can pass another Android version like it :
```
./dexcalibur --api=android:7.0.0 --app=<appname> --port=<webapp_port>
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

### 2.d Generate a JS script, performing a "Java.use" for each classes from a package 


To generate a "Java.use" call for each class from a given package.  
```
./dexcalibur --api=android:7.0.0 --app=com.sample.app --buildClass=java.lang --buildOut=../javaLang.js 
```


## 3. GUI Documentation

TODO

## 4. CLI Documentation

### 4.a Project

#### 4.a.I Device auto-detection

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

### 4.b Analyzer

This is one of the main components of Dexcalibur. It performs statical analysis by parsing the original binaries and making a modelisation of the application. 

This component takes avantage of the Search API and Security Scanner in order to hook obfuscator methods and dynamically update his modelisation at runtime. It allows the analyzer to discover definition contained in encrypted Dex file, and make a more complete image of the application.


#### 4.b.I Analyze with a single connected device

If a single device/emulator is connected and installed the packages *com.targeted.app*, the analyzer can be call as it : 

```
> var project = new Dexcalibur("com.targeted.app")
> project.pull()
> project.useAPI("android:7.0.0").fullscan()
```

#### 4.b.II Analyze with several connected devices

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

#### 4.b.III Analyze a directory containing .smali files


```
> project.scan('./output_apktool/')
```

#### 4.b.IV Analyze from an APK file


```
> project.scanFile('./target.apk')
```


### 4.c Search API

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

#### 4.c.I Search from a set of node


The search engine use to 

#### 4.c.I Operation on results

#### 4.c.1 Search cross-reference to a read or write operation 

```
project.find.nocase().calls.getter("calleed.name:login").show()
```



#### 4.c.I Filtering results

Sometimes there is too much matches and you would like filter the results by some characteristics like a AND clause into the last search request.    

```
> projet.find.()
```


#### 4.c.I Use case



### 4.a Security Scanner

```
> project.security.*
```

This feature use the Search API in order to identified security mechanism and sort it by type. 

If the device is connected, each identified mechanisms can be hooked or patched automatically by following a predefined pattern, or can be attacked manually.


All tests can be invoked in one way style by the method *scan()* 
```
> project.security.scan()
```




### 4.a Disassembler


### 4.a Device Manager
### 4.a Hook Manager
### 4.a Patch Manager
### 4.e Backup Manager


## 5. API

### 5.a Search

```
<type_of_node>("<condition>") [.<filter>("<condition | value>")] *
```

### 5.a FinderResult


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


### 5.a FinderJoin
```
.on(<search_pattern>)
```



## 6. Troobleshooting

### 6.a Heap overflow during *.fullscan() calls

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

