import Homey from 'homey';
import { NgbsIconClient, NgbsIconThermostat } from "ngbs-icon";
import ModbusThermostatDriver from './driver';
import {setTimeout} from "timers/promises";

class ThermostatDevice extends Homey.Device {
  private status!: NgbsIconThermostat;
  private client!: NgbsIconClient;
  private modbusThermostatDriver!: ModbusThermostatDriver;

  async onInit() {
    this.log('Initializing...');
    this.modbusThermostatDriver = this.driver as ModbusThermostatDriver;
    this.client = this.modbusThermostatDriver.registerClient(
      this.getData().address, this.getData().id, this.setStatus.bind(this)
    );
    this.registerCapabilityListener("target_temperature", this.setTargetTemperature.bind(this));
    this.registerCapabilityListener("thermostat_mode", this.setMode.bind(this));
    await this.modbusThermostatDriver.poll();
    this.log('Initialized');
  }

  async onUninit() {
    this.log('Uninitializing...');
    this.modbusThermostatDriver.unregisterClient(this.getData().address, this.getData().id);
    this.log('Uninitialized');
  }

  async setTargetTemperature(target: number) {
    this.log('Setting target temperature to ' + target);
    await this.modbusThermostatDriver.poll();
    await this.client!.setThermostatTarget(this.getData().id, this.status.cooling, this.status.eco, target);
    await setTimeout(2000); // Wait for the value to be set, and the valve to be turned on/off
    await this.modbusThermostatDriver.poll();
    this.log('Temperature successfully set to ' + target);
  }

  async setMode(mode: string) {
    this.log('Trying to set mode to ' + mode);
    throw new Error('Can not set mode per thermostat.');
  }

  setStatus(status: NgbsIconThermostat) {
    this.status = status;
    this.setCapabilityValue("target_temperature", status.target);
    this.setCapabilityValue("measure_temperature", status.temperature);
    this.setCapabilityValue("measure_humidity", status.humidity);
    this.setCapabilityValue("thermostat_mode", status.valve ? (status.cooling ? 'cool' : 'heat') : 'off');
  }
}

module.exports = ThermostatDevice;
