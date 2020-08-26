const chai = require('chai')
const chaiHttp = require('chai-http')
const { expect } = chai
chai.use(chaiHttp)

const { main } = require('./api/app')
const { db, utils } = require('@goatfishes/utils')
const sleep = m => new Promise(r => setTimeout(r, m))

let server
const keys = {
    "apiKeyID": process.env.API_KEY_ID,
    "apiKeySecret": process.env.API_KEY_SECRET
}

describe('Bots API', () => {
    before(async () => {
        const app = await main()
        server = app.listen(3000)
    })

    after(() => {
        server.close()
    })

    describe('Healthcheck File', () => {
        describe('/healthcheck enpdoint', () => {
            describe('Should return the health of the container', async () => {
                before(async () => {
                    res = await chai
                        .request(server)
                        .get('/bot_manager/healthcheck')
                })

                it('Should return 200 when calling /healthcheck for the container', async () => {
                    expect(res).to.have.status(200)
                })

                it('Should return the correct message', () => {
                    expect(res.text).to.eql('{"data":"OK"}');
                })
            })
        })
    })

    describe('Management File', () => {
        describe('/upload endpoint', async () => {
            describe('upload a bot with the correct payload', async () => {
                let res
                before(async () => {
                    res = await chai
                        .request(server)
                        .post('/bot_manager/management/upload')
                        .set('content-type', 'application/json')
                        .send({
                            "botId": "defaultKeys",
                            "strategy":
                                `const strategy = async (params) => {
            let strategyObject = {
                execute: false						// Identifies whether we will be making an order
                , symbol: "XBTUSD"				// Identifies the asset that will be makin an order
                , leverage: "10"					// Identifies leverage used for the order
                , side: "Buy"						// Buy v. sell 
                , orderQty: "10"						// Amount of contracts
                , price: "755"						// Price at which to buy
                , orderType: "Limit"						// Always limit
                , timeInForce: "GoodTillCancel"						// Always goodTillCancelled
                , timestamp: null
            }
            if (params[params.length - 1].open < 977) {
                strategyObject.execute = true
                strategyObject.price = params[params.length - 1].open
                strategyObject.timestamp = params[params.length - 1].timestamp
            }
            else if (params[params.length - 1].open > 977) {
                strategyObject.execute = true
                strategyObject.price = params[params.length - 1].open
                strategyObject.side = "Sell"
                strategyObject.timestamp = params[params.length - 1].timestamp
            }
            return strategyObject
            }
            module.exports = { strategy }
            `
                            , "apiKeyId": keys.apiKeyID, "apiKeySecret": keys.apiKeySecret, "exchange": "bitmex", "portNumber": 3009, "assets": `["1mXBTUSD", "5mXBTUSD"]`
                        })
                })

                it('Should return 200 when calling /upload for the container', async () => {
                    expect(res).to.have.status(200)
                })

                it('Should return the correct message', () => {
                    expect(res.text).to.eql('{"data":{"botId":"defaultKeys","upload":"OK"}}');
                })

                it('Should persist a new bot to the database', async () => {
                    let tradePersistance = await db.selectBotByBotId(['defaultKeys'])
                    expect(tradePersistance[0].bot_id).to.eql('defaultKeys');
                })

                after(async () => {
                    await db.TruncateTables()
                })
            })
            describe('fail to upload a bot with empty payload', async () => {
                // Upload a new bot
                let res

                before(async () => {
                    res = await chai
                        .request(server)
                        .post('/bot_manager/management/upload')
                        .set('content-type', 'application/json')
                        .send({})
                })

                it('Should return 550 when calling /upload for the container', async () => {
                    expect(res).to.have.status(550)
                })

                after(async () => {
                    await db.TruncateTables()
                })
            })
        })

        describe('/initiliaze endpoint', async () => {
            var res
            const port = 3009
            describe('Should initialise a trading strategy by passing in the correct payload', async () => {
                before(async () => {
                    await db.insertBotKeys(["defaultKeys", keys, "bitmex"])
                    await db.insertBotStrategy(["defaultKeys", "", 0.0, 0.0, port, `["1mXBTUSD", "5mXBTUSD"]`, 'Stop'])

                    res = await chai
                        .request(server)
                        .post('/bot_manager/management/initiliaze')
                        .set('content-type', 'application/json')
                        .send({ "botId": "defaultKeys" })
                })

                it('Should succesfully call the /initiliaze endpoint', async () => {
                    expect(res).to.have.status(200)
                })

                it('Should return the correct message', () => {
                    expect(res.text).to.eql('{"data":{"botId":"defaultKeys","status":"Stop"}}');
                })

                it('Should return 200 when calling /healthcheck for the container', async () => {
                    await sleep(2500);
                    res = await chai
                        .request(`http://defaultKeys:${port}`)
                        .get('/healthcheck')

                    expect(res).to.have.status(200)
                })

                after(async () => {
                    await db.TruncateTables()
                })
            })

            describe('Should fail to intialise a trading strategy by passing in an empty payload', async () => {
                before(async () => {
                    await db.insertBotKeys(["defaultKeys", keys, "bitmex"])
                    await db.insertBotStrategy(["defaultKeys", "", 0.0, 0.0, port, `["1mXBTUSD", "5mXBTUSD"]`, 'Stop'])

                    res = await chai
                        .request(server)
                        .post('/bot_manager/management/initiliaze')
                        .set('content-type', 'application/json')
                        .send({})
                })

                it('Should succesfully call the /initiliaze endpoint', async () => {
                    expect(res).to.have.status(550)
                })

                after(async () => {
                    await db.TruncateTables()
                })
            })

            describe('Should fail to parse a payload thats not registered', async () => {
                before(async () => {
                    await db.insertBotKeys(["defaultKeeys", keys, "bitmex"])
                    await db.insertBotStrategy(["defaultKeys", "", 0.0, 0.0, port, `["1mXBTUSD", "5mXBTUSD"]`, 'Stop'])

                    res = await chai
                        .request(server)
                        .post('/bot_manager/management/initiliaze')
                        .set('content-type', 'application/json')
                        .send({ "botId": "defaultKeyzs" })
                })

                it('Should fail to call the /initiliaze endpoint with code 550', async () => {
                    expect(res).to.have.status(550)
                })

                after(async () => {
                    await db.TruncateTables()
                })
            })
        })
    })

    describe('Margin File', () => {
        describe('/ endpoint', async () => {
            describe('Pass all the correct parameter through kafka', async () => {
                let res
                let date

                before(async () => {
                    let topic = "margin"
                    await db.insertBotKeys(["defaultKeys", keys, "bitmex"])
                    await db.insertBotStrategy(["defaultKeys", "", 0.0, 0.0, 3009, null, 'Stop'])
                    await utils.kafkaProduce(topic, { "botId": "defaultKeys", "exchange": "bitmex", "data": { "account": 1180512, "currency": "XBt", "prevDeposited": 274515, "prevWithdrawn": 0, "prevTransferIn": 0, "prevTransferOut": 0, "prevAmount": 1308, "prevTimestamp": "2019-11-25T13:00:00.000Z", "deltaDeposited": 0, "deltaWithdrawn": 0, "deltaTransferIn": 0, "deltaTransferOut": 0, "deltaAmount": 0, "deposited": 274515, "withdrawn": 0, "transferIn": 0, "transferOut": 0, "amount": 1308, "pendingCredit": 0, "pendingDebit": 0, "confirmedDebit": 0, "timestamp": "2019-11-27T12:00:02.877Z", "addr": "3BMEXVK5Jypn8yS8sMZqNg6MtFWaQzwcta", "script": "534104220936c3245597b1513a9a7fe96d96facf1a840ee21432a1b73c2cf42c1810284dd730f21ded9d818b84402863a2b5cd1afe3a3d13719d524482592fb23c88a3410472225d3abc8665cf01f703a270ee65be5421c6a495ce34830061eb0690ec27dfd1194e27b6b0b659418d9f91baec18923078aac18dc19699aae82583561fefe541048a1c80f418e2e0ed444c7cf868094598a480303aec840f4895b207b813a8b700e0960a513f567724a7e467101a608c5b20be10de103010bb66fec4d0d2c8cb8b4104a24db5c0e8ed34da1fd3b6f9f797244981b928a8750c8f11f9252041daad7b2d95309074fed791af77dc85abdd8bb2774ed8d53379d28cd49f251b9c08cab7fc54ae", "withdrawalLock": [] } })
                    await utils.kafkaProduce(topic, { "botId": "defaultKeys", "exchange": "bitmex", "data": { "account": 1180512, "currency": "XBt", "prevDeposited": 274515, "prevWithdrawn": 0, "prevTransferIn": 0, "prevTransferOut": 0, "prevAmount": 1308, "prevTimestamp": "2019-11-25T12:00:00.000Z", "deltaDeposited": 0, "deltaWithdrawn": 0, "deltaTransferIn": 0, "deltaTransferOut": 0, "deltaAmount": 0, "deposited": 274515, "withdrawn": 0, "transferIn": 0, "transferOut": 0, "amount": 1308, "pendingCredit": 0, "pendingDebit": 0, "confirmedDebit": 0, "timestamp": "2019-11-26T12:00:02.877Z", "addr": "3BMEXVK5Jypn8yS8eMZqNg6MtFWaQzwcta", "script": "534104220936c3245597b1513a9a7fe96d96facf1a840ee21432a1b73c2cf42c1810284dd730f21ded9d818b84402863a2b5cd1afe3a3d13719d524482592fb23c88a3410472225d3abc8665cf01f703a270ee65be5421c6a495ce34830061eb0690ec27dfd1194e27b6b0b659418d9f91baec18923078aac18dc19699aae82583561fefe541048a1c80f418e2e0ed444c7cf868094598a480303aec840f4895b207b813a8b700e0960a513f567724a7e467101a608c5b20be10de103010bb66fec4d0d2c8cb8b4104a24db5c0e8ed34da1fd3b6f9f797244981b928a8750c8f11f9252041daad7b2d95309074fed791af77dc85abdd8bb2774ed8d53379d28cd49f251b9c08cab7fc54ae", "withdrawalLock": [] } })

                    res = await chai
                        .request(server)
                        .get('/bot_manager/margin')

                    date = res.body.data.marginResponseObject.bitmex[0].date
                })

                it('Should succesfully call the / endpoint', async () => {
                    it('Should return 200 when calling /orders/get for the container', async () => {
                        expect(res).to.have.status(200)
                    })
                })

                it('Should return the correct response', () => {
                    expect(res.body).to.have.property('data');
                    expect(res.body.data).to.have.property('marginResponseObject');
                    expect(res.body.data.marginResponseObject).to.have.property('bitmex');
                    expect(res.body.data.marginResponseObject.bitmex[0]).to.have.property('botId');
                    expect(res.body.data.marginResponseObject.bitmex[0]).to.have.property('amount');
                    expect(res.body.data.marginResponseObject.bitmex[0]).to.have.property('date');

                })

                it('Should persit the correct margin to the bots table', async () => {
                    let botInfo = await db.selectBotByBotId(['defaultKeys'])
                    expect(botInfo[0].margin).to.eql(1308);
                })

                it('Should persit the correct margin and date to the margin table', async () => {
                    let marginStats = await db.selectMargin([1308, date])

                    expect(marginStats[0].amount).to.eql(1308);
                })

                after(async () => {
                    await db.TruncateTables()
                })
            })

            describe('Pass all the a null botId through kafka', async () => {
                before(async () => {
                    let topic = "margin"
                    await db.insertBotKeys(["defaultKeys", keys, "bitmex"])
                    await db.insertBotStrategy(["defaultKeys", "", 0.0, 0.0, 3009, null, 'Stop'])

                    await utils.kafkaProduce(topic, '{"exchange":"bitmex","data":{"account":1180512,"currency":"XBt","prevDeposited":274515,"prevWithdrawn":0,"prevTransferIn":0,"prevTransferOut":0,"prevAmount":1308,"prevTimestamp":"2019-11-25T13:00:00.000Z","deltaDeposited":0,"deltaWithdrawn":0,"deltaTransferIn":0,"deltaTransferOut":0,"deltaAmount":0,"deposited":274515,"withdrawn":0,"transferIn":0,"transferOut":0,"amount":1308,"pendingCredit":0,"pendingDebit":0,"confirmedDebit":0,"timestamp":"2019-11-27T12:00:02.877Z","addr":"3BMEXVK5Jypn8yS8sMZqNg6MtFWaQzwcta","script":"534104220936c3245597b1513a9a7fe96d96facf1a840ee21432a1b73c2cf42c1810284dd730f21ded9d818b84402863a2b5cd1afe3a3d13719d524482592fb23c88a3410472225d3abc8665cf01f703a270ee65be5421c6a495ce34830061eb0690ec27dfd1194e27b6b0b659418d9f91baec18923078aac18dc19699aae82583561fefe541048a1c80f418e2e0ed444c7cf868094598a480303aec840f4895b207b813a8b700e0960a513f567724a7e467101a608c5b20be10de103010bb66fec4d0d2c8cb8b4104a24db5c0e8ed34da1fd3b6f9f797244981b928a8750c8f11f9252041daad7b2d95309074fed791af77dc85abdd8bb2774ed8d53379d28cd49f251b9c08cab7fc54ae","withdrawalLock":[]}}')

                    res = await chai
                        .request(server)
                        .get('/bot_manager/margin')
                })
            })
        })
    })

    describe('Orders File', () => {
        describe('/get endpoint', async () => {
            describe('Filled order status', async () => {
                var res
                before(async () => {
                    let topic = "orders"
                    await db.insertBotStrategy(["defaultKeys", "", 0.0, 0.0, 3009, null, 'Stop'])
                    await db.insertOrder(["defaultKeys", "bitmex", "ab7ae2nf-c828-76fc-3190-a35883804599", null, "2019-08-08T01:04:28.939Z", "Open", "Buy", 1000, 8000, 4000, 10, "Limit", null])
                    await utils.kafkaProduce(topic, { "bot_id": "defaultKeys", "exchange": "bitmex", "data": [{ "orderID": "ab7ae2nf-c828-76fc-3190-a35883804599", "clOrdID": "", "clOrdLinkID": "", "account": 1180512, "symbol": "XBTUSD", "side": "Sell", "simpleOrderQty": null, "orderQty": 100, "price": 11948, "displayQty": null, "stopPx": null, "pegOffsetValue": null, "pegPriceType": "", "currency": "USD", "settlCurrency": "XBt", "ordType": "Limit", "timeInForce": "GoodTillCancel", "execInst": "", "contingencyType": "", "exDestination": "XBME", "ordStatus": "Filled", "triggered": "", "workingIndicator": false, "ordRejReason": "", "simpleLeavesQty": null, "leavesQty": 0, "simpleCumQty": null, "cumQty": 100, "avgPx": 11949, "multiLegReportingType": "SingleSecurity", "text": "Submission from www.bitmex.com", "transactTime": "2019-08-08T01:04:28.939Z", "timestamp": "2019-08-08T01:04:28.939Z" }] })

                    res = await chai
                        .request(server)
                        .get('/bot_manager/orders/get')
                })

                it('Should return 200 when calling /orders/get for the container', async () => {
                    expect(res).to.have.status(200)
                })

                it('Should return the correct response', () => {
                    expect(res.body).to.have.property("data")
                    expect(res.body.data[0]).to.have.property("bot_id")
                    expect(res.body.data[0]).to.have.property("orders")
                    expect(res.body.data[0].orders).to.have.property("filled")
                    expect(res.body.data[0].orders).to.have.property("open")
                    expect(res.body.data[0].orders.filled[0]).to.have.property("bot_id")
                    expect(res.body.data[0].orders.filled[0]).to.have.property("exchange")
                    expect(res.body.data[0].orders.filled[0]).to.have.property("order_id")
                    expect(res.body.data[0].orders.filled[0]).to.have.property("position_ref")
                    expect(res.body.data[0].orders.filled[0]).to.have.property("_timestamp")
                    expect(res.body.data[0].orders.filled[0]).to.have.property("order_status")
                    expect(res.body.data[0].orders.filled[0]).to.have.property("side")
                    expect(res.body.data[0].orders.filled[0]).to.have.property("size")
                    expect(res.body.data[0].orders.filled[0]).to.have.property("_price")
                    expect(res.body.data[0].orders.filled[0]).to.have.property("margin")
                    expect(res.body.data[0].orders.filled[0]).to.have.property("leverage")
                    expect(res.body.data[0].orders.filled[0]).to.have.property("average_price")
                })

                it('Should perist a new order to the database', async () => {
                    let orderPersistance = await db.selectOrders()
                    expect(orderPersistance[0].order_id).to.eql('ab7ae2nf-c828-76fc-3190-a35883804599');
                })

                after(async () => {
                    await db.TruncateTables()
                })
            })

            describe('Open order status', async () => {
                var res
                before(async () => {
                    let topic = "orders"
                    await db.insertBotStrategy(["defaultKeys", "", 0.0, 0.0, 3009, null, 'Stop'])
                    await db.insertOrder(["defaultKeys", "bitmex", "ab7ae2nf-c828-76fc-3190-a35883804599", null, "2019-08-08T01:04:28.939Z", "Open", "Buy", 1000, 8000, 4000, 10, "Limit", null])
                    await db.insertOrder(["defaultKeys", "bitmex", "ab7ae2nf-c828-76fc-3190-a358838045e9", null, "2019-08-08T01:04:28.989Z", "Open", "Buy", 1000, 8000, 4000, 10, "Limit", null])
                    await db.insertOrder(["defaultKeys", "bitmex", "ab7ae2nf-c828-76fc-3190-a35883804589", null, "2019-08-08T01:04:28.989Z", "Open", "Buy", 1000, 8000, 4000, 10, "Limit", null])
                    await utils.kafkaProduce(topic, { "bot_id": "defaultKeys", "exchange": "bitmex", "data": [{ "orderID": "ab7ae2nf-c828-76fc-3190-a35883804599", "clOrdID": "", "clOrdLinkID": "", "account": 1180512, "symbol": "XBTUSD", "side": "Sell", "simpleOrderQty": null, "orderQty": 100, "price": 11948, "displayQty": null, "stopPx": null, "pegOffsetValue": null, "pegPriceType": "", "currency": "USD", "settlCurrency": "XBt", "ordType": "Limit", "timeInForce": "GoodTillCancel", "execInst": "", "contingencyType": "", "exDestination": "XBME", "ordStatus": "Open", "triggered": "", "workingIndicator": false, "ordRejReason": "", "simpleLeavesQty": null, "leavesQty": 0, "simpleCumQty": null, "cumQty": 100, "avgPx": 11949, "multiLegReportingType": "SingleSecurity", "text": "Submission from www.bitmex.com", "transactTime": "2019-08-08T01:04:28.939Z", "timestamp": "2019-08-08T01:04:28.939Z" }] })


                    res = await chai
                        .request(server)
                        .get('/bot_manager/orders/get')
                })

                it('Should return 200 when calling /orders/get for the container', async () => {
                    expect(res).to.have.status(200)
                })

                it('Should return the correct response', () => {
                    expect(res.body).to.have.property("data")
                    expect(res.body.data[0]).to.have.property("bot_id")
                    expect(res.body.data[0]).to.have.property("orders")
                    expect(res.body.data[0].orders).to.have.property("filled")
                    expect(res.body.data[0].orders).to.have.property("open")
                    expect(res.body.data[0].orders.open[0]).to.have.property("bot_id")
                    expect(res.body.data[0].orders.open[0]).to.have.property("exchange")
                    expect(res.body.data[0].orders.open[0]).to.have.property("order_id")
                    expect(res.body.data[0].orders.open[0]).to.have.property("position_ref")
                    expect(res.body.data[0].orders.open[0]).to.have.property("_timestamp")
                    expect(res.body.data[0].orders.open[0]).to.have.property("order_status")
                    expect(res.body.data[0].orders.open[0]).to.have.property("side")
                    expect(res.body.data[0].orders.open[0]).to.have.property("size")
                    expect(res.body.data[0].orders.open[0]).to.have.property("_price")
                    expect(res.body.data[0].orders.open[0]).to.have.property("margin")
                    expect(res.body.data[0].orders.open[0]).to.have.property("leverage")
                    expect(res.body.data[0].orders.open[0]).to.have.property("average_price")
                })

                it('Should perist a new order to the database', async () => {
                    let orderPersistance = await db.selectOrders()
                    expect(orderPersistance[0].order_id).to.eql('ab7ae2nf-c828-76fc-3190-a358838045e9');
                })

                after(async () => {
                    await db.TruncateTables()
                })
            })
        })
    })

    describe('Positions File', () => {
        describe('/ endpoint', async () => {
            describe('Type is null', async () => {
                var res

                before(async () => {
                    await db.insertBotStrategy(["defaultKeys", "", 0.0, 0.0, 3009, null, 'Stop'])
                    await db.insertOrder(["defaultKeys", "bitmex", "ab7ae2nf-c828-76fc-3190-a35883804599", null, "2019-08-08T01:04:28.939Z", "Filled", "Buy", 1000, 8000, 4000, 10, "Limit", 200])
                    await db.insertOrder(["defaultKeys", "bitmex", "ab7ae2nf-c824-76fc-3190-a35883804599", null, "2019-08-08T01:04:29.939Z", "Filled", "Sell", 1000, 8000, 4000, 10, "Limit", 200])

                    await db.insertOrder(["defaultKeys", "bitmex", "ab7ae2nf-c828-76fc-3190-a35883804599", null, "2019-08-08T01:04:28.939Z", "Filled", "Sell", 1000, 8000, 4000, 10, "Limit", 200])
                    await db.insertOrder(["defaultKeys", "bitmex", "ab7ae2nf-c824-76fc-3190-a35883804599", null, "2019-08-08T01:04:29.939Z", "Filled", "Buy", 1000, 8000, 4000, 10, "Limit", 200])

                    await db.insertOrder(["defaultKeys", "bitmex", "ab7ae2nf-c824-76fc-3190-a35883804599", null, "2019-08-08T01:04:29.939Z", "Filled", "Buy", 1000, 8000, 4000, 10, "Limit", 200])
                    await db.insertOrder(["defaultKeys", "bitmex", "ab7ae2nf-c828-76fc-3190-a35883804599", null, "2019-08-08T01:04:28.939Z", "Filled", "Buy", 1000, 8000, 4000, 10, "Limit", 200])
                    await db.insertOrder(["defaultKeys", "bitmex", "ab7ae2nf-c824-76fc-3190-a35883804599", null, "2019-08-08T01:04:29.939Z", "Filled", "Sell", 2000, 8000, 8000, 10, "Limit", 200])

                    await db.insertOrder(["defaultKeys", "bitmex", "ab7ae2nf-c824-76fc-3190-a35883804599", null, "2019-08-08T01:04:29.939Z", "Filled", "Sell", 1000, 8000, 4000, 10, "Limit", 200])
                    await db.insertOrder(["defaultKeys", "bitmex", "ab7ae2nf-c824-76fc-3190-a35883804599", null, "2019-08-08T01:04:29.939Z", "Filled", "Sell", 1000, 8000, 4000, 10, "Limit", 200])
                    await db.insertOrder(["defaultKeys", "bitmex", "ab7ae2nf-c824-76fc-3190-a35883804599", null, "2019-08-08T01:04:29.939Z", "Filled", "Buy", 2000, 8000, 8000, 10, "Limit", 200])

                    res = await chai
                        .request(server)
                        .get('/bot_manager/positions?type=null')
                })

                it('Should return 200 when calling /orders/get for the container', async () => {
                    expect(res).to.have.status(200)
                })

                it('Should return the correct response', () => {
                    expect(res.body).to.have.property("data")
                    expect(res.body.data[0]).to.have.property("botId")
                    expect(res.body.data[0]).to.have.property("positions")
                    expect(res.body.data[0].positions).to.have.property("long")
                    expect(res.body.data[0].positions).to.have.property("short")
                    expect(res.body.data[0].positions.long[0]).to.have.property("position_id")
                    expect(res.body.data[0].positions.long[0]).to.have.property("bot_id")
                    expect(res.body.data[0].positions.long[0]).to.have.property("entry_price")
                    expect(res.body.data[0].positions.long[0]).to.have.property("init_margin")
                    expect(res.body.data[0].positions.long[0]).to.have.property("start_time")
                    expect(res.body.data[0].positions.long[0]).to.have.property("end_time")
                    expect(res.body.data[0].positions.long[0]).to.have.property("side")
                    expect(res.body.data[0].positions.long[0]).to.have.property("size")
                    expect(res.body.data[0].positions.long[0]).to.have.property("profit_loss")
                    expect(res.body.data[0].positions.long[0]).to.have.property("roe")
                    expect(res.body.data[0].positions.long[0]).to.have.property("leverage")
                    expect(res.body.data[0].positions.long[0]).to.have.property("average_price")
                })

                it('Should perist the new position_id to orders table in the databse', async () => {
                    let orderPersistance = await db.selectPaperOrders()
                    for (let i = 0; i < orderPersistance.length; i++) {
                        expect(orderPersistance[i].position_ref).to.not.be.null;
                    }
                })

                it('Should perist a new position to the database', async () => {
                    let positionPersistance = await db.selectPaperPositions()
                    for (let i = 0; i < positionPersistance.length; i++) {
                        expect(positionPersistance[i].position_id).to.not.be.null;
                    }
                })

                after(async () => {
                    await db.TruncateTables()
                })
            })

            describe('Type is paperTrade', async () => {
                let res
                before(async () => {
                    await db.insertPaperOrder(["defaultKeys", "bitmex", "ab7ae2nf-c828-76fc-3190-a35883804599", null, "2019-08-08T01:04:28.939Z", "Filled", "Sell", 1000, 8000, 4000, 10, "Limit", 200])
                    await db.insertPaperOrder(["defaultKeys", "bitmex", "ab7ae2nf-c824-76fc-3190-a35883804599", null, "2019-08-08T01:04:29.939Z", "Filled", "Buy", 1000, 8000, 4000, 10, "Limit", 200])
                    res = await chai
                        .request(server)
                        .get('/bot_manager/positions?type=paperTrade')
                })

                it('Should return 200 when calling /orders/get for the container', async () => {
                    expect(res).to.have.status(200)
                })

                it('Should return the correct response', () => {
                    expect(res.body).to.have.property("data")
                    expect(res.body.data[0]).to.have.property("botId")
                    expect(res.body.data[0]).to.have.property("positions")
                    expect(res.body.data[0].positions).to.have.property("long")
                    expect(res.body.data[0].positions).to.have.property("short")
                    expect(res.body.data[0].positions.short[0]).to.have.property("position_id")
                    expect(res.body.data[0].positions.short[0]).to.have.property("bot_id")
                    expect(res.body.data[0].positions.short[0]).to.have.property("entry_price")
                    expect(res.body.data[0].positions.short[0]).to.have.property("init_margin")
                    expect(res.body.data[0].positions.short[0]).to.have.property("start_time")
                    expect(res.body.data[0].positions.short[0]).to.have.property("end_time")
                    expect(res.body.data[0].positions.short[0]).to.have.property("side")
                    expect(res.body.data[0].positions.short[0]).to.have.property("size")
                    expect(res.body.data[0].positions.short[0]).to.have.property("profit_loss")
                    expect(res.body.data[0].positions.short[0]).to.have.property("roe")
                    expect(res.body.data[0].positions.short[0]).to.have.property("leverage")
                    expect(res.body.data[0].positions.short[0]).to.have.property("average_price")
                })

                it('Should perist the new position_id to orders table in the databse', async () => {
                    let orderPersistance = await db.selectPaperOrders()
                    for (let i = 0; i < orderPersistance.length; i++) {
                        expect(orderPersistance[i].position_ref).to.not.be.null;
                    }
                })

                it('Should perist a new position to the database', async () => {
                    let positionPersistance = await db.selectPaperPositions()
                    for (let i = 0; i < positionPersistance.length; i++) {
                        expect(positionPersistance[i].position_id).to.not.be.null;
                    }
                })
                after(async () => {
                    await db.TruncateTables()
                })
            })
        })
    })
})



