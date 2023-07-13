const path = require("path");
const koaBody = require("koa-body");

const middlewareParseParams = () =>
	koaBody({
		strict: false,
		multipart: true,
		formidable: {
			// 上传目录
			uploadDir: path.join(xU.var.APP_ROOT_SERVER_DIR, xU.var.UPLOADS),
			// 保留文件扩展名
			keepExtensions: true
		},
		jsonLimit: "4mb",
		formLimit: "4mb",
		textLimit: "4mb"
	});

module.exports = function (app) {
	app.use(middlewareParseParams());
};
