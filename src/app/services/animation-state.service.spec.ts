import { TestBed } from '@angular/core/testing';

import { AnimationStateService } from './animation-state.service';

describe('AnimationStateService', () => {
  let service: AnimationStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AnimationStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
