import Homey from 'homey';
import { PairSession } from 'homey/lib/Driver';
import { NgbsIconModbusTcpClient } from "ngbs-icon";

class IconDriver extends Homey.Driver {

  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.log('MyDriver has been initialized');
  }

  async onPair(session: PairSession) {
    let address: string;

    session.setHandler("setAddress", async msg => {
      address = msg;
    });

    session.setHandler("list_devices", async () => {
      const client = new NgbsIconModbusTcpClient(address);
      try {
        this.log('Testing address ' + address);
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
        return devices;
      } catch (e: any) {
        const code: string = e.code || e.data.code;
        const error = this.homey.__("pair.address.errors." + code) || e.message || e.data.message || JSON.stringify(e);
        this.log('NGBS client error', code, error, e);
        throw new Error(error);
      }
    });
  }
}

module.exports = IconDriver;
