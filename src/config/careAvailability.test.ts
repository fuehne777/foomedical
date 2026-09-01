// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Patient } from '@medplum/fhirtypes';
import { describe, expect, test } from 'vitest';
import {
  getBookingHoldBlockReason,
  isPatientEligibleForBooking,
  isSlotWithinBookingWindow,
} from './careAvailability';

function localTime(hours: number, minutes = 0): Date {
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

const activePatient: Patient = { resourceType: 'Patient', id: 'example-1', active: true };
const inactivePatient: Patient = { resourceType: 'Patient', id: 'example-2', active: false };

describe('careAvailability', () => {
  test('allows active patients only', () => {
    expect(isPatientEligibleForBooking(activePatient)).toBe(true);
    expect(isPatientEligibleForBooking(inactivePatient)).toBe(false);
    expect(isPatientEligibleForBooking({ resourceType: 'Patient', id: 'example-3' })).toBe(false);
    expect(isPatientEligibleForBooking(undefined)).toBe(false);
  });

  test('keeps slot starts inside the local 6:00 AM–10:00 PM window', () => {
    expect(isSlotWithinBookingWindow(localTime(5, 59))).toBe(false);
    expect(isSlotWithinBookingWindow(localTime(6, 0))).toBe(true);
    expect(isSlotWithinBookingWindow(localTime(22, 0))).toBe(true);
    expect(isSlotWithinBookingWindow(localTime(22, 1))).toBe(false);
  });

  test('blocks holds for ineligible patients and out-of-window slots', () => {
    expect(getBookingHoldBlockReason(inactivePatient, localTime(9))).toMatch(/active record/i);
    expect(getBookingHoldBlockReason(activePatient, localTime(23))).toMatch(/6:00 AM and 10:00 PM/i);
    expect(getBookingHoldBlockReason(activePatient, localTime(9))).toBeUndefined();
  });
});
