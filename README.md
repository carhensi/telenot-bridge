# 📟 Telenot Bridge

![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)
![Version](https://img.shields.io/badge/version-0.1.0-blue)
![Node.js CI](https://img.shields.io/badge/build-passing-brightgreen.svg)
![Documentation](https://img.shields.io/badge/docs-passing-brightgreen)
![Coverage](https://img.shields.io/badge/coverage-99%25-brightgreen.svg)
[![Known Vulnerabilities](https://snyk.io/test/github/carhensi/telenot-bridge/badge.svg)](https://snyk.io/test/github/carhensi/telenot)
![CI](https://github.com/carhensi/telenot-bridge/actions/workflows/ci.yml/badge.svg)
![CodeQL Analysis](https://github.com/carhensi/telenot-bridge/actions/workflows/codeql-analysis.yml/badge.svg)
![Docker Publish](https://github.com/carhensi/telenot-bridge/actions/workflows/docker-publish.yml/badge.svg)

## 🔒 Integrate Telenot Alarm System with HomeAssistant and HomeKit

This Node.js application serves as a bridge between the **Telenot Complex 400H** alarm system, **Home Assistant**, and **HomeKit**. It enables seamless integration, providing enhanced control and monitoring of your security system. Additionally, it supports a virtual `arm_night` mode, ideal for advanced automations. Devices in Home Assistant are automatically configured with appropriate vendor and sensor icons for a polished experience. Communication with the Telenot alarm system is facilitated via its existing RS232 interface.

Compared to the official Interface KNX 400 IP, this solution is significantly more cost-effective but does not provide the same level of robustness, features and is not VdS certified.

---

## 🚀 Features

- 🏝️ **Arm Away** (`arm_away`)
- 🏡 **Arm Home** (`arm_home`)
- 🌙 **Arm Night** (`arm_night`) - *Virtual Mode for customized automations*
- 🏠 **HomeAssistant Discovery** - Automatically discover sensors and devices
- 📡 **MQTT Integration** - Communicate over MQTT for real-time updates
- 🛡️ **Secure Communication** - Handles secure connections with your alarm system
- 📖 **Detailed Logging** - Customizable logging levels for easier debugging
- ✅ **High Test Coverage** - Jest tests with over 99% coverage ensure reliability

---

## 🔧 Hardware Requirement

To use this package, you need an RS232 to Ethernet TCP/IP server module. Specifically:
	•	USR-TCP232-302 Tiny - RS232 to Ethernet TCP/IP Server Module
   •	straight-through RS-232 Cable

This module allows your program to connect using a socket connection to receive data from the Telenot system. The connection on the USR needs to be configured accordingly to Telenot which is 9.600 bps, 8bit size, no parity and stop bits 1 bit. Further more the RS-232 port of the Telenot needs to be configured for GMS output.

## 🔧 Configuration

* Rename .env.example to .env:

```bash
cp -r config-example config
cp .env.example .env
```

* Edit the .env file with your configuration:

```bash
# MQTT Configuration
MQTTHOST=mqtt://your_mqtt_broker
MQTTPORT=1883
MQTTUSER="your_mqtt_username"
MQTTPASSWORD="your_mqtt_password"

# Telnet Configuration
TELNETHOST=your_telenot_ip
TELNETPORT=your_telenot_port

# Other configurations...
```

* Configure your sensors in `src/config/`:
  - See [Configuration Guide](src/config-example/README.md) for detailed instructions
  - Includes device type mapping, Telenot terminology, and troubleshooting

## 🏃‍♂️ Usage

Start with running the ready to use container:

```bash
docker run -i -t \
   --env-file=.env \
   -v $(pwd)/logs:/usr/src/app/logs \
   -v $(pwd)/locations:/usr/src/app/config/locations \
   ghcr.io/carhensi/telenot-bridge:latest
```

## 📡 HomeAssistant Integration

Ensure that `HOMEASSISTANT_AUTODISCOVERY` is set to true in your `.env` file to enable automatic discovery of your Telenot sensors in HomeAssistant.


## 📦 Development


```bash
# Clone the repository
git clone https://github.com/carhensi/telenot-bridge.git

# Navigate into the directory
cd telenot-bridge

# Install dependencies
yarn install

```

## 🧪 Testing

The project includes Jest tests with excellent coverage (>99%). To run the tests:

`yarn test`

For coverage report:

`yarn test:coverage`

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## 🙏 Acknowledgements
* [Michel Munzert](https://github.com/michelde) for the initial application that inspired this project.
* Telenot for their robust alarm systems.
* HomeAssistant community for making smart home integration accessible.

## 📄 License

This project is licensed under the ISC License.

## 📞 Support

For any questions or support, please open an issue on GitHub.

✨ Enjoy
