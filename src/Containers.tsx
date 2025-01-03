import * as React from "react";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { Container } from "./Container";
import { use$ } from "./state";
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
    const numContainers = use$<number>("numContainersPooled");
    const animSize = useValue$("totalSize");

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

     const style = useAnimatedStyle(() => {
        return horizontal ? { width: animSize.value } : { height: animSize.value };
     });
   

    return <Animated.View style={style}>{containers}</Animated.View>;
});
