const Koa = require('koa')
const route = require('koa-route')
const { utils, constants, db } = require('@goatfishes/utils')


module.exports = async () => {
    const app = new Koa()

    /**
     *  Get the margin for all the aggregated bots or any given, by reading from kafka
     * 
     * @returns an object that organises the margin of each bot by exchange
     */
    app.use(route.get('/', async (ctx) => {
        try {
            const exchangeList = []
            let marginResponseObject = {}

            utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Validating the payload`)
            ctx.checkPayload(ctx, 'empty')

            utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Detemine current day`)
            const today = new Date()
            const date = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`

            utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Initialise Kafka consumer`)
            const messages = await utils.consumer("margin")

            utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Processing Kafka response`)
            const updatedmarginResponseObject = await processMargin({ messages, exchangeList, date, marginResponseObject })
            marginResponseObject = updatedmarginResponseObject

            ctx.status = 200
            ctx.body = {
                data: {
                    marginResponseObject
                }
            }
        } catch (e) { throw new utils.ExceptionHandler(constants.RESPONSE_CODES.APPLICATION_ERROR, `Fatal error on margin retrieval : ${e}`) }
    }))

    return app
}

/**
 * Processes the messages read from kafka
 * 
 * @param {array} messaged Array containing all the unparse messages from kafka
 * @param {array} exchangeList List of all the exchanges the bots are using
 * @param {data} date ISO 8601 formated date
 * @param {object} marginResponseObject Empty object with the bots organised by exchanges 
 * 
 * @returns an object that organises the margin of each bot by exchange
 */
const processMargin = async (params) => {
    const { messages, exchangeList, date, marginResponseObject } = params

    for (let i = 0; i < messages.length; i += 1) {
        const parsedMessage = JSON.parse(messages[i].value)

        utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Update bot Margin`)
        await db.updateBotMargin([parsedMessage.data.amount, parsedMessage.botId])

        utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Log the Margin difference and price difference if it exists`)
        const currentMargin = await db.selectMargin([parsedMessage.data.amount, date])
        if (!currentMargin.length) {
            await db.insertMargin([parsedMessage.data.amount, parsedMessage.botId, date])
        }

        utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Build margin_response by grouping bots by their exchange`)
        if (!exchangeList.includes(parsedMessage.exchange)) {
            exchangeList.push(parsedMessage.exchange)
            const { exchange } = parsedMessage
            marginResponseObject[exchange] = []
            marginResponseObject[exchange].push({ botId: `${parsedMessage.botId}`, amount: `${parsedMessage.data.amount}`, date  })
        }
        else if (exchangeList.includes(parsedMessage.exchange)) {
            const { exchange } = parsedMessage
            marginResponseObject[exchange] = []
            marginResponseObject[exchange].push({ botId: `${parsedMessage.botId}`, amount: `${parsedMessage.data.amount}`, date })
        }
    }

    return marginResponseObject
}
