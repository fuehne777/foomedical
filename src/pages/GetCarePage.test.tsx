// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { MantineProvider } from '@mantine/core';
import { MockClient } from '@medplum/mock';
import type { Appointment, Bundle, HealthcareService, Patient, Schedule } from '@medplum/fhirtypes';
import { MedplumProvider } from '@medplum/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { INELIGIBLE_PATIENT_MESSAGE } from '../config/careAvailability';
import { GetCare } from './GetCarePage';

const SERVICE_TYPE_REFERENCE_URI = 'https://medplum.com/fhir/service-type-reference';

const activePatient: Patient = { resourceType: 'Patient', id: 'example-active', active: true };
const inactivePatient: Patient = { resourceType: 'Patient', id: 'example-inactive', active: false };

function slotStartTomorrow(hour: number, minute = 0): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function renderGetCare(medplum: MockClient): void {
  render(
    <MemoryRouter>
      <MedplumProvider medplum={medplum}>
        <MantineProvider theme={{}}>
          <GetCare />
        </MantineProvider>
      </MedplumProvider>
    </MemoryRouter>
  );
}

async function setupScheduler(slotStart: Date): Promise<{ medplum: MockClient; holdPost: ReturnType<typeof vi.spyOn> }> {
  const medplum = new MockClient({ seedDefaultData: false, profile: activePatient });

  const service = await medplum.createResource<HealthcareService>({
    resourceType: 'HealthcareService',
    name: 'Office Visit',
  });
  await medplum.createResource<Schedule>({
    resourceType: 'Schedule',
    actor: [{ display: 'Example Practitioner' }],
    serviceType: [
      {
        extension: [
          {
            url: SERVICE_TYPE_REFERENCE_URI,
            valueReference: { reference: `HealthcareService/${service.id}` },
          },
        ],
      },
    ],
  });

  const appointment: Appointment = {
    resourceType: 'Appointment',
    status: 'proposed',
    start: slotStart.toISOString(),
    participant: [{ actor: { display: 'Example Practitioner' }, status: 'accepted' }],
  };

  const originalGet = medplum.get.bind(medplum);
  vi.spyOn(medplum, 'get').mockImplementation(async (url, options) => {
    if (String(url).includes('Appointment/$find')) {
      return { resourceType: 'Bundle', entry: [{ resource: appointment }] } as Bundle<Appointment>;
    }
    return originalGet(url, options);
  });

  const originalPost = medplum.post.bind(medplum);
  const holdPost = vi.spyOn(medplum, 'post').mockImplementation(async (url, body, contentType, options) => {
    if (String(url).includes('Appointment/$hold')) {
      return { resourceType: 'Bundle' } as Bundle;
    }
    return originalPost(url, body, contentType, options);
  });

  return { medplum, holdPost };
}

async function selectDisplayedSlot(slotStart: Date): Promise<void> {
  expect(await screen.findByText('Select date')).toBeInTheDocument();

  const shownMonth = new Date();
  if (slotStart.getMonth() !== shownMonth.getMonth() || slotStart.getFullYear() !== shownMonth.getFullYear()) {
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    });
    expect(await screen.findByText('Select date')).toBeInTheDocument();
  }

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: String(slotStart.getDate()) }));
  });

  const timeLabel = slotStart.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  await act(async () => {
    fireEvent.click(await screen.findByRole('button', { name: timeLabel }));
  });
}

test('booking inside the allowed window holds the appointment', async () => {
  const slotStart = slotStartTomorrow(10);
  const { medplum, holdPost } = await setupScheduler(slotStart);

  await act(async () => {
    renderGetCare(medplum);
  });
  await selectDisplayedSlot(slotStart);

  expect(await screen.findByText("You're all set!")).toBeInTheDocument();
  expect(holdPost).toHaveBeenCalled();
  expect(String(holdPost.mock.calls[0][0])).toContain('Appointment/$hold');
});

test('booking outside the allowed window is blocked', async () => {
  const slotStart = slotStartTomorrow(23);
  const { medplum, holdPost } = await setupScheduler(slotStart);

  await act(async () => {
    renderGetCare(medplum);
  });
  await selectDisplayedSlot(slotStart);

  expect(await screen.findByText('Booking unavailable')).toBeInTheDocument();
  expect(screen.getByText(/6:00 AM and 10:00 PM/)).toBeInTheDocument();
  expect(screen.queryByText("You're all set!")).not.toBeInTheDocument();
  expect(holdPost.mock.calls.some((call) => String(call[0]).includes('Appointment/$hold'))).toBe(false);
});

test('ineligible patient is blocked from booking', async () => {
  const medplum = new MockClient({ seedDefaultData: false, profile: inactivePatient });

  await act(async () => {
    renderGetCare(medplum);
  });

  expect(await screen.findByText('Booking unavailable')).toBeInTheDocument();
  expect(screen.getByText(INELIGIBLE_PATIENT_MESSAGE)).toBeInTheDocument();
  expect(screen.queryByTestId('scheduler')).not.toBeInTheDocument();
});
