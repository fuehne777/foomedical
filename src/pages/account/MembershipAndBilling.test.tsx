// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { MantineProvider } from '@mantine/core';
import { MockClient } from '@medplum/mock';
import type { Patient } from '@medplum/fhirtypes';
import { MedplumProvider } from '@medplum/react';
import { act, render } from '@testing-library/react';
import { Suspense } from 'react';
import { MemoryRouter } from 'react-router';
import { MembershipAndBilling } from './MembershipAndBilling';

const patient: Patient = { resourceType: 'Patient', id: 'example-1', active: true };

test('PaymentNotice search is scoped to the signed-in patient', async () => {
  const medplum = new MockClient({ seedDefaultData: false, profile: patient });
  const searchResources = vi.spyOn(medplum, 'searchResources');

  await act(async () => {
    render(
      <MemoryRouter>
        <MedplumProvider medplum={medplum}>
          <MantineProvider theme={{}}>
            <Suspense fallback={null}>
              <MembershipAndBilling />
            </Suspense>
          </MantineProvider>
        </MedplumProvider>
      </MemoryRouter>
    );
  });

  const paymentSearch = searchResources.mock.calls.find((call) => call[0] === 'PaymentNotice');
  expect(paymentSearch?.[1]).toEqual({ 'request:Claim.patient': 'Patient/example-1' });
});
