import * as React from "react";
import { $View } from "./$View";
import { Container } from "./Container";
import { peek$, use$, useStateContext } from "./state";

interface ContainersProps {
    horizontal: boolean;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ReactNode;
    updateItemSize: (key: string, size: number) => void;
    getRenderedItem: (key: string, containerId: number) => React.ReactNode;
}

export const Containers = React.memo(function Containers({
    horizontal,
    recycleItems,
    ItemSeparatorComponent,
    updateItemSize,
    getRenderedItem,
}: ContainersProps) {
    const ctx = useStateContext();
    const numContainers = use$<number>("numContainersPooled");

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
            $key="totalSize"
            $key2="scrollAdjustTop"
            $key3="scrollAdjustBottom"
            $style={() => {
                const adjustTop = peek$<number>(ctx, "scrollAdjustTop") || 0;
                const adjustBottom = peek$<number>(ctx, "scrollAdjustBottom") || 0;
                const size = peek$<number>(ctx, "totalSize");

                return horizontal
                    ? {
                          width: size,
                      }
                    : {
                        marginTop: adjustTop,
                        height: size,
                        marginBottom: adjustBottom, // it seems that changing marginTop and marginBottom at same point of time causes jerk
                        // It may be not really necessary to do this at same point of time,
                      };
            }}
        >
            {containers}
        </$View>
    );
});
