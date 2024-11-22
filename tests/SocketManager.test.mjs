import { jest, afterEach, describe, it, expect, beforeEach } from '@jest/globals'
import net from 'net'
import SocketManager from '../src/services/socket/SocketManager.mjs'

describe('SocketManager', () => {
    let mockLogger, mockConfig, socketManager, mockSocket, onData, onError, onClose

    beforeEach(() => {
        jest.useFakeTimers() // Enable fake timers explicitly
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        }

        mockConfig = {
            Connection: {
                telnetConfig: { host: '127.0.0.1', port: 1234 },
            },
        }

        mockSocket = {
            connect: jest.fn(),
            on: jest.fn(),
            write: jest.fn(),
            setTimeout: jest.fn(),
            end: jest.fn(),
            destroy: jest.fn(),
            destroyed: false,
        }

        jest.spyOn(net, 'Socket').mockImplementation(() => mockSocket)
        socketManager = new SocketManager(mockLogger, mockConfig)

        onData = jest.fn()
        onError = jest.fn()
        onClose = jest.fn()
    })

    afterEach(() => {
        jest.clearAllTimers() // Clear timers after each test
        jest.restoreAllMocks()
        jest.clearAllMocks()
        if (socketManager.reconnectTimeout) clearTimeout(socketManager.reconnectTimeout)
        jest.useRealTimers() // Restore real timers
    })

    describe('Constructor', () => {
        it('should throw an error if config is missing Connection.telnetConfig', () => {
            expect(() => new SocketManager(mockLogger, {})).toThrow(
                'Invalid config: missing Connection.telnetConfig',
            )
        })

        it('should initialize with correct default properties', () => {
            expect(socketManager.logger).toBe(mockLogger)
            expect(socketManager.config).toBe(mockConfig)
            expect(socketManager.socket).toBeNull()
            expect(socketManager.isConnected).toBe(false)
            expect(socketManager.reconnectAttempts).toBe(0)
            expect(socketManager.maxReconnectAttempts).toBe(5)
            expect(socketManager.reconnectInterval).toBe(5000)
        })
    })

    describe('createConnection', () => {
        let onData, onError, onClose

        beforeEach(() => {
            // Mock callback functions
            onData = jest.fn()
            onError = jest.fn()
            onClose = jest.fn()
        })

        it('should create a new socket and set up event listeners', () => {
            socketManager.createConnection(onData, onError, onClose)

            // Verify Socket constructor was called
            expect(net.Socket).toHaveBeenCalledTimes(1)

            // Verify socket.connect was called with correct parameters
            expect(mockSocket.connect).toHaveBeenCalledWith(
                mockConfig.Connection.telnetConfig.port,
                mockConfig.Connection.telnetConfig.host,
                expect.any(Function),
            )

            // Simulate successful connection
            const connectCallback = mockSocket.connect.mock.calls[0][2]
            connectCallback()

            // Verify logger and state updates
            expect(mockLogger.info).toHaveBeenCalledWith(
                `Connected to TCP converter at ${mockConfig.Connection.telnetConfig.host}:${mockConfig.Connection.telnetConfig.port}`,
            )
            expect(socketManager.isConnected).toBe(true)
            expect(socketManager.reconnectAttempts).toBe(0)

            // Verify event listeners are set up
            expect(mockSocket.on).toHaveBeenCalledWith('data', onData)
            expect(mockSocket.on).toHaveBeenCalledWith('error', expect.any(Function))
            expect(mockSocket.on).toHaveBeenCalledWith('close', expect.any(Function))
            expect(mockSocket.on).toHaveBeenCalledWith('timeout', expect.any(Function))

            // Verify socket timeout is set
            expect(mockSocket.setTimeout).toHaveBeenCalledWith(15000)

            // Verify socket is assigned
            expect(socketManager.socket).toBe(mockSocket)
        })
    })

    describe('Socket error handling', () => {
        it('should handle socket error by setting isConnected to false, calling onError, and invoking handleReconnect', () => {
            // Spy on handleReconnect to verify it gets called
            const handleReconnectSpy = jest.spyOn(socketManager, 'handleReconnect')

            // Create the connection to set up listeners
            socketManager.createConnection(onData, onError, onClose)

            // Simulate an error event
            const error = new Error('Socket error')
            const errorCallback = mockSocket.on.mock.calls.find((call) => call[0] === 'error')[1]
            errorCallback(error)

            // Assertions
            expect(socketManager.isConnected).toBe(false) // isConnected should be false
            expect(onError).toHaveBeenCalledWith(error) // onError callback should be called with the error
            expect(handleReconnectSpy).toHaveBeenCalled() // handleReconnect should be called
        })
    })

    describe('Socket timeout handling', () => {
        it('should handle socket timeout by logging warning, setting isConnected to false, ending socket, and calling handleReconnect', () => {
            // Spy on handleReconnect to verify it gets called
            const handleReconnectSpy = jest.spyOn(socketManager, 'handleReconnect')

            // Set up the connection to establish listeners
            socketManager.createConnection()

            // Verify setTimeout was called on the socket
            expect(mockSocket.setTimeout).toHaveBeenCalledWith(15000)

            // Trigger the "timeout" event manually
            const timeoutCallback = mockSocket.on.mock.calls.find(
                (call) => call[0] === 'timeout',
            )[1]
            timeoutCallback()

            // Assertions
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'Socket connection timed out. Ending connection...',
            )
            expect(socketManager.isConnected).toBe(false)
            expect(mockSocket.end).toHaveBeenCalled()
            expect(handleReconnectSpy).toHaveBeenCalled()
        })
    })

    describe('handleReconnect', () => {
        beforeEach(() => {
            jest.useFakeTimers()
            socketManager.createConnection = jest.fn()
        })

        afterEach(() => {
            jest.runOnlyPendingTimers()
            jest.clearAllTimers()
            jest.useRealTimers()
        })

        it('should clear existing reconnect timeout before setting a new one', () => {
            jest.spyOn(global, 'clearTimeout')

            // Simulate that reconnectTimeout is already set
            socketManager.reconnectTimeout = setTimeout(() => {}, 1000)

            // Capture the existing timeout handle before calling handleReconnect()
            const existingTimeout = socketManager.reconnectTimeout

            socketManager.handleReconnect()

            // Verify that clearTimeout was called with the previous timeout handle
            expect(clearTimeout).toHaveBeenCalledWith(existingTimeout)

            // Verify that a new reconnectTimeout has been set
            expect(socketManager.reconnectTimeout).not.toBe(existingTimeout)
            expect(socketManager.reconnectTimeout).toBeDefined()

            // Fast-forward time to trigger reconnection
            jest.advanceTimersByTime(socketManager.reconnectInterval)
            expect(socketManager.createConnection).toHaveBeenCalled()
        })

        it('should attempt to reconnect if below max attempts', () => {
            socketManager.reconnectAttempts = 2
            socketManager.handleReconnect()

            // Verify reconnection attempt count and logging
            expect(socketManager.reconnectAttempts).toBe(3)
            expect(mockLogger.info).toHaveBeenCalledWith(`Attempting to reconnect (3/5)...`)

            // Fast-forward time to trigger reconnection
            jest.advanceTimersByTime(socketManager.reconnectInterval)
            expect(socketManager.createConnection).toHaveBeenCalled()
        })

        it('should log an error if max attempts are reached', () => {
            socketManager.reconnectAttempts = socketManager.maxReconnectAttempts // Max attempts reached

            socketManager.handleReconnect()

            // Verify error logging
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Max reconnection attempts reached. Please check the connection manually.',
            )
        })
    })

    describe('sendData', () => {
        it('should send data through the socket when connected', async () => {
            // Set socket as connected
            socketManager.isConnected = true
            socketManager.socket = mockSocket

            // Mock successful write
            mockSocket.write.mockImplementation((data, callback) => callback())

            await socketManager.sendData('hello')

            // Verify data sent and logged
            expect(mockSocket.write).toHaveBeenCalledWith(
                Buffer.from('hello'),
                expect.any(Function),
            )
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `Data successfully written to socket: 68656c6c6f`,
            )
        })

        it('should send data through the socket when data is a Buffer', async () => {
            // Set socket as connected
            socketManager.isConnected = true
            socketManager.socket = mockSocket

            // Mock successful write
            mockSocket.write.mockImplementation((data, callback) => callback())

            const bufferData = Buffer.from('hello')

            await socketManager.sendData(bufferData)

            // Verify data sent and logged
            expect(mockSocket.write).toHaveBeenCalledWith(bufferData, expect.any(Function))
            expect(mockLogger.debug).toHaveBeenCalledWith(
                `Data successfully written to socket: 68656c6c6f`,
            )
        })

        it('should reject if socket is not connected', async () => {
            // Set socket as disconnected
            socketManager.isConnected = false
            socketManager.socket = null

            await expect(socketManager.sendData('hello')).rejects.toThrow('Socket is not connected')

            // Verify write was not called
            expect(mockSocket.write).not.toHaveBeenCalled()
            expect(mockLogger.debug).not.toHaveBeenCalled()
        })

        it('should handle write errors gracefully', async () => {
            // Set socket as connected
            socketManager.isConnected = true
            socketManager.socket = mockSocket

            const writeError = new Error('Write failed')

            // Mock write to invoke callback with error
            mockSocket.write.mockImplementation((data, callback) => callback(writeError))

            await expect(socketManager.sendData('hello')).rejects.toThrow('Write failed')

            // Verify error logging
            expect(mockLogger.error).toHaveBeenCalledWith(
                `Error writing data to socket: ${writeError}`,
            )
        })
    })

    describe('closeConnection', () => {
        it('should close the socket connection if it is open', () => {
            // Mock an open socket
            socketManager.socket = mockSocket
            mockSocket.destroyed = false

            socketManager.closeConnection()

            // Verify socket.destroy was called and state updated
            expect(mockSocket.destroy).toHaveBeenCalled()
            expect(socketManager.isConnected).toBe(false)
            expect(mockLogger.info).toHaveBeenCalledWith('Socket connection closed')
        })

        it('should clear reconnect timeout if it exists', () => {
            jest.spyOn(global, 'clearTimeout')

            // Simulate that reconnectTimeout is already set
            const existingTimeout = setTimeout(() => {}, 1000)
            socketManager.reconnectTimeout = existingTimeout

            // Mock an open socket
            socketManager.socket = mockSocket
            mockSocket.destroyed = false

            socketManager.closeConnection()

            // Verify that clearTimeout was called with the correct timeout handle
            expect(clearTimeout).toHaveBeenCalledWith(existingTimeout)

            // Verify socket.destroy was called and state updated
            expect(mockSocket.destroy).toHaveBeenCalled()
            expect(socketManager.isConnected).toBe(false)
            expect(mockLogger.info).toHaveBeenCalledWith('Socket connection closed')
        })

        it('should not attempt to close if the socket is already destroyed', () => {
            // Mock a destroyed socket
            socketManager.socket = mockSocket
            mockSocket.destroyed = true

            socketManager.closeConnection()

            // Verify destroy was not called
            expect(mockSocket.destroy).not.toHaveBeenCalled()
            expect(mockLogger.info).not.toHaveBeenCalled()
        })

        it('should not attempt to close if there is no socket', () => {
            // No socket present
            socketManager.socket = null

            socketManager.closeConnection()

            // Verify destroy was not called
            expect(mockSocket.destroy).not.toHaveBeenCalled()
            expect(mockLogger.info).not.toHaveBeenCalled()
        })
    })

    describe('SocketManager close event', () => {
        let onData, onError, onClose

        beforeEach(() => {
            // Mock callback functions
            onData = jest.fn()
            onError = jest.fn()
            onClose = jest.fn()

            // Re-create SocketManager for each test
            socketManager = new SocketManager(mockLogger, mockConfig)

            // Set up the socket connection
            socketManager.createConnection(onData, onError, onClose)
        })

        it('should handle the close event by setting isConnected to false, calling onClose, and invoking handleReconnect', () => {
            // Spy on handleReconnect to verify it gets called
            const handleReconnectSpy = jest.spyOn(socketManager, 'handleReconnect')

            // Simulate the close event on the mock socket
            const closeCallback = mockSocket.on.mock.calls.find((call) => call[0] === 'close')[1]
            closeCallback()

            // Assertions
            expect(socketManager.isConnected).toBe(false) // isConnected should be false
            expect(onClose).toHaveBeenCalled() // onClose callback should be called
            expect(handleReconnectSpy).toHaveBeenCalled() // handleReconnect should be called
        })
    })

    describe('getConnectionStatus', () => {
        it('should return true when connected', () => {
            socketManager.isConnected = true
            expect(socketManager.getConnectionStatus()).toBe(true)
        })

        it('should return false when not connected', () => {
            socketManager.isConnected = false
            expect(socketManager.getConnectionStatus()).toBe(false)
        })
    })
})
