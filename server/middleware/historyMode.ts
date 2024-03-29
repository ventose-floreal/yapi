const fs = require("fs");
const path = require("path");
const mime = require("mime-types");

const middlewareNotFound = () => async (ctx, next) => {
	/* history 模式，除了api，都返回index.html */
	if (ctx.status === 404) {
		(() => {
			xU.applog.info("middlewareNotFound return index", ctx.path);
			let indexPath;

			indexPath = path.join(
				xU.var.APP_ROOT_DIR,
				"static",
				ctx.path.substring(1)
			);
			if (xU.fileExist(indexPath)) {
				ctx.status = 200;
				ctx.set("Content-Type", mime.lookup(indexPath));
				ctx.body = xU.fs.createReadStream(indexPath);
				return;
			}

			if (
				ctx.header?.accept &&
				ctx.header.accept.indexOf("application/json") > -1
			) {
				ctx.status = 404;
				ctx.set("Content-Type", "application/json");
				ctx.body = xU.$response(null, 404, "NOT_FOUND");
				return;
			}

			/* 返回首页 */
			indexPath = path.join(xU.var.APP_ROOT_DIR, "static", "index.html");
			ctx.status = 200;
			ctx.set("Content-Type", mime.lookup(indexPath));
			ctx.body = xU.fs.createReadStream(indexPath);
			return;
		})();
	}
	next();
};

module.exports = async function (app) {
	app.use(middlewareNotFound());
};
