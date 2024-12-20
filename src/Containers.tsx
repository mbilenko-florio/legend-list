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
            $key2="scrollAdjust"
            $style={() => {
                const adjust = peek$<number>(ctx, "scrollAdjust");
                const size = peek$<number>(ctx, "totalSize");

                return horizontal
                    ? {
                          width: size,
                      }
                    : {
                        marginTop: adjust,
                        height: size,
                        marginBottom: -adjust,
                      };
            }}
        >
            {containers}
        </$View>
    );
});
