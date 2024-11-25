import * as React from 'react';
import { $View } from './$View';
import { Container } from './Container';
import { peek$, use$, useStateContext } from './state';

interface ContainersProps {
    horizontal: boolean;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ReactNode;
    updateItemSize: (index: number, length: number) => void;
    getRenderedItem: (index: number) => React.ReactNode;
}

export const Containers = React.memo(function Containers({
    horizontal,
    recycleItems,
    ItemSeparatorComponent,
    updateItemSize,
    getRenderedItem,
}: ContainersProps) {
    const ctx = useStateContext();
    const numContainers = use$<number>('numContainers');

    const containers = [];
    for (let i = 0; i < numContainers; i++) {
        containers.push(
            <Container
                id={i}
                key={i}
                recycleItems={recycleItems}
                horizontal={horizontal}
                getRenderedItem={getRenderedItem}
                onLayout={updateItemSize}
                ItemSeparatorComponent={ItemSeparatorComponent}
            />,
        );
    }

    return (
        <$View
            $key="totalLength"
            $style={() =>
                horizontal
                    ? {
                          width: peek$(ctx, 'totalLength'),
                      }
                    : {
                          height: peek$(ctx, 'totalLength'),
                      }
            }
        >
            {containers}
        </$View>
    );
});
