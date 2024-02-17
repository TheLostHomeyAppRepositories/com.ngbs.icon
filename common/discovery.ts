import { networkInterfaces } from 'os';
import { getSysId } from "ngbs-icon";

export async function scan(progress: (percent: number|null) => void, log: (...args: any) => void) {
    let homeyAddress;
    for (let [name, iface] of Object.entries(networkInterfaces())) {
      for (let addr of iface!) {
        if (addr.internal || addr.family !== 'IPv4') continue;
        homeyAddress = addr.address;
        break;
      }
    }
    log('Homey local address', homeyAddress);
    if (!homeyAddress) return;
    const prefix = homeyAddress.replace(/[0-9]+$/, '');
    log('Start network scan for', prefix + '1-254');
    for (let start = 1; start < 255; start += 10) {
      const stop = Math.min(start+10, 254);
      log('Scan', prefix + start + '-' + stop);
      progress(Math.round(start / 2.55));
      const reqs: Promise<string>[] = [];
      for (let x = start; x < stop; x++) reqs.push(getSysId(prefix + x));
      for (let [j, res] of (await Promise.allSettled(reqs)).entries()) {
        if (res.status !== 'fulfilled') continue;
        const result = {
            address: prefix + (start+j),
            sysid: res.value,
        };
        progress(null);
        log('Prefill scan result:', result);
        return result;
      }
    }
    progress(null);
}