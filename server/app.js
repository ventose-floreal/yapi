process.env.NODE_PATH = __dirname;
require('module').Module._initPaths();

const yapi = require('./yapi.js');
const commons = require('./utils/commons');
yapi.commons = commons;
const dbModule = require('./utils/db.js');
yapi.connect = dbModule.connect();
const mockServer = require('./middleware/mockServer.js');
require('./plugin.js');
const websockify = require('koa-websocket');
const websocket = require('./websocket.js');
const storageCreator = require('./utils/storage');
var cors = require('koa2-cors');

require('./utils/notice');

const Koa = require('koa');
const koaStatic = require('koa-static');
// const bodyParser = require('koa-bodyparser');
const koaBody = require('koa-body');
const router = require('./router.js');

global.storageCreator = storageCreator;
let indexFile = process.argv[2] === 'dev' ? 'dev.html' : 'index.html';

const app = websockify(new Koa());
app.proxy = true;
yapi.app = app;

app.use(async (ctx, next) => {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    ctx.set('yapi-Response-Time', `${ms}ms`);
});

// app.use(bodyParser({multipart: true}));
app.use(cors());

app.use(koaBody({strict: false, multipart: true, jsonLimit: '4mb', formLimit: '4mb', textLimit: '4mb'}));
app.use(mockServer);
app.use(async (ctx, next) => {
    console.clear();
    console.log('ctx.params', ctx.originalUrl, ctx.params);
    await next();
});
app.use(router.routes());
app.use(router.allowedMethods());

websocket(app);

app.use(async (ctx, next) => {
    if (/^\/(?!api)[a-zA-Z0-9\/\-_]*$/.test(ctx.path)) {
        ctx.path = '/';
        await next();
    } else {
        await next();
    }
});

app.use(async (ctx, next) => {
    if (ctx.path.indexOf('/prd') === 0) {
        ctx.set('Cache-Control', 'max-age=8640000000');
        if (yapi.commons.fileExist(yapi.path.join(yapi.WEBROOT, 'static', ctx.path + '.gz'))) {
            ctx.set('Content-Encoding', 'gzip');
            ctx.path = ctx.path + '.gz';
        }
    }
    await next();
});

app.use(koaStatic(yapi.path.join(yapi.WEBROOT, 'static'), {index: indexFile, gzip: true}));

const server = app.listen(yapi.WEBCONFIG.port);

server.setTimeout(yapi.WEBCONFIG.timeout);

commons.log(
    `?????????????????????????????????????????????:
      http://127.0.0.1${yapi.WEBCONFIG.port == '80' ? '' : ':' + yapi.WEBCONFIG.port}/`
);
