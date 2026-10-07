const api = {
  setSendLiveMetrics: jest.fn(),
  start: jest.fn(),
};
api.setSendLiveMetrics.mockReturnValue(api);

const setup = jest.fn(() => api);

jest.mock('applicationinsights', () => ({
  setup: (...args: unknown[]) => (setup as (...a: unknown[]) => unknown)(...args),
}));

import { iniciarTelemetria } from '../../src/telemetria';

describe('iniciarTelemetria', () => {
  beforeEach(() => {
    setup.mockImplementation(() => api);
    api.setSendLiveMetrics.mockReturnValue(api);
  });

  it('string vazia → false e o SDK não é chamado', () => {
    expect(iniciarTelemetria('')).toBe(false);
    expect(setup).not.toHaveBeenCalled();
    expect(api.setSendLiveMetrics).not.toHaveBeenCalled();
    expect(api.start).not.toHaveBeenCalled();
  });

  it('string não vazia → setup(connectionString), setSendLiveMetrics(false), start() e true', () => {
    const cs = 'InstrumentationKey=00000000-0000-0000-0000-000000000000';
    expect(iniciarTelemetria(cs)).toBe(true);
    expect(setup).toHaveBeenCalledWith(cs);
    expect(api.setSendLiveMetrics).toHaveBeenCalledWith(false);
    expect(api.start).toHaveBeenCalledTimes(1);
  });
});
