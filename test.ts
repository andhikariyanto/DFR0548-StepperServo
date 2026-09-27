// DFR0548 V1 test examples

DFR0548.stepperConfigure(DFR0548.StepperPort.M1_M2,
    DFR0548.StepperType.BYJ_28, 2048)
DFR0548.stepperConfigure(DFR0548.StepperPort.M3_M4,
    DFR0548.StepperType.BYJ_28, 2048)

DFR0548.tankConfigure(DFR0548.StepperPort.M1_M2,
    DFR0548.StepperPort.M3_M4)
DFR0548.tankSpeed(100)

// Forward: both CW
DFR0548.tankForward(100)

// Backward: both CCW
DFR0548.tankBackward(100)

// Pivot left/right
DFR0548.tankTurnLeft(100)
DFR0548.tankTurnRight(100)

// Servo
DFR0548.servoAngle(DFR0548.ServoPort.S1, 90)
