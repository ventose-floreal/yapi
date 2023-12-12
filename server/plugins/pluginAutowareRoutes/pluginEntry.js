const koaStatic = require("koa-static");
const ControllerBase = require("server/controllers/base");
const RouteMap = new Map();

/* isHideInSwagger */
/* auth */

/* 便捷使用schema */
xU.schema = schema => ({ $ref: `#/definitions/${schema}` });
xU.swagger_id = desc => ({
	description: desc,
	type: "string"
});
function getRoute(url, method) {
	const urlObj = RouteMap.get(url);
	if (urlObj) {
		return urlObj[String(method).toLowerCase()];
	}
}
function appUseSwagger(app, swaggerJSON) {
	app.use(async (ctx, next) => {
		if (ctx.path === "/swagger") {
			ctx.status = 200;
			ctx.set("Content-Type", "text/html");
			ctx.body = xU.fs.createReadStream(
				xU.path.resolve(__dirname, "swagger_assets/swagger.html")
			);
			return;
		}
		if (ctx.path === "/api/swagger-doc") {
			ctx.status = 200;
			ctx.set("Content-Type", "application/json");
			ctx.body = swaggerJSON;
			return;
		}
		await next();
	});
	app.use(koaStatic(xU.path.join(__dirname)));
}

function appAddRoutes(app, routes) {
	routes.forEach(route => {
		const { url, method } = route;
		const basePath =
			yapi_configs?.isUsePlugin?.AutowareRoutes?.swaggerInfo?.basePath || "";
		let key = `${basePath}${url}`;
		const urlObj = RouteMap.get(key) || {};
		urlObj[String(method).toLowerCase()] = route;
		RouteMap.set(key, urlObj);
	});

	app.use(async (ctx, next) => {
		const isDone = await (async () => {
			/* AOP */
			const route = getRoute(ctx.path, ctx.method);
			if (route) {
				const { handler, auth } = route;
				const vm = new ControllerBase(ctx);
				try {
					await vm.init(ctx);
					/* TODO: 权限控制  */
					if (vm.$auth || auth) {
						vm.ctx.payload = xU.merge(
							{},
							ctx.params || {},
							ctx.query || {},
							ctx.request.body || {}
						);
						/* TODO: 参数校验 根据route的schema校验 */
						try {
							await handler.call(vm, ctx);
						} catch (error) {
							error.message += `\n${ctx.path} ${ctx.method} handler error`;
							throw error;
						}
						return true;
					} else {
						ctx.body = xU.$response({ msg: "未获取授权" }, 40011, "请登录...");
					}
				} catch (err) {
					ctx.body = xU.$response(null, 500, err.message);
					xU.applog.error(err);
					return true;
				}
			} else {
				// ctx.body = xU.$response(null, 404, `API ${ctx.url} 使用了错误的 METHOD`);
				return false
			}
		})();
		if (!isDone) {
			await next();
		}
	});
}

module.exports = async function (app) {
	/*autoware controllers文件夹下面带有Auto前缀的controller*/
	const { routes, swaggerJSON } =
		await require("./utils/scanAllAutowareController")(app);
	appAddRoutes(app, routes);

	/*是否开启swagger: 用环境变量也可以，用配置文件也行，内网使用，一直开启也无妨，当然，默认是关闭*/
	if (yapi_configs?.isUsePlugin?.AutowareRoutes?.isUseSwagger) {
		appUseSwagger(app, swaggerJSON);
	}
};
