# Home Assistant Integration for Telenot Bridge

This guide will help you set up `telenot-bridge` with Home Assistant. The integration uses Home Assistant's Alarm Control Panel component and publishes it to HomeKit for seamless integration with Apple devices. For controlling the device from within Home Assistant, the `ha_ema_dashboard.yaml` file provides a good starting point.

## Configuration Steps

### 1. Configure the Alarm Control Panel in Home Assistant

Add the following configuration to your Home Assistant configuration:

```yaml
mqtt:
  alarm_control_panel:
    - name: "Alarmanlage"
      unique_id: telenot_alarm_panel
      state_topic: "telenot/alarm/state"
      command_topic: "telenot/alarm/command"
      payload_disarm: "DISARM"
      payload_arm_home: "ARM_HOME"
      payload_arm_away: "ARM_AWAY"
      payload_arm_night: "ARM_NIGHT"
```

### 2. Publish the device to HomeKit using Home Assistant Bridge

Add this configuration to enable HomeKit integration:

```yaml
homekit:
  - name: "HA Bridge"
    mode: bridge
    port: 51826
    filter:
      include_entities:
        - alarm_control_panel.alarmanlage
```

## Usage

Once configured, and having the bridge paired with your device, you can control your Telenot alarm system through:
- The Home Assistant interface
- Apple HomeKit (via iPhone, iPad, Mac, or HomePod)
- Custom dashboards using the provided `ha_ema_dashboard.yaml` template

## Troubleshooting

If you encounter issues with the MQTT connection, verify that:
- The MQTT broker is properly configured and running
- The topics match between telenot-bridge and Home Assistant
- The alarm states are being properly transmitted