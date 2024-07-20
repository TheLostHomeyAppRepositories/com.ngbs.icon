import Homey from 'homey';
import { NgbsIconClient, NgbsIconThermostat, NgbsIconState, NgbsIconControllerConfig } from "ngbs-icon";
import { stateUpdates, broadcastState, broadcastResult, NgbsQueryResult } from '../../common/client'
import { connect } from "ngbs-icon";

export default class ThermostatDevice extends Homey.Device {
  client!: NgbsIconClient;
  private status?: NgbsIconThermostat;
  private config?: NgbsIconControllerConfig;
  private id!: string;
  url!: string;
  private broadcastListener!: (state: NgbsQueryResult) => void;

  async onInit() {
    this.log(`Initializing ${this.getName()}...`);
    // Migrate existing devices (TODO: delete after everyone updated)
    if (!this.hasCapability('eco')) await this.addCapability('eco');
    if (!this.hasCapability('alarm_water')) await this.addCapability('alarm_water');
    if (!this.hasCapability('locked')) await this.addCapability('locked');
    const data = this.getData();
    this.id = data.id;

    // Network address logic -
    const url = new URL(data.url);
    const settings = this.getSettings();
    this.log('Retrieving address: data.url =', data.url, 'settings.address =', settings.address);
    if (settings.address) {
      url.host = settings.address;
    } else {
      this.setSettings({address: url.host});
    }
    this.url = url.toString();
    this.log('Connecting to ', this.url);
    this.client = connect(this.url);

    this.broadcastListener = this.setStatus.bind(this);
    stateUpdates.on(this.url, this.broadcastListener);
    this.registerCapabilityListener("target_temperature", this.setTargetTemperature.bind(this));
    this.registerCapabilityListener("thermostat_mode", this.setMode.bind(this));
    this.registerCapabilityListener("eco", this.setEco.bind(this));
    this.registerCapabilityListener("locked", this.setParentalLock.bind(this));
    // Get basic data and config. Assume config does not change (some operations would re-fetch it though).
    // Do not wait for it to complete, to finish initialization (it might throw an error, we still want to initialize).
    this.poll();
    this.log('Initialized');
  }

  async onSettings({ newSettings, changedKeys }: { newSettings: any, changedKeys: string[] }) {
    if (changedKeys.includes('address')) {
      // Construct and test new URL, before storing the new URL
      const url = new URL(this.url);
      url.host = newSettings.address;
      const client = connect(url.toString());
      const state = await client.getState(true);
      
      // State retrieval was successful, changing the stored URL
      this.log('Address changed from', this.url, 'to', url.toString(), ' - reconnecting');
      stateUpdates.off(this.url, this.broadcastListener);
      this.url = url.toString();
      stateUpdates.on(this.url, this.broadcastListener);
      this.client = client;
      broadcastState(state);
    }
  }

  async poll() {
    const result: NgbsQueryResult = {};
    try {
      result.state = await this.client.getState(true);
    } catch(e: any) {
      result.error = e?.message || e?.data?.message || JSON.stringify(e);
      const code: string = e?.code || e?.data?.code || 'other';
      this.error('NGBS client error', code, result.error, e);
    }
    broadcastResult(this.url, result);
  }

  async onUninit() {
    this.log('Uninitializing...');
    stateUpdates.off(this.url, this.broadcastListener);
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
    let status = this.status!;
    const t = status.temperature;
    const h = this.config!.thermostatHysteresis;
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

  async setEco(eco: boolean) {
    broadcastState(await this.client.setThermostatEco(this.id, eco));
  }

  async setParentalLock(lock: boolean) {
    broadcastState(await this.client.setThermostatParentalLock(this.id, lock));
  }

  setStatus(result: NgbsQueryResult) {
    if (result.error) {
      if (this.getAvailable()) {
        this.setUnavailable(result.error);
        this.error('Marking as unavailable due to error:', result.error);
      }
      return;
    }
    if (!this.getAvailable()) this.setAvailable();
    const state = result.state!;
    const status = state.thermostats.find(t => t.id === this.id)!;
    status.humidity = Math.round(status.humidity);
    if (status.target !== this.status?.target) {
      this.log('Target temperature:', this.status?.target, '->', status.target);
      this.setCapabilityValue('target_temperature', status.target);
    }
    if (status.temperature !== this.status?.temperature) {
      this.log('Measured temperature:', this.status?.temperature, '->', status.temperature);
      this.setCapabilityValue('measure_temperature', status.temperature);
    }
    if (status.humidity !== this.status?.humidity) {
      this.log('Measured humidity:', this.status?.humidity, '->', status.humidity);
      this.setCapabilityValue('measure_humidity', status.humidity);
    }
    if (status.dewProtection !== this.status?.dewProtection) {
      this.log('Dew protection:', this.status?.dewProtection, '->', status.dewProtection);
      this.setCapabilityValue('alarm_water', status.dewProtection);
    }
    const mode = this.status && (this.status.valve ? (this.status.cooling ? 'cool' : 'heat') : 'off');
    const newMode = status.valve ? (status.cooling ? 'cool' : 'heat') : 'off';
    if (newMode !== mode) {
      this.log('Thermostat mode:', mode, '->', newMode);
      this.setCapabilityValue('thermostat_mode', newMode);
    }
    if (status.limit !== this.status?.limit || status.midpoint !== this.status?.midpoint) {
      this.log(
        'Limits:',
        this.status?.midpoint, '+/-', this.status?.limit, '->',
        status.midpoint, '+/-', status.limit,
      );
      this.setCapabilityOptions('target_temperature', {
        "min": status.midpoint - status.limit,
        "max": status.midpoint + status.limit,
      });
    }
    if (status.eco !== this.status?.eco) {
      this.log('ECO state:', this.status?.eco, '->', status.eco);
      this.setCapabilityValue('eco', status.eco);
    }
    if (status.parentalLock !== this.status?.parentalLock) {
      this.log('Parental lock:', this.status?.parentalLock, '->', status.parentalLock);
      this.setCapabilityValue('locked', status.parentalLock);
    }
    if (state.controller.config) this.config = state.controller.config;
    this.status = status;
  }
}

module.exports = ThermostatDevice;
