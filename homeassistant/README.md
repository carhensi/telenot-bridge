# Home Assistant Integration for Telenot Bridge

This guide will help you set up `telenot-bridge` with Home Assistant. The integration uses Home Assistant's Alarm Control Panel component and publishes it to HomeKit for seamless integration with Apple devices. For controlling the device from within Home Assistant, the `ha_ema_dashboard.yaml` file provides a good starting point.

## Prerequisites

### Required HACS Custom Cards

The dashboard template (`ha_ema_dashboard.yaml`) requires the following HACS frontend integrations:

1. **button-card** - [GitHub](https://github.com/custom-cards/button-card)
2. **layout-card** - [GitHub](https://github.com/thomasloven/lovelace-layout-card)
3. **auto-entities** - [GitHub](https://github.com/thomasloven/lovelace-auto-entities)

Install these via HACS → Frontend before importing the dashboard.

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

### 3. Import the Dashboard (Optional)

To use the provided dashboard template:

1. Ensure all required HACS cards are installed (see Prerequisites)
2. In Home Assistant, go to Settings → Dashboards
3. Click "Add Dashboard" → "New dashboard from scratch"
4. Open the dashboard in edit mode (three dots → "Edit dashboard")
5. Click the three dots again → "Raw configuration editor"
6. Copy the contents of `ha_ema_dashboard.yaml` and paste it
7. Click "Save"

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