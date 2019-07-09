![npm dependencies](https://david-dm.org/frenchyeti/dexcalibur.svg)
![Docker Automated build](https://img.shields.io/docker/automated/frenchyeti/dexcalibur.svg?style=flat-square)

# Dexcalibur


See the latest news here : [https://github.com/FrenchYeti/dexcalibur/wiki/News](https://github.com/FrenchYeti/dexcalibur/wiki/News)

Show Dexcalibur videos : [Less than 1 minute to hook 61 methods ? Not a problem. \(youtube\)](https://www.youtube.com/watch?v=2dGoolvMEpI)

![Features](https://raw.githubusercontent.com/FrenchYeti/dexcalibur-doc/master/pictures/aims.png)


## 1. Installation

Follow installation guide : https://github.com/FrenchYeti/dexcalibur/wiki/Installation-guide

Or use Docker ([See docker guide](https://github.com/FrenchYeti/dexcalibur/wiki/Use-the-Docker-image)):

*(MacOS + Dexcalibur docker + Android emulator (host) = DONT WORK (it could works, but it need some configuartion efforts. Contributors are welcome :D  ))*

```
docker pull frenchyeti/dexcalibur
docker run -it -v <workspace_path>:/home/dexcalibur/workspace -p 8080:8000 --device=<device_path> frenchyeti/dexcalibur
# ./dexcalibur --app=<target> --port=8000 [--pull]
```

## 2. Screenshots

Following screenshots illustrate the automatic update of *xrefs* at runtime.

![Xref auto update](https://raw.githubusercontent.com/FrenchYeti/dexcalibur-doc/master/pictures/xref_after_run_white.png)


## 3. Getting started

The Dexcalibur GUI can be launch from the console by using the *dexcalibur* script.

The first time, connect the device to your computer, run the following command, and open your browser (localhost:<webapp_port>) : 
```
./dexcalibur --app=<appname> --port=<webapp_port> --pull
```

If you have already scanned the app, just exec the following command (without --pull) and open your browser (localhost:<webapp_port>)  :
```
./dexcalibur --app=<appname> --port=<webapp_port>
```

## 4. See more on the wiki : 

* [Screenshots](https://github.com/FrenchYeti/dexcalibur/wiki)
* [CLI User Guide](https://github.com/FrenchYeti/dexcalibur/wiki/CLI-User-guide)
* [User Guide](https://github.com/FrenchYeti/dexcalibur/wiki/User-guide)
* [Troubleshoots](https://github.com/FrenchYeti/dexcalibur/wiki/Troubleshoots)
