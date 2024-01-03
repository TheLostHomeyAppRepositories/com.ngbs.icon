import { NgbsIconModbusTcpClient, NgbsIconClient } from "ngbs-icon";

/** Aggregate connections from different devices/drivers. */
export class NgbsIconClientManager {
    static clients: {
        [address: string]: {
            client: NgbsIconClient,
            users: number,
        }
    } = {};

    static registerClient(address: string): NgbsIconClient {
        if (!(address in NgbsIconClientManager.clients)) {
            if (address.startsWith('modbus-tcp:')) {
                const client = new NgbsIconModbusTcpClient(address.slice('modbus-tcp:'.length));
                NgbsIconClientManager.clients[address] = { client, users: 1 };
            } else {
                throw new Error('Unknown address type: ' + address);
            }
        }
        return NgbsIconClientManager.clients[address].client;
    }

    static unregisterClient(address: string) {
        if (!(address in NgbsIconClientManager.clients)) throw new Error('No client for address ' + address);
        const client = NgbsIconClientManager.clients[address];
        client.users -= 1;
        if (!client.users) {
            client.client.disconnect();
            delete NgbsIconClientManager.clients[address];
        }
    }
}