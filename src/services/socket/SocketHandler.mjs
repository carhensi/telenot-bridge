import config from '../../config/config.mjs'

// Confirmation ACK
const CONF_ACK = Buffer.from('6802026800020216', 'hex')

// Telenot Message Type Enumeration
const TelenotMsgType = {
    SEND_NORM: 0,
    MP: 2,
    SB: 3,
    CONF_ACK: 4,
    SYS_INT_ARMED: 5,
    SYS_EXT_ARMED: 6,
    SYS_DISARMED: 7,
    ALARM: 8,
    INVALID: 23,
    SEND_NDAT: 25,
    INTRUSION: 9,
    BATTERY_MALFUNCTION: 10,
    POWER_OUTAGE: 11,
    OPTICAL_FLASHER_MALFUNCTION: 12,
    HORN_1_MALFUNCTION: 13,
    HORN_2_MALFUNCTION: 14,
    COM_FAULT: 15,
    RESTART: 16,
    // Discovery related
    USED_INPUTS: 17,
    USED_OUTPUTS: 18,
    USED_CONTACTS_INFO: 19,
    USED_OUTPUT_CONTACTS_INFO: 20,
    USED_SB_CONTACTS_INFO: 21,
    USED_MB_CONTACTS_INFO: 22,
    NOT_USED_CONTACT: 26,
}

// Reverse mapping for message type names
const MSG_TYPE_NAME = {}
Object.keys(TelenotMsgType).forEach((key) => {
    MSG_TYPE_NAME[TelenotMsgType[key]] = key
})

// START_TO_MSG_TYPE mapping for quick lookup
const START_TO_MSG_TYPE = {
    68020268: TelenotMsgType.SEND_NORM,
    '682C2C68': TelenotMsgType.MP,
}

/**
 * Handles socket communication for the Telenot system.
 */
class SocketHandler {
    static readyToSendData = {
        value: false,
        set(newValue) {
            this.value = newValue
        },
        get() {
            return this.value
        },
    }

    constructor(logger, telenot, socketManager, virtualStateHandler) {
        if (!virtualStateHandler) {
            throw new Error('VirtualStateHandler is required')
        }

        this.logger = logger
        this.telenot = telenot
        this.socketManager = socketManager
        this.virtualStateHandler = virtualStateHandler
    }

    /**
     * Determines the message type based on a hex string.
     * @param {string} hexStr - The hexadecimal string to analyze.
     * @returns {number} The message type.
     */
    getMsgType(hexStr) {
        // Prioritize full string matching
        const msgTypeFull = this.matchHexStrToMsgType(hexStr)
        if (msgTypeFull !== null) {
            return msgTypeFull
        }

        // Fallback to substring-based mapping
        const msgType = START_TO_MSG_TYPE[hexStr.substring(0, 8)]
        return msgType !== undefined ? msgType : TelenotMsgType.INVALID
    }

    /**
     * Matches a hexadecimal string to a specific message type.
     * @param {string} hexStr - The hexadecimal string to match.
     * @returns {number|null} The matched message type or null if no match is found.
     */
    matchHexStrToMsgType(hexStr) {
        // System operation messages
        if (/^6802026840024216/.test(hexStr)) {
            return TelenotMsgType.SEND_NORM
        }
        if (/^6802026800020216/.test(hexStr)) {
            return TelenotMsgType.CONF_ACK
        }

        // MP and SB messages
        if (/^68[0-9A-Fa-f]{4}687302[0-9A-Fa-f]{2}2400000001.*16$/.test(hexStr)) {
            return TelenotMsgType.MP
        }
        if (/^68[0-9A-Fa-f]{4}687302[0-9A-Fa-f]{2}2400050002.*16$/.test(hexStr)) {
            return TelenotMsgType.SB
        }

        // System state messages
        if (/^682[c|C]2[c|C]68730205020005310162/.test(hexStr)) {
            return TelenotMsgType.SYS_INT_ARMED
        }
        if (/^682[c|C]2[c|C]68730205020005320161/.test(hexStr)) {
            return TelenotMsgType.SYS_EXT_ARMED
        }
        if (/^682[c|C]2[c|C]687302050200053001[e|E]1/.test(hexStr)) {
            return TelenotMsgType.SYS_DISARMED
        }

        // pattern for alarm external
        if (/^682[c|C]2[c|C]6873020502000540/.test(hexStr)) {
            return TelenotMsgType.ALARM
        }

        // pattern for alarm internal
        if (/^683[c|C]3[c|C]6873020502010028/.test(hexStr)) {
            return TelenotMsgType.ALARM
        }

        // pattern for water/sensor alarms
        if (/^68[0-9A-Fa-f]{2}[0-9A-Fa-f]{2}687302050201002b/.test(hexStr)) {
            return TelenotMsgType.ALARM
        }

        // Malfunction messages (from Java's START_TO_MSG_TYPE map)
        if (/^682[C|c]2[C|c]687302050201001001/.test(hexStr)) {
            return TelenotMsgType.INTRUSION
        }
        if (/^681[A|a]1[A|a]687302050200001401/.test(hexStr)) {
            return TelenotMsgType.BATTERY_MALFUNCTION
        }
        if (/^681[A|a]1[A|a]687302050200001501/.test(hexStr)) {
            return TelenotMsgType.POWER_OUTAGE
        }
        if (/^681[A|a]1[A|a]687302050200001301/.test(hexStr)) {
            return TelenotMsgType.OPTICAL_FLASHER_MALFUNCTION
        }
        if (/^681[A|a]1[A|a]687302050200001101/.test(hexStr)) {
            return TelenotMsgType.HORN_1_MALFUNCTION
        }
        if (/^681[A|a]1[A|a]687302050200001201/.test(hexStr)) {
            return TelenotMsgType.HORN_2_MALFUNCTION
        }
        if (/^681[A|a]1[A|a]687302050200001701/.test(hexStr)) {
            return TelenotMsgType.COM_FAULT
        }

        // System messages
        if (/^68[0-9A-Fa-f]{4}687302[0-9A-Fa-f]{2}[0-9A-Fa-f]{4}([F|f]{4})0153.*16$/.test(hexStr)) {
            return TelenotMsgType.RESTART
        }
        if (/^68..68730/.test(hexStr)) {
            return TelenotMsgType.SEND_NDAT
        }

        return null
    }

    /**
     * Publishes to MQTT topics and logs success or error.
     * @param {string} topic - The MQTT topic.
     * @param {string} message - The message to publish.
     * @returns {Promise<void>} Resolves when publish is complete.
     */
    publishToMQTT(topic, message) {
        const publishOptions = { retain: true }
        return this.telenot.mqttHandler
            .publish(topic, message, publishOptions)
            .then(() => this.logger.info(`Published '${message}' to ${topic}`))
            .catch((error) => this.logger.error(`Failed to publish to ${topic}: ${error}`))
    }

    /**
     * Parses and responds to received data.
     * @param {string} hexStr - Hexadecimal string representation of data.
     * @param {Buffer} hex - Raw data buffer.
     * @returns {Buffer|null} Response to send back, or null if no response is needed.
     */
    async parseData(hexStr, hex) {
        const msgType = this.getMsgType(hexStr)
        this.logger.debug(`Parsed msgType: ${msgType} (${MSG_TYPE_NAME[msgType] || 'UNKNOWN'})`)

        switch (msgType) {
            case TelenotMsgType.SEND_NORM:
                return CONF_ACK

            case TelenotMsgType.CONF_ACK:
                this.logger.debug('Confirmation ACK received.')
                SocketHandler.readyToSendData.set(false)
                return CONF_ACK

            case TelenotMsgType.MP:
                this.telenot.decodeHex(hex, config.Telenot.MELDEGRUPPEN.name)
                return CONF_ACK

            case TelenotMsgType.SB:
                this.telenot.decodeHex(hex, config.Telenot.MELDEBEREICHE.name)
                SocketHandler.readyToSendData.set(true)
                return CONF_ACK

            case TelenotMsgType.SYS_INT_ARMED:
                const stateToPublish = this.virtualStateHandler.mapToExternalState('armed_home')
                await this.publishToMQTT(config.Connection.mqttConfig.stateTopic, stateToPublish)
                await this.publishToMQTT(
                    `${config.Connection.mqttConfig.diagnosticsTopic}/state`,
                    JSON.stringify({
                        state: stateToPublish,
                        internalState: 'armed_home',
                        timestamp: new Date().toISOString(),
                        isVirtualMode: stateToPublish === 'armed_night',
                        virtualType: stateToPublish === 'armed_night' ? 'night_mode' : null,
                    }),
                )
                return CONF_ACK

            case TelenotMsgType.SYS_DISARMED:
                this.virtualStateHandler.resetVirtualModes()
                await this.publishToMQTT(config.Connection.mqttConfig.stateTopic, 'disarmed')
                await this.publishToMQTT(
                    `${config.Connection.mqttConfig.diagnosticsTopic}/state`,
                    JSON.stringify({
                        state: 'disarmed',
                        timestamp: new Date().toISOString(),
                    }),
                )
                return CONF_ACK

            case TelenotMsgType.SYS_EXT_ARMED:
                await this.publishToMQTT(config.Connection.mqttConfig.stateTopic, 'armed_away')
                await this.publishToMQTT(
                    `${config.Connection.mqttConfig.diagnosticsTopic}/state`,
                    JSON.stringify({
                        state: 'armed_away',
                        timestamp: new Date().toISOString(),
                        type: 'external',
                    }),
                )
                return CONF_ACK

            case TelenotMsgType.ALARM:
                await this.publishToMQTT(config.Connection.mqttConfig.stateTopic, 'triggered')
                await this.publishToMQTT(
                    `${config.Connection.mqttConfig.diagnosticsTopic}/alarm`,
                    JSON.stringify({
                        state: 'triggered',
                        timestamp: new Date().toISOString(),
                        type: 'alarm',
                    }),
                )
                return CONF_ACK

            // New message types from Java implementation
            case TelenotMsgType.INTRUSION:
                await this.publishToMQTT(
                    `${config.Connection.mqttConfig.diagnosticsTopic}/intrusion`,
                    JSON.stringify({
                        state: 'triggered',
                        timestamp: new Date().toISOString(),
                        type: 'intrusion',
                    }),
                )
                return CONF_ACK

            case TelenotMsgType.BATTERY_MALFUNCTION:
                await this.publishToMQTT(
                    `${config.Connection.mqttConfig.diagnosticsTopic}/battery`,
                    JSON.stringify({
                        state: 'malfunction',
                        timestamp: new Date().toISOString(),
                    }),
                )
                return CONF_ACK

            case TelenotMsgType.POWER_OUTAGE:
                await this.publishToMQTT(
                    `${config.Connection.mqttConfig.diagnosticsTopic}/power`,
                    JSON.stringify({
                        state: 'outage',
                        timestamp: new Date().toISOString(),
                    }),
                )
                return CONF_ACK

            case TelenotMsgType.OPTICAL_FLASHER_MALFUNCTION:
                await this.publishToMQTT(
                    `${config.Connection.mqttConfig.diagnosticsTopic}/flasher`,
                    JSON.stringify({
                        state: 'malfunction',
                        timestamp: new Date().toISOString(),
                    }),
                )
                return CONF_ACK

            case TelenotMsgType.HORN_1_MALFUNCTION:
            case TelenotMsgType.HORN_2_MALFUNCTION:
                const hornNumber = msgType === TelenotMsgType.HORN_1_MALFUNCTION ? 1 : 2
                await this.publishToMQTT(
                    `${config.Connection.mqttConfig.diagnosticsTopic}/horn${hornNumber}`,
                    JSON.stringify({
                        state: 'malfunction',
                        timestamp: new Date().toISOString(),
                    }),
                )
                return CONF_ACK

            case TelenotMsgType.COM_FAULT:
                await this.publishToMQTT(
                    `${config.Connection.mqttConfig.diagnosticsTopic}/communication`,
                    JSON.stringify({
                        state: 'fault',
                        timestamp: new Date().toISOString(),
                    }),
                )
                return CONF_ACK

            case TelenotMsgType.RESTART:
                this.logger.info('System restart detected')
                await this.publishToMQTT(
                    `${config.Connection.mqttConfig.diagnosticsTopic}/restart`,
                    JSON.stringify({
                        state: 'restart',
                        timestamp: new Date().toISOString(),
                    }),
                )
                return CONF_ACK

            default:
                if (this.logger && config.Discover) {
                    this.logger.discover('--- Discovery Detection ---')
                    this.logger.discover(`Unknown Message Type: ${hexStr}`)
                } else {
                    this.logger.warn(`Unknown Message Type: ${hexStr}`)
                }
                return CONF_ACK
        }
    }

    /**
     * Handles incoming data from the socket connection.
     * @param {Buffer} data - The raw data received from the socket.
     */
    async handleData(data) {
        if (!this.socketManager.getConnectionStatus()) {
            this.logger.error('Attempted to handle data on a closed socket')
            return
        }

        const hexStr = data.toString('hex')
        this.logger.debug(`Processing hex string: ${hexStr}`)

        try {
            const sendBack = await this.parseData(hexStr, data)
            if (sendBack) {
                this.logger.debug(`Sending response: ${sendBack.toString('hex')}`)
                await this.socketManager.sendData(sendBack)
            }
        } catch (error) {
            this.logger.error(`Error handling data: ${error}`)
        }
    }
}

export default SocketHandler
