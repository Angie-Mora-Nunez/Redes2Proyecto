import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';

import { seasonGuard } from './season-guard';

describe('seasonGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => seasonGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
