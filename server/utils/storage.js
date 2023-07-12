module.exports = function storageCreator(id) {
	const storageModel = require("../models/storage");
	const yapi = require("./utils");
	const defaultData = {};
	return {
		getItem: async (name = "") => {
			let inst = xU.getInst(storageModel);
			let data = await inst.get(id);
			data = data || defaultData;
			if (name) return data[name];
			return data;
		},
		setItem: async (name, value) => {
			let inst = xU.getInst(storageModel);
			let curData = await inst.get(id);
			let data = curData || defaultData;
			let result;
			data[name] = value;
			if (!curData) {
				result = await inst.save(id, data, true);
			} else {
				result = await inst.save(id, data, false);
			}

			return result;
		}
	};
};