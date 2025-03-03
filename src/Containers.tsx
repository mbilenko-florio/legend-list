import * as React from "react";
import {} from "react-native";
import { $View } from "./$View";
import { Container } from "./Container";
import { peek$, use$, useStateContext } from "./state";

interface ContainersProps {
    horizontal: boolean;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ReactNode;
    waitForInitialLayout: boolean | undefined;
    updateItemSize: (containerId: number, itemKey: string, size: number) => void;
    getRenderedItem: (key: string) => { index: number; renderedItem: React.ReactNode } | null;
}

export const Containers = React.memo(function Containers({
    horizontal,
    recycleItems,
    ItemSeparatorComponent,
    waitForInitialLayout,
    updateItemSize,
    getRenderedItem,
}: ContainersProps) {
    const ctx = useStateContext();
    const numContainers = use$<number>("numContainersPooled");
    // const animSize = useValue$("totalSize", undefined, /*useMicrotask*/ true);
    // const animOpacity = waitForInitialLayout ? useValue$("containersDidLayout", (value) => (value ? 1 : 0)) : undefined;

    const containers = [];
    for (let i = 0; i < numContainers; i++) {
        containers.push(
            <Container
                id={i}
                key={i}
                recycleItems={recycleItems}
                horizontal={horizontal}
                getRenderedItem={getRenderedItem}
                updateItemSize={updateItemSize}
                // specifying inline separator makes Containers rerender on each data change
                // should we do memo of ItemSeparatorComponent?
                ItemSeparatorComponent={ItemSeparatorComponent}
            />,
        );
    }

    return (
        <$View
            $key={"totalSize"}
            $style={() => {
                const size = peek$<number>(ctx, "totalSize");
                return horizontal ? { width: size } : { height: size };
            }}
        >
            {containers}
        </$View>
    );
});
