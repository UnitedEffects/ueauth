import {Provider} from "oidc-provider";
import events from "../../events/events";

class UEProvider {
    constructor() {
        this.providerList = {};
    }
    get(agId) {
        return this.providerList[agId];
    }
    define(group, issuer, options) {
        const agId = group.id || group._id;
        // Do not let this get bigger than 100 instances, you can always reinitialize
        if(Object.keys(this.providerList).length > 100) {
            const oldStream = Object.keys(this.providerList)[0];
            this.delete(oldStream);
        }
        this.providerList[agId] = new Provider(issuer, options);
        //async event emitter
        events.providerEventEmitter(this.providerList[agId], group);
        return this.providerList[agId];
    }
    find(group, issuer, options) {
        const agId = group.id || group._id;
        const op = this.get(agId);
        if(!op) {
            return this.define(group, issuer, options);
        }
        return op;
    }
    delete(agId) {
        this.providerList[agId].removeAllListeners();
        delete this.providerList[agId];
    }
}

export default UEProvider;