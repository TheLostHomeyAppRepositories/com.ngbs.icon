# NGBS iCON

Thermostat controls for the NGBS iCON surface heating/cooling system. Note that this is not an official app from NGBS, but developed by an NGBS iCON user.

## Limitations

Currently, the app needs the iCON controller to have a **fixed IP** to function correctly. This is because there is no known discovery method the controller supports (Homey [supports](https://apps.developer.homey.app/wireless/wi-fi/discovery) mDNS, SSDP and broadcast ping based discovery, none of which work). The web API (used by the mobile app) would be a potential alternative, but it's probably not suitable for 24/7 continuous polling.

## Contributions

Contributions from fellow users are very welcome. Please open GitHub issues or send pull requests.
