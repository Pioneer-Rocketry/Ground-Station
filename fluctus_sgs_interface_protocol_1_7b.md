## Page 1

&lt;img&gt;Silicdyne Logo&lt;/img&gt;
# Steady ground station USB interface protocol overview + Fluctus 1.7b firmware data parsing architecture

May 23rd, 2025

## 1 Overview of the radio ⇨ USB data path

*   The flight computer (Fluctus) fills a **binary telemetry buffer** and calls the sending.
*   Fluctus appends a 16-bit additive checksum and transmits the radio frame.
*   The **ground station** verifies that checksum, strips it, converts the remaining bytes to a printable representation and pushes a **single ASCII line** to its USB-CDC port:

F B <hex ...>|Grssi-65/Gsnr6\n

^ ^ ^ ^
|| | |
| | | diagnostics added by the ground station
| | all remaining telemetry bytes rendered as two-digit hex
| packet-type byte ('B' = binary, 'C' = ASCII string)
└ radio callsign of the packet origin

The checksum is never exposed on USB—the PC application can trust the payload.

Copyright Silicdyne 2025

---


## Page 2

# 2 Starting and stopping the ground station

## 2.1 start command

Send one line to the ground-station serial port:

start <band><chan><chan> Fluctus \n

<table>
<thead>
<tr>
<th>Field</th>
<th>Size</th>
<th>Allowed values</th>
<th>Purpose</th>
</tr>
</thead>
<tbody>
<tr>
<td>band</td>
<td>1</td>
<td>0 = 902–928 MHz (US) 1 = 863–870 MHz (EU)</td>
<td>Regional ISM band</td>
</tr>
<tr>
<td>chan</td>
<td>2</td>
<td>00...25 or A...Z → (902.5 MHz + chan × 1 MHz)</td>
<td>Centre frequency</td>
</tr>
<tr>
<td>device</td>
<td>7</td>
<td>Fluctus</td>
<td>must match the flight computer</td>
</tr>
<tr>
<td>\n</td>
<td>1</td>
<td>line feed</td>
<td>terminator</td>
</tr>
</tbody>
</table>

Example (US, channel 03):

start003Fluctus\n

## Ground-station reply

Gstartok123 <- “123” is the station firmware ID

After that handshake it forwards every LoRa packet it receives.

## 2.2 ping and startf commands

<table>
<thead>
<tr>
<th>Command line (USB)</th>
<th>In-air effect</th>
<th>Down-link indication</th>
</tr>
</thead>
<tbody>
<tr>
<td>ping\n</td>
<td>queued and wrapped into a G packet on the next RX window</td>
<td>flight computer returns FCpong (type C)</td>
</tr>
<tr>
<td>startf\n</td>
<td>arms the flight sequencer</td>
<td>status field in the next telemetry frame changes from **0 (IDLE)** to **1 (ARMED)** – there is no explicit string reply</td>
</tr>
</tbody>
</table>

All commands are ASCII, case-sensitive and must end with \n.

---
<footer>Copyright Silicdyne 2025</footer>

---


## Page 3

3 Binary telemetry frame (“B”)

Little-endian unless noted.

3.1 Field list & scaling

The firmware’s encoded types.
The table cross-references that mnemonic, the internal variable, and the factor required to obtain engineering units.

<table>
  <thead>
    <tr>
      <th>#</th>
      <th>Name (indexConfig)</th>
      <th>Enc. type</th>
      <th>Size (B)</th>
      <th>Firmware variable</th>
      <th>Unit / range</th>
      <th>Decode formula</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>0</td>
      <td>uid</td>
      <td>i16</td>
      <td>2</td>
      <td>fluctusUID</td>
      <td>-</td>
      <td>16-bit signed</td>
    </tr>
    <tr>
      <td>1</td>
      <td>fw</td>
      <td>i16</td>
      <td>2</td>
      <td>fwver</td>
      <td>-</td>
      <td>16-bit signed</td>
    </tr>
    <tr>
      <td>2</td>
      <td>rx</td>
      <td>i8</td>
      <td>1</td>
      <td>rxPacketCount</td>
      <td>-</td>
      <td>8-bit signed</td>
    </tr>
    <tr>
      <td>3</td>
      <td>timeMPU</td>
      <td>i32</td>
      <td>4</td>
      <td>_time</td>
      <td>ms</td>
      <td>int32</td>
    </tr>
    <tr>
      <td>4</td>
      <td>status</td>
      <td>i8</td>
      <td>1</td>
      <td>status</td>
      <td>see §3.3</td>
      <td>enum</td>
    </tr>
    <tr>
      <td>5</td>
      <td>altitude</td>
      <td>i24</td>
      <td>3</td>
      <td>sf_altitude</td>
      <td>m</td>
      <td>24-bit signed</td>
    </tr>
    <tr>
      <td>6</td>
      <td>speedVert</td>
      <td>i16</td>
      <td>2</td>
      <td>sf_speedvert</td>
      <td>m · s<sup>-1</sup></td>
      <td>int16</td>
    </tr>
    <tr>
      <td>7</td>
      <td>accel</td>
      <td>f16</td>
      <td>2</td>
      <td>accelGlob</td>
      <td>m · s<sup>-2</sup></td>
      <td>int16 / 10</td>
    </tr>
    <tr>
      <td>8</td>
      <td>angle</td>
      <td>ui8</td>
      <td>1</td>
      <td>angle</td>
      <td>deg</td>
      <td>0-255</td>
    </tr>
    <tr>
      <td>9</td>
      <td>battVoltage</td>
      <td>i16</td>
      <td>2</td>
      <td>realBattVoltage</td>
      <td>mV</td>
      <td>int16</td>
    </tr>
    <tr>
      <td>10</td>
      <td>time</td>
      <td>f16</td>
      <td>2</td>
      <td>flightTime</td>
      <td>s</td>
      <td>int16 / 10</td>
    </tr>
    <tr>
      <td>11</td>
      <td>pyroStates</td>
      <td>i8</td>
      <td>1</td>
      <td>pyrostatus</td>
      <td>see §3.4</td>
      <td>bitfield</td>
    </tr>
    <tr>
      <td>12</td>
      <td>logStatus</td>
      <td>i8</td>
      <td>1</td>
      <td>logstatus</td>
      <td>% free (0-100) or<br>101 = OFF</td>
      <td>int8</td>
    </tr>
    <tr>
      <td>13</td>
      <td>gpsLat</td>
      <td>gps</td>
      <td>4</td>
      <td>gpsLat</td>
      <td>°WGS84</td>
      <td>int32 / 1 000<br>000</td>
    </tr>
    <tr>
      <td>14</td>
      <td>gpsLng</td>
      <td>gps</td>
      <td>4</td>
      <td>gpsLng</td>
      <td>°WGS84</td>
      <td>int32 / 1 000<br>000</td>
    </tr>
    <tr>
      <td>15</td>
      <td>gpsState</td>
      <td>i8</td>
      <td>1</td>
      <td>gpsState</td>
      <td>0-5</td>
      <td>int8</td>
    </tr>
    <tr>
      <td>16</td>
      <td>warnCode</td>
      <td>i8</td>
      <td>1</td>
      <td>warncode</td>
      <td>bit-mask</td>
      <td>int8</td>
    </tr>
    <tr>
      <td>17</td>
      <td>message</td>
      <td>msg</td>
      <td>4</td>
      <td>rolling statistics</td>
      <td>see §3.2</td>
      <td>custom</td>
    </tr>
    <tr>
      <td>18</td>
      <td>userIn1*</td>
      <td>i16</td>
      <td>2</td>
      <td>userInputVoltage_in1</td>
      <td>mV</td>
      <td>int16</td>
    </tr>
    <tr>
      <td>19</td>
      <td>userIn2*</td>
      <td>i16</td>
      <td>2</td>
      <td>userInputVoltage_in2</td>
      <td>mV</td>
      <td>int16</td>
    </tr>
  </tbody>
