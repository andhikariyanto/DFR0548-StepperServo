//% weight=10 color=#DF6721 icon="\uf013" block="DFR0548"
namespace DFR0548 {

    const PCA = 0x40
    const MODE1 = 0x00
    const PRESCALE = 0xFE
    const LED0 = 0x06

    // Patterns copied from the original DFR0548/DFRobot driver.
    const A_ON = 2047
    const A_OFF = 4095
    const B_ON = 1
    const B_OFF = 2047
    const C_ON = 1023
    const C_OFF = 3071
    const D_ON = 3071
    const D_OFF = 1023

    const GA_ON = 3071
    const GA_OFF = 1023
    const GB_ON = 1023
    const GB_OFF = 3071
    const GC_ON = 4095
    const GC_OFF = 2047
    const GD_ON = 2047
    const GD_OFF = 4095

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
    let leftType = StepperType.BYJ_28
    let rightType = StepperType.BYJ_28
    let leftSteps = 2048
    let rightSteps = 2048
    let leftRpm = 10
    let rightRpm = 10

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
        setFrequency(50)
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
        // RESTART + AI (auto increment), needed for burst writes.
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

    // Write four consecutive PCA9685 channels in one I2C transaction.
    function pwm4(base: number, aOn: number, aOff: number, bOn: number, bOff: number, cOn: number, cOff: number, dOn: number, dOff: number): void {
        let b = pins.createBuffer(17)
        b[0] = LED0 + base * 4
        b[1] = aOn & 0xFF
        b[2] = (aOn >> 8) & 0x0F
        b[3] = aOff & 0xFF
        b[4] = (aOff >> 8) & 0x0F
        b[5] = bOn & 0xFF
        b[6] = (bOn >> 8) & 0x0F
        b[7] = bOff & 0xFF
        b[8] = (bOff >> 8) & 0x0F
        b[9] = cOn & 0xFF
        b[10] = (cOn >> 8) & 0x0F
        b[11] = cOff & 0xFF
        b[12] = (cOff >> 8) & 0x0F
        b[13] = dOn & 0xFF
        b[14] = (dOn >> 8) & 0x0F
        b[15] = dOff & 0xFF
        b[16] = (dOff >> 8) & 0x0F
        pins.i2cWriteBuffer(PCA, b)
    }

    // micro:bit I2C writes must stay within the safe buffer size.
    // PCA9685 needs 1 register byte + 16 data bytes for 4 channels,
    // so two 17-byte transactions are used for both tank motors.
    function tankWritePair(
        r0On: number, r0Off: number, r1On: number, r1Off: number,
        r2On: number, r2Off: number, r3On: number, r3Off: number,
        l0On: number, l0Off: number, l1On: number, l1Off: number,
        l2On: number, l2Off: number, l3On: number, l3Off: number): void {
        pwm4(0, r0On,r0Off, r1On,r1Off, r2On,r2Off, r3On,r3Off)
        pwm4(4, l0On,l0Off, l1On,l1Off, l2On,l2Off, l3On,l3Off)
    }

