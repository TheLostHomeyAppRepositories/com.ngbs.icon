import Homey from 'homey';
import { PairSession } from 'homey/lib/Driver';
import { NgbsIconClient } from "ngbs-icon";
import { NgbsIconClientManager } from '../../common/client'

/** Implement the pairing process, and aggregate polling across all thermostats. */
export default class ModbusThermostatDriver extends Homey.Driver {
  private pollInterval: NodeJS.Timeout | undefined;
  private statusUpdateCallbacks: {[address: string]: Function[]} = {};

  async onInit() {
    this.pollInterval = setInterval(() => this.poll(), 60000);
    this.log('Initialized');
  }

  async onUninit() {
    clearInterval(this.pollInterval!);
    this.log('Uninitialized');
  }

  registerClient(address: string, id: number, statusUpdateCallback: Function): NgbsIconClient {
    const client = NgbsIconClientManager.registerClient(address);
    const callbacks = this.statusUpdateCallbacks[address] || [];
    callbacks[id] = statusUpdateCallback;
    this.statusUpdateCallbacks[address] = callbacks;
    return client;
  }

  unregisterClient(address: string, id: number) {
    NgbsIconClientManager.unregisterClient(address);
    delete this.statusUpdateCallbacks[address][id]
    if (!this.statusUpdateCallbacks[address].length) delete this.statusUpdateCallbacks[address];
  }

  async poll() {
    try {
      for (let [address, callbacks] of Object.entries(this.statusUpdateCallbacks)) {
        for (let thermostat of await NgbsIconClientManager.clients[address]!.client.getThermostats()) {
          const callback = callbacks[thermostat.id];
          if (callback) callback(thermostat);
        }
      }
    } catch(e) {
      this.error('Error while polling: ', e);
    }
  }

  async onPair(session: PairSession) {
    let address: string;

    session.setHandler("set_address", async msg => {
      address = 'modbus-tcp:' + msg;
      this.log('Set address to ' + address);
    });

    session.setHandler("list_devices", async () => {
      try {
        this.log('Connecting to ' + address);
        const client = NgbsIconClientManager.registerClient(address);
        const thermostats = await client.getThermostats();
        this.log('Successfully retrieved ' + thermostats.length + ' thermostats.');
        const devices = thermostats.map((thermostat, index) => ({
          name: "Thermostat " + (index + 1),
          data: {
            address,
            id: thermostat.id,
          },
        }));
        this.log('Devices:', devices);
        NgbsIconClientManager.unregisterClient(address);
        return devices;
      } catch (e: any) {
        const code: string = e?.code || e?.data?.code || 'other';
        const error = this.homey.__("pair.address.errors." + code) || e?.message || e?.data?.message || JSON.stringify(e);
        this.error('NGBS client error', code, error, e);
        throw new Error(error);
      }
    });
  }
}

module.exports = ModbusThermostatDriver;
