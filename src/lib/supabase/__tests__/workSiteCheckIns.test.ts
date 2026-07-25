import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  captureCurrentWorkSiteLocation,
  workSiteMapUrl,
} from '@/lib/supabase/workSiteCheckIns';

const originalGeolocation = navigator.geolocation;

afterEach(() => {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: originalGeolocation,
  });
  vi.restoreAllMocks();
});

describe('captureCurrentWorkSiteLocation', () => {
  it('returns coordinates, accuracy and the device capture timestamp', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: {
          latitude: 60.169857,
          longitude: 24.938379,
          accuracy: 18.4,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.UTC(2026, 6, 25, 6, 30, 0),
      } as GeolocationPosition);
    });

    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition },
    });

    await expect(captureCurrentWorkSiteLocation()).resolves.toEqual({
      latitude: 60.169857,
      longitude: 24.938379,
      accuracyM: 18.4,
      capturedAt: '2026-07-25T06:30:00.000Z',
    });
    expect(getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });

  it('explains how to recover when location permission is denied', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_success: PositionCallback, error: PositionErrorCallback) => error({
          code: 1,
          message: 'denied',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        }),
      },
    });

    await expect(captureCurrentWorkSiteLocation()).rejects.toThrow(
      'Sijaintilupa evättiin. Salli sijainti selaimen asetuksista, jotta voit kirjautua työmaalle.',
    );
  });

  it('rejects invalid coordinates returned by the device', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => success({
          coords: {
            latitude: 120,
            longitude: 24.938379,
            accuracy: 10,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition),
      },
    });

    await expect(captureCurrentWorkSiteLocation()).rejects.toThrow(
      'Laite palautti virheellisen sijaintitiedon.',
    );
  });

  it('rejects location uncertainty above the database limit', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success: PositionCallback) => success({
          coords: {
            latitude: 60.169857,
            longitude: 24.938379,
            accuracy: 100_001,
            altitude: null,
            altitudeAccuracy: null,
            heading: null,
            speed: null,
          },
          timestamp: Date.now(),
        } as GeolocationPosition),
      },
    });

    await expect(captureCurrentWorkSiteLocation()).rejects.toThrow(
      'Laite palautti virheellisen sijaintitiedon.',
    );
  });

  it('rejects browsers without geolocation support', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: undefined,
    });

    await expect(captureCurrentWorkSiteLocation()).rejects.toThrow(
      'Tämä selain tai laite ei tue sijainnin määritystä.',
    );
  });
});

describe('workSiteMapUrl', () => {
  it('creates an OpenStreetMap link without making a background geocoding request', () => {
    expect(workSiteMapUrl({ latitude: 60.169857, longitude: 24.938379 })).toBe(
      'https://www.openstreetmap.org/?mlat=60.169857&mlon=24.938379#map=18/60.169857/24.938379',
    );
  });
});
