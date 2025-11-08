# Configuration Guide

This directory contains example configurations for the Telenot Bridge. Copy this entire directory to `src/config` and customize it for your setup.

## Telenot Terminology

Understanding the different configuration sections:

### SICHERUNGSBEREICH (Security Area 1)

Main arming modes for your alarm system:

- **Extern scharf** (Armed Away) - Full system armed
- **Unscharf** (Disarmed) - System off

### SICHERUNGSBEREICH2 (Security Area 2)

Additional arming modes:

- **Intern scharf** (Armed Home) - Partial arming (e.g., perimeter only)
- **Nacht** (Night mode) - Custom night mode

### MELDEBEREICHE (Status Areas)

System-wide status indicators:

- **Bereit** (Ready) - System ready to arm
- **Alarm** - Alarm triggered
- **Störung** (Fault) - System fault/error
- **Unscharf/Intern/Extern scharf** - Current arming state

### MELDEGRUPPEN (Sensor Groups)

Individual sensors and detectors:

- Motion detectors (Bewegungsmelder)
- Door/window contacts (Magnetkontakt, Schliesskontakt)
- Smoke detectors (Rauchmelder)
- Tamper sensors (Sabotage)
- System components (Gehäuse, Signalgeber)

## Device Type Mapping

The `type` field in your sensor configuration maps to HomeAssistant device classes:

| Type              | HomeAssistant Device Class | Icon               | Description             |
| ----------------- | -------------------------- | ------------------ | ----------------------- |
| `bewegungsmelder` | `motion`                   | mdi:motion-sensor  | Motion detector         |
| `rauchmelder`     | `smoke`                    | mdi:smoke-detector | Smoke detector          |
| `wassermelder`    | `moisture`                 | mdi:water-alert    | Water/moisture detector |
| `magnetkontakt`   | `door`                     | mdi:door           | Magnetic door contact   |
| `schliesskontakt` | `door`                     | mdi:door-closed    | Door lock contact       |
| `sicherung`       | `safety`                   | mdi:shield-check   | Security zone           |
| `systemstatus`    | `power`                    | mdi:information    | System status           |
| `gehaeuse`        | `tamper`                   | mdi:shield-alert   | Enclosure tamper        |
| `signalgeber`     | `sound`                    | mdi:bell-ring      | Siren/sounder           |
| `sabotage`        | `tamper`                   | mdi:alert          | Tamper detection        |
| `ueberfallmelder` | `safety`                   | mdi:alarm-light    | Panic button            |

## Configuration Structure

### Sensor Definition

Each sensor requires these fields:

```javascript
{
    hex: '0x010',              // Hex address from Telenot system (see GMS protocol)
    name: 'Short_Name',        // Internal identifier (no spaces)
    name_ha: 'Display Name',   // Name shown in HomeAssistant
    type: 'bewegungsmelder',   // Device type (see mapping table above)
    topic: 'telenot/alarm/location/sensor', // MQTT topic
    location: 'Room Name',     // Physical location
    inverted: true             // true = normally closed, false = normally open
}
```

### Finding Hex Addresses

Hex addresses come from your Telenot system configuration:

1. Request the **GMS protocol documentation** from your installer
2. Export the **sensor list** from the Telenot configuration software
3. Map each sensor's **Meldegruppen-Nummer** to hex (e.g., 16 decimal = 0x010)

**Note:** Auto-discovery is not possible as the GMS protocol only transmits hex positions without sensor names.

## File Organization

- `config.mjs` - Main configuration file
- `locations/` - Sensor definitions organized by location
    - `ema.mjs` - Central unit sensors
    - `eg.mjs` - Ground floor sensors
    - `og.mjs` - Upper floor sensors
    - `dg.mjs` - Attic sensors
    - `kg.mjs` - Basement sensors

Organize your sensors by location for better maintainability.

## Example Workflow

1. Get sensor list from your installer
2. Create location files (e.g., `locations/living_room.mjs`)
3. Map each sensor with correct hex address and type
4. Import location files in `config.mjs`
5. Test with `HOMEASSISTANT_AUTODISCOVERY=true`

## Troubleshooting

**Sensor not appearing in HomeAssistant:**

- Check hex address matches Telenot configuration
- Verify MQTT topic is unique
- Ensure `HOMEASSISTANT_AUTODISCOVERY=true` in `.env`

**Wrong sensor state:**

- Toggle `inverted` field (normally closed vs. normally open)
- Check GMS protocol output in logs

**Device class not matching:**

- Verify `type` field matches table above
- Check HomeAssistant logs for discovery messages

**High latency / delayed sensor updates:**

- RS232 GMS protocol has inherent delays (typically 1-3 seconds)
- Motion detector sensitivity can be adjusted by your installer
- For time-critical automations (e.g., lighting), consider using KNX or Zigbee sensors in parallel
- The Telenot system is designed for security, not real-time home automation
