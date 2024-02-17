import Homey from 'homey';
import { PairSession } from 'homey/lib/Driver';
import { NgbsIconClient } from "ngbs-icon";
import { NgbsIconClientManager } from '../../common/client'

/** Implement the pairing process, and aggregate polling across all thermostats. */
export default class ModbusThermostatDriver extends Homey.Driver {
  private pollInterval: NodeJS.Timeout | undefined;
  private statusUpdateCallbacks: Map<string, Map<string, Function>> = new Map();

  async onInit() {
    this.pollInterval = setInterval(() => this.poll(), 60000);
    this.log('Initialized');
  }

  async onUninit() {
    clearInterval(this.pollInterval!);
    this.log('Uninitialized');
  }

  registerClient(address: string, id: string, statusUpdateCallback: Function): NgbsIconClient {
    const client = NgbsIconClientManager.registerClient(address);
    const callbacks = this.statusUpdateCallbacks.get(address) || new Map<string, Function>();
    callbacks.set(id, statusUpdateCallback);
    this.statusUpdateCallbacks.set(address, callbacks);
    return client;
  }

  unregisterClient(address: string, id: string) {
    NgbsIconClientManager.unregisterClient(address);
    const callbacks = this.statusUpdateCallbacks.get(address)!;
    callbacks.delete(id);
    if (!callbacks.size) this.statusUpdateCallbacks.delete(address);
  }

  async poll() {
    try {
      for (let [address, callbacks] of this.statusUpdateCallbacks.entries()) {
        for (let thermostat of (await NgbsIconClientManager.clients[address]!.client.getState()).thermostats) {
          const callback = callbacks.get(thermostat.id);
          if (callback) callback(thermostat);
        }
      }
    } catch(e) {
      this.error('Error while polling: ', e);
    }
  }

  async onPair(session: PairSession) {
    let address: string;
    let sysid: string;

    session.setHandler("set_address", async msg => {
      address = msg;
      this.log('Set address to ' + address);
    });

    session.setHandler("set_sysid", async msg => {
      sysid = msg;
      this.log('Set SYSID to ' + sysid);
    });

    session.setHandler("list_devices", async () => {
      try {
        const url = 'service://' + sysid + '@' + address;
        this.log('Connecting to ' + url);
        const client = NgbsIconClientManager.registerClient(url);
        const thermostats = (await client.getState()).thermostats;
        this.log('Successfully retrieved ' + thermostats.length + ' thermostats.');
        const devices = thermostats.map((thermostat, index) => ({
          name: thermostat.name || ("Thermostat " + (index + 1)),
          data: {
            url,
            id: thermostat.id,
          },
        }));
        this.log('Devices:', devices);
        NgbsIconClientManager.unregisterClient(url);
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
