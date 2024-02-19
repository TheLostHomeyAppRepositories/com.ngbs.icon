import Homey from 'homey';
import { NgbsIconClient, NgbsIconThermostat, NgbsIconState, NgbsIconControllerConfig } from "ngbs-icon";
import { setTimeout } from "timers/promises";
import { stateUpdates, broadcastState } from '../../common/client'
import { connect } from "ngbs-icon";

export default class ThermostatDevice extends Homey.Device {
  client!: NgbsIconClient;
  private status!: NgbsIconThermostat;
  private config!: NgbsIconControllerConfig;
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
    broadcastState(await this.client.getState(true));
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
    this.log('Temperature successfully set to ' + target);
  }

  async setMode(mode: string) {
    if (mode === 'auto') throw new Error('Auto mode is not supported');

    this.log('Setting mode to ' + mode);
    let status = this.status;
    const t = status.temperature;
    const h = this.config.thermostatHysteresis;
    let state: NgbsIconState;

    if (mode === 'off') {
      if (!status.valve) {
        this.log('Valve is already off - no need to do anything');
        return;
      }
      const target = status.cooling ? Math.ceil((t + h) * 2) / 2 : Math.floor((t - h) * 2) / 2;
      this.log('Setting target to turn off valve', target, t, h);
      state = await this.client.setThermostatTarget(this.id, target);
    } else {
      const cool = (mode === 'cool');
      if (status.cooling !== cool) {
        this.log('Changing thermostat mode to ' + mode);
        state = await this.client.setThermostatCooling(this.id, cool);
      } else if (status.valve) {
        this.log('Mode is already set to this and the valve is active - no need to do anything');
        return;
      }
      if (cool ? (t <= status.target) : (t >= status.target)) {
        const target = cool ? Math.floor((t - h) * 2) / 2 : Math.ceil((t + h) * 2) / 2;
        this.log('Setting target to turn on valve', target, t, h);
        state = await this.client.setThermostatTarget(this.id, target);
      }
    }

    broadcastState(state!);
    this.log('Mode successfully set to ' + mode);
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
    if (state.controller.config) this.config = state.controller.config;
  }
}

module.exports = ThermostatDevice;
