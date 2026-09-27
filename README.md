# DFR0548 Stepper + Servo Library V1

Custom MakeCode library for the **DFRobot Micro:bit Driver Expansion Board DFR0548**.

## V1 focus

- 2 stepper ports: `M1+M2` and `M3+M4`
- 28BYJ-48 and 42BYGH profiles
- exact step movement
- degree movement
- revolution movement
- configurable steps/revolution
- configurable gear ratio
- configurable speed in steps/second
- software position counter and zero
- immediate stepper stop / stop all
- 8 servo ports S1..S8
- servo angle control
- servo pulse control in microseconds
- servo pulse calibration
- servo angle limits
- servo sweep
- PCA9685 is initialized at 50 Hz

## Important

The DFR0548 is not a modern STEP/DIR stepper driver. Its PCA9685 drives the board's H-bridge inputs, so this library generates coil phase sequences itself.

The default 28BYJ-48 setting is 2048 steps/revolution as a starting profile. **Do not assume this is mechanically exact for every 28BYJ-48 gearbox.** Use `stepperConfigure()` to set the measured output-shaft steps/revolution.

The default 42BYGH profile is 200 steps/revolution. Configure it to the actual motor used.

## Example

```typescript
// 28BYJ-48 on M1+M2
DFR0548.stepperConfigure(DFR0548.StepperPort.M1_M2,
    DFR0548.StepperType.BYJ_28, 2048)
DFR0548.stepperSpeed(DFR0548.StepperPort.M1_M2, 150)
DFR0548.stepperRevolutions(DFR0548.StepperPort.M1_M2,
    DFR0548.Direction.CW, 1)

// Servo S1
DFR0548.servoCalibrate(DFR0548.ServoPort.S1, 500, 2500)
DFR0548.servoAngle(DFR0548.ServoPort.S1, 90)
```

## Design difference from the old DFRobot library

The old library exposes degree/turn commands for the stepper, but the underlying implementation applies a fixed coil pattern and waits; it does not provide an explicit per-step position engine. This V1 instead advances the coil phase for every requested step and keeps a software position counter.


## Two-stepper tank drive

V1 also supports two stepper motors running as a robot drive. By default:

- `M1+M2` = left motor
- `M3+M4` = right motor

You can change this with `tankConfigure()`.

### Forward / backward

```typescript
DFR0548.tankSpeed(150)
DFR0548.tankForward(1000)   // left CW + right CW
DFR0548.tankBackward(1000)  // left CCW + right CCW
```

### Pivot turn like a tank

```typescript
DFR0548.tankTurnLeft(500)   // left CCW + right CW
DFR0548.tankTurnRight(500)  // left CW + right CCW
```

### Curved steering

For a gradual turn, use different distances on each side:

```typescript
// gentle left arc
DFR0548.tankMove(DFR0548.Direction.CW, 600,
    DFR0548.Direction.CW, 1000)
```

The two-motor move uses a DDA-style scheduler so that when the distances differ, the shorter side is distributed through the movement rather than simply finishing first. This is intended for coordinated robot motion on the micro:bit.

> Important: the physical robot's actual forward direction depends on how the two stepper motors are mounted and wired. If one motor is mechanically mirrored, you may need to swap the direction used by that side. The library follows the requested electrical direction exactly: CW means CW for that motor.
