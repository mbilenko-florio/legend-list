
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

    containers.push(  <CellContainer
        style={{position: "absolute", top: 100000, left: 0, right: 0}}
        index={100000}
        key={'container'}
       >
            <PlaceHolder />
       </CellContainer>
    );

    const style: StyleProp<ViewStyle> = horizontal ? { width: animSize } : { height: animSize };

    return (
        <AutoLayoutViewAnimated
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
    );
});
const PlaceHolder = () => {
    return (
        
            <View style={{height: 300, borderRadius: 10, backgroundColor: 'white', margin:10, padding:8 }} >
                <View style={ {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
        backgroundColor: 'lightgrey'
    }}></View>
                <View style={{height: 40, backgroundColor: 'lightgrey', margin: 10}} />
                <View style={{height: 40, backgroundColor: 'lightgrey', margin: 10}} />
                <View style={{height: 40, backgroundColor: 'lightgrey', margin: 10}} />
                <View style={{height: 40, backgroundColor: 'lightgrey', margin: 10}} />
            </View>

    );
};
