const path = require("path");
const fs = require("fs-extra");
const nodemailer = require("nodemailer");

let mail = () => null;
if (WEBCONFIG.mail && WEBCONFIG.mail.enable) {
	mail = nodemailer.createTransport(WEBCONFIG.mail);
}

let INSTS = new Map();

const {
	schemaToJson,
	resReturn,
	log,
	fileExist,
	time,
	fieldSelect,
	rand,
	json_parse,
	randStr,
	getIp,
	generatePassword,
	expireDate,
	sendMail,
	validateSearchKeyword,
	filterRes,
	handleVarPath,
	verifyPath,
	sandbox,
	trim,
	ltrim,
	rtrim,
	handleParams,
	validateParams,
	saveLog,
	createAction,
	handleParamsValue,
	getCaseList,
	runCaseScript,
	getUserdata,
	handleMockScript,
	createWebAPIRequest,
	applog
} = require("./commons");

const WEBROOT = path.resolve(__dirname, "../.."); //路径
const WEBROOT_SERVER = __dirname;
const WEBROOT_RUNTIME = path.resolve(__dirname, "../../..");
const WEBROOT_LOG = path.join(WEBROOT_RUNTIME, "log");
fs.ensureDirSync(WEBROOT_LOG);

/**
 * 获取一个model实例，如果不存在则创建一个新的返回
 * @param {*} m class
 * @example
 * getInst(groupModel, arg1, arg2)
 */
function getInst(m, ...args) {
	if (!INSTS.get(m)) {
		INSTS.set(m, new m(args));
	}
	return INSTS.get(m);
}

function delInst(m) {
	try {
		INSTS.delete(m);
	} catch (err) {
		console.error(err); // eslint-disable-line
	}
}

const VARIABLE = {
	PAGE_LIMIT: 10, // 默认每页展示10条数据
	NAME_LIMIT: 100, // 限制名称的字符长度(中文算两个长度)
	HTTP_METHOD: {
		GET: {
			request_body: false,
			default_tab: "query"
		},
		POST: {
			request_body: true,
			default_tab: "body"
		},
		PUT: {
			request_body: true,
			default_tab: "body"
		},
		DELETE: {
			request_body: true,
			default_tab: "body"
		},
		HEAD: {
			request_body: false,
			default_tab: "query"
		},
		OPTIONS: {
			request_body: false,
			default_tab: "query"
		},
		PATCH: {
			request_body: true,
			default_tab: "body"
		}
	},
	PROJECT_COLOR: {
		blue: "#2395f1",
		green: "#00a854",
		yellow: "#ffbf00",
		red: "#f56a00",
		pink: "#f5317f",
		cyan: "#00a2ae",
		gray: "#bfbfbf",
		purple: "#7265e6"
	},
	PROJECT_ICON: [
		"code-o",
		"swap",
		"clock-circle-o",
		"unlock",
		"calendar",
		"play-circle-o",
		"file-text",
		"desktop",
		"hdd",
		"appstore-o",
		"line-chart",
		"mail",
		"mobile",
		"notification",
		"picture",
		"poweroff",
		"search",
		"setting",
		"share-alt",
		"shopping-cart",
		"tag-o",
		"video-camera",
		"cloud-o",
		"star-o",
		"environment-o",
		"camera-o",
		"team",
		"customer-service",
		"pay-circle-o",
		"rocket",
		"database",
		"tool",
		"wifi",
		"idcard",
		"medicine-box",
		"coffee",
		"safety",
		"global",
		"api",
		"fork",
		"android-o",
		"apple-o"
	],
	HTTP_REQUEST_HEADER: [
		"Accept",
		"Accept-Charset",
		"Accept-Encoding",
		"Accept-Language",
		"Accept-Datetime",
		"Authorization",
		"Cache-Control",
		"Connection",
		"Cookie",
		"Content-Disposition",
		"Content-Length",
		"Content-MD5",
		"Content-Type",
		"Date",
		"Expect",
		"From",
		"Host",
		"If-Match",
		"If-Modified-Since",
		"If-None-Match",
		"If-Range",
		"If-Unmodified-Since",
		"Max-Forwards",
		"Origin",
		"Pragma",
		"Proxy-Authorization",
		"Range",
		"Referer",
		"TE",
		"User-Agent",
		"Upgrade",
		"Via",
		"Warning",
		"X-Requested-With",
		"DNT",
		"X-Forwarded-For",
		"X-Forwarded-Host",
		"X-Forwarded-Proto",
		"Front-End-Https",
		"X-Http-Method-Override",
		"X-ATT-DeviceId",
		"X-Wap-Profile",
		"Proxy-Connection",
		"X-UIDH",
		"X-Csrf-Token"
	],
	METHOD_COLOR: {
		post: {
			bac: "#d2eafb",
			color: "#108ee9"
		},
		get: {
			bac: "#cfefdf",
			color: "#00a854"
		},
		put: {
			bac: "#fff3cf",
			color: "#ffbf00"
		},
		delete: {
			bac: "#fcdbd9",
			color: "#f04134"
		},
		head: {
			bac: "#fff3cf",
			color: "#ffbf00"
		},
		patch: {
			bac: "#fff3cf",
			color: "#ffbf00"
		},
		options: {
			bac: "#fff3cf",
			color: "#ffbf00"
		}
	},
	MOCK_SOURCE: [
		{ name: "字符串", mock: "@string" },
		{ name: "自然数", mock: "@natural" },
		{ name: "浮点数", mock: "@float" },
		{ name: "字符", mock: "@character" },
		{ name: "布尔", mock: "@boolean" },
		{ name: "url", mock: "@url" },
		{ name: "域名", mock: "@domain" },
		{ name: "ip地址", mock: "@ip" },
		{ name: "id", mock: "@id" },
		{ name: "guid", mock: "@guid" },
		{ name: "当前时间", mock: "@now" },
		{ name: "时间戳", mock: "@timestamp" },
		{ name: "日期", mock: "@date" },
		{ name: "时间", mock: "@time" },
		{ name: "日期时间", mock: "@datetime" },
		{ name: "图片连接", mock: "@image" },
		{ name: "图片data", mock: "@imageData" },
		{ name: "颜色", mock: "@color" },
		{ name: "颜色hex", mock: "@hex" },
		{ name: "颜色rgba", mock: "@rgba" },
		{ name: "颜色rgb", mock: "@rgb" },
		{ name: "颜色hsl", mock: "@hsl" },
		{ name: "整数", mock: "@integer" },
		{ name: "email", mock: "@email" },
		{ name: "大段文本", mock: "@paragraph" },
		{ name: "句子", mock: "@sentence" },
		{ name: "单词", mock: "@word" },
		{ name: "大段中文文本", mock: "@cparagraph" },
		{ name: "中文标题", mock: "@ctitle" },
		{ name: "标题", mock: "@title" },
		{ name: "姓名", mock: "@name" },
		{ name: "中文姓名", mock: "@cname" },
		{ name: "中文姓", mock: "@cfirst" },
		{ name: "中文名", mock: "@clast" },
		{ name: "英文姓", mock: "@first" },
		{ name: "英文名", mock: "@last" },
		{ name: "中文句子", mock: "@csentence" },
		{ name: "中文词组", mock: "@cword" },
		{ name: "地址", mock: "@region" },
		{ name: "省份", mock: "@province" },
		{ name: "城市", mock: "@city" },
		{ name: "地区", mock: "@county" },
		{ name: "转换为大写", mock: "@upper" },
		{ name: "转换为小写", mock: "@lower" },
		{ name: "挑选（枚举）", mock: "@pick" },
		{ name: "打乱数组", mock: "@shuffle" },
		{ name: "协议", mock: "@protocol" }
	],
	IP_REGEXP:
		/^(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])(\.(\d{1,2}|1\d\d|2[0-4]\d|25[0-5])){3}$/,
	docHref: {
		adv_mock_case: "https://hellosean1025.github.io/yapi/documents/mock.html",
		adv_mock_script:
			"https://hellosean1025.github.io/yapi/documents/adv_mock.html"
	}
};

function storageCreator(id) {
	const storageModel = require("../models/storage");
	const defaultData = {};
	return {
		getItem: async (name = "") => {
			let inst = getInst(storageModel);
			let data = await inst.get(id);
			data = data || defaultData;
			if (name) return data[name];
			return data;
		},
		setItem: async (name, value) => {
			let inst = getInst(storageModel);
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
}

let xU = {};

xU.fs = fs;
xU.path = path;
xU.WEBROOT = WEBROOT;
xU.VARIABLE = VARIABLE;
xU.WEBROOT_LOG = WEBROOT_LOG;
xU.WEBROOT_SERVER = WEBROOT_SERVER;
xU.WEBROOT_RUNTIME = WEBROOT_RUNTIME;
xU.getInst = getInst;
xU.delInst = delInst;
xU.getInsts = INSTS;
xU.storageCreator = storageCreator;
xU.schemaToJson = schemaToJson;
xU.resReturn = resReturn;
xU.log = log;
xU.fileExist = fileExist;
xU.time = time;
xU.fieldSelect = fieldSelect;
xU.rand = rand;
xU.json_parse = json_parse;
xU.randStr = randStr;
xU.getIp = getIp;
xU.generatePassword = generatePassword;
xU.expireDate = expireDate;
xU.sendMail = sendMail;
xU.validateSearchKeyword = validateSearchKeyword;
xU.filterRes = filterRes;
xU.handleVarPath = handleVarPath;
xU.verifyPath = verifyPath;
xU.sandbox = sandbox;
xU.trim = trim;
xU.ltrim = ltrim;
xU.rtrim = rtrim;
xU.handleParams = handleParams;
xU.validateParams = validateParams;
xU.saveLog = saveLog;
xU.createAction = createAction;
xU.handleParamsValue = handleParamsValue;
xU.getCaseList = getCaseList;
xU.runCaseScript = runCaseScript;
xU.getUserdata = getUserdata;
xU.handleMockScript = handleMockScript;
xU.createWebAPIRequest = createWebAPIRequest;
xU.applog = applog;
xU.mail = mail;

global.xU = xU;