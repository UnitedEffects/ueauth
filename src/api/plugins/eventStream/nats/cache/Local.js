import NodeCache from 'node-cache';
import h from '../../../../../helper';

const DEFAULT_TTL_S  = 60*60*24; //24h
const MAX_ALLOWED = 5;

class LocalCache {
	constructor(name, ttl= DEFAULT_TTL_S, max = MAX_ALLOWED) {
		this.defaultTTL = ttl;
		this.maxSize = max;
		this.cacheName = name;
		this.myCache = new NodeCache();
	}
	describe() {
		return {
			name: this.cacheName,
			ttl: this.defaultTTL,
			maxSize: this.maxSize,
		};
	}
	instance() {
		return this.myCache;
	}
	async find(key) {
		const val = this.instance().get(key);
		if(h.isJson(val)) return JSON.parse(val);
		return val;
	}
	async save(key, val, ttl = this.defaultTTL) {
		const data = (typeof val === 'object' && h.isJson(JSON.stringify(val))) ? JSON.stringify(val) : val;
		const stats = await this.instance().getStats();
		if(stats.keys >= this.maxSize) {
			console.info('toooo big');
			const keys = this.instance().keys();
			console.info('killing key');
			this.instance().del(keys[0]);
		}
		return this.instance().set(key, data, ttl);
	}
	async update(key, updated) {
		if(this.instance().has(key)) {
			const ttl = this.instance().getTtl(key);
			this.instance().del(key);
			return this.instance().set(key, updated, ttl);
		}
		return undefined;
	}
	async clear(key) {
		return this.instance().take(key);
	}
	async flush() {
		return this.flush();
	}
}

export default LocalCache;