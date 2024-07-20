import { NgbsIconState } from "ngbs-icon";
import { EventEmitter} from 'node:events';

/** Aggregate state updates from different devices/drivers. */
export let stateUpdates = new EventEmitter();

export interface NgbsQueryResult {
    error?: string,
    state?: NgbsIconState,
}

export function broadcastResult(url: string, result: NgbsQueryResult): NgbsQueryResult {
    stateUpdates.emit(url, result);
    return result;
}

export function broadcastState(state: NgbsIconState): NgbsIconState {
    broadcastResult(state.url, {state});
    return state;
}