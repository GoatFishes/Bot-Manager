const Koa = require('koa')
const route = require('koa-route')
const { utils, constants} = require('@goatfishes/utils')

module.exports = async () => {
    const app = new Koa()

    /** 
     * Endpoint dedicated to return the health of the container when queried
     * 
     * @returns Code indicating the health, o lack thereof, of the container
     */
    app.use(route.get('/', async (ctx) => {

        utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Validating the payload`)
        ctx.checkPayload(ctx, 'empty')

        utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Strategy container is running`)
        ctx.status = 200
        ctx.body = {
            data: "OK"
        }
    }))

    return app
}
