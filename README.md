
# Dexcalibur

![Features](https://raw.githubusercontent.com/FrenchYeti/dexcalibur-doc/master/pictures/aims.png)


## 1. Installation

Follow installation guide : https://github.com/FrenchYeti/dexcalibur/wiki/Installation-guide

Or use Docker ([See docker guide](https://github.com/FrenchYeti/dexcalibur/wiki/Use-the-Docker-image)):
```
docker pull frenchyeti/dexcalibur
docker run -it -v <workspace_path>:/home/dexcalibur/workspace -p 8080:8000 --device=<device_path> frenchyeti/dexcalibur
# ./dexcalibur --app=<target> --port=8000 [--pull]
```

## 2. Screenshots

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
