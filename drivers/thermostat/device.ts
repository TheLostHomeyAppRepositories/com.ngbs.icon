import Homey from 'homey';
import { NgbsIconClient, NgbsIconThermostat, NgbsIconState } from "ngbs-icon";
import { setTimeout } from "timers/promises";
import { stateUpdates, broadcastState } from '../../common/client'
import { connect } from "ngbs-icon";

export default class ThermostatDevice extends Homey.Device {
  client!: NgbsIconClient;
  private status!: NgbsIconThermostat;
  private id!: string;
  private broadcastListener!: (state: NgbsIconState) => void;

  async onInit() {
    this.log(`Initializing ${this.getName()}...`);
    const data = this.getData();
    this.id = data.id;
    this.client = connect(data.url);
    this.broadcastListener = this.setStatus.bind(this);
    stateUpdates.on(data.url, this.broadcastListener);
    this.registerCapabilityListener("target_temperature", this.setTargetTemperature.bind(this));
    this.registerCapabilityListener("thermostat_mode", this.setMode.bind(this));
    broadcastState(await this.client.getState());
    this.log('Initialized');
  }

  async onUninit() {
    this.log('Uninitializing...');
    stateUpdates.off(this.getData().url, this.broadcastListener);
    this.log('Uninitialized');
  }

  async setTargetTemperature(target: number) {
    this.log('Setting target temperature to ' + target);
    broadcastState(await this.client.setThermostatTarget(this.id, target));
    await setTimeout(2000); // Wait for the valve to be turned on/off
    broadcastState(await this.client.getState());
    this.log('Temperature successfully set to ' + target);
  }

  async setMode(mode: string) {
    this.log('Trying to set mode to ' + mode);
    throw new Error('Can not set mode per thermostat.');
  }

  setStatus(state: NgbsIconState) {
    const status = state.thermostats.find(t => t.id === this.id)!;
    this.status = status;
    this.log('Status update', JSON.stringify(status));
    this.setCapabilityValue('target_temperature', status.target);
    this.setCapabilityValue('measure_temperature', status.temperature);
    this.setCapabilityValue('measure_humidity', status.humidity);
    this.setCapabilityValue('thermostat_mode', status.valve ? (status.cooling ? 'cool' : 'heat') : 'off');
    this.setCapabilityOptions('target_temperature', {
      "min": status.midpoint - status.limit,
      "max": status.midpoint + status.limit,
    });
  }
}

module.exports = ThermostatDevice;
