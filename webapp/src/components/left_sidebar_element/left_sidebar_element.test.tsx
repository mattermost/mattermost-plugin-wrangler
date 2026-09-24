import React, {act} from 'react';
import {createRoot} from 'react-dom/client';

import LeftSidebarElement from './left_sidebar_element';

describe('LeftSidebarElement', () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    const renderAndHover = async () => {
        const root = createRoot(container);

        await act(async () => {
            root.render(
                <LeftSidebarElement
                    id={'merge-thread'}
                    text={'Merging Thread'}
                    tooltip={<span>{'Howdy Partner!'}</span>}
                    clickHandler={() => {}}
                />,
            );
        });

        const trigger = container.querySelector('.wrangler-left-sidebar-wrapper');
        await act(async () => {
            trigger!.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
        });

        return document.querySelector('[role="tooltip"]');
    };

    // React 19 ignores defaultProps on react-bootstrap's forwardRef components, which silently
    // strips the bsClass prefix and leaves the tooltip unstyled. Assert the classes Bootstrap needs.
    test('renders the tooltip with the bootstrap classes that carry its styling', async () => {
        const tooltip = await renderAndHover();

        expect(tooltip).not.toBeNull();
        expect(tooltip!.classList.contains('tooltip')).toBe(true);
        expect(tooltip!.querySelector('.tooltip-inner')).not.toBeNull();
        expect(tooltip!.querySelector('.tooltip-arrow')).not.toBeNull();
    });

    test('renders the tooltip content', async () => {
        const tooltip = await renderAndHover();

        expect(tooltip!.querySelector('.tooltip-inner')!.textContent).toBe('Howdy Partner!');
    });
});
