import { connect, NgbsIconClient } from "ngbs-icon";

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
            const client = connect(address);
            NgbsIconClientManager.clients[address] = { client, users: 1 };
        }
        return NgbsIconClientManager.clients[address].client;
    }

    static unregisterClient(address: string) {
        if (!(address in NgbsIconClientManager.clients)) throw new Error('No client for address ' + address);
        const client = NgbsIconClientManager.clients[address];
        client.users -= 1;
        if (!client.users) {
            delete NgbsIconClientManager.clients[address];
        }
    }
}