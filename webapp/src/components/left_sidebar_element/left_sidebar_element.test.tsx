import React, {act} from 'react';
import {createRoot, Root} from 'react-dom/client';

import LeftSidebarElement from './left_sidebar_element';

describe('LeftSidebarElement', () => {
    let container: HTMLDivElement;
    let root: Root;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        root = createRoot(container);
    });

    // OverlayTrigger portals the tooltip outside the container, so unmount rather than just
    // dropping the container, or the next document-wide query finds a stale tooltip.
    const cleanup = async () => {
        await act(async () => {
            root.unmount();
        });
        container.remove();
    };

    afterEach(cleanup);

    const renderAndHover = async () => {
        await act(async () => {
            root.render(
                <LeftSidebarElement
                    id={'merge-thread'}
                    text={'Merging Thread'}
                    tooltip={<span>{'Howdy Partner!'}</span>}
                    clickHandler={jest.fn()}
                />,
            );
        });

        const trigger = container.querySelector('.wrangler-left-sidebar-wrapper');
        await act(async () => {
            trigger!.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
        });

        const tooltips = document.querySelectorAll('[role="tooltip"]');
        expect(tooltips).toHaveLength(1);

        return tooltips[0];
    };

    // React 19 ignores defaultProps on react-bootstrap's forwardRef components, which silently
    // strips the bsClass prefix and leaves the tooltip unstyled. Assert the classes Bootstrap needs.
    test('renders the tooltip with the bootstrap classes that carry its styling', async () => {
        const tooltip = await renderAndHover();

        expect(tooltip.classList.contains('tooltip')).toBe(true);
        expect(tooltip.querySelector('.tooltip-inner')).not.toBeNull();
        expect(tooltip.querySelector('.tooltip-arrow')).not.toBeNull();
    });

    test('renders the tooltip content', async () => {
        const tooltip = await renderAndHover();

        expect(tooltip.querySelector('.tooltip-inner')!.textContent).toBe('Howdy Partner!');
    });
});
