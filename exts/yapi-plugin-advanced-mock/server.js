const { DbConnection } = xU;
const controller = require("./controller");
const advModel = require("./advMockModel");
const modelCase = require("./modelCase");

const _ = require("lodash");
const path = require("path");
const lib = require(path.resolve(xU.var.APP_ROOT_DIR, "common/lib"));
const Mock = require("mockjs");
const mockExtra = require(path.resolve(
	xU.var.APP_ROOT_DIR,
	"common/mock-extra"
));

function arrToObj(arr) {
	let obj = { "Set-Cookie": [] };
	arr.forEach(item => {
		if (item.name === "Set-Cookie") {
			obj["Set-Cookie"].push(item.value);
		} else obj[item.name] = item.value;
	});
	return obj;
}

module.exports = function () {
	let Col = DbConnection.connection.db.collection("adv_mock");
	Col.createIndex({
		interface_id: 1
	});
	Col.createIndex({
		project_id: 1
	});

	let caseCol = DbConnection.connection.db.collection("adv_mock_case");
	caseCol.createIndex({
		interface_id: 1
	});
	caseCol.createIndex({
		project_id: 1
	});

	async function checkCase(ctx, interfaceId) {
		let reqParams = Object.assign({}, ctx.query, ctx.request.body);
		let caseInst = xU.$orm(modelCase);

		// let ip = ctx.ip.match(/\d+.\d+.\d+.\d+/)[0];
		// request.ip

		let ip = xU.getIp(ctx);
		//   数据库信息查询
		// 过滤 开启IP
		let listWithIp = await caseInst.model
			.find({
				interface_id: interfaceId,
				ip_enable: true,
				ip: ip
			})
			.select("_id params case_enable");

		let matchList = [];
		listWithIp.forEach(item => {
			let params = item.params;
			if (item.case_enable && lib.isDeepMatch(reqParams, params)) {
				matchList.push(item);
			}
		});

		// 其他数据
		if (matchList.length === 0) {
			let list = await caseInst.model
				.find({
					interface_id: interfaceId,
					ip_enable: false
				})
				.select("_id params case_enable");
			list.forEach(item => {
				let params = item.params;
				if (item.case_enable && lib.isDeepMatch(reqParams, params)) {
					matchList.push(item);
				}
			});
		}

		if (matchList.length > 0) {
			let maxItem = _.max(
				matchList,
				item => (item.params && Object.keys(item.params).length) || 0
			);
			return maxItem;
		}
		return null;
	}

	async function handleByCase(caseData) {
		let caseInst = xU.$orm(modelCase);
		let result = await caseInst.get({
			_id: caseData._id
		});
		return result;
	}

	this.bindHook("add_router", function (addRouter) {
		addRouter({
			controller: controller,
			method: "get",
			path: "advmock/get",
			action: "getMock"
		});
		addRouter({
			controller: controller,
			method: "post",
			path: "advmock/save",
			action: "upMock"
		});
		addRouter({
			/**
			 * 保存期望
			 */
			controller: controller,
			method: "post",
			path: "advmock/case/save",
			action: "saveCase"
		});

		addRouter({
			controller: controller,
			method: "get",
			path: "advmock/case/get",
			action: "getCase"
		});

		addRouter({
			/**
			 * 获取期望列表
			 */
			controller: controller,
			method: "get",
			path: "advmock/case/list",
			action: "list"
		});

		addRouter({
			/**
			 * 删除期望列表
			 */
			controller: controller,
			method: "post",
			path: "advmock/case/del",
			action: "delCase"
		});

		addRouter({
			/**
			 * 隐藏期望列表
			 */
			controller: controller,
			method: "post",
			path: "advmock/case/hide",
			action: "hideCase"
		});
	});
	this.bindHook("interface_del", async function (id) {
		let inst = xU.$orm(advModel);
		await inst.delByInterfaceId(id);
	});
	this.bindHook("project_del", async function (id) {
		let inst = xU.$orm(advModel);
		await inst.delByProjectId(id);
	});
	/**
   * let context = {
	  projectData: project,
	  interfaceData: interfaceData,
	  ctx: ctx,
	  mockJson: res
	}
   */
	this.bindHook("mock_after", async function (context) {
		let interfaceId = context.interfaceData._id;
		let caseData = await checkCase(context.ctx, interfaceId);

		// 只有开启高级mock才可用
		if (caseData && caseData.case_enable) {
			// 匹配到高级mock
			let data = await handleByCase(caseData);

			context.mockJson = xU.json_parse(data.res_body);
			try {
				context.mockJson = Mock.mock(
					mockExtra(context.mockJson, {
						query: context.ctx.query,
						body: context.ctx.request.body,
						params: Object.assign(
							{},
							context.ctx.query,
							context.ctx.request.body
						)
					})
				);
			} catch (err) {
				applog.error(err);
			}

			context.resHeader = arrToObj(data.headers);
			context.httpCode = data.code;
			context.delay = data.delay;
			return true;
		}
		let inst = xU.$orm(advModel);
		let data = await inst.get(interfaceId);

		if (!data || !data.enable || !data.mock_script) {
			return context;
		}

		// mock 脚本
		let script = data.mock_script;
		await xU.handleMockScript(script, context);
	});
};