</table>

* The last two fields are **optional**; they are present only when configured by the user in FCC.
Parse them only if the USB payload is at least 42 bytes (after stripping F B).

Copyright Silicdyne 2025

---


## Page 4

# 3.2 Rolling message (field 17 – 4 B)

Every time a packet it sent, the message rotates through three statistics:

<table>
<thead>
<tr>
<th>Telemetry-counter (mod 3)</th>
<th>ID byte (message[0])</th>
<th>Encoded value</th>
</tr>
</thead>
<tbody>
<tr>
<td>0</td>
<td>'A' (0x41)</td>
<td>sf_maxAltitude</td>
</tr>
<tr>
<td>1</td>
<td>'S' (0x53)</td>
<td>sf_maxSpeedvert</td>
</tr>
<tr>
<td>2</td>
<td>'G' (0x47)</td>
<td>maxAccelGlob</td>
</tr>
</tbody>
</table>

## Encoding

Byte 0 : ID ('A', 'S', 'G')

Byte 1 : LSB of value×10

Byte 2 : Mid

Byte 3 : MSB

Signed 24-bit integer, little-endian.

To decode:

```python
raw = b1 | (b2<<8) | (b3<<16)
if raw & 0x800000:    # sign-extend
    raw |= 0xFF000000
value = raw
```

Example – bytes 41 04 1E 00
→ ID 'A', raw = 0x001E04 = 7684 → **7684 m** maximum altitude.

# 3.3 Flight-sequencer status codes (field 4)

<table>
<thead>
<tr>
<th>Code</th>
<th>Meaning</th>
<th>Typical phase</th>
</tr>
</thead>
<tbody>
<tr>
<td>0</td>
<td>IDLE</td>
<td>powered, disarmed</td>
</tr>
<tr>
<td>1</td>
<td>ARMED</td>
<td>safety pin removed, still idle</td>
</tr>
<tr>
<td>2</td>
<td>COUNTDOWN ENGAGED</td>
<td>countdown running</td>
</tr>
<tr>
<td>3</td>
<td>WAITING FOR LAUNCH</td>
<td>countdown done, hold-off until launch-detect</td>
</tr>
<tr>
<td>4</td>
<td>ASCENT</td>
<td>motor burning / coasting up</td>
</tr>
<tr>
<td>5</td>
<td>DESCENT</td>
<td>after apogee</td>
</tr>
<tr>
<td>6</td>
<td>TOUCHDOWN</td>
<td>motionless, flight complete</td>
</tr>
</tbody>
</table>

<footer>Copyright Silicdyne 2025</footer>

---


## Page 5

3.4 Pyrotechnic output bitmap (field 11)

Bit 1-0 : Pyro A

Bit 3-2 : Pyro B

Bit 5-4 : Pyro C

Per-output value:

<table>
<thead>
<tr>
<th>Enc.</th>
<th>Meaning (original sequencer value)</th>
</tr>
</thead>
<tbody>
<tr>
<td>0</td>
<td><strong>DISABLED</strong> (no continuity)</td>
</tr>
<tr>
<td>1</td>
<td><strong>CONTINUITY</strong> (disabled but wire intact)</td>
</tr>
<tr>
<td>3</td>
<td><strong>ENABLED / FIRED</strong> (original value 10 maps to 3)</td>
</tr>
</tbody>
</table>

Bits 6-7 are unused and always 0.

Copyright Silicdyne 2025

---


## Page 6

# 4 Worked example

USB line captured:

FB3E00070100BEDD0100000000000006C00AA89109CFF00650000000000000000000E53000000|Grssi-65/Gsnr6

1. Split at the pipe (|).
2. Discard the first two chars (F, B). The remaining hex string is 80 characters → 40 bytes.
3. Convert to a byte array and feed the table above.

