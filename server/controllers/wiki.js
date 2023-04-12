const { yapi } = global;
const baseController = require('./base.js');
const { WikiModel } = require('server/models/wiki');
const { WikiOrderModel } = require('server/models/WikiOrder');

class wikiController extends baseController {
  constructor(ctx) {
    super(ctx);
    this.orm_wiki = yapi.getInst(WikiModel);
    this.orm_wiki_order = yapi.getInst(WikiOrderModel);
  }

  /*
   * 
   * 
   * @param {any} ctx 
   * 
   * @memberOf wikiController
   * */
  async action(ctx) {
    const { action } = ctx.params;
    const strategy = STRATEGY[action];
    if (strategy) {
      try {
        const res = await strategy.call(this, ctx);
        ctx.body = yapi.commons.resReturn(res);
      } catch (err) {
        ctx.body = yapi.commons.resReturn(null, 402, err.message);
      }
    }
  }
}


const STRATEGY = {
  async delete(ctx) {
    const { _id } = ctx.params;
    /* 标记删除 */
    return await this.orm_wiki.delete(_id);
  },
  async detail(ctx) {
    const { _id } = ctx.params;
    return await this.orm_wiki.detail(_id);
  },
  async list(ctx) {
    return { list: await this.orm_wiki.list() };
  },
  async menu(ctx) {
    const { payload } = ctx.params || {};
    let { belong_type, belong_id } = payload || {};
    const { order } = (await this.orm_wiki_order.detail({ belong_type, belong_id })) || {};
    const orderArray = order || [];

    const res = {
      list: await this.orm_wiki.menu({ belong_type, belong_id }),
      orderArray
    };
    return res;
  },
  async resetMenuOrder(ctx) {
    const { payload } = ctx.params || {};
    let { belong_type, belong_id, order } = payload || {};

    if (!belong_type) {
      belong_type = 'private';
      /* 当前用户的ID */
      belong_id = this.$user._id;
    }

    return await this.orm_wiki_order.upsertOne({ belong_type, belong_id, order });
  },
  async upsertOne(ctx) {
    const { data } = ctx.params;
    const { _id, belong_type } = data;
    let res;

    if (!belong_type) {
      data.belong_type = 'private';
      /* 当前用户的ID */
      data.belong_id = this.$user._id;
    }

    if (_id) {
      res = await this.orm_wiki.up(_id, data);
    } else {
      res = await this.orm_wiki.save(data);
    }
    return { msg: res };
  }
};

exports.wikiController = wikiController;
