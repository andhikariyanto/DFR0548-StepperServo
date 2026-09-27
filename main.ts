/**
 * DFR0548 Stepper + Servo Library V1
 * Target: DFRobot Micro:bit Driver Expansion Board DFR0548
 * Focus: 2 stepper ports + 8 servo ports
 *
 * Hardware uses PCA9685 at I2C address 0x40.
 */

//% color=#1565C0 icon="\uf1d8" block="DFR0548"
namespace dfr0548 {

    const PCA9685_ADDRESS = 0x40
    const MODE1 = 0x00
    const MODE2 = 0x01
    const PRESCALE = 0xFE
    const LED0_ON_L = 0x06

    const PWM_FREQ = 50
    const PWM_MAX = 4095

    /** Stepper connector pair on the DFR0548. */
    export enum StepperPort {
        //% block="M1 + M2"
        M1_M2 = 1,
        //% block="M3 + M4"
        M3_M4 = 2
    }

    /** Direction. */
    export enum Direction {
        //% block="clockwise"
        CW = 1,
        //% block="counter-clockwise"
        CCW = -1
    }

    /** Built-in stepper profiles. */
    export enum StepperType {
        //% block="28BYJ-48"
        BYJ_28 = 1,
        //% block="42BYGH"
        BYGH_42 = 2
    }

    /** 8 servo sockets. */
    export enum ServoPort {
        //% block="S1"
        S1 = 1,
        //% block="S2"
        S2 = 2,
        //% block="S3"
        S3 = 3,
        //% block="S4"
        S4 = 4,
        //% block="S5"
        S5 = 5,
        //% block="S6"
        S6 = 6,
        //% block="S7"
        S7 = 7,
        //% block="S8"
        S8 = 8
    }

    interface StepperState {
        type: StepperType
        stepsPerRevolution: number
        gearRatio: number
        speed: number
        phase: number
        position: number
        enabled: boolean
    }

    interface ServoCalibration {
        minUs: number
        maxUs: number
        minAngle: number
        maxAngle: number
    }

    let initialized = false
    let servoFrequency = PWM_FREQ
    let steppers: StepperState[] = []
    let servoCal: ServoCalibration[] = []
    let servoAngleState: number[] = []

    // 28BYJ-48 profile: output-shaft steps/revolution is configurable.
    // Default is 2048 half-steps/rev, a common starting value.
    const DEFAULT_28_STEPS = 2048
    const DEFAULT_42_STEPS = 200

    // DFR0548 PCA9685 channel layout used by the original DFR0548 driver.
    // S1..S8 map to PCA9685 channels 15..8.
    function servoChannel(port: ServoPort): number {
        return 16 - port
    }

    function initStepperDefaults(): void {
        steppers = []
        steppers.push({
            type: StepperType.BYJ_28,
            stepsPerRevolution: DEFAULT_28_STEPS,
            gearRatio: 1,
            speed: 200,
            phase: 0,
            position: 0,
            enabled: false
        })
        steppers.push({
            type: StepperType.BYGH_42,
            stepsPerRevolution: DEFAULT_42_STEPS,
            gearRatio: 1,
            speed: 100,
            phase: 0,
            position: 0,
            enabled: false
        })
    }

    function initServoDefaults(): void {
        servoCal = []
        servoAngleState = []
        for (let i = 0; i < 8; i++) {
            servoCal.push({ minUs: 600, maxUs: 2400, minAngle: 0, maxAngle: 180 })
            servoAngleState.push(90)
        }
    }

    function ensureInit(): void {
        if (initialized) return
        initPCA9685()
        initStepperDefaults()
        initServoDefaults()
        initialized = true
    }

    function writeReg(reg: number, value: number): void {
        let b = pins.createBuffer(2)
        b[0] = reg & 0xFF
        b[1] = value & 0xFF
        pins.i2cWriteBuffer(PCA9685_ADDRESS, b)
    }

    function readReg(reg: number): number {
        pins.i2cWriteNumber(PCA9685_ADDRESS, reg & 0xFF, NumberFormat.UInt8BE)
        return pins.i2cReadNumber(PCA9685_ADDRESS, NumberFormat.UInt8BE)
    }

    function setPwmFrequency(freq: number): void {
        if (freq < 24) freq = 24
        if (freq > 1526) freq = 1526

        let prescaleVal = 25000000 / 4096 / freq - 1
        let prescale = Math.round(prescaleVal)
        let oldMode = readReg(MODE1)
        let sleepMode = (oldMode & 0x7F) | 0x10

        writeReg(MODE1, sleepMode)
        writeReg(PRESCALE, prescale)
        writeReg(MODE1, oldMode)
        control.waitMicros(5000)
        writeReg(MODE1, oldMode | 0xA1)
    }

    function initPCA9685(): void {
        writeReg(MODE1, 0x00)
        writeReg(MODE2, 0x04)
        setPwmFrequency(PWM_FREQ)
    }

    function setPwm(channel: number, on: number, off: number): void {
        if (channel < 0 || channel > 15) return
        let b = pins.createBuffer(5)
        b[0] = LED0_ON_L + channel * 4
        b[1] = on & 0xFF
        b[2] = (on >> 8) & 0x0F
        b[3] = off & 0xFF
        b[4] = (off >> 8) & 0x0F
        pins.i2cWriteBuffer(PCA9685_ADDRESS, b)
    }

    function clamp(v: number, lo: number, hi: number): number {
        if (v < lo) return lo
        if (v > hi) return hi
        return v
    }

    function usToTicks(us: number): number {
        return clamp(Math.round(us * PWM_FREQ * 4096 / 1000000), 0, PWM_MAX)
    }

    /**
     * Set one servo angle using the calibrated pulse range.
     */
    //% blockId=dfr0548_servo_angle block="servo %port angle %angle °"
    //% angle.min=0 angle.max=180 angle.defl=90
    //% weight=100
    export function servoAngle(port: ServoPort, angle: number): void {
        ensureInit()
        let c = servoCal[port - 1]
        angle = clamp(angle, c.minAngle, c.maxAngle)
        let ratio = (angle - c.minAngle) / (c.maxAngle - c.minAngle)
        let us = c.minUs + ratio * (c.maxUs - c.minUs)
        setPwm(servoChannel(port), 0, usToTicks(us))
        servoAngleState[port - 1] = angle
    }

    /** Set a servo directly in microseconds. */
    //% blockId=dfr0548_servo_pulse block="servo %port pulse %microseconds μs"
    //% microseconds.min=400 microseconds.max=2600 microseconds.defl=1500
    //% weight=90
    export function servoPulse(port: ServoPort, microseconds: number): void {
        ensureInit()
        microseconds = clamp(microseconds, 300, 3000)
        setPwm(servoChannel(port), 0, usToTicks(microseconds))
    }

    /** Calibrate a servo's pulse and angle limits. */
    //% blockId=dfr0548_servo_calibrate block="servo %port calibrate min %minUs μs max %maxUs μs"
    //% minUs.min=300 minUs.max=1500 minUs.defl=600
    //% maxUs.min=1500 maxUs.max=3000 maxUs.defl=2400
    //% weight=80
    export function servoCalibrate(port: ServoPort, minUs: number, maxUs: number): void {
        ensureInit()
        if (minUs >= maxUs) return
        servoCal[port - 1].minUs = clamp(minUs, 300, 1500)
        servoCal[port - 1].maxUs = clamp(maxUs, 1500, 3000)
    }

    /** Set the logical angle limits. */
    //% blockId=dfr0548_servo_limits block="servo %port angle limits %minAngle ° to %maxAngle °"
    //% minAngle.min=-180 minAngle.max=180 minAngle.defl=0
    //% maxAngle.min=-180 maxAngle.max=360 maxAngle.defl=180
    //% weight=70
    export function servoAngleLimits(port: ServoPort, minAngle: number, maxAngle: number): void {
        ensureInit()
        if (minAngle >= maxAngle) return
        servoCal[port - 1].minAngle = minAngle
        servoCal[port - 1].maxAngle = maxAngle
    }

    /** Move a servo in small angle increments. */
    //% blockId=dfr0548_servo_move block="servo %port move to %angle ° speed %speed"
    //% angle.min=-180 angle.max=360 angle.defl=90
    //% speed.min=1 speed.max=100 speed.defl=10
    //% weight=60
    export function servoMove(port: ServoPort, angle: number, speed: number): void {
        ensureInit()
        speed = clamp(speed, 1, 100)
        let c = servoCal[port - 1]
        angle = clamp(angle, c.minAngle, c.maxAngle)

        let start = servoAngleState[port - 1]
        let step = angle >= start ? 1 : -1
        let delay = Math.max(5, Math.round(100 / speed))
        let a = start
        while ((step > 0 && a <= angle) || (step < 0 && a >= angle)) {
            servoAngle(port, a)
            basic.pause(delay)
            a += step
        }
    }

    /** Sweep a servo between two angles. */
    //% blockId=dfr0548_servo_sweep block="servo %port sweep %fromAngle ° to %toAngle ° speed %speed"
    //% fromAngle.min=-180 fromAngle.max=360 fromAngle.defl=0
    //% toAngle.min=-180 toAngle.max=360 toAngle.defl=180
    //% speed.min=1 speed.max=100 speed.defl=20
    //% weight=50
    export function servoSweep(port: ServoPort, fromAngle: number, toAngle: number, speed: number): void {
        ensureInit()
        speed = clamp(speed, 1, 100)
        let c = servoCal[port - 1]
        fromAngle = clamp(fromAngle, c.minAngle, c.maxAngle)
        toAngle = clamp(toAngle, c.minAngle, c.maxAngle)
        let step = toAngle >= fromAngle ? 1 : -1
        let delay = Math.max(5, Math.round(100 / speed))
        let a = fromAngle
        while ((step > 0 && a <= toAngle) || (step < 0 && a >= toAngle)) {
            servoAngle(port, a)
            basic.pause(delay)
            a += step
        }
    }

    /** Configure a stepper motor profile. */
    //% blockId=dfr0548_stepper_config block="stepper %port type %type steps/rev %stepsPerRev"
    //% stepsPerRev.min=1 stepsPerRev.max=20000 stepsPerRev.defl=2048
    //% weight=100
    export function stepperConfigure(port: StepperPort, type: StepperType, stepsPerRev: number): void {
        ensureInit()
        let s = steppers[port - 1]
        s.type = type
        s.stepsPerRevolution = Math.max(1, Math.round(stepsPerRev))
        s.phase = 0
        s.position = 0
        s.enabled = false
    }

    /** Set gearbox ratio. Output steps/rev = motor steps/rev * ratio. */
    //% blockId=dfr0548_stepper_ratio block="stepper %port gear ratio %ratio"
    //% ratio.min=0.01 ratio.max=100 ratio.defl=1
    //% weight=90
    export function stepperGearRatio(port: StepperPort, ratio: number): void {
        ensureInit()
        steppers[port - 1].gearRatio = Math.max(0.01, ratio)
    }

    /** Set step speed in steps/second. */
    //% blockId=dfr0548_stepper_speed block="stepper %port speed %stepsPerSecond steps/s"
    //% stepsPerSecond.min=1 stepsPerSecond.max=1000 stepsPerSecond.defl=100
    //% weight=80
    export function stepperSpeed(port: StepperPort, stepsPerSecond: number): void {
        ensureInit()
        steppers[port - 1].speed = clamp(stepsPerSecond, 1, 1000)
    }

    // Phase values are static PWM levels used by the DFR0548 H-bridge inputs.
    // Each profile has a 4-phase sequence. The channel order differs by port.
    function applyStepperPhase(port: StepperPort, type: StepperType, phase: number): void {
        let p = ((phase % 4) + 4) % 4
        let a: number[] = []

        if (type == StepperType.BYJ_28) {
            // Four phase sequence derived from the DFR0548 28BYJ drive levels.
            // Values are intentionally kept as the board's original PWM levels.
            let seq = [
                [2047, 1, 1023, 3071],
                [4095, 2047, 1023, 3071],
                [4095, 2047, 3071, 1023],
                [2047, 1, 3071, 1023]
            ]
            a = seq[p]
        } else {
            let seq42 = [
                [3071, 1023, 4095, 2047],
                [1023, 3071, 4095, 2047],
                [1023, 3071, 2047, 4095],
                [3071, 1023, 2047, 4095]
            ]
            a = seq42[p]
        }

        let ch: number[]
        if (port == StepperPort.M1_M2) {
            // DFR0548 channels 4..7, matching the original driver mapping.
            ch = [4, 5, 6, 7]
        } else {
            ch = [0, 1, 2, 3]
        }

        // One I2C transaction for the four contiguous channels.
        let buf = pins.createBuffer(17)
        buf[0] = LED0_ON_L + ch[0] * 4
        for (let i = 0; i < 4; i++) {
            let value = a[i]
            let base = 1 + i * 4
            buf[base] = 0
            buf[base + 1] = 0
            buf[base + 2] = value & 0xFF
            buf[base + 3] = (value >> 8) & 0x0F
        }
        pins.i2cWriteBuffer(PCA9685_ADDRESS, buf)
    }

    function stopStepperInternal(port: StepperPort): void {
        let first = port == StepperPort.M1_M2 ? 4 : 0
        for (let i = 0; i < 4; i++) setPwm(first + i, 0, 0)
        steppers[port - 1].enabled = false
    }

    /** One physical step. */
    function stepOnce(port: StepperPort, direction: Direction): void {
        let s = steppers[port - 1]
        if (direction == Direction.CW) s.phase++
        else s.phase--
        applyStepperPhase(port, s.type, s.phase)
        if (direction == Direction.CW) s.position++
        else s.position--
        s.enabled = true
    }

    /** Move an exact number of steps. */
    //% blockId=dfr0548_stepper_steps block="stepper %port %direction %steps steps"
    //% steps.min=1 steps.max=20000 steps.defl=100
    //% weight=100
    export function stepperSteps(port: StepperPort, direction: Direction, steps: number): void {
        ensureInit()
        let s = steppers[port - 1]
        steps = Math.abs(Math.round(steps))
        if (steps == 0) return

        let delayUs = Math.max(1000, Math.round(1000000 / s.speed))
        for (let i = 0; i < steps; i++) {
            stepOnce(port, direction)
            control.waitMicros(delayUs)
        }
        stopStepperInternal(port)
    }

    /** Move an exact number of degrees using the configured steps/revolution. */
    //% blockId=dfr0548_stepper_degrees block="stepper %port %direction %degrees °"
    //% degrees.min=1 degrees.max=36000 degrees.defl=90
    //% weight=90
    export function stepperDegrees(port: StepperPort, direction: Direction, degrees: number): void {
        ensureInit()
        let s = steppers[port - 1]
        let steps = Math.round(Math.abs(degrees) * s.stepsPerRevolution * s.gearRatio / 360)
        stepperSteps(port, direction, steps)
    }

    /** Move a number of complete revolutions. */
    //% blockId=dfr0548_stepper_revolutions block="stepper %port %direction %revolutions revolutions"
    //% revolutions.min=1 revolutions.max=1000 revolutions.defl=1
    //% weight=80
    export function stepperRevolutions(port: StepperPort, direction: Direction, revolutions: number): void {
        ensureInit()
        let s = steppers[port - 1]
        let steps = Math.round(Math.abs(revolutions) * s.stepsPerRevolution * s.gearRatio)
        stepperSteps(port, direction, steps)
    }

    // ---------------------------------------------------------------------
    // Two-stepper / tank drive
    // ---------------------------------------------------------------------

    /**
     * Configure which physical stepper ports are used as LEFT and RIGHT.
     * Default is M1+M2 = left and M3+M4 = right.
     */
    let tankLeftPort: StepperPort = StepperPort.M1_M2
    let tankRightPort: StepperPort = StepperPort.M3_M4

    //% blockId=dfr0548_tank_config block="tank left motor %left right motor %right"
    //% weight=75
    export function tankConfigure(left: StepperPort, right: StepperPort): void {
        ensureInit()
        if (left == right) return
        tankLeftPort = left
        tankRightPort = right
    }

    /** Set both tank motors to the same speed. */
    //% blockId=dfr0548_tank_speed block="tank speed %stepsPerSecond steps/s"
    //% stepsPerSecond.min=1 stepsPerSecond.max=1000 stepsPerSecond.defl=100
    //% weight=74
    export function tankSpeed(stepsPerSecond: number): void {
        ensureInit()
        stepsPerSecond = clamp(stepsPerSecond, 1, 1000)
        steppers[tankLeftPort - 1].speed = stepsPerSecond
        steppers[tankRightPort - 1].speed = stepsPerSecond
    }

    /**
     * Set left and right motor speeds independently.
     * Useful for curved turns instead of a pivot turn.
     */
    //% blockId=dfr0548_tank_differential_speed block="tank left speed %leftSpeed right speed %rightSpeed steps/s"
    //% leftSpeed.min=0 leftSpeed.max=1000 leftSpeed.defl=100
    //% rightSpeed.min=0 rightSpeed.max=1000 rightSpeed.defl=100
    //% weight=73
    export function tankDifferentialSpeed(leftSpeed: number, rightSpeed: number): void {
        ensureInit()
        steppers[tankLeftPort - 1].speed = clamp(leftSpeed, 0, 1000)
        steppers[tankRightPort - 1].speed = clamp(rightSpeed, 0, 1000)
    }

    /**
     * Low-level synchronized move of the two tank motors.
     * A simple DDA/Bresenham scheduler is used when the two distances differ,
     * so the motors progress together instead of completing one motor first.
     */
    function tankMoveInternal(leftDirection: Direction, rightDirection: Direction,
        leftSteps: number, rightSteps: number): void {
        leftSteps = Math.abs(Math.round(leftSteps))
        rightSteps = Math.abs(Math.round(rightSteps))
        if (leftSteps == 0 && rightSteps == 0) return

        let left = steppers[tankLeftPort - 1]
        let right = steppers[tankRightPort - 1]
        let maxSteps = Math.max(leftSteps, rightSteps)

        // Prevent a zero-speed motor from being stepped.
        let leftActive = leftSteps > 0 && left.speed > 0
        let rightActive = rightSteps > 0 && right.speed > 0
        if (!leftActive && !rightActive) return

        let leftAcc = 0
        let rightAcc = 0

        // Use the slower requested motor rate as the common scheduler rate.
        // This keeps both sides coordinated while preserving their configured
        // relative speed as closely as MakeCode timing allows.
        let commonSpeed = 0
        if (leftActive) commonSpeed = Math.max(commonSpeed, left.speed)
        if (rightActive) commonSpeed = Math.max(commonSpeed, right.speed)
        commonSpeed = clamp(commonSpeed, 1, 1000)
        let delayUs = Math.max(1000, Math.round(1000000 / commonSpeed))

        for (let i = 0; i < maxSteps; i++) {
            if (leftActive) {
                leftAcc += leftSteps
                if (leftAcc >= maxSteps) {
                    leftAcc -= maxSteps
                    stepOnce(tankLeftPort, leftDirection)
                }
            }
            if (rightActive) {
                rightAcc += rightSteps
                if (rightAcc >= maxSteps) {
                    rightAcc -= maxSteps
                    stepOnce(tankRightPort, rightDirection)
                }
            }
            control.waitMicros(delayUs)
        }

        stopStepperInternal(tankLeftPort)
        stopStepperInternal(tankRightPort)
    }

    /** Move both motors forward. Both motors rotate CW. */
    //% blockId=dfr0548_tank_forward block="tank forward %steps steps"
    //% steps.min=1 steps.max=50000 steps.defl=100
    //% weight=100
    export function tankForward(steps: number): void {
        ensureInit()
        tankMoveInternal(Direction.CW, Direction.CW, steps, steps)
    }

    /** Move both motors backward. Both motors rotate CCW. */
    //% blockId=dfr0548_tank_backward block="tank backward %steps steps"
    //% steps.min=1 steps.max=50000 steps.defl=100
    //% weight=99
    export function tankBackward(steps: number): void {
        ensureInit()
        tankMoveInternal(Direction.CCW, Direction.CCW, steps, steps)
    }

    /** Pivot/turn left: left motor CCW, right motor CW. */
    //% blockId=dfr0548_tank_turn_left block="tank turn left %steps steps"
    //% steps.min=1 steps.max=50000 steps.defl=100
    //% weight=98
    export function tankTurnLeft(steps: number): void {
        ensureInit()
        tankMoveInternal(Direction.CCW, Direction.CW, steps, steps)
    }

    /** Pivot/turn right: left motor CW, right motor CCW. */
    //% blockId=dfr0548_tank_turn_right block="tank turn right %steps steps"
    //% steps.min=1 steps.max=50000 steps.defl=100
    //% weight=97
    export function tankTurnRight(steps: number): void {
        ensureInit()
        tankMoveInternal(Direction.CW, Direction.CCW, steps, steps)
    }

    /**
     * Differential/curved movement. Each side can travel a different distance
     * and direction. This can make a gentle left/right arc or a pivot.
     */
    //% blockId=dfr0548_tank_move block="tank left %leftDirection %leftSteps steps right %rightDirection %rightSteps steps"
    //% leftSteps.min=0 leftSteps.max=50000 leftSteps.defl=100
    //% rightSteps.min=0 rightSteps.max=50000 rightSteps.defl=100
    //% weight=96
    export function tankMove(leftDirection: Direction, leftSteps: number,
        rightDirection: Direction, rightSteps: number): void {
        ensureInit()
        tankMoveInternal(leftDirection, rightDirection, leftSteps, rightSteps)
    }

    /** Stop both tank motors immediately and release their coils. */
    //% blockId=dfr0548_tank_stop block="tank stop"
    //% weight=95
    export function tankStop(): void {
        ensureInit()
        stopStepperInternal(tankLeftPort)
        stopStepperInternal(tankRightPort)
    }

    /**
     * Move both sides by revolutions. This is convenient for robot drive code.
     */
    //% blockId=dfr0548_tank_revolutions block="tank forward revolutions %revolutions"
    //% revolutions.min=0.01 revolutions.max=1000 revolutions.defl=1
    //% weight=94
    export function tankForwardRevolutions(revolutions: number): void {
        ensureInit()
        let left = steppers[tankLeftPort - 1]
        let right = steppers[tankRightPort - 1]
        let leftSteps = Math.round(Math.abs(revolutions) * left.stepsPerRevolution * left.gearRatio)
        let rightSteps = Math.round(Math.abs(revolutions) * right.stepsPerRevolution * right.gearRatio)
        tankMoveInternal(Direction.CW, Direction.CW, leftSteps, rightSteps)
    }

    /** Move both sides backward by revolutions. */
    //% blockId=dfr0548_tank_backward_revolutions block="tank backward revolutions %revolutions"
    //% revolutions.min=0.01 revolutions.max=1000 revolutions.defl=1
    //% weight=93
    export function tankBackwardRevolutions(revolutions: number): void {
        ensureInit()
        let left = steppers[tankLeftPort - 1]
        let right = steppers[tankRightPort - 1]
        let leftSteps = Math.round(Math.abs(revolutions) * left.stepsPerRevolution * left.gearRatio)
        let rightSteps = Math.round(Math.abs(revolutions) * right.stepsPerRevolution * right.gearRatio)
        tankMoveInternal(Direction.CCW, Direction.CCW, leftSteps, rightSteps)
    }

    /** Immediately de-energize a stepper port. */
    //% blockId=dfr0548_stepper_stop block="stop stepper %port"
    //% weight=70
    export function stepperStop(port: StepperPort): void {
        ensureInit()
        stopStepperInternal(port)
    }

    /** Stop both stepper ports. */
    //% blockId=dfr0548_stepper_stop_all block="stop all steppers"
    //% weight=60
    export function stepperStopAll(): void {
        ensureInit()
        stopStepperInternal(StepperPort.M1_M2)
        stopStepperInternal(StepperPort.M3_M4)
    }

    /** Reset software position counters to zero. */
    //% blockId=dfr0548_stepper_zero block="zero position of stepper %port"
    //% weight=50
    export function stepperZero(port: StepperPort): void {
        ensureInit()
        steppers[port - 1].position = 0
    }

    /** Return current software step position. */
    export function stepperPosition(port: StepperPort): number {
        ensureInit()
        return steppers[port - 1].position
    }

    /** Return configured steps per revolution. */
    export function stepperStepsPerRevolution(port: StepperPort): number {
        ensureInit()
        return steppers[port - 1].stepsPerRevolution
    }

    /** Set all four coil channels off for a port. */
    export function releaseStepper(port: StepperPort): void {
        ensureInit()
        stopStepperInternal(port)
    }

    /** Reinitialize the PCA9685 and software state. */
    //% blockId=dfr0548_reset block="DFR0548 reset controller"
    //% weight=40
    export function resetController(): void {
        initialized = false
        ensureInit()
    }
}
