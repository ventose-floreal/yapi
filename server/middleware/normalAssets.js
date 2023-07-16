const koaStatic = require("koa-static");

exports.middlewareNormaoAssets = () => {
	return koaStatic(xU.path.join(xU.var.APP_ROOT_DIR, "static"), {
		index: xU.var.INDEX_FILE,
		gzip: true
	});
};