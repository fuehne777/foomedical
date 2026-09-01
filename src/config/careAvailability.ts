// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import type { Patient } from '@medplum/fhirtypes';

/** Inclusive patient-local booking window. */
export const BOOKING_WINDOW = {
  startHour: 6,
  startMinute: 0,
  endHour: 22,
  endMinute: 0,
} as const;

export const INELIGIBLE_PATIENT_MESSAGE = 'Only patients with an active record can request an appointment.';

export function isPatientEligibleForBooking(patient: Patient | undefined): patient is Patient {
  return patient?.resourceType === 'Patient' && patient.active === true;
}

export function isSlotWithinBookingWindow(slotStart: Date): boolean {
  const slotMinutes = toMinutes(slotStart.getHours(), slotStart.getMinutes());
  const startMinutes = toMinutes(BOOKING_WINDOW.startHour, BOOKING_WINDOW.startMinute);
  const endMinutes = toMinutes(BOOKING_WINDOW.endHour, BOOKING_WINDOW.endMinute);
  return slotMinutes >= startMinutes && slotMinutes <= endMinutes;
}

export function formatBookingWindowLabel(): string {
  return `${formatClock(BOOKING_WINDOW.startHour, BOOKING_WINDOW.startMinute)} and ${formatClock(BOOKING_WINDOW.endHour, BOOKING_WINDOW.endMinute)}`;
}

export function getBookingHoldBlockReason(
  patient: Patient | undefined,
  slotStart: Date | undefined
): string | undefined {
  if (!isPatientEligibleForBooking(patient)) {
    return INELIGIBLE_PATIENT_MESSAGE;
  }
  if (!slotStart || !isSlotWithinBookingWindow(slotStart)) {
    return `Appointments can only be requested between ${formatBookingWindowLabel()} (your local time). This time is outside the booking window.`;
  }
  return undefined;
}

function toMinutes(hour: number, minute: number): number {
  return hour * 60 + minute;
}

function formatClock(hour: number, minute: number): string {
  const period = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  const paddedMinute = String(minute).padStart(2, '0');
  return `${hour12}:${paddedMinute} ${period}`;
}