Partial outcome

<table>
<thead>
<tr>
<th>Name</th>
<th>Raw hex</th>
<th>Decoded</th>
</tr>
</thead>
<tbody>
<tr>
<td>uid</td>
<td>3E00</td>
<td>62</td>
</tr>
<tr>
<td>fw</td>
<td>0701</td>
<td>0x0107 → 263</td>
</tr>
<tr>
<td colspan="3">timeMPU BEDD0100 122 046 ms</td>
</tr>
<tr>
<td>status</td>
<td>00</td>
<td>IDLE</td>
</tr>
<tr>
<td>altitude</td>
<td>000000</td>
<td>0 m</td>
</tr>
<tr>
<td>...</td>
<td>...</td>
<td>...</td>
</tr>
</tbody>
</table>

Because the frame length is 40 B the *optional* user inputs are absent (they would extend to 44 B).

---

Copyright Silicdyne 2025

---


## Page 7

5 Implementing a parser (C#/Python/...)

1.  After USB read, **trim CR/LF**, locate the ']', and split.
2.  Verify that the first character is 'F'; second char is the *type*.
3.  For type 'B' remove the two header letters and call HexToBytes().
4.  Walk the byte array with the field list in §3.1.
    *   Sign-extend **i24** (see code below).
    *   Divide **f16** by 10, **gps** by 1 000 000.
    *   Decode **msg**, **status**, **pyroStates** using §3.2 – §3.4.
5.  If bytes remain after field 17, read **userIn1/2** (two i16 each).

```csharp
static int ReadInt24(byte[] buf, int ofs)
{
    int val = buf[ofs] | (buf[ofs+1]<<8) | (buf[ofs+2]<<16);
    if ((val & 0x800000) != 0) val |= unchecked((int)0xFF000000);
    return val;
}
```

6 Ground-station command summary

<table>
<thead>
<tr>
<th>Command (USB)</th>
<th>Purpose</th>
<th>Flight-computer reaction</th>
</tr>
</thead>
<tbody>
<tr>
<td><code>start<band><chan><chan>Fluctus\n</chan></chan></band></code></td>
<td>Initialise RF link</td>
<td>Returns Gstartok<fw></fw></td>
</tr>
<tr>
<td><code>ping\n</code></td>
<td>Connectivity test</td>
<td>Sends back FCpong (type C)</td>
</tr>
<tr>
<td><code>startf\n</code></td>
<td>Arm sequencer</td>
<td>status field changes 0 → 1</td>
</tr>
</tbody>
</table>

<footer>Copyright Silicdyne 2025</footer>

---


## Page 8

Appendix – Type mnemonic cheat-sheet

<table>
  <thead>
    <tr>
      <th>Mnemonic</th>
      <th>Meaning</th>
      <th>Scaling in this firmware</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>i8 / ui8</td>
      <td>1-byte signed / unsigned</td>
      <td>none</td>
    </tr>
    <tr>
      <td>i16</td>
      <td>2-byte signed</td>
      <td>none</td>
    </tr>
    <tr>
      <td>i24</td>
      <td>3-byte signed</td>
      <td>none</td>
    </tr>
    <tr>
      <td>i32</td>
      <td>4-byte signed</td>
      <td>none</td>
    </tr>
    <tr>
      <td>f16</td>
      <td>2-byte signed fixed-point</td>
      <td>divide by 10</td>
    </tr>
    <tr>
      <td>gps</td>
      <td>4-byte signed fixed-point</td>
      <td>divide by 1 000 000</td>
    </tr>
    <tr>
      <td>msg</td>
      <td>1 B ID + 24-bit value</td>
      <td>divide by 10</td>
    </tr>
    <tr>
      <td>b</td>
      <td>Boolean</td>
      <td>0 / 1</td>
    </tr>
    <tr>
      <td>c</td>
      <td>ASCII char</td>
      <td>-</td>
    </tr>
  </tbody>
</table>

Copyright Silicdyne 2025