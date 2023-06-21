const fs = require("fs-extra");
const path = require("path");
const dayjs = require("dayjs");
const sha1 = require("sha1");
const modelLog = require("../models/log.js");
const modelProject = require("../models/project.js");
const modelUser = require("../models/user.js");
const interfaceColModel = require("../models/interfaceCol.js");
const interfaceCaseModel = require("../models/interfaceCase.js");
const interfaceModel = require("../models/interface.js");
const followModel = require("../models/follow.js");
const json5 = require("json5");
const _ = require("underscore");
const Ajv = require("ajv");
const Mock = require("mockjs");
const sandboxFn = require("./sandbox");
const ejs = require("easy-json-schema");
const jsf = require("json-schema-faker");
const { schemaValidator } = require("../../common/utils");
const http = require("http");

jsf.extend("mock", function () {
	return {
		mock: function (xx) {
			return Mock.mock(xx);
		}
	};
});

const defaultOptions = {
	failOnInvalidTypes: false,
	failOnInvalidFormat: false
};

const schemaToJson = function (schema, options = {}) {
	Object.assign(options, defaultOptions);

	jsf.option(options);
	let result;
	try {
		result = jsf(schema);
	} catch (err) {
		result = err.message;
	}
	jsf.option(defaultOptions);
	return result;
};

const resReturn = (data, errcode, errmsg) => {
	errcode = errcode || 0;
	return {
		errcode,
		errmsg: errmsg || "成功！",
		data
	};
};

const log = (msg, type = "info") => {
	let errorThrowAt = ``;
	if (!msg) {
		return;
	}

	if (typeof msg === "object") {
		if (msg instanceof Error) msg = msg.message;
		else msg = JSON.stringify(msg);
	}

	try {
		throw new Error("common.info");
	} catch (error) {
		try {
			const contentArray = String(error.stack).split("\n");
			let errorAt = String(contentArray[3]);
			const res = errorAt.match(/\((.*)\)/);
			if (res && res[1]) {
				errorThrowAt += `\n(${res[1]})`;
			} else {
				errorThrowAt += `\n(${errorAt.split("    at ")[1]})`;
			}
		} catch (error) { }
	}
	/* let date = new Date(); let year = date.getFullYear();
	let month = date.getMonth() + 1; */
	const date = Date.now();
	let logfile = path.join(xU.WEBROOT_LOG, `${dayjs(date).format("YYYY-MM-DD_HH")}.log`);
	const errorContent = `【${dayjs(date).format("YYYY-MM-DD HH:mm:ss")}-${date}】：【${type}】：【${msg}】${errorThrowAt}\n===`;
	fs.writeFileSync(logfile, errorContent, {
		flag: "a"
	});
	let logFn = console[type];
	logFn(errorContent);
};

const fileExist = filePath => {
	try {
		return fs.statSync(filePath).isFile();
	} catch (err) {
		return false;
	}
};

const time = () => {
	return Date.parse(new Date()) / 1000;
};

const fieldSelect = (data, field) => {
	if (!data || !field || !Array.isArray(field)) {
		return null;
	}

	var arr = {};

	field.forEach(f => {
		typeof data[f] !== "undefined" && (arr[f] = data[f]);
	});

	return arr;
};

const rand = (min, max) => {
	return Math.floor(Math.random() * (max - min) + min);
};

const json_parse = json => {
	try {
		return json5.parse(json);
	} catch (e) {
		return json;
	}
};

const randStr = () => {
	return Math.random().toString(36).substr(2);
};
const getIp = ctx => {
	let ip;
	try {
		ip = ctx.ip.match(/\d+.\d+.\d+.\d+/)
			? ctx.ip.match(/\d+.\d+.\d+.\d+/)[0]
			: "localhost";
	} catch (e) {
		ip = null;
	}
	return ip;
};

const generatePassword = (password, passsalt) => {
	return sha1(password + sha1(passsalt));
};

const expireDate = day => {
	let date = new Date();
	date.setTime(date.getTime() + day * 86400000);
	return date;
};

const sendMail = (options, cb) => {
	if (!xU.mail) return false;
	options.subject = options.subject
		? options.subject + "-YApi 平台"
		: "YApi 平台";

	cb =
		cb ||
		function (err) {
			if (err) {
				xU.applog.info("send mail " + options.to + " error," + err.message, "error");
			} else {
				xU.applog.info("send mail " + options.to + " success");
			}
		};

	try {
		xU.mail.sendMail(
			{
				from: WEBCONFIG.mail.from,
				to: options.to,
				subject: options.subject,
				html: options.contents
			},
			cb
		);
	} catch (e) {
		xU.applog.info(e.message, "error");
		console.error(e.message); // eslint-disable-line
	}
};

