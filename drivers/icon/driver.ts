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
    session.setHandler("connect", async ip => {
      const client = new NgbsIconModbusTcpClient(ip);
      try {
        this.log('Testing IP ' + ip);
        const thermostats = await client.getThermostats();
        this.log('Successfully retrieved ' + thermostats.length + ' thermostats.');
        await session.done();
        return;
      } catch (e) {
        this.log('NGBS client error', e);
        return String(e);
      }
    });
  }
}

module.exports = IconDriver;