    function tankPhasePair(leftType: StepperType, leftPhase: number, rightType: StepperType, rightPhase: number): void {
        leftPhase = leftPhase % 4
        if (leftPhase < 0) leftPhase = leftPhase + 4
        rightPhase = rightPhase % 4
        if (rightPhase < 0) rightPhase = rightPhase + 4
        let r0 = 0, r1 = 0, r2 = 0, r3 = 0
        let l0 = 0, l1 = 0, l2 = 0, l3 = 0

        if (rightType == StepperType.BYJ_28) {
            if (rightPhase == 0) { r0=A_ON; r1=C_ON; r2=B_ON; r3=D_ON }
            else if (rightPhase == 1) { r0=B_ON; r1=D_ON; r2=C_ON; r3=A_ON }
            else if (rightPhase == 2) { r0=C_ON; r1=A_ON; r2=D_ON; r3=B_ON }
            else { r0=D_ON; r1=B_ON; r2=A_ON; r3=C_ON }
            // OFF values are fixed per coil pattern.
            let ro0 = A_OFF, ro1 = C_OFF, ro2 = B_OFF, ro3 = D_OFF
            if (rightPhase == 1) { ro0=B_OFF; ro1=D_OFF; ro2=C_OFF; ro3=A_OFF }
            else if (rightPhase == 2) { ro0=C_OFF; ro1=A_OFF; ro2=D_OFF; ro3=B_OFF }
            else if (rightPhase == 3) { ro0=D_OFF; ro1=B_OFF; ro2=A_OFF; ro3=C_OFF }
            if (leftType == StepperType.BYJ_28) {
                if (leftPhase == 0) { l0=A_ON; l1=C_ON; l2=B_ON; l3=D_ON }
                else if (leftPhase == 1) { l0=B_ON; l1=D_ON; l2=C_ON; l3=A_ON }
                else if (leftPhase == 2) { l0=C_ON; l1=A_ON; l2=D_ON; l3=B_ON }
                else { l0=D_ON; l1=B_ON; l2=A_ON; l3=C_ON }
            } else {
                if (leftPhase == 0) { l0=GD_ON; l1=GC_ON; l2=GB_ON; l3=GA_ON }
                else if (leftPhase == 1) { l0=GC_ON; l1=GB_ON; l2=GA_ON; l3=GD_ON }
                else if (leftPhase == 2) { l0=GB_ON; l1=GA_ON; l2=GD_ON; l3=GC_ON }
                else { l0=GA_ON; l1=GD_ON; l2=GC_ON; l3=GB_ON }
            }
            let lo0:number; let lo1:number; let lo2:number; let lo3:number
            if (leftType == StepperType.BYJ_28) {
                lo0=A_OFF; lo1=C_OFF; lo2=B_OFF; lo3=D_OFF
                if (leftPhase == 1) { lo0=B_OFF; lo1=D_OFF; lo2=C_OFF; lo3=A_OFF }
                else if (leftPhase == 2) { lo0=C_OFF; lo1=A_OFF; lo2=D_OFF; lo3=B_OFF }
                else if (leftPhase == 3) { lo0=D_OFF; lo1=B_OFF; lo2=A_OFF; lo3=C_OFF }
            } else {
                lo0=GD_OFF; lo1=GC_OFF; lo2=GB_OFF; lo3=GA_OFF
                if (leftPhase == 1) { lo0=GC_OFF; lo1=GB_OFF; lo2=GA_OFF; lo3=GD_OFF }
                else if (leftPhase == 2) { lo0=GB_OFF; lo1=GA_OFF; lo2=GD_OFF; lo3=GC_OFF }
                else if (leftPhase == 3) { lo0=GA_OFF; lo1=GD_OFF; lo2=GC_OFF; lo3=GB_OFF }
            }
            tankWritePair(r0,ro0,r1,ro1,r2,ro2,r3,ro3,l0,lo0,l1,lo1,l2,lo2,l3,lo3)
        } else {
            // Right motor is 42BYGH.
            if (rightPhase == 0) { r0=GD_ON; r1=GC_ON; r2=GB_ON; r3=GA_ON }
            else if (rightPhase == 1) { r0=GC_ON; r1=GB_ON; r2=GA_ON; r3=GD_ON }
            else if (rightPhase == 2) { r0=GB_ON; r1=GA_ON; r2=GD_ON; r3=GC_ON }
            else { r0=GA_ON; r1=GD_ON; r2=GC_ON; r3=GB_ON }
            let ro0=GD_OFF, ro1=GC_OFF, ro2=GB_OFF, ro3=GA_OFF
            if (rightPhase == 1) { ro0=GC_OFF; ro1=GB_OFF; ro2=GA_OFF; ro3=GD_OFF }
            else if (rightPhase == 2) { ro0=GB_OFF; ro1=GA_OFF; ro2=GD_OFF; ro3=GC_OFF }
            else if (rightPhase == 3) { ro0=GA_OFF; ro1=GD_OFF; ro2=GC_OFF; ro3=GB_OFF }
            if (leftType == StepperType.BYJ_28) {
                if (leftPhase == 0) { l0=A_ON; l1=C_ON; l2=B_ON; l3=D_ON }
                else if (leftPhase == 1) { l0=B_ON; l1=D_ON; l2=C_ON; l3=A_ON }
                else if (leftPhase == 2) { l0=C_ON; l1=A_ON; l2=D_ON; l3=B_ON }
                else { l0=D_ON; l1=B_ON; l2=A_ON; l3=C_ON }
                let lo0=A_OFF, lo1=C_OFF, lo2=B_OFF, lo3=D_OFF
                if (leftPhase == 1) { lo0=B_OFF; lo1=D_OFF; lo2=C_OFF; lo3=A_OFF }
                else if (leftPhase == 2) { lo0=C_OFF; lo1=A_OFF; lo2=D_OFF; lo3=B_OFF }
                else if (leftPhase == 3) { lo0=D_OFF; lo1=B_OFF; lo2=A_OFF; lo3=C_OFF }
                tankWritePair(r0,ro0,r1,ro1,r2,ro2,r3,ro3,l0,lo0,l1,lo1,l2,lo2,l3,lo3)
            } else {
                if (leftPhase == 0) { l0=GD_ON; l1=GC_ON; l2=GB_ON; l3=GA_ON }
                else if (leftPhase == 1) { l0=GC_ON; l1=GB_ON; l2=GA_ON; l3=GD_ON }
                else if (leftPhase == 2) { l0=GB_ON; l1=GA_ON; l2=GD_ON; l3=GC_ON }
                else { l0=GA_ON; l1=GD_ON; l2=GC_ON; l3=GB_ON }
                let lo0=GD_OFF, lo1=GC_OFF, lo2=GB_OFF, lo3=GA_OFF
                if (leftPhase == 1) { lo0=GC_OFF; lo1=GB_OFF; lo2=GA_OFF; lo3=GD_OFF }
                else if (leftPhase == 2) { lo0=GB_OFF; lo1=GA_OFF; lo2=GD_OFF; lo3=GC_OFF }
                else if (leftPhase == 3) { lo0=GA_OFF; lo1=GD_OFF; lo2=GC_OFF; lo3=GB_OFF }
                tankWritePair(r0,ro0,r1,ro1,r2,ro2,r3,ro3,l0,lo0,l1,lo1,l2,lo2,l3,lo3)
            }
        }
    }