const validateSearchKeyword = keyword => {
	if (/^\*|\?|\+|\$|\^|\\|\.$/.test(keyword)) {
		return false;
	}

	return true;
};

const filterRes = (list, rules) => {
	return list.map(item => {
		let filteredRes = {};

		rules.forEach(rule => {
			if (typeof rule == "string") {
				filteredRes[rule] = item[rule];
			} else if (typeof rule == "object") {
				filteredRes[rule.alias] = item[rule.key];
			}
		});

		return filteredRes;
	});
};

const handleVarPath = (pathname, params) => {
	function insertParams(name) {
		if (!_.find(params, { name: name })) {
			params.push({
				name: name,
				desc: ""
			});
		}
	}

	if (!pathname) return;
	if (pathname.indexOf(":") !== -1) {
		let paths = pathname.split("/"),
			name,
			i;
		for (i = 1; i < paths.length; i++) {
			if (paths[i] && paths[i][0] === ":") {
				name = paths[i].substr(1);
				insertParams(name);
			}
		}
	}
	pathname.replace(/\{(.+?)\}/g, function (str, match) {
		insertParams(match);
	});
};

/**
 * 验证一个 path 是否合法
 * path第一位必需为 /, path 只允许由 字母数字-/_:.{}= 组成
 */
const verifyPath = path => {
	// if (/^\/[a-zA-Z0-9\-\/_:!\.\{\}\=]*$/.test(path)) {
	//   return true;
	// } else {
	//   return false;
	// }
	return /^\/[a-zA-Z0-9\-\/_:!\.\{\}\=]*$/.test(path);
};

/**
 * 沙盒执行 js 代码
 * @sandbox Object context
 * @script String script
 * @return sandbox
 *
 * @example let a = sandbox({a: 1}, 'a=2')
 * a = {a: 2}
 */
const sandbox = (sandbox, script) => {
	try {
		const vm = require("vm");
		sandbox = sandbox || {};
		script = new vm.Script(script);
		const context = new vm.createContext(sandbox);
		script.runInContext(context, {
			timeout: 3000
		});
		return sandbox;
	} catch (err) {
		throw err;
	}
};

function trim(str) {
	if (!str) {
		return str;
	}

	str = str + "";

	return str.replace(/(^\s*)|(\s*$)/g, "");
}

function ltrim(str) {
	if (!str) {
		return str;
	}

	str = str + "";

	return str.replace(/(^\s*)/g, "");
}

function rtrim(str) {
	if (!str) {
		return str;
	}

	str = str + "";

	return str.replace(/(\s*$)/g, "");
}

/**
 * 处理请求参数类型，String 字符串去除两边空格，Number 使用parseInt 转换为数字
 * @params Object {a: ' ab ', b: ' 123 '}
 * @keys Object {a: 'string', b: 'number'}
 * @return Object {a: 'ab', b: 123}
 */
const handleParams = (params, keys) => {
	if (
		!params ||
		typeof params !== "object" ||
		!keys ||
		typeof keys !== "object"
	) {
		return false;
	}

	for (var key in keys) {
		var filter = keys[key];
		if (params[key]) {
			switch (filter) {
				case "string":
					params[key] = trim(params[key] + "");
					break;
				case "number":
					params[key] = !isNaN(params[key]) ? parseInt(params[key], 10) : 0;
					break;
				default:
					params[key] = trim(params + "");
			}
		}
	}

	return params;
};

const validateParams = (schema2, params) => {
	const flag = schema2.closeRemoveAdditional;
	const ajv = new Ajv({
		allErrors: true,
		coerceTypes: true,
		useDefaults: true,
		removeAdditional: flag ? false : true
	});

	var localize = require("ajv-i18n");
	delete schema2.closeRemoveAdditional;

	const schema = ejs(schema2);

	schema.additionalProperties = flag ? true : false;
	const validate = ajv.compile(schema);
	let valid = validate(params);

	let message = "请求参数 ";
	if (!valid) {
		localize.zh(validate.errors);
		message += ajv.errorsText(validate.errors, { separator: "\n" });
	}

	return {
		valid: valid,
		message: message
	};
};

const saveLog = logData => {
	try {
		let logInst = xU.getInst(modelLog);
		let data = {
			content: logData.content,
			type: logData.type,
			uid: logData.uid,
			username: logData.username,
			typeid: logData.typeid,
			data: logData.data
		};

		logInst.save(data).then();
	} catch (e) {
		xU.applog.info(e, "error"); // eslint-disable-line
	}
};

/**
 *
 * @param {*} router router
 * @param {*} baseurl base_url_path
 * @param {*} routerController controller
 * @param {*} path  routerPath
 * @param {*} method request_method , post get put delete ...
 * @param {*} action controller action_name
 * @param {*} ws enable ws
 */
const createAction = (
	router,
	baseurl,
	routerController,
	action,
	path,
	method,
	ws
) => {
	router[method](baseurl + path, async ctx => {
		let inst = new routerController(ctx);
		try {
			await inst.init(ctx);
			ctx.params = Object.assign(
				{},
				ctx.request.query,
				ctx.request.body,
				ctx.params
			);
			if (
				inst.schemaMap &&
				typeof inst.schemaMap === "object" &&
				inst.schemaMap[action]
			) {
				let validResult = xU.validateParams(inst.schemaMap[action], ctx.params);

				if (!validResult.valid) {
					return (ctx.body = xU.resReturn(null, 400, validResult.message));
				}
			}
			if (inst.$auth === true) {
				await inst[action].call(inst, ctx);
			} else {
				if (ws === true) {
					ctx.ws.send("请登录...");
				} else {
					ctx.body = xU.resReturn(null, 40011, "请登录...");
				}
			}
		} catch (err) {
			ctx.body = xU.resReturn(null, 40011, "服务器出错...");
			xU.applog.info(err, "error");
		}
	});
};

/**
 *
 * @param {*} params 接口定义的参数
 * @param {*} val  接口case 定义的参数值
 */
function handleParamsValue(params, val) {
	let value = {};
	try {
		params = params.toObject();
	} catch (e) { }
	if (params.length === 0 || val.length === 0) {
		return params;
	}
	val.forEach(item => {
		value[item.name] = item;
	});
	params.forEach((item, index) => {
		if (!value[item.name] || typeof value[item.name] !== "object") return null;
		params[index].value = value[item.name].value;
		if (!_.isUndefined(value[item.name].enable)) {
			params[index].enable = value[item.name].enable;
		}
	});
	return params;
}

const getCaseList = async function getCaseList(id) {
	const caseInst = xU.getInst(interfaceCaseModel);
	const colInst = xU.getInst(interfaceColModel);
	const projectInst = xU.getInst(modelProject);
	const interfaceInst = xU.getInst(interfaceModel);

	let resultList = await caseInst.list(id, "all");
	let colData = await colInst.get(id);
	for (let index = 0; index < resultList.length; index++) {
		let result = resultList[index].toObject();
		let data = await interfaceInst.get(result.interface_id);
		if (!data) {
			await caseInst.del(result._id);
			continue;
		}
		let projectData = await projectInst.getBaseInfo(data.project_id);
		result.path = projectData.basepath + data.path;
		result.method = data.method;
		result.title = data.title;
		result.req_body_type = data.req_body_type;
		result.req_headers = handleParamsValue(
			data.req_headers,
			result.req_headers
		);
		result.res_body_type = data.res_body_type;
		result.req_body_form = handleParamsValue(
			data.req_body_form,
			result.req_body_form
		);
		result.req_query = handleParamsValue(data.req_query, result.req_query);
		result.req_params = handleParamsValue(data.req_params, result.req_params);
		resultList[index] = result;
	}
	resultList = resultList.sort((a, b) => {
		return a.index - b.index;
	});
	let ctxBody = xU.resReturn(resultList);
	ctxBody.colData = colData;
	return ctxBody;
};

function convertString(variable) {
	if (variable instanceof Error) {
		return variable.name + ": " + variable.message;
	}
	try {
		if (variable && typeof variable === "string") {
			return variable;
		}
		return JSON.stringify(variable, null, "   ");
	} catch (err) {
		return variable || "";
	}
}

const runCaseScript = async function runCaseScript(params, colId, interfaceId) {
	const colInst = xU.getInst(interfaceColModel);
	let colData = await colInst.get(colId);
	const logs = [];
	const context = {
		assert: require("assert"),
		status: params.response.status,
		body: params.response.body,
		header: params.response.header,
		records: params.records,
		params: params.params,
		log: msg => {
			logs.push("log: " + convertString(msg));
		}
	};

	let result = {};
	try {
		if (colData.checkHttpCodeIs200) {
			let status = +params.response.status;
			if (status !== 200) {
				throw "Http status code 不是 200，请检查(该规则来源于于 [测试集->通用规则配置] )";
			}
		}

		if (colData.checkResponseField.enable) {
			if (
				params.response.body[colData.checkResponseField.name] !=
				colData.checkResponseField.value
			) {
				throw `返回json ${colData.checkResponseField.name} 值不是${colData.checkResponseField.value}，请检查(该规则来源于于 [测试集->通用规则配置] )`;
			}
		}

		if (colData.checkResponseSchema) {
			const interfaceInst = xU.getInst(interfaceModel);
			let interfaceData = await interfaceInst.get(interfaceId);
			if (interfaceData.res_body_is_json_schema && interfaceData.res_body) {
				let schema = JSON.parse(interfaceData.res_body);
				let result = schemaValidator(schema, context.body);
				if (!result.valid) {
					throw `返回Json 不符合 response 定义的数据结构,原因: ${result.message}
数据结构如下：
${JSON.stringify(schema, null, 2)}`;
				}
			}
		}

		if (colData.checkScript.enable) {
			let globalScript = colData.checkScript.content;
			// script 是断言
			if (globalScript) {
				logs.push("执行脚本：" + globalScript);
				result = await sandboxFn(context, globalScript);
			}
		}

		let script = params.script;
		// script 是断言
		if (script) {
			logs.push("执行脚本:" + script);
			result = await sandboxFn(context, script);
		}
		result.logs = logs;
		return xU.resReturn(result);
	} catch (err) {
		logs.push(convertString(err));
		result.logs = logs;
		return xU.resReturn(result, 400, err.name + ": " + err.message);
	}
};

const getUserdata = async function getUserdata(uid, role) {
	role = role || "dev";
	let userInst = xU.getInst(modelUser);
	let userData = await userInst.findById(uid);
	if (!userData) {
		return null;
	}
	return {
		role: role,
		uid: userData._id,
		username: userData.username,
		email: userData.email
	};
};

// 处理mockJs脚本
const handleMockScript = async function (script, context) {
	let sandbox = {
		header: context.ctx.header,
		query: context.ctx.query,
		body: context.ctx.request.body,
		mockJson: context.mockJson,
		params: Object.assign({}, context.ctx.query, context.ctx.request.body),
		resHeader: context.resHeader,
		httpCode: context.httpCode,
		delay: context.httpCode,
		Random: Mock.Random
	};
	sandbox.cookie = {};

	context.ctx.header.cookie &&
		context.ctx.header.cookie.split(";").forEach(function (Cookie) {
			var parts = Cookie.split("=");
			sandbox.cookie[parts[0].trim()] = (parts[1] || "").trim();
		});
	sandbox = await sandboxFn(sandbox, script);
	sandbox.delay = isNaN(sandbox.delay) ? 0 : +sandbox.delay;

	context.mockJson = sandbox.mockJson;
	context.resHeader = sandbox.resHeader;
	context.httpCode = sandbox.httpCode;
	context.delay = sandbox.delay;
};

const createWebAPIRequest = function (ops) {
	return new Promise(function (resolve, reject) {
		let req = "";
		let http_client = http.request(
			{
				host: ops.hostname,
				method: "GET",
				port: ops.port,
				path: ops.path
			},
			function (res) {
				res.on("error", function (err) {
					reject(err);
				});
				res.setEncoding("utf8");
				if (res.statusCode != 200) {
					reject({ message: "statusCode != 200" });
				} else {
					res.on("data", function (chunk) {
						req += chunk;
					});
					res.on("end", function () {
						resolve(req);
					});
				}
			}
		);
		http_client.on("error", e => {
			reject({ message: `request error: ${e.message}` });
		});
		http_client.end();
	});
};

const applog = {
	info(msg) {
		log(msg, "info");
	},
	error(msg) {
		log(msg, "error");
	},
	warn(msg) {
		log(msg, "warn");
	}
};

exports.schemaToJson = schemaToJson;
exports.resReturn = resReturn;
exports.log = log;
exports.fileExist = fileExist;
exports.time = time;
exports.fieldSelect = fieldSelect;
exports.rand = rand;
exports.json_parse = json_parse;
exports.randStr = randStr;
exports.getIp = getIp;
exports.generatePassword = generatePassword;
exports.expireDate = expireDate;
exports.sendMail = sendMail;
exports.validateSearchKeyword = validateSearchKeyword;
exports.filterRes = filterRes;
exports.handleVarPath = handleVarPath;
exports.verifyPath = verifyPath;
exports.sandbox = sandbox;
exports.trim = trim;
exports.ltrim = ltrim;
exports.rtrim = rtrim;
exports.handleParams = handleParams;
exports.validateParams = validateParams;
exports.saveLog = saveLog;
exports.createAction = createAction;
exports.handleParamsValue = handleParamsValue;
exports.getCaseList = getCaseList;
exports.runCaseScript = runCaseScript;
exports.getUserdata = getUserdata;
exports.handleMockScript = handleMockScript;
exports.createWebAPIRequest = createWebAPIRequest;
exports.applog = applog;
