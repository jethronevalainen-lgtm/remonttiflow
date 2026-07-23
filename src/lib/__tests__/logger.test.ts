import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { log, logger } from '../logger';

// import.meta.env.DEV is true under Vitest, so the dev console path is active.
describe('logger (dev mode)', () => {
  let debugSpy: ReturnType<typeof vi.spyOn>;
  let infoSpy: ReturnType<typeof vi.spyOn>;
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("log('debug', ...) routes to console.debug with the [VaKantti] prefix", () => {
    log('debug', 'vianjäljitys');
    expect(debugSpy).toHaveBeenCalledTimes(1);
    expect(debugSpy).toHaveBeenCalledWith('[VaKantti] vianjäljitys');
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("log('info', ...) routes to console.info", () => {
    log('info', 'tieto');
    expect(infoSpy).toHaveBeenCalledTimes(1);
    expect(infoSpy).toHaveBeenCalledWith('[VaKantti] tieto');
    expect(debugSpy).not.toHaveBeenCalled();
  });

  it("log('warn', ...) routes to console.warn", () => {
    log('warn', 'varoitus');
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('[VaKantti] varoitus');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("log('error', ...) routes to console.error", () => {
    log('error', 'virhe');
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('[VaKantti] virhe');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('passes the context object as a second argument when provided', () => {
    const context = { code: 500, detail: 'palvelinvirhe' };
    log('error', 'pyyntö epäonnistui', context);
    expect(errorSpy).toHaveBeenCalledWith('[VaKantti] pyyntö epäonnistui', context);
  });

  it('omits the second argument when context is undefined', () => {
    log('info', 'ei kontekstia');
    expect(infoSpy).toHaveBeenCalledWith('[VaKantti] ei kontekstia');
    expect(infoSpy.mock.calls[0]).toHaveLength(1);
  });

  it('logger.debug/info/warn/error delegate to the matching console method', () => {
    logger.debug('d');
    logger.info('i');
    logger.warn('w');
    logger.error('e');
    expect(debugSpy).toHaveBeenCalledWith('[VaKantti] d');
    expect(infoSpy).toHaveBeenCalledWith('[VaKantti] i');
    expect(warnSpy).toHaveBeenCalledWith('[VaKantti] w');
    expect(errorSpy).toHaveBeenCalledWith('[VaKantti] e');
  });

  it('logger methods forward the context object', () => {
    const ctx = { err: new Error('boom') };
    logger.error('kaatui', ctx);
    expect(errorSpy).toHaveBeenCalledWith('[VaKantti] kaatui', ctx);
  });
});