    function stopPort(port: StepperPort): void {
        if (port == StepperPort.M1_M2) {
            pwm4(4, 0, 0, 0, 0, 0, 0, 0, 0)
        } else {
            pwm4(0, 0, 0, 0, 0, 0, 0, 0, 0)
        }
    }

    // 28BYJ-48: one full-step is one transition through the 4-phase sequence.
    // Default 2048 steps/rev corresponds to the common geared 28BYJ-48 full-step setup.
    function phase28(port: StepperPort, phase: number): void {
        let base = 4
        if (port == StepperPort.M3_M4) base = 0
        phase = phase % 4
        if (phase < 0) phase = phase + 4
        if (phase == 0) pwm4(base, A_ON,A_OFF, C_ON,C_OFF, B_ON,B_OFF, D_ON,D_OFF)
        else if (phase == 1) pwm4(base, B_ON,B_OFF, D_ON,D_OFF, C_ON,C_OFF, A_ON,A_OFF)
        else if (phase == 2) pwm4(base, C_ON,C_OFF, A_ON,A_OFF, D_ON,D_OFF, B_ON,B_OFF)
        else pwm4(base, D_ON,D_OFF, B_ON,B_OFF, A_ON,A_OFF, C_ON,C_OFF)
    }

    // 42BYGH1861A-C: original DFRobot pattern, rotated one phase per step.
    function phase42(port: StepperPort, phase: number): void {
        let base = 4
        if (port == StepperPort.M3_M4) base = 0
        phase = phase % 4
        if (phase < 0) phase = phase + 4
        if (phase == 0) pwm4(base, GD_ON,GD_OFF, GC_ON,GC_OFF, GB_ON,GB_OFF, GA_ON,GA_OFF)
        else if (phase == 1) pwm4(base, GC_ON,GC_OFF, GB_ON,GB_OFF, GA_ON,GA_OFF, GD_ON,GD_OFF)
        else if (phase == 2) pwm4(base, GB_ON,GB_OFF, GA_ON,GA_OFF, GD_ON,GD_OFF, GC_ON,GC_OFF)
        else pwm4(base, GA_ON,GA_OFF, GD_ON,GD_OFF, GC_ON,GC_OFF, GB_ON,GB_OFF)
    }

