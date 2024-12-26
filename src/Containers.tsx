import * as React from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { Container } from "./Container";
import { use$, useStateContext } from "./state";
import { useValue$ } from "./useValue$";

interface ContainersProps {
    horizontal: boolean;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ReactNode;
    updateItemSize: (containerId: number, itemKey: string, size: number) => void;
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
    const totalSize = useValue$("totalSize");
    const adjustTop = useValue$("scrollAdjustTop");
    const adjustBottom = useValue$("scrollAdjustBottom");

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
                ItemSeparatorComponent={ItemSeparatorComponent}
            />,
        );
    }

    const additionalSize = { marginTop: adjustTop };

    const style: StyleProp<ViewStyle> = horizontal
        ? { width: Animated.add(totalSize, adjustBottom), ...additionalSize }
        : { height: Animated.add(totalSize, adjustBottom), ...additionalSize };

    return <Animated.View style={style}>{containers}</Animated.View>;
});
