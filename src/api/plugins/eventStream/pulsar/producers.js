class AGProducer {
	constructor() {
		this.producerList = new Map();
	}
	get(agId) {
		return this.producerList.get(agId);
	}
	getAll() {
		return this.producerList;
	}
	async define(agId, client, topic) {
		// Do not let this get bigger than 1000 instances, you can always reinitialize
		if(this.producerList.size > 1000) {
			const [f] = this.producerList.keys();
			const first = this.get(f);
			await first.close();
			this.producerList.delete(f);
		}
		const producer = await client.createProducer({
			topic,
			sendTimeoutMs: 30000,
			batchingEnabled: true,
		});
		this.producerList.set(agId, producer);
		return producer;
	}
	async find(agId, client, topic) {
		const producer = this.get(agId);
		if(!producer) {
			return this.define(agId, client, topic);
		}
		await producer.flush();
		return producer;
	}
	async close(agId) {
		const producer = this.get(agId);
		await producer.close();
		this.producerList.delete(agId);
	}
	async clearAll() {
		this.producerList.clear();
	}
}

export default AGProducer;