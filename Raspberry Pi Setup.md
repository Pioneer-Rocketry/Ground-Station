# Raspberry Pi Installation/Setup Guide

This is assuming you already had a Raspberry Pi with a debian based OS installed connected to the internet.

## Installation
Update the OS and install all required dependencies
```console
$ apt update
$ apt upgrade

$ apt install mosquitto nodejs python3
$ pip install pyserial paho-mqtt dotenv
```

## Setup
### Setup SSH
```console
$ sudo raspi-config
# Select Interface Options -> SSH -> Yes -> Ok -> Finish
```

### Setting up Mosquitto MQTT Broker
edit `/etc/mosquitto/conf.d/default.conf`

```
listener 1883
protocol mqtt

allow_anonymous true
password_file /etc/mosquitto/passwd
acl_file /etc/mosquitto/acl
```

edit `/etc/mosquitto/passwd`

```
# Anonymous users: READ ONLY
pattern read telemetry/#

# Authenticated writer user
user device
topic write telemetry/#
```
This allow anonymous listening, but requires a login to publish to the telemetry thread

Setup passwords 
```console
$ sudo mosquitto_passwd -c /etc/mosquitto/passwd device
```


Restart the Mosquitto Broker
```console
$ sudo systemctl restart mosquitto
```

#### Troubleshooting
Make sure the files have the correct file permissions
```console
$ sudo chmod 640 /etc/mosquitto/passwd /etc/mosquitto/acl
```


### Switch the Wifi to an Access Point -- **UNTESTED**

```console
$ sudo apt install -y hostapd dnsmasq
$ sudo systemctl unmask hostapd
$ sudo systemctl enable hostapd
$ sudo DEBIAN_FRONTEND=noninteractive apt install -y netfilter-persistent iptables-
$ persistent
$ sudo reboot
```
Some of those commands can take some time

Edit `/etc/dhcpcd.conf` and add to the bottom of the file
```
interface wlan0
    static ip_address=192.168.4.1/24
    nohook wpa_supplicant
```

Edit `/etc/sysctl.d/routed-ap.conf`
```
# Enable IPv4 routing
net.ipv4.ip_forward=1
```

Edit `/etc/dnsmasq.conf`
```
interface=wlan0 # Listening interface
dhcp-range=192.168.4.2,192.168.4.20,255.255.255.0,24h
# Pool of IP addresses served via DHCP
domain=wlan # Local wireless DNS domain
address=/gw.wlan/192.168.4.1
# Alias for this router
```

Edit `/etc/hostapd/hostapd.conf`
```
country_code=US
interface=wlan0
ssid=PioneerRocketryTelemetry
hw_mode=g
channel=6
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=2
wpa_passphrase=BestRocketryTeamEver
wpa_key_mgmt=WPA-PSK
wpa_pairwise=TKIP
rsn_pairwise=CCMP
```