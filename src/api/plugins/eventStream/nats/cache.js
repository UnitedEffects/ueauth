import NodeCache from 'node-cache';
import JWT from 'jsonwebtoken';
const myCache = new NodeCache();

export default {
	async findJwt() {
		const jwt = await myCache.get('plugin-nats-jwt');
		if(jwt) {
			const decoded = await JWT.decode(jwt, {});
			if(decoded.exp > (Date.now()/1000)){
				console.info('cached jwt was expired...');
				console.info('resetting...');
				console.info(jwt);
				await this.clearJwt();
				return undefined;
			}
		}
		return jwt;
	},
	async setJwt(jwt) {
		const decoded = await JWT.decode(jwt, {});
		let ttl;
		if(decoded.exp) {
			ttl = decoded.exp - (Date.now()/1000);
		}
		return myCache.set('plugin-nats-jwt', jwt, Math.floor(ttl));
	},
	async clearJwt() {
		return myCache.del('plugin-nats-jwt');
	},
	async count() {
		let check = myCache.get('nats-check');
		let i = 1;
		if(check) i = check + i;
		myCache.set('nats-check', i);
		return i;
	},
	resetCount() {
		return myCache.del('nats-check');
	}
};