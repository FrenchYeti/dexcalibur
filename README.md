![npm dependencies](https://david-dm.org/frenchyeti/dexcalibur.svg)
![npm](https://img.shields.io/npm/dm/dexcalibur)
![npm](https://img.shields.io/npm/v/dexcalibur?color=green)
![Docker Automated build](https://img.shields.io/docker/automated/frenchyeti/dexcalibur.svg?style=flat-square)
[![Build Status](https://travis-ci.org/FrenchYeti/dexcalibur.svg?branch=master)](https://travis-ci.org/FrenchYeti/dexcalibur)
![Twitter Follow](https://img.shields.io/twitter/follow/frenchyeti?style=social)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=flat-square)](http://makeapullrequest.com) 
[![Maintainability](https://api.codeclimate.com/v1/badges/080688cfe119a255db70/maintainability)](https://codeclimate.com/github/FrenchYeti/dexcalibur/maintainability)


![Dexcalibur banner](https://raw.githubusercontent.com/FrenchYeti/dexcalibur-doc/master/pictures/v1.0.0a/Dexcalibur-for-Github2.jpg)
# Dexcalibur

Dexcalibur is an Android reverse engineering platform focus on instrumentation automation. Its particularity is to use dynamic analysis to improve static analysis heuristics. It aims automate boring tasks related to dynamic instrumentation, such as :
* Decompile/disass intercepted bytecode at runtime
* Write hook code and Manage lot of hook message
* Search interesting pattern / things to hook
* Process data gathered by hook (dex file, invoked method, class loader, ...)
* and so ...
But not only that, because Dexcalibur has own static analysis engine and it is able to execute partial piece of smali.  


Do you want share something or do you need some help ? Join our official chats :

[Telegram](https://t.me/dexcalibur) - the quickiest way to give a response

[![https://discord.gg/pfB7Ez34Ts](https://discordapp.com/api/guilds/852565889386676246/widget.png?style=banner2)](https://discord.gg/pfB7Ez34Ts)


Official documentation is available [here (website - work in progress)](https://frenchyeti.github.io/dexcalibur-doc/). 

See the latest news here : [http://docs.dexcalibur.org/News.html](http://docs.dexcalibur.org/News.html) 

Show Dexcalibur demo videos : [Demo: Less than 1 minute to hook 61 methods ? Not a problem. \(youtube\)](https://www.youtube.com/watch?v=2dGoolvMEpI)


## How to support Dexcalibur ? 

**Contribute !**

Don't hesitate ! There are several ways to contribute : 
- Make a pull request related to a fix or a new feature
- Create an issue to help me to patch/involves tools 
- Help me to develop UI
- Send me a mail with your feedback
- etc ...


## A. Installation

### A.1 New install

Go to [Install doc](https://frenchyeti.github.io/dexcalibur-doc/Installation-guide.html)


### A.2 Launch dexcalibur

**For Linux and MacOS**

NPM Install : If Dexcalibur has been installed globaly using NPM (`-g` option), then Dexcalibur can be launch from terminal by doing `$ dexcalibur`, else the location it can be launch by `$ node $(node root -g dexcalibur)/dexcalibur/dexcalibur.js`.

Install from source : from `dexcalibur` folder, run `$ dexcalibur` or `$ node dexcalibur.js`. 

**For Windows**

NPM Install : Event if Dexcalibur is installed globaly using NPM (`-g` option), Dexcalibur must be launched from terminal by running the following command from a terminal `node <NPM_ROOT>/dexcalibur/dexcalibur.js`.

Install from source : from `dexcalibur` folder, into the terminal, run the command  `node dexcalibur.js`. 

### A.3 Update 

#### From version <= 0.6.x

You are using a previous version of Dexcalibur ? 

Follow same steps than a new install, and when you should enter workspace path, enter your current workspace location. 


#### From version >= 0.7

Just by doing:
```
$  npm install -g dexcalibur
``` 

Existing configuration and workspace will be detected automatically. 




## C. Screenshots

Following screenshots illustrate the automatic update of *xrefs* at runtime.

![Xref auto update](https://raw.githubusercontent.com/FrenchYeti/dexcalibur-doc/master/pictures/xref_after_run_white.png)


![Features](https://raw.githubusercontent.com/FrenchYeti/dexcalibur-doc/master/pictures/aims.png)


## D. Features and limitations

Actually, the biggest limitation is Dexcalibur is not able to generate source code of hook targeting native function (into JNI library). However, you can declare manually a Frida's Interceptor by editing a hook.

Assuming Dexcalibur does not provide (for the moment) features to analyse native part such as JNI library or JNA, only features and limitations related to Java part have been detailled.  

**Analysis accuracy depends of the completeness of the Android API image used during early steps of the analysis. That means, if you use a DEX file generated from the Android.jar file from Android SDK, some references to internal methods, fields, or classes from Android java API could be missing. Better results are obtained when the analysis start from a "boot.oat" file extracted directly from a real device running the expected Android version.**  

### D.1 Features

#### D.1.A Static analyzer

TODO : write text

#### D.1.B Hook manager

TODO : write text

#### D.1.C Dexcalibur's smali VM

**Tracked behaviors**

Static analyzer involved into "Run smali (VM)" action is able to discover and accept but track following behaviors :
* Out-of-bound destination register (register out of v0 - v255)
* Out-of-bound source register (register out of v0 - v65535)
* Detect invalid instruction throwing implicitely an internal exception
* Detect some piece of valid bytecode non-compliant with Android specification
* Compute length of undefined array
* Fill undefined array  
* and more ...

Actually, handlers/listeners for such invalid instruction are not supported but events are tracked and rendered.   

**Dexcalibur IR**

The VM produces a custom and simplified Intermediate Representation (IR) which is displayed **only to help analyst** to perform its analysis. 

Depending of the value of the callstack depth and configuration, IR can include or not instruction executed into called function. If the execution enters into a try block and continues to return, but never excute catch, then the catch block will not be rendered. In fact the purpose of Dexcalibur IR is to render only "what is executed" or "what  could be executed depending of some symbol's value" into VM context. 

Dexcalibur IR helps to read a cleaned version of bytcode by removing useless goto and opaque predicate. Dexcalibur IR can be generated by the VM with 2 simplifying levels :

*1st level IR, could be used if you don't trust 2th level IR  :*

 - no CFG simplifying : conditions and incondtionnal jumps are rendered.
 - every move into a register are rendered


*2th level :* 

- Hide assign if the register is not modified with an unknown value before its use.
- Always TRUE/FALSE predicate are removed
- Inconditional jump such goto are removed under certain conditions : single predecessor of targeted basic block, etc ...  
- Resolve & replace Method.inoke() call by called method if possible. 
- Instructions into a Try block are not rendered if an exception is thrown before 
- ...

**Android API mock**

TODO

**Details**

Smali VM follows steps :

1. Init VM : stack memory, heap, classloaders, method area, ...
2. The VM load class declaring the method.
3. (Optionnal) If the class has static blocks, clinit() is executed.  It helps to solve concrete value stored into static properties
4. Load method metadata
5. Execute method's instructions, if PseudoCodeMaker is enable, Dexcalibur IR is generated. 


How VM handles invoke-* instruction ?  

1. When an invoke-* happens, the local symbol table is saved, and the invoked method is loaded.
2. If the class declaring the invoked method  has never been loaded, the class is loaded 
3. If the method has never been loaded, the method is loaded (by MethodArea) and its local symbol table initialized by importing symbols of arguments from caller's symbol table. 
4. Invoked method is push into callstack (StackMemory).
5. Method instruction are executed.
6. Return is push into stack memory
7. Caller give flow control

#### D.1.D Application Topology  analyzers


**Manifest analysis (LIMITED)**

Before the first run, the Android manifest of the application is parsed. Actually, anomalies into the manifest 
such insecure configuration are really detected at this level. 

The only purpose of Android manifest parsing is to populate other kind of analyzers.

**Permission analysis**

Every permissions extracted from the Manifest are listed and identified and compared to Android specification of the target Android API version.

Dexcalibur provides - only in some case - a description of the permission purpose, the minimal Android API version, ... 

**Activities analysis**

**Providers analysis**

**Services analysis**

**Receivers analysis**


#### D.1.E Runtime monitoring (not implemented)

**Network monitoring**

**Intent monitoring**

**File access monitoring**

#### D.1.F Collaborating features

You cannot find multi-user menu ? Not a probleme, there is not a menu but minimalistic collaborative work can be achieve. 

Dexcalibur runs a web server.  So, if several people are on the same network of this web server and if host firewall is well configured, you can be several to work on the same Dexcalibur instance.

*Actual limitations are :*
- **No authentication :** everybody into the network can send request to Dexcalibur instance and doing RCE the host through search engine.
- **No identifying :** modifying are not tracked, so, if someone rename a symbol, you could not know who renamed it. Similar case : you are not able to know who created a specific hook.
- **Single device instrumentation :** if several devices are connected to Dexcalibur's host, and even if you can choose the device to instrument, instrumentation and hook messages are linked to the last device selected. So, you cannot generate instrumention for several devices simultaneously.



## E. Github Contributors

A special thanks to contributors : 

- [ubamrein](https://github.com/ubamrein)
- [jhscheer](https://github.com/jhscheer)
- [eybisi](https://github.com/eybisi)
- [monperrus](https://github.com/monperrus)
- [cryptax](https://github.com/cryptax)

## F. Troubleshoots

### F.1 Dexcalibur continues to start into "install mode"

Before to go deeper :
- Ensure you are connected to Internet : Apktool and target platform are downloaded during install
- Did you have tried to reinstall it by doing `dexcalibur --reinstall` command ? If no, try it.


First, check if global settings have been saved into `<user_directory>/.dexcalibur/`
```
$ ls -la ~/.dexcalibur      

total 8
drwxr-xr-x   3 test_user  staff    96 29 avr 11:41 .
drwxr-xr-x+ 87 test_user  staff  2784 29 avr 11:47 ..
-rw-r--r--   1 test_user  staff   204 29 avr 11:41 config.json


$ cat ~/.dexcalibur/config.json 

{
    "workspace":"/Users/test_user/dexcaliburWS3",
    "registry":"https://github.com/FrenchYeti/dexcalibur-registry/raw/master/",
    "registryAPI":"https://api.github.com/repos/FrenchYeti/dexcalibur-registry/contents/"
}
```


Next, check if structure of Dexcalibur workspace is as following (content of `/api` folder may differs).
```
$ ls -la ~/dexcaliburWS/.dxc/*
/Users/test_user/dexcaliburWS/.dxc/api:
total 0
drwxr-xr-x  3 test_user  staff   96 29 avr 11:41 .
drwxr-xr-x  7 test_user  staff  224 29 avr 11:41 ..
drwxr-xr-x  8 test_user  staff  256 29 avr 11:41 sdk_androidapi_29_google

/Users/test_user/dexcaliburWS/.dxc/bin:
total 34824
drwxr-xr-x   4 test_user  staff       128 29 avr 11:41 .
drwxr-xr-x   7 test_user  staff       224 29 avr 11:41 ..
-rwxr-xr-x   1 test_user  staff  17661172 29 avr 11:41 apktool.jar
drwxr-xr-x  18 test_user  staff       576 29 avr 11:41 platform-tools

/Users/test_user/dexcaliburWS/.dxc/cfg:
total 8
drwxr-xr-x  3 test_user  staff   96 29 avr 11:41 .
drwxr-xr-x  7 test_user  staff  224 29 avr 11:41 ..
-rw-r--r--  1 test_user  staff  314 29 avr 11:41 config.json

/Users/test_user/dexcaliburWS/.dxc/dev:
total 0
drwxr-xr-x  2 test_user  staff   64 29 avr 11:41 .
drwxr-xr-x  7 test_user  staff  224 29 avr 11:41 ..

/Users/test_user/dexcaliburWS/.dxc/tmp:
total 0
drwxr-xr-x  2 test_user  staff   64 29 avr 11:41 .
drwxr-xr-x  7 test_user  staff  224 29 avr 11:41 ..
```

## G. FAQ

### My device not appears when into device list

If you use a physical device connected over USB, ensure *developper mode* and *USB debugging* are enabled.  

If you use a virtual device, go to `/splash.html`,  select `Device Manager`,  click `Connect over TCP ...` and follow instructions. If you don't know IP address of your device, let Dexcalibur detect it by checking box `automatic configuration`.


### USB debugging is enabled, but my device not appears when into device list

 - Connect/disconnect USB and ensure your computer is allowed. 
 - Select file transfert

### Why enroll a new device ?

You need to enroll the target device before to be able to use it. 
During enrollment Dexcalibur gather device metadata and push a compatible version of Frida server.

Such metadata are used to select right frida-server and frida-gadget targets.

#### My device is listed into Device Manager, but it cannot be enrolled

If a red exclamation mark `!` appears on a line into device list, then your desktop is not allowed by device. You probably need to confirm 

If your device is listed into DeviceManager and the column `online` is checked, then click `enroll` 


#### G.1 My device is listed into Device Manager

If your device is listed into DeviceManager and the column `online` is checked, then click `enroll` 

### How to use an emulator instead of a physical device ?

Dexcalibur version < v0.7 was not able to detect automatically emulated device and use it due to an incomplete ADB output parsing.

Since version >= v0.7, once your virtual device is running, go to `/splash.html` or click on `DEXCALIBUR` into navigation bar.
Click on `Device Manager` button into left menu, and click the `Refresh` button at top of array.

You should have a row starting by the ADB ID of your virtual device.

### How to use a device over TCP ?

First, as any target device, you should enroll it.

Click `Connect over TCP ...` to add a new device over TCP or to connect an enrolled device over TCP.

If the device has never been enrolled, so enrollment will be perform through TCP. 
In some case, connection over TCP is slower than over USB. So enrollement can take additional time.

If the device has been enrolled over USB, so the new prefered transport type for this device becomes TCP.

### How to contribute to the dexcalibur ?

Create a pull request on this repository or create an issue.

### How to contribute to the documentation?

Create a pull request on [dexcalibur-doc](https://github.com/FrenchYeti/dexcalibur-doc) repository.

Documentation is available at [here (doc website)](https://frenchyeti.github.io/dexcalibur-doc/) and [here (wiki)](https://github.com/FrenchYeti/dexcalibur/wiki/News)

## H. Sponsors

| ![https://www.jetbrains.com/?from=dexcalibur](https://github.com/FrenchYeti/dexcalibur-doc/raw/master/pictures/jetbrains_logo.png) |
| --- |
| They offered a license for All Products <3 |

## I. Resources

There is actually few documentation and training resources about Dexcalibur. If you successfully used Dexcalibur to win CTF challenge or to find vulnerability, i highly encourage you to share your experience. 

* [THCon 2020](https://www.youtube.com/watch?v=VRVV23glm_o)
* [SSTIC 2020](https://www.sstic.org/2020/presentation/dexcalibur_hook_it_yourself/)
* [Slides of Pass the SALT 2019 (PDF)](https://2019.pass-the-salt.org/files/slides/02-Dexcalibur.pdf)
* [Youtube : demonstration](https://www.youtube.com/watch?v=2dGoolvMEpI)
* [CLI User Guide](https://github.com/FrenchYeti/dexcalibur/wiki/CLI-User-guide)
* [User Guide](https://github.com/FrenchYeti/dexcalibur/wiki/User-guide)
* [Troubleshoots](https://github.com/FrenchYeti/dexcalibur/wiki/Troubleshoots)
* [Screenshots](https://github.com/FrenchYeti/dexcalibur/wiki)


## J. They wrote something about Dexcalibur

* [Awesome Frida](https://github.com/dweinstein/awesome-frida)
* [Awesome OpenSource Security](https://github.com/CaledoniaProject/awesome-opensource-security)
* [n0secure.org - PassTheSalt2019 J2](https://www.n0secure.org/2019/06/sstic-2019-j2.html)
* [rootshell.be - PassTheSalt2019 Wrap Up](https://blog.rootshell.be/2019/07/04/pass-the-salt-2019-wrap-up/)
* [PentesterLand - the 5 hacking newsletter 61](https://pentester.land/newsletter/2019/07/09/the-5-hacking-newsletter-61.html)
* [Technology Knowledge Database](https://github.com/ikey4u/tkb/blob/d26f47bf75d8d4c1aa5a655ab6c60f876ad7d402/tkb201907.txt)
* [Xuanwu Lab Security](https://github.com/MyKings/security-study-tutorial/blob/3a5661fb54c6320f403eefa95bcf787324a6e923/origin/Xuanwu%20Lab%20Security/2019/08/01.md)
* [Mobile Gitbook](https://github.com/z3f1r/mobile-gitbook)
* [274 - AppsSec Ezine](https://github.com/Simpsonpt/AppSecEzine/blob/60c530b32984921daa47164591e94bb564b0c75c/Ezines/274%20-%20AppSec%20Ezine)
* [ysh329 / Android Reverse Engineering](https://github.com/ysh329/android-reverse-engineering)

