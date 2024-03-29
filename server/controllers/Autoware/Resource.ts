const mime = require("mime-types");
const fs = require("fs");
const path = require("path");
const { ModelResource } = require("server/models/Resource");
const { _n } = require("@ventose/utils-node");
const { getType } = require("mime");

let TARGET_PREFIX = path.join(
	xU.var.APP_ROOT_SERVER_DIR,
	xU.var.UPLOADS,
	xU.var.RESOURCE_ASSETS
);

function returnBase64Body(basecode) {
	if (basecode.indexOf("base64") > -1) {
		return new Buffer(basecode.split("base64")[1], "base64");
	} else {
		return new Buffer(basecode, "base64");
	}
}

module.exports = {
	definitions: {
		ResponseSelf: {
			type: "object",
			properties: {
				code: { type: "integer", format: "int32" },
				type: { type: "string" },
				message: { type: "string" }
			}
		},
		UploadSuccess: {
			type: "object",
			properties: {
				errcode: { type: "integer" },
				message: { type: "int32" },
				data: {
					type: "object",
					properties: {
						_id: { type: "integer" }
					}
				}
			}
		}
	},
	tag: {
		description: "文件资源的管理，例如wiki 截图的上传下载"
	},
	paths: {
		"/resource/base64img": {
			post: {
				summary: "上传图片",
				description: "以base64形式",
				request: {
					body: {
						basecode: {
							description: "base64",
							type: "string"
						},
						name: { description: "name", type: "string" },
						size: { description: "size", type: "string" },
						type: { description: "type", type: "string" },
						useFor: {
							required: true,
							type: "string",
							enum: ["wiki"],
							default: "wiki"
						}
					}
				},
				async handler(ctx) {
					try {
						const { useFor, basecode, name, size, type } = ctx.payload;
						const add_time = xU.time();
						const wikiInfo = {
							name: `${useFor}_${add_time}_${name}`,
							useFor: useFor,
							type,
							path: `${useFor}/${add_time}/${name}/`,
							size,
							basecode,
							uploadBy: this.$uid,
							add_time
						};
						const res = await orm.Resource.save(wikiInfo);
						ctx.body = xU.$response({ _id: res._id });
					} catch (e) {
						ctx.body = xU.$response(null, 400, e.message);
						xU.applog.error(e.message);
					}
				}
			}
		},
		"/resource/single_upload": {
			post: {
				summary: "上传单个文件",
				description: "文件保存在服务器上",
				request: {
					formData: {
						useFor: {
							description: "资源的用处，如wiki",
							required: true,
							type: "string"
						},
						file: {
							description: "上传的文件",
							required: true,
							type: "file"
						}
					}
				},
				response: {
					200: {
						description: "成功",
						schema: xU.schema("UploadSuccess")
					}
				},
				async handler(ctx) {
					try {
						const { files, fields } = ctx.payload;
						const { file } = files;
						const { useFor } = fields;
						const sourcePath = file.path;
						let targetPath = path.resolve(
							TARGET_PREFIX,
							useFor,
							xU.dayjs().format("YYYY_MM_DD")
						);
						await _n.asyncSafeMakeDir(targetPath);
						const basename = path.basename(sourcePath);
						targetPath = path.resolve(targetPath, basename);
						await xU.fs.promises.copyFile(sourcePath, targetPath);
						await xU.fs.promises.unlink(sourcePath);
						const wikiInfo = {
							name: file.name,
							path: xU.last(String(targetPath).split(xU.var.RESOURCE_ASSETS)),
							type: file.type,
							useFor: useFor,
							size: file.size,
							uploadBy: this.$uid,
							add_time: xU.time()
						};
						const res = await orm.Resource.save(wikiInfo);
						ctx.body = xU.$response({ _id: res._id });
					} catch (e) {
						xU.applog.error(e.message);
						ctx.body = xU.$response(null, 402, e.message);
					}
				}
			}
		},
		"/resource/get": {
			get: {
				summary: "根据ID获取资源",
				description: "文件保存在服务器上",
				request: {
					query: {
						id: {
							description: "资源id",
							required: true,
							type: "integer"
						}
					}
				},
				async handler(ctx) {
					try {
						const targetResource = await orm.Resource.getResourceById(
							ctx.query.id
						);
						var type;
						/* base64 存储 */
						if (targetResource?.basecode) {
							type = targetResource.type;
							ctx.set("Content-type", type);
							ctx.body = returnBase64Body(targetResource.basecode);
							return;
						}

						/* 文件形式存储，需要path路径 */
						if (targetResource) {
							let targetPath = path.resolve(
								`${TARGET_PREFIX}${targetResource.path}`
							);
							const isExist = xU.fileExist(targetPath);
							if (isExist) {
								xU.applog.info("targetPath", targetPath);
								ctx.status = 200;
								ctx.set("Content-Type", mime.lookup(targetResource.path));
								ctx.body = xU.fs.createReadStream(targetPath);
							} else {
								const targetResource = await orm.Resource.getResourceByName(
									"SYSTEM_404"
								);
								ctx.set("Content-type", "image/png");
								ctx.body = returnBase64Body(targetResource.basecode);
							}
						}
					} catch (e) {
						xU.applog.error(e.message);
					}
				}
			}
		},
		"/resource/ls": {
			post: {
				summary: "根据提供的path",
				description: "文件保存在服务器上",
				request: {
					body: {
						path: {
							description: "文件夹路径",
							type: "string"
						}
					}
				},
				async handler(ctx) {
					try {
						if (this.$user?.role === "admin") {
							const { path: dirpath } = ctx.payload;
							if (dirpath === "/") {
								throw new Error("auth");
							}
							let targetPath = path.resolve(
								yapi_configs.RESOURCE_ASSETS_REMOTE,
								dirpath || ""
							);
							const dirlsArray = await fs.promises.readdir(targetPath);
							ctx.body = xU.$response(dirlsArray);
						} else {
							throw new Error("auth");
						}
					} catch (e) {
						ctx.body = xU.$response(null, 404, "not found");
						xU.applog.error(e.message);
					}
				}
			}
		},
		"/resource/status": {
			post: {
				summary: "根据提供的path",
				description: "资源状态信息，并返回对应的信息",
				request: {
					body: {
						path: {
							description: "资源路径",
							type: "string"
						}
					}
				},
				async handler(ctx) {
					try {
						if (this.$user?.role === "admin") {
							let { path: dirpath } = ctx.payload;
							if (dirpath === "/") {
								throw new Error("auth");
							}
							dirpath = dirpath.replace(/^\//, "");
							let targetPath = path.resolve(
								yapi_configs.RESOURCE_ASSETS_REMOTE,
								dirpath || ""
							);

							const stat = await fs.promises.stat(targetPath);
							if (stat.isDirectory()) {
								const dirlsArray = await fs.promises.readdir(targetPath);
								const dirname = path.dirname(targetPath);
								const rootDirName = path.resolve(
									yapi_configs.RESOURCE_ASSETS_REMOTE
								);

								let parentDir;
								if (dirname.length < rootDirName.length) {
									parentDir = "";
								} else {
									parentDir = dirname.substring(rootDirName.length);
									parentDir = parentDir
										.split(path.sep)
										.filter(Boolean)
										.join("/");
								}

								const current = dirpath;
								ctx.body = xU.$response({
									type: "directory",
									parent: parentDir,
									current,
									children: dirlsArray
								});
								return;
							}
							if (stat.isFile()) {
								const type = getType(targetPath);
								if (isAudioType(type)) {
									const record = await getAudioRecord({
										filePath: targetPath,
										id: dirpath,
										size: stat.size,
										type
									});
									ctx.body = xU.$response({
										type: "audio",
										record
									});
									return;
								}
							}
						}

						throw new Error("auth");
					} catch (e) {
						ctx.body = xU.$response(null, 404, "not found");
						xU.applog.error(e.message);
					}
				}
			}
		},
		"/resource/remote_music_file": {
			get: {
				summary: "媒体文件流",
				description: "媒体文件流",
				request: {
					query: {
						id: {
							description: "资源id",
							required: true,
							type: "string"
						}
					}
				},
				async handler(ctx) {
					const { headers, payload } = ctx;
					const { id: dirpath } = payload;
					let resourcePath = path.resolve(
						yapi_configs.RESOURCE_ASSETS_REMOTE,
						dirpath || ""
					);
					const stat = await fs.promises.stat(resourcePath);
					if (stat.isFile()) {
						const type = getType(resourcePath);
						if (isAudioType(type)) {
							const record = await getAudioRecord({
								filePath: resourcePath,
								id: dirpath,
								size: stat.size,
								type
							});
							const total = record.size;
							try {
								if (headers.range) {
									const range = headers.range;
									const parts = range.replace(/bytes=/, "").split("-");
									const partialstart = parseInt(parts[0], 10);
									const partialend = parseInt(parts[1], 10);

									let start = partialstart;
									const end = partialend ? partialend : total - 1;
									const chunksize = end - start + 1;

									ctx.status = 206;
									ctx.set({
										"Content-Range": "bytes " + start + "-" + end + "/" + total,
										"Accept-Ranges": "bytes",
										"Content-Length": chunksize,
										"Content-Type": record.type || "audio/mp3"
									});
									ctx.body = fs.createReadStream(resourcePath, { start, end });
								} else {
									ctx.set({
										"Content-Type": record.type || "audio/mp3",
										"Accept-Ranges": "bytes",
										"Content-Length": total
									});
									ctx.body = fs.createReadStream(resourcePath);
								}
							} catch (error) {
								ctx.body = xU.$response(null, 400, error);
							}

							return;
						}
					}
					ctx.body = xU.$response(
						{
							msg: "not found"
						},
						404,
						"Not Found"
					);
				}
			}
		}
	}
};

function isAudioType(type) {
	return ["audio/mpeg", "audio/x-flac", "audio/mp4"].includes(type);
}

async function getAudioRecord({ filePath, id, size, type }) {
	const { parseFile } = await import("music-metadata");
	const metadata = await parseFile(filePath);
	const record = _n.merge(
		{ dirpath: id, id: id, type, size, isPrivate: true },
		metadata.common
	);
	return record;
}
