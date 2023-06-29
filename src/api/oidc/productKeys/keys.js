import ueEvents from '../../../events/ueEvents';

export default {
    async initializeProductKeyClient(authGroup, product, data) {
        // ueEvents.emit(data.authGroup, 'ue.key.access.defined', output);
    },
    async removeProductKeyClient(authGroup, product, clientId) {
        // ueEvents.emit(data.authGroup, 'ue.key.access.destroy', output);
    },
    async showProductKeyClients(authGroup, product, q) {

    },
    async createKey(authGroup, product, data) {
        // ueEvents.emit(data.authGroup, 'ue.key.access.defined', output);
    },
    async getKeys(authGroup, product, q) {

    },
    async getKey(authGroup, product, id) {

    },
    async refreshKey(authGroup, product, id) {
        // ueEvents.emit(data.authGroup, 'ue.key.access.refreshed', output);
    },
    async removeKey(authGroup, product, id) {
        // ueEvents.emit(data.authGroup, 'ue.key.access.destroy', output);
    }
}