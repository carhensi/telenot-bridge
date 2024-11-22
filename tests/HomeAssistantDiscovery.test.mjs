// tests/HomeAssistantDiscovery.test.mjs

import { jest, afterEach } from '@jest/globals'
import HomeAssistantDiscovery from '../src/services/homeassistant/HomeAssistantDiscovery.mjs'

describe('HomeAssistantDiscovery', () => {
    let discovery
    let mockLogger
    let mockMqttHandler

    beforeEach(() => {
        // Mock the logger
        mockLogger = {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        }

        // Mock the MQTT handler
        mockMqttHandler = {
            isConnected: jest.fn().mockReturnValue(true),
            publish: jest.fn().mockResolvedValue(),
        }

        discovery = new HomeAssistantDiscovery(mockLogger, mockMqttHandler)
    })

    afterEach(() => {
        jest.clearAllMocks()
    })

    describe('publishDiscoveryMessages', () => {
        it('should publish discovery messages for valid sensors', async () => {
            const sensors = [
                {
                    name_ha: 'Sensor 1',
                    type: 'bewegungsmelder',
                    topic: 'home/sensor1',
                    location: 'Living Room',
                    hex: '01',
                },
                {
                    name_ha: 'Sensor 2',
                    type: 'rauchmelder',
                    topic: 'home/sensor2',
                    location: 'Kitchen',
                    hex: '02',
                },
            ]

            await discovery.publishDiscoveryMessages(sensors)

            // Expect isConnected to be called
            expect(mockMqttHandler.isConnected).toHaveBeenCalled()

            // Expect publish to be called twice
            expect(mockMqttHandler.publish).toHaveBeenCalledTimes(2)

            // Check that the correct topics were used
            expect(mockMqttHandler.publish).toHaveBeenCalledWith(
                'homeassistant/binary_sensor/telenot/living_room_bewegungsmelder_sensor_1/config',
                expect.any(String),
                { retain: true },
            )

            expect(mockMqttHandler.publish).toHaveBeenCalledWith(
                'homeassistant/binary_sensor/telenot/kitchen_rauchmelder_sensor_2/config',
                expect.any(String),
                { retain: true },
            )

            // Get the actual payloads
            const calls = mockMqttHandler.publish.mock.calls

            const call1 = calls.find(
                (call) =>
                    call[0] ===
                    'homeassistant/binary_sensor/telenot/living_room_bewegungsmelder_sensor_1/config',
            )
            const payload1 = JSON.parse(call1[1])

            const expectedPayload1 = {
                name: 'Sensor 1',
                unique_id: 'living_room_bewegungsmelder_sensor_1',
                device_class: 'motion',
                state_topic: 'home/sensor1',
                value_template: '{{ value_json.state }}',
                payload_on: 'ON',
                payload_off: 'OFF',
                icon: 'mdi:motion-sensor',
                json_attributes_topic: 'home/sensor1',
                json_attributes_template: '{{ value_json | tojson }}',
                device: {
                    identifiers: ['telenot_living_room'],
                    name: 'Living Room',
                    model: 'Telenot Alarm System',
                    manufacturer: 'Telenot',
                    suggested_area: 'Living Room',
                    hw_version: 'complex_system',
                    via_device: 'telenot_zentrale',
                },
                enabled_by_default: true,
            }

            expect(payload1).toEqual(expectedPayload1)

            // Similarly for payload2
            const call2 = calls.find(
                (call) =>
                    call[0] ===
                    'homeassistant/binary_sensor/telenot/kitchen_rauchmelder_sensor_2/config',
            )
            const payload2 = JSON.parse(call2[1])

            const expectedPayload2 = {
                name: 'Sensor 2',
                unique_id: 'kitchen_rauchmelder_sensor_2',
                device_class: 'smoke',
                state_topic: 'home/sensor2',
                value_template: '{{ value_json.state }}',
                payload_on: 'ON',
                payload_off: 'OFF',
                icon: 'mdi:smoke-detector',
                json_attributes_topic: 'home/sensor2',
                json_attributes_template: '{{ value_json | tojson }}',
                device: {
                    identifiers: ['telenot_kitchen'],
                    name: 'Kitchen',
                    model: 'Telenot Alarm System',
                    manufacturer: 'Telenot',
                    suggested_area: 'Kitchen',
                    hw_version: 'complex_system',
                    via_device: 'telenot_zentrale',
                },
                enabled_by_default: true,
            }

            expect(payload2).toEqual(expectedPayload2)
        })

        it('should handle sensors with missing required fields', async () => {
            const sensors = [
                {
                    name_ha: 'Valid Sensor',
                    type: 'bewegungsmelder',
                    topic: 'home/valid_sensor',
                    location: 'Hallway',
                    hex: '03',
                },
                {
                    name_ha: 'Invalid Sensor',
                    // Missing 'type'
                    topic: 'home/invalid_sensor',
                    location: 'Hallway',
                    hex: '04',
                },
            ]

            await discovery.publishDiscoveryMessages(sensors)

            // Expect warning about skipped sensors
            expect(mockLogger.warn).toHaveBeenCalledWith('Skipped 1 invalid sensors')

            // Expect publish to be called once
            expect(mockMqttHandler.publish).toHaveBeenCalledTimes(1)

            // Ensure the valid sensor was published
            expect(mockMqttHandler.publish).toHaveBeenCalledWith(
                expect.stringContaining('hallway_bewegungsmelder_valid_sensor'),
                expect.any(String),
                { retain: true },
            )
        })

        it('should wait for MQTT connection if not connected', async () => {
            jest.useFakeTimers()

            mockMqttHandler.isConnected.mockReturnValue(false)

            const sensors = [
                {
                    name_ha: 'Sensor 1',
                    type: 'bewegungsmelder',
                    topic: 'home/sensor1',
                    location: 'Living Room',
                    hex: '01',
                },
            ]

            const setTimeoutSpy = jest.spyOn(global, 'setTimeout')

            const publishPromise = discovery.publishDiscoveryMessages(sensors)

            // Advance timers to simulate the setTimeout
            jest.advanceTimersByTime(2000)

            // Allow any pending promises to resolve
            await publishPromise

            expect(mockLogger.info).toHaveBeenCalledWith('Waiting for MQTT connection...')
            expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000)

            setTimeoutSpy.mockRestore()
            jest.useRealTimers()
        })

        it('should handle publish errors gracefully', async () => {
            mockMqttHandler.publish.mockRejectedValue(new Error('Publish failed'))

            const sensors = [
                {
                    name_ha: 'Sensor 1',
                    type: 'bewegungsmelder',
                    topic: 'home/sensor1',
                    location: 'Living Room',
                    hex: '01',
                },
            ]

            await discovery.publishDiscoveryMessages(sensors)

            expect(mockLogger.error).toHaveBeenCalledWith(
                '     ⚠ Failed to publish sensor Sensor 1:',
                expect.any(Error),
            )
        })

        it('should throw and log error if discovery process fails', async () => {
            // Simulate an unexpected error
            const error = new Error('Unexpected error')
            mockMqttHandler.isConnected.mockImplementation(() => {
                throw error
            })

            const sensors = [
                {
                    name_ha: 'Sensor 1',
                    type: 'bewegungsmelder',
                    topic: 'home/sensor1',
                    location: 'Living Room',
                    hex: '01',
                },
            ]

            await expect(discovery.publishDiscoveryMessages(sensors)).rejects.toThrow(
                'Unexpected error',
            )

            expect(mockLogger.error).toHaveBeenCalledWith('Discovery process failed:', error)
        })

        it('should handle empty sensors array', async () => {
            const sensors = []

            await discovery.publishDiscoveryMessages(sensors)

            expect(mockLogger.info).toHaveBeenCalledWith(
                'Starting discovery process for 0 sensors...',
            )
            expect(mockLogger.info).toHaveBeenCalledWith('Found 0 locations to process')
            expect(mockLogger.info).toHaveBeenCalledWith('Discovery process completed successfully')
        })
    })

    describe('generateDeviceId', () => {
        it('should generate a device ID from location', () => {
            const deviceId = discovery.generateDeviceId('Living Room')
            expect(deviceId).toBe('telenot_living_room')
        })

        it('should handle special characters and uppercase letters', () => {
            const deviceId = discovery.generateDeviceId('My-Living Room!')
            expect(deviceId).toBe('telenot_my_living_room')
        })

        it('should handle locations with numbers', () => {
            const deviceId = discovery.generateDeviceId('Room 101')
            expect(deviceId).toBe('telenot_room_101')
        })
    })

    describe('generateEntityId', () => {
        it('should generate an entity ID from sensor', () => {
            const sensor = {
                name_ha: 'Window Sensor',
                type: 'magnetkontakt',
                location: 'Bedroom',
            }
            const entityId = discovery.generateEntityId(sensor)
            expect(entityId).toBe('bedroom_magnetkontakt_window_sensor')
        })

        it('should handle special characters and uppercase letters', () => {
            const sensor = {
                name_ha: 'Front Door!',
                type: 'Schliesskontakt',
                location: 'Main Entrance',
            }
            const entityId = discovery.generateEntityId(sensor)
            expect(entityId).toBe('main_entrance_schliesskontakt_front_door')
        })

        it('should handle sensors with "Telenot" prefix in name', () => {
            const sensor = {
                name_ha: 'Telenot Motion Detector',
                type: 'Bewegungsmelder',
                location: 'Hallway',
            }
            const entityId = discovery.generateEntityId(sensor)
            expect(entityId).toBe('hallway_bewegungsmelder_motion_detector')
        })

        it('should handle names and locations with numbers', () => {
            const sensor = {
                name_ha: 'Smoke Detector 2',
                type: 'Rauchmelder',
                location: 'Floor 1',
            }
            const entityId = discovery.generateEntityId(sensor)
            expect(entityId).toBe('floor_1_rauchmelder_smoke_detector_2')
        })
    })
})
