//% weight=10 color=#DF6721 icon="\uf013" block="DFR0548"
namespace DFR0548 {

    const PCA = 0x40
    const MODE1 = 0x00
    const PRESCALE = 0xFE
    const LED0 = 0x06

    const STEP_A_ON = 2047
    const STEP_A_OFF = 4095
    const STEP_B_ON = 1
    const STEP_B_OFF = 2047
    const STEP_C_ON = 1023
    const STEP_C_OFF = 3071
    const STEP_D_ON = 3071
    const STEP_D_OFF = 1023

    const BYG_A_ON = 3071
    const BYG_A_OFF = 1023
    const BYG_B_ON = 1023
    const BYG_B_OFF = 3071
    const BYG_C_ON = 4095
    const BYG_C_OFF = 2047
    const BYG_D_ON = 2047
    const BYG_D_OFF = 4095

    export enum StepperPort {
        //% block="M1 + M2"
        M1_M2 = 1,
        //% block="M3 + M4"
        M3_M4 = 2
    }

    export enum Direction {
        //% block="CW"
        CW = 1,
        //% block="CCW"
        CCW = -1
    }

    export enum StepperType {
        //% block="28BYJ-48"
        BYJ_28 = 28,
        //% block="42BYGH"
        BYGH_42 = 42
    }

    export enum ServoPort {
        //% block="S1"
        S1 = 8,
        //% block="S2"
        S2 = 7,
        //% block="S3"
        S3 = 6,
        //% block="S4"
        S4 = 5,
        //% block="S5"
        S5 = 4,
        //% block="S6"
        S6 = 3,
        //% block="S7"
        S7 = 2,
        //% block="S8"
        S8 = 1
    }

    let ready = false
    let leftPort = StepperPort.M1_M2
    let rightPort = StepperPort.M3_M4
    let leftSpeed = 100
    let rightSpeed = 100
    let leftType = StepperType.BYJ_28
    let rightType = StepperType.BYJ_28

    function writeReg(reg: number, value: number): void {
        let b = pins.createBuffer(2)
        b[0] = reg
        b[1] = value
        pins.i2cWriteBuffer(PCA, b)
    }

    function readReg(reg: number): number {
        pins.i2cWriteNumber(PCA, reg, NumberFormat.UInt8BE)
        return pins.i2cReadNumber(PCA, NumberFormat.UInt8BE)
    }

    function init(): void {
        if (ready) return
        writeReg(MODE1, 0x00)
        setFrequency(53)
        ready = true
    }

    function setFrequency(hz: number): void {
        let oldMode = readReg(MODE1)
        let prescale = Math.round(25000000 / 4096 / hz - 1)
        let sleepMode = (oldMode & 0x7F) | 0x10
        writeReg(MODE1, sleepMode)
        writeReg(PRESCALE, prescale)
        writeReg(MODE1, oldMode)
        control.waitMicros(5000)
        writeReg(MODE1, oldMode | 0xA1)
    }

    function pwm(channel: number, on: number, off: number): void {
        let b = pins.createBuffer(5)
        b[0] = LED0 + channel * 4
        b[1] = on & 0xFF
        b[2] = (on >> 8) & 0x0F
        b[3] = off & 0xFF
        b[4] = (off >> 8) & 0x0F
        pins.i2cWriteBuffer(PCA, b)
    }

    function off(channel: number): void {
        pwm(channel, 0, 0)
    }

    function stopPort(port: StepperPort): void {
        if (port == StepperPort.M1_M2) {
            off(4); off(5); off(6); off(7)
        } else {
            off(0); off(1); off(2); off(3)
        }
    }

    function set28(port: StepperPort, direction: Direction): void {
        if (port == StepperPort.M1_M2) {
            if (direction == Direction.CW) {
                pwm(4, STEP_A_ON, STEP_A_OFF)
                pwm(6, STEP_B_ON, STEP_B_OFF)
                pwm(5, STEP_C_ON, STEP_C_OFF)
                pwm(7, STEP_D_ON, STEP_D_OFF)
            } else {
                pwm(7, STEP_A_ON, STEP_A_OFF)
                pwm(5, STEP_B_ON, STEP_B_OFF)
                pwm(6, STEP_C_ON, STEP_C_OFF)
                pwm(4, STEP_D_ON, STEP_D_OFF)
            }
        } else {
            if (direction == Direction.CW) {
                pwm(0, STEP_A_ON, STEP_A_OFF)
                pwm(2, STEP_B_ON, STEP_B_OFF)
                pwm(1, STEP_C_ON, STEP_C_OFF)
                pwm(3, STEP_D_ON, STEP_D_OFF)
            } else {
                pwm(3, STEP_A_ON, STEP_A_OFF)
                pwm(1, STEP_B_ON, STEP_B_OFF)
                pwm(2, STEP_C_ON, STEP_C_OFF)
                pwm(0, STEP_D_ON, STEP_D_OFF)
            }
        }
    }

    function set42(port: StepperPort, direction: Direction): void {
        if (port == StepperPort.M1_M2) {
            if (direction == Direction.CW) {
                pwm(7, BYG_A_ON, BYG_A_OFF)
                pwm(6, BYG_B_ON, BYG_B_OFF)
                pwm(5, BYG_C_ON, BYG_C_OFF)
                pwm(4, BYG_D_ON, BYG_D_OFF)
            } else {
                pwm(7, BYG_C_ON, BYG_C_OFF)
                pwm(6, BYG_D_ON, BYG_D_OFF)
                pwm(5, BYG_A_ON, BYG_A_OFF)
                pwm(4, BYG_B_ON, BYG_B_OFF)
            }
        } else {
            if (direction == Direction.CW) {
                pwm(3, BYG_A_ON, BYG_A_OFF)
                pwm(2, BYG_B_ON, BYG_B_OFF)
                pwm(1, BYG_C_ON, BYG_C_OFF)
                pwm(0, BYG_D_ON, BYG_D_OFF)
            } else {
                pwm(3, BYG_C_ON, BYG_C_OFF)
                pwm(2, BYG_D_ON, BYG_D_OFF)
                pwm(1, BYG_A_ON, BYG_A_OFF)
                pwm(0, BYG_B_ON, BYG_B_OFF)
            }
        }
    }

    function runFor(port: StepperPort, motorType: StepperType, direction: Direction, degrees: number, speed: number): void {
        init()
        if (degrees <= 0 || speed <= 0) return
        speed = Math.max(1, Math.min(100, speed))
        if (motorType == StepperType.BYJ_28) set28(port, direction)
        else set42(port, direction)
        // The original DFR0548 driver is time-based rather than STEP/DIR based.
        // Keep that behavior here so the library remains compatible with the board.
        let ms = 1000 * degrees / 360
        ms = ms * 100 / speed
        basic.pause(Math.round(ms))
        stopPort(port)
    }

    //% block="Servo %port angle %angle°"
    //% angle.min=0 angle.max=180 angle.defl=90
    //% weight=100
    export function servoAngle(port: ServoPort, angle: number): void {
        init()
        angle = Math.max(0, Math.min(180, angle))
        let us = angle * 10 + 600
        let value = Math.round(us * 4095 / 20000)
        pwm(port + 7, 0, value)
    }

    //% block="Servo %port pulse %microseconds μs"
    //% microseconds.min=500 microseconds.max=2500 microseconds.defl=1500
    //% weight=90
    export function servoPulse(port: ServoPort, microseconds: number): void {
        init()
        microseconds = Math.max(500, Math.min(2500, microseconds))
        let value = Math.round(microseconds * 4095 / 20000)
        pwm(port + 7, 0, value)
    }

    //% block="Stepper configure %port type %motorType steps/rev %stepsPerRev"
    //% stepsPerRev.min=1 stepsPerRev.max=100000 stepsPerRev.defl=2048
    //% weight=80
    export function stepperConfigure(port: StepperPort, motorType: StepperType, stepsPerRev: number): void {
        init()
        if (port == StepperPort.M1_M2) leftType = motorType
        else rightType = motorType
    }

    //% block="Stepper %port %direction degrees %degrees speed %speed"
    //% degrees.min=0 degrees.max=36000 degrees.defl=90
    //% speed.min=1 speed.max=100 speed.defl=100
    //% weight=70
    export function stepperDegrees(port: StepperPort, direction: Direction, degrees: number, speed: number): void {
        let motorType = leftType
        if (port == StepperPort.M3_M4) motorType = rightType
        runFor(port, motorType, direction, Math.abs(degrees), speed)
    }

    //% block="Stepper %port %direction revolutions %revolutions speed %speed"
    //% revolutions.min=0 revolutions.max=1000 revolutions.defl=1
    //% speed.min=1 speed.max=100 speed.defl=100
    //% weight=60
    export function stepperRevolutions(port: StepperPort, direction: Direction, revolutions: number, speed: number): void {
        stepperDegrees(port, direction, Math.abs(revolutions) * 360, speed)
    }

    //% block="Stepper stop %port"
    //% weight=50
    export function stepperStop(port: StepperPort): void {
        init()
        stopPort(port)
    }

    //% block="Tank configure left %left right %right"
    //% weight=40
    export function tankConfigure(left: StepperPort, right: StepperPort): void {
        leftPort = left
        rightPort = right
    }

    //% block="Tank speed %speed %percent"
    //% speed.min=1 speed.max=100 speed.defl=100
    //% weight=39
    export function tankSpeed(speed: number): void {
        speed = Math.max(1, Math.min(100, speed))
        leftSpeed = speed
        rightSpeed = speed
    }

    //% block="Tank left speed %leftSpeed right speed %rightSpeed"
    //% leftSpeed.min=1 leftSpeed.max=100 leftSpeed.defl=100
    //% rightSpeed.min=1 rightSpeed.max=100 rightSpeed.defl=100
    //% weight=38
    export function tankDifferentialSpeed(left: number, right: number): void {
        leftSpeed = Math.max(1, Math.min(100, left))
        rightSpeed = Math.max(1, Math.min(100, right))
    }

    //% block="Tank forward %degrees degrees"
    //% degrees.min=1 degrees.max=36000 degrees.defl=360
    //% weight=37
    export function tankForward(degrees: number): void {
        init()
        let d = Math.abs(degrees)
        if (leftType == StepperType.BYJ_28) set28(leftPort, Direction.CW)
        else set42(leftPort, Direction.CW)
        if (rightType == StepperType.BYJ_28) set28(rightPort, Direction.CW)
        else set42(rightPort, Direction.CW)
        let maxSpeed = Math.max(leftSpeed, rightSpeed)
        basic.pause(Math.round(1000 * d / 360 * 100 / maxSpeed))
        stopPort(leftPort)
        stopPort(rightPort)
    }

    //% block="Tank backward %degrees degrees"
    //% degrees.min=1 degrees.max=36000 degrees.defl=360
    //% weight=36
    export function tankBackward(degrees: number): void {
        init()
        let d = Math.abs(degrees)
        if (leftType == StepperType.BYJ_28) set28(leftPort, Direction.CCW)
        else set42(leftPort, Direction.CCW)
        if (rightType == StepperType.BYJ_28) set28(rightPort, Direction.CCW)
        else set42(rightPort, Direction.CCW)
        let maxSpeed = Math.max(leftSpeed, rightSpeed)
        basic.pause(Math.round(1000 * d / 360 * 100 / maxSpeed))
        stopPort(leftPort)
        stopPort(rightPort)
    }

    //% block="Tank turn left %degrees degrees"
    //% degrees.min=1 degrees.max=36000 degrees.defl=180
    //% weight=35
    export function tankTurnLeft(degrees: number): void {
        init()
        let d = Math.abs(degrees)
        if (leftType == StepperType.BYJ_28) set28(leftPort, Direction.CCW)
        else set42(leftPort, Direction.CCW)
        if (rightType == StepperType.BYJ_28) set28(rightPort, Direction.CW)
        else set42(rightPort, Direction.CW)
        basic.pause(Math.round(1000 * d / 360 * 100 / Math.max(leftSpeed, rightSpeed)))
        stopPort(leftPort)
        stopPort(rightPort)
    }

    //% block="Tank turn right %degrees degrees"
    //% degrees.min=1 degrees.max=36000 degrees.defl=180
    //% weight=34
    export function tankTurnRight(degrees: number): void {
        init()
        let d = Math.abs(degrees)
        if (leftType == StepperType.BYJ_28) set28(leftPort, Direction.CW)
        else set42(leftPort, Direction.CW)
        if (rightType == StepperType.BYJ_28) set28(rightPort, Direction.CCW)
        else set42(rightPort, Direction.CCW)
        basic.pause(Math.round(1000 * d / 360 * 100 / Math.max(leftSpeed, rightSpeed)))
        stopPort(leftPort)
        stopPort(rightPort)
    }

    //% block="Tank stop"
    //% weight=33
    export function tankStop(): void {
        init()
        stopPort(leftPort)
        stopPort(rightPort)
    }
}
