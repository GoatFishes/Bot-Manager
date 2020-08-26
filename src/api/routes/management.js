const fs = require('fs');
const Koa = require('koa')
const route = require('koa-route')
const { exec } = require('child_process');
const { utils, constants, db } = require('@goatfishes/utils')

module.exports = async () => {
    const app = new Koa()

    /**
     * Uploads all the information require to bring up a bot
     * 
     * @param {string} botId Unique name for the bot
     * @param {string} strategy Strategy the bot should execute. 
     * @param {string} apiKeyId Key id for the API
     * @param {string} apiKeySecret Secret for the API
     * @param {string} exchange Exchange the api keys belong to
     * @param {string} portNumber Port the bot will be accessible at
     * @param {string} pair An array of strings specifying the time_frame-pair this bot will watch. Defaults to all. Strings should be structured like 1mXBTUSD[time_framePair].
     * 
     * @returns Returns a sucess message and the botId created
     */
    app.use(route.post('/upload', async (ctx) => {
        try {
            utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Validating the payload`)
            const payload = ctx.checkPayload(ctx, 'upload')
            const { pair, portNumber, exchange, apiKeySecret, apiKeyID, strategy, botId } = payload

            utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Inserting bot keys into the database`)
            const key = { apiKeyID, apiKeySecret }
            await db.insertBotKeys([botId, key, exchange])

            utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Uploading a new bot strategy`)
            await db.insertBotStrategy([botId, strategy, 0.0, 0.0, portNumber, pair, "Stop"])

            utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Copy startegy into a js file`)
            await fs.writeFile(`/usr/src/app/strategies/${botId}.js`, strategy, function (err) {
                if (err) { throw new utils.ExceptionHandler(constants.RESPONSE_CODES.APPLICATION_ERROR, `Fatal error copying the file :  + ${err}`) }
            });

            ctx.status = 200
            ctx.body = {
                data: {
                    botId,
                    upload: "OK"
                }
            }
        } catch (e) { throw new utils.ExceptionHandler(constants.RESPONSE_CODES.APPLICATION_ERROR, `UPLOAD ISSUE :  + ${e}`) }
    }))

    /**
     * Bring up a bot container 
     * 
     * @param {string} botId Unique name for the bot 
     * 
     * @returns Returns a sucess message, the botId and the status of the strategy - always "Stop" at this stage
     */
    app.use(route.post('/initiliaze', async (ctx) => {
        try {
            utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Validating the payload`)
            const { botId } = ctx.checkPayload(ctx, 'execute')

            utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Retrieving the API keys for a given Bot`)
            const botInfo = await db.selectBotByBotId([botId])
            const { pair } = botInfo[0]
            const PORT = botInfo[0].port_n
            const PAIR = pair.join()

            utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Setting up containerised bot`)
            exec(`curl --unix-socket /var/run/docker.sock -H "Content-Type: application/json" -d '{ "Image": "lucasxhy/strategy_baseline:latest", "ExposedPorts": { "${PORT}/tcp": {} }, "HostConfig": { "Binds": ["${process.env.CURRENT_PATH}/src/api/strategies/${botId}.js:/usr/src/app/strategies/${botId}.js"], "NetworkMode": "goatFish_backend", "PortBindings": { "${PORT}/tcp": [{ "HostPort": "${PORT}" }]}}, "Env": ["BOTNAME=${botId}", "PORT=${PORT}", "PAIR=${PAIR}"]}' -X POST http:/v1.4/containers/create?name=${botId}`,
                (err) => {
                    if (err) {
                        // empty
                    }
                    exec(`curl --unix-socket /var/run/docker.sock -X POST http:/v1.4/containers/${botId}/start`, (error) => {
                        if (error) {
                            // empty
                        }
                    });
                });

            ctx.status = 200
            ctx.body = {
                data: {
                    botId,
                    status: "Stop"
                }
            }
        } catch (e) { throw new utils.ExceptionHandler(constants.RESPONSE_CODES.APPLICATION_ERROR, `Initialization fatal error : ${e}`) }
    }))

    return app
}
