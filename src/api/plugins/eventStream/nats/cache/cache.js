import Local from './Local';
const localCache = new Map();

async function getInstance(cName) {
	let cache = localCache.get(cName);
	if(!cache) {
		cache = new Local(cName);
		localCache.set(cName, cache);
	}
	return cache;
}

export default {
	async set(cName, key, val, ttl) {
		const cache = await getInstance(cName);
		return cache.save(key, val, ttl);
	},
	async update(cName, key, val) {
		const cache = await getInstance(cName);
		return cache.update(key, val);
	},
	async describe(cName) {
		const cache = await getInstance(cName);
		return cache.describe();
	},
	async find(cName, key) {
		const cache = await getInstance(cName);
		return cache.find(key);
	},
	async clear(cName, key) {
		const cache = await getInstance(cName);
		return cache.clear(key);
	},
	async clearCache(cName) {
		const cache = await getInstance(cName);
		await cache.flush();
		localCache.delete(cName);
	},
	async getInstance(cName) {
		return getInstance(cName);
	}
};