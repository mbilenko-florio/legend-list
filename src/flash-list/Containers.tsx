import * as React from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { Container } from "./Container";
import { use$ } from "../state";
import { useValue$ } from "../useValue$";
import { AutoLayoutView } from "flashlist-autolayout";

const AutoLayoutViewAnimated = Animated.createAnimatedComponent(AutoLayoutView);

interface ContainersProps {
    horizontal: boolean;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ReactNode;
    updateItemSize: (containerId: number, itemKey: string, size: number) => void;
    getRenderedItem: (key: string, containerId: number) => React.ReactNode;
}

export const FlashListContainers = React.memo(function Containers({
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
                // specifying inline separator makes Containers rerender on each data change
                // should we do memo of ItemSeparatorComponent?
                ItemSeparatorComponent={ItemSeparatorComponent}
            />,
        );
    }

    const style: StyleProp<ViewStyle> = horizontal ? { width: animSize } : { height: animSize };

    return  <AutoLayoutViewAnimated
    style={style}
    disableAutoLayout={false}
    onBlankAreaEvent={(evt) => {
       // console.log("Blank area event", evt);
    }}
    onLayout={(p) => {
       console.log("layout", p.nativeEvent.layout);
    }}
    windowSize={709}
>
    {containers}
</AutoLayoutViewAnimated>
});
