// SPDX-FileCopyrightText: Copyright Orangebot, Inc. and Medplum contributors
// SPDX-License-Identifier: Apache-2.0
import { MantineProvider } from '@mantine/core';
import { MockClient } from '@medplum/mock';
import { MedplumProvider } from '@medplum/react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { HomePage } from './HomePage';

function PathProbe() {
  const location = useLocation();
  return <div data-testid="path">{location.pathname}</div>;
}

test('hero Get Care navigates to the scheduling page', async () => {
  await act(async () => {
    render(
      <MemoryRouter>
        <MedplumProvider medplum={new MockClient()}>
          <MantineProvider theme={{}}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/get-care" element={<PathProbe />} />
            </Routes>
          </MantineProvider>
        </MedplumProvider>
      </MemoryRouter>
    );
  });

  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Get Care' }));
  });

  expect(screen.getByTestId('path').textContent).toBe('/get-care');
});
