const Koa = require('koa')
const route = require('koa-route')
const { utils, constants, db } = require('@goatfishes/utils')

module.exports = async () => {
    const app = new Koa()

    /**
     * Get the orders for all the aggregated bots or any given id, by reading from kafka
     */
    app.use(route.get('/get', async (ctx) => {
        try {
            const ordersId = []

            utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Validating the payload`)
            ctx.checkPayload(ctx, 'empty')

            utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Fetching all orders from the database`)
            const orderInfo = await db.selectOrders()
            for (let i = 0; i < orderInfo.length; i += 1) {
                ordersId.push(orderInfo[i].order_id)
            }

            utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Initialising Kafka consumer`)
            const messages = await utils.consumer("orders")

            utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Processing Kafka respose`)
            await processOrder({ messages, orderInfo, ordersId })

            const updatedOrderInfo = await db.selectOrders()

            utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Building response object`)
            let botPosition
            const botSet = []
            const orderSet = []
            for (let i = 0; i < updatedOrderInfo.length; i += 1) {
                if (!botSet.includes(updatedOrderInfo[i].botId)) {
                    botSet.push(updatedOrderInfo[i].botId)
                    botPosition = botSet.indexOf(updatedOrderInfo[i].botId);
                    orderSet.push({ bot_id: updatedOrderInfo[i].bot_id, orders: { open: [], filled: [] } })

                    if (updatedOrderInfo[i].order_status === "Filled") {
                        orderSet[botPosition].orders.filled.push(updatedOrderInfo[i])
                    }
                    else if (updatedOrderInfo[i].order_status === "Open") {
                        orderSet[botPosition].orders.open.push(updatedOrderInfo[i])
                    }
                }
                else if (botSet.includes(updatedOrderInfo[i].botId)) {
                    botPosition = botSet.indexOf(updatedOrderInfo[i].botId);
                    if (orderInfo[i].order_status === "Filled") {
                        orderSet[botPosition].orders.filled.push(updatedOrderInfo[i])
                    }
                    else if (updatedOrderInfo[i].order_status === "Open") {
                        orderSet[botPosition].orders.open.push(updatedOrderInfo[i])
                    }
                }
            }
            ctx.status = 200
            ctx.body = {
                data: orderSet
            }
        } catch (e) { throw new utils.ExceptionHandler(constants.RESPONSE_CODES.APPLICATION_ERROR, `Fatal error on order retrieval : ${e}`) }
    }))

    return app
}

const processOrder = async (params) => {
    const { messages, ordersId, orderInfo } = params
    utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Parsing kafka messages`)
    for (let i = 0; i < messages.length; i += 1) {
        const orderObject = JSON.parse(messages[i].value)

        // We dont add orders here, since this is meant exclusively as a getter 
        // For reference orders should be added to the table **exclusively** when they are sent to the exchange
        for (let j = 0; j < orderObject.data.length; j += 1) {
            if ((ordersId.includes(orderObject.data[j].orderID)) && (orderObject.data[j].ordStatus !== orderInfo[j].order_status)) {
                utils.logEvent(constants.LOG_LEVELS.info, constants.RESPONSE_CODES.LOG_MESSAGE_ONLY, `Updating orders table`)
                await db.updateOrderStatus([orderObject.data[j].ordStatus, orderObject.data[j].orderID])
            }
        }
    }
}
