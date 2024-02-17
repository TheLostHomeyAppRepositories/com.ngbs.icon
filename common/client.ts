import { NgbsIconState } from "ngbs-icon";
import { EventEmitter} from 'node:events';

/** Aggregate state updates from different devices/drivers. */
export let stateUpdates = new EventEmitter();

export function broadcastState(state: NgbsIconState): NgbsIconState {
    stateUpdates.emit(state.url, state);
    return state;
}