const ControllerBase = require("./base");
const ModelFollow = require("../models/follow");
const { ModelProject } = require("server/models/project");

class followController extends ControllerBase {
	constructor(ctx) {
		super(ctx);
		this.model = xU.orm(ModelFollow);
		this.modelProject = xU.orm(ModelProject);
	}

	/**
	 * 获取关注项目列表
	 * @interface /follow/list
	 * @method GET
	 * @category follow
	 * @foldnumber 10
	 * @param {Number} [page] 分页页码
	 * @param {Number} [limit] 分页大小
	 * @returns {Object}
	 * @example /follow/list
	 */

	async list(ctx) {
		let uid = this.getUid();
		// 关注列表暂时不分页 page & limit 为分页配置
		// page = ctx.request.query.page || 1,
		// limit = ctx.request.query.limit || 10;

		if (!uid) {
			return (ctx.body = xU.$response(null, 400, "用户id不能为空"));
		}

		try {
			let result = await this.model.list(uid);

			ctx.body = xU.$response({
				list: result
			});
		} catch (err) {
			ctx.body = xU.$response(null, 402, err.message);
		}
	}

	/**
	 * 取消关注
	 * @interface /follow/del
	 * @method POST
	 * @category follow
	 * @foldnumber 10
	 * @param {Number} projectid
	 * @returns {Object}
	 * @example /follow/del
	 */

	async del(ctx) {
		let params = ctx.request.body,
			uid = this.getUid();

		if (!params.projectid) {
			return (ctx.body = xU.$response(null, 400, "项目id不能为空"));
		}

		let count = await this.model.checkProjectRepeat(uid, params.projectid);

		if (count == 0) {
			return (ctx.body = xU.$response(null, 401, "项目未关注"));
		}

		try {
			let result = await this.model.del(params.projectid, this.getUid());
			ctx.body = xU.$response(result);
		} catch (e) {
			ctx.body = xU.$response(null, 402, e.message);
		}
	}

	/**
	 * 添加关注
	 * @interface /follow/add
	 * @method GET
	 * @category follow
	 * @foldnumber 10
	 * @param {Number} projectid 项目id
	 * @param {String} projectname 项目名
	 * @param {String} icon 项目icon
	 * @returns {Object}
	 * @example /follow/add
	 */

	async add(ctx) {
		let params = ctx.request.body;
		params = xU.ensureParamsType(params, {
			projectid: "number"
		});

		let uid = this.getUid();

		if (!params.projectid) {
			return (ctx.body = xU.$response(null, 400, "项目id不能为空"));
		}

		let count = await this.model.checkProjectRepeat(uid, params.projectid);

		if (count) {
			return (ctx.body = xU.$response(null, 401, "项目已关注"));
		}

		try {
			let project = await this.modelProject.get(params.projectid);
			let data = {
				uid: uid,
				projectid: params.projectid,
				projectname: project.name,
				icon: project.icon,
				color: project.color
			};
			let result = await this.model.save(data);
			result = xU.fieldSelect(result, [
				"_id",
				"uid",
				"projectid",
				"projectname",
				"icon",
				"color"
			]);
			ctx.body = xU.$response(result);
		} catch (e) {
			ctx.body = xU.$response(null, 402, e.message);
		}
	}
}

module.exports = followController;
