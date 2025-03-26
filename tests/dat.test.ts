import {
  assert,
  describe,
  test,
  clearStore,
  beforeAll,
  afterAll
} from "matchstick-as/assembly/index"
import { Address, BigInt } from "@graphprotocol/graph-ts"
import { AddressBlocked } from "../generated/schema"
import { AddressBlocked as AddressBlockedEvent } from "../generated/DAT/DAT"
import { handleAddressBlocked } from "../src/dat"
import { createAddressBlockedEvent } from "./dat-utils"

// Tests structure (matchstick-as >=0.5.0)
// https://thegraph.com/docs/en/developer/matchstick/#tests-structure-0-5-0

describe("Describe entity assertions", () => {
  beforeAll(() => {
    let blockedAddress = Address.fromString(
      "0x0000000000000000000000000000000000000001"
    )
    let newAddressBlockedEvent = createAddressBlockedEvent(blockedAddress)
    handleAddressBlocked(newAddressBlockedEvent)
  })

  afterAll(() => {
    clearStore()
  })

  // For more test scenarios, see:
  // https://thegraph.com/docs/en/developer/matchstick/#write-a-unit-test

  test("AddressBlocked created and stored", () => {
    assert.entityCount("AddressBlocked", 1)

    // 0xa16081f360e3847006db660bae1c6d1b2e17ec2a is the default address used in newMockEvent() function
    assert.fieldEquals(
      "AddressBlocked",
      "0xa16081f360e3847006db660bae1c6d1b2e17ec2a-1",
      "blockedAddress",
      "0x0000000000000000000000000000000000000001"
    )

    // More assert options:
    // https://thegraph.com/docs/en/developer/matchstick/#asserts
  })
})
