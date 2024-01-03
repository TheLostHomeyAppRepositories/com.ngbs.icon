import Homey from 'homey';
import { PairSession } from 'homey/lib/Driver';
import { NgbsIconModbusTcpClient } from "ngbs-icon";

class IconDriver extends Homey.Driver {
  async onInit() {
    this.log('Initialized');
  }

  async onPair(session: PairSession) {
    let address: string;

    session.setHandler("set_address", async msg => {
      this.log('Set address to ' + address);
      address = msg;
    });

    session.setHandler("list_devices", async () => {
      try {
        this.log('Connecting to ' + address);
        const client = new NgbsIconModbusTcpClient(address);
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
        client.disconnect();
        return devices;
      } catch (e: any) {
        const code: string = e?.code || e?.data?.code || 'other';
        const error = this.homey.__("pair.address.errors." + code) || e?.message || e?.data?.message || JSON.stringify(e);
        this.log('NGBS client error', code, error, e);
        throw new Error(error);
      }
    });
  }
}

module.exports = IconDriver;
