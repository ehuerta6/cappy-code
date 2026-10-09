// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Badge, Button, StateMessage } from './primitives';

describe('shared UI primitives', () => {
  it('keeps action variants keyboard-operable and respects disabled state', () => {
    render(
      <>
        <Button variant="primary">Save changes</Button>
        <Button variant="danger" disabled>
          Delete Session
        </Button>
      </>,
    );

    expect(
      screen.getByRole('button', { name: 'Save changes' }).className,
    ).toContain('ui-button ui-button--primary');
    expect(
      (
        screen.getByRole('button', {
          name: 'Delete Session',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('keeps status text available to assistive technology', () => {
    render(
      <>
        <Badge tone="success">Live</Badge>
        <StateMessage role="alert">
          Problem Bank could not be loaded.
        </StateMessage>
      </>,
    );

    expect(screen.getByText('Live').className).toContain(
      'ui-badge ui-badge--success',
    );
    expect(screen.getByRole('alert').textContent).toContain(
      'Problem Bank could not be loaded.',
    );
  });
});
