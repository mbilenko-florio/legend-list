
import { use$ } from "../state";
import { useValue$ } from "../useValue$";
import { AutoLayoutView, CellContainer } from "flashlist-autolayout";
import React from "react";
import { Animated, Dimensions, StyleProp, View, ViewStyle } from "react-native";
import { Container } from "./Container";

const AutoLayoutViewAnimated = Animated.createAnimatedComponent(AutoLayoutView);

interface ContainersProps {
    horizontal: boolean;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ReactNode;
    updateItemSize: (containerId: number, itemKey: string, size: number) => void;
    updateItemPosition: (index: number, y: number, size: number) => void;
    getRenderedItem: (key: string, containerId: number) => React.ReactNode;
    allContainersUpdated: () => void;
    SkeletonComponent?: React.ComponentType<any> | React.ReactElement | null | undefined;
}

export const FlashListContainers = React.memo(function Containers({
    horizontal,
    recycleItems,
    ItemSeparatorComponent,
    updateItemPosition,
    allContainersUpdated,
    getRenderedItem,
    SkeletonComponent,
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
                // specifying inline separator makes Containers rerender on each data change
                // should we do memo of ItemSeparatorComponent?
                ItemSeparatorComponent={ItemSeparatorComponent}
            />,
        );
    }

    if (SkeletonComponent) {
    containers.push(  <CellContainer
        style={{position: "absolute", top: 100000, left: 0, right: 0}}
        index={100000}
        key={'container'}
       >
            <SkeletonComponent />
       </CellContainer>
    );
    containers.push(  <CellContainer
        style={{position: "absolute", top: 100300, left: 0, right: 0}}
        index={100001}
        key={'container2'}
       >
            <SkeletonComponent />
       </CellContainer>
    );
    containers.push(  <CellContainer
        style={{position: "absolute", top: 100600, left: 0, right: 0}}
        index={100002}
        key={'container3'}
       >
            <SkeletonComponent />
       </CellContainer>
    );
}

    const style: StyleProp<ViewStyle> = horizontal ? { width: animSize } : { height: animSize };

    return (
        <AutoLayoutViewAnimated
            style={style}
            disableAutoLayout={false}
            onBlankAreaEvent={(evt) => {
                // console.log("Blank area event", evt);
            }}
            onLayout={(p) => {
                //console.log("layout", p.nativeEvent.layout);
            }}
            windowSize={709}
            onAutoLayout={(evt) => {
                // does this really make sense?
                // onLayout comes much earlier
                // is there case where layout events come out of order?
                // console.log("Auto layout event", evt);
                for (let i=0;i<evt.layouts.length;i++) {
                    const { key, y, height } = evt.layouts[i];
                    updateItemPosition(key, y, height);
                }
                allContainersUpdated();
            }}
        >
            {containers}
        </AutoLayoutViewAnimated>
    );
});