    function stepOnce(port: StepperPort, motorType: StepperType, phase: number): void {
        if (motorType == StepperType.BYJ_28) phase28(port, phase)
        else phase42(port, phase)
    }

    function stepDelayUs(stepsPerRev: number, rpm: number): number {
        if (stepsPerRev < 1) stepsPerRev = 1
        if (rpm < 1) rpm = 1
        let us = Math.round(60000000 / (stepsPerRev * rpm))
        if (us < 100) us = 100
        return us
    }

    function moveSteps(port: StepperPort, motorType: StepperType, stepsPerRev: number, direction: Direction, steps: number, rpm: number): void {
        init()
        steps = Math.round(Math.abs(steps))
        if (steps <= 0) return
        rpm = Math.max(1, Math.min(300, rpm))
        let phase = 0
        let delayUs = stepDelayUs(stepsPerRev, rpm)
        for (let i = 0; i < steps; i++) {
            if (direction == Direction.CW) phase++
            else phase--
            stepOnce(port, motorType, phase)
            control.waitMicros(delayUs)
        }
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
        stepsPerRev = Math.max(1, Math.round(stepsPerRev))
        if (port == StepperPort.M1_M2) {
            leftType = motorType
            leftSteps = stepsPerRev
        } else {
            rightType = motorType
            rightSteps = stepsPerRev
        }
    }

    //% block="Stepper %port %direction steps %steps speed %rpm RPM"
    //% steps.min=1 steps.max=100000 steps.defl=2048
    //% rpm.min=1 rpm.max=300 rpm.defl=10
    //% weight=79
    export function stepperSteps(port: StepperPort, direction: Direction, steps: number, rpm: number): void {
        let motorType = leftType
        let stepsPerRev = leftSteps
        if (port == StepperPort.M3_M4) {
            motorType = rightType
            stepsPerRev = rightSteps
        }
        moveSteps(port, motorType, stepsPerRev, direction, steps, rpm)
    }

    //% block="Stepper %port %direction degrees %degrees speed %rpm RPM"
    //% degrees.min=1 degrees.max=36000 degrees.defl=90
    //% rpm.min=1 rpm.max=300 rpm.defl=10
    //% weight=78
    export function stepperDegrees(port: StepperPort, direction: Direction, degrees: number, rpm: number): void {
        let stepsPerRev = leftSteps
        if (port == StepperPort.M3_M4) stepsPerRev = rightSteps
        let steps = Math.round(Math.abs(degrees) * stepsPerRev / 360)
        stepperSteps(port, direction, steps, rpm)
    }

    //% block="Stepper %port %direction revolutions %revolutions speed %rpm RPM"
    //% revolutions.min=0.01 revolutions.max=1000 revolutions.defl=1
    //% rpm.min=1 rpm.max=300 rpm.defl=10
    //% weight=77
    export function stepperRevolutions(port: StepperPort, direction: Direction, revolutions: number, rpm: number): void {
        let stepsPerRev = leftSteps
        if (port == StepperPort.M3_M4) stepsPerRev = rightSteps
        let steps = Math.round(Math.abs(revolutions) * stepsPerRev)
        stepperSteps(port, direction, steps, rpm)
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

    //% block="Tank speed %rpm RPM"
    //% rpm.min=1 rpm.max=300 rpm.defl=10
    //% weight=39
    export function tankSpeed(rpm: number): void {
        rpm = Math.max(1, Math.min(300, rpm))
        leftRpm = rpm
        rightRpm = rpm
    }

    //% block="Tank left speed %leftRPM RPM right speed %rightRPM RPM"
    //% leftRPM.min=1 leftRPM.max=300 leftRPM.defl=10
    //% rightRPM.min=1 rightRPM.max=300 rightRPM.defl=10
    //% weight=38
    export function tankDifferentialSpeed(leftRPM: number, rightRPM: number): void {
        leftRpm = Math.max(1, Math.min(300, leftRPM))
        rightRpm = Math.max(1, Math.min(300, rightRPM))
    }

    // Tank commands intentionally use the configured steps/rev of each motor.
    // Both motors receive the same number of mechanical revolutions.
    function tankMove(revolutions: number, leftDirection: Direction, rightDirection: Direction): void {
        init()
        let leftCount = Math.round(Math.abs(revolutions) * leftSteps)
        let rightCount = Math.round(Math.abs(revolutions) * rightSteps)
        let maxCount = Math.max(leftCount, rightCount)
        if (maxCount <= 0) return

        let leftPhase = 0
        let rightPhase = 0
        let leftDone = 0
        let rightDone = 0
        let leftDelay = stepDelayUs(leftSteps, leftRpm)
        let rightDelay = stepDelayUs(rightSteps, rightRpm)
        let leftTimer = 0
        let rightTimer = 0
        let tick = 50

        // Finite scheduler: the counters are the only termination condition.
        while (leftDone < leftCount || rightDone < rightCount) {
            // If both motors are due together, update all 8 coils in ONE I2C transaction.
            if (leftDone < leftCount && rightDone < rightCount && leftTimer <= 0 && rightTimer <= 0) {
                if (leftDirection == Direction.CW) leftPhase++
                else leftPhase--
                if (rightDirection == Direction.CW) rightPhase++
                else rightPhase--
                tankPhasePair(leftType, leftPhase, rightType, rightPhase)
                leftDone++
                rightDone++
                leftTimer = leftDelay
                rightTimer = rightDelay
            } else {
                if (leftDone < leftCount && leftTimer <= 0) {
                    if (leftDirection == Direction.CW) leftPhase++
                    else leftPhase--
                    if (leftType == StepperType.BYJ_28) phase28(leftPort, leftPhase)
                    else phase42(leftPort, leftPhase)
                    leftDone++
                    leftTimer = leftDelay
                }
                if (rightDone < rightCount && rightTimer <= 0) {
                    if (rightDirection == Direction.CW) rightPhase++
                    else rightPhase--
                    if (rightType == StepperType.BYJ_28) phase28(rightPort, rightPhase)
                    else phase42(rightPort, rightPhase)
                    rightDone++
                    rightTimer = rightDelay
                }
            }
            control.waitMicros(tick)
            leftTimer -= tick
            rightTimer -= tick
        }
        stopPort(leftPort)
        stopPort(rightPort)
    }

    //% block="Tank forward %revolutions revolutions"
    //% revolutions.min=0.01 revolutions.max=1000 revolutions.defl=1
    //% weight=37
    export function tankForward(revolutions: number): void {
        tankMove(revolutions, Direction.CCW, Direction.CW)
    }

    //% block="Tank backward %revolutions revolutions"
    //% revolutions.min=0.01 revolutions.max=1000 revolutions.defl=1
    //% weight=36
    export function tankBackward(revolutions: number): void {
        tankMove(revolutions, Direction.CW, Direction.CCW)
    }

    //% block="Tank turn left %revolutions revolutions"
    //% revolutions.min=0.01 revolutions.max=1000 revolutions.defl=1
    //% weight=35
    export function tankTurnLeft(revolutions: number): void {
        tankMove(revolutions, Direction.CW, Direction.CW)
    }

    //% block="Tank turn right %revolutions revolutions"
    //% revolutions.min=0.01 revolutions.max=1000 revolutions.defl=1
    //% weight=34
    export function tankTurnRight(revolutions: number): void {
        tankMove(revolutions, Direction.CCW, Direction.CCW)
    }

    //% block="Tank stop"
    //% weight=33
    export function tankStop(): void {
        init()
        stopPort(leftPort)
        stopPort(rightPort)
    }
}
