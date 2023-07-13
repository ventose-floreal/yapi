const fs = require("fs");
const path = require("path");

const middlewareNotFound = () => async (ctx, next) => {
	/* history 模式，除了api，都返回index.html */
	if (ctx.status === 404) {
		xU.applog.info("middlewareNotFound return index");
		const indexPath = path.join(xU.var.APP_ROOT_DIR, "static", "index.html");
		ctx.status = 200;
		ctx.set("Content-Type", "text/html");
		ctx.body = fs.createReadStream(indexPath);
	}
};

module.exports = function (app) {
	app.use(middlewareNotFound());
	app.use(middlewareNotFound());
};
