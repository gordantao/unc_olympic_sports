// VALD API types

export type ValdTestResults<T> = {
  tests: Array<T>;
}

export type NordbordTest = {
  profileId: string
  testId: string
  modifiedDateUtc: string
  testDateUtc: string
  testTypeId: string
  testTypeName: string
  notes: null | string
  device: string
  leftAvgForce: number
  leftImpulse: number
  leftMaxForce: number
  leftTorque: number
  leftCalibration: number
  leftRepetitions: number
  rightAvgForce: number
  rightImpulse: number
  rightMaxForce: number
  rightTorque: number
  rightCalibration: number
  rightRepetitions: number
}

export type ForceframeTest = {
  profileId: string
  testId: string
  testDateUtc: string
  testTypeId: string
  testPositionId: string
  notes: null | string
  innerLeftAvgForce: number
  innerLeftImpulse: number
  innerLeftMaxForce: number
  innerLeftRepetitions: number
  innerRightAvgForce: number
  innerRightImpulse: number
  innerRightMaxForce: number
  innerRightRepetitions: number
  outerLeftAvgForce: number
  outerLeftImpulse: number
  outerLeftMaxForce: number
  outerLeftRepetitions: number
  outerRightAvgForce: number
  outerRightImpulse: number
  outerRightMaxForce: number
  outerRightRepetitions: number
  device: string
  modifiedDateUtc: string
  testTypeName: string
  testPositionName: string
}

export type ForcedecksTest = {
  testId: string
  tenantId: string
  profileId: string
  recordingId: string
  modifiedDateUtc: string
  recordedDateUtc: string
  recordedDateOffset: number,
  recordedDateTimezone: string,
  analysedDateUtc: string
  analysedDateOffset: number,
  analysedDateTimezone: string,
  testType: string,
  notes: string,
  weight: number,
  parameter: {
    resultId: number,
    value: number
  },
  extendedParameters: null | [
    {
      resultId: number,
      value: number
    }
  ],
  attributes: null | [
    {
      attributeValueId: string
      attributeValueName: string
      attributeTypeId: string
      attributeTypeName: string
    }
  ]
}