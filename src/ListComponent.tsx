import type { ReactNode } from "react";
import * as React from "react";
import {
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    View,
} from "react-native";
import Animated, { runOnJS, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { Containers } from "./Containers";
import { peek$, set$, useStateContext } from "./state";
import type { LegendListProps } from "./types";
import { useValue$ } from "./useValue$";

interface ListComponentProps
    extends Omit<
        LegendListProps<any>,
        | "data"
        | "estimatedItemSize"
        | "drawDistance"
        | "maintainScrollAtEnd"
        | "maintainScrollAtEndThreshold"
        | "maintainVisibleContentPosition"
    > {
    horizontal: boolean;
    initialContentOffset: number | undefined;
    refScrollView: React.Ref<Animated.ScrollView>;
    getRenderedItem: (key: string, containerId: number) => ReactNode;
    updateItemSize: (containerId: number, itemKey: string, size: number) => void;
    handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onLayout: (event: LayoutChangeEvent) => void;
    maintainVisibleContentPosition: boolean;
}

const getComponent = (Component: React.ComponentType<any> | React.ReactElement) => {
    if (React.isValidElement<any>(Component)) {
        return Component;
    }
    if (Component) {
        return <Component />;
    }
    return null;
};

export const ListComponent = React.memo(function ListComponent({
    style,
    contentContainerStyle,
    horizontal,
    initialContentOffset,
    recycleItems,
    ItemSeparatorComponent,
    alignItemsAtEnd,
    waitForInitialLayout,
    handleScroll,
    onLayout,
    ListHeaderComponent,
    ListHeaderComponentStyle,
    ListFooterComponent,
    ListFooterComponentStyle,
    ListEmptyComponent,
    ListEmptyComponentStyle,
    getRenderedItem,
    updateItemSize,
    refScrollView,
    maintainVisibleContentPosition,
    ...rest
}: ListComponentProps) {
    const ctx = useStateContext();
    const animPaddingTop = useValue$("paddingTop");
    const animScrollAdjust = useValue$("scrollAdjust");


    const scrollBrakePosition = useSharedValue<{ engaged: boolean; value: number }>({ engaged: false, value: 0 });
    // const scrollOffset = useScrollViewOffset(refScrollView);

    // scrollOffset.addListener((event) => {
    //     handleScroll({ nativeEvent: event });
    // });

    const animatedScrollHandler = useAnimatedScrollHandler((event) => {
        const offset = event.contentOffset.y;
        const velocity = event.velocity.y;
        //console.log(event.velocity.y);
        runOnJS(handleScroll)({ nativeEvent: event });

        // if (velocity > 20 && !scrollBrakePosition.value.engaged) {
        //     const val = scrollBrakePosition.value.value + 5;

        //     // scrollBrakePosition.modify((prev) => {
        //     //     val = prev + 200;
        //     //     return { engaged: trure, value: val };
        //     // });
        //     scrollBrakePosition.value = {
        //         ...{
        //             engaged: true,
        //             value: val,
        //         },
        //     };
        //     console.log("engaging brake", val);
        //     scrollBrake.value = withTiming(val, { duration: 500 }, () => {
        //         scrollBrakePosition.value = {
        //             ...{
        //                 ...scrollBrakePosition.value,
        //                 engaged: false,
        //             },
        //         };
        //     });
        // }

        // if (offset + scrollHeight > lastLaidOutCoordinate.value) {
        //     const blankingAmount = offset + scrollHeight - lastLaidOutCoordinate.value;
        //     //console.log(offset+scrollHeight,lastLaidOutCoordinate.value)
        //     if (blankingAmount > 2000) {
        //         console.log("blanking!", blankingAmount);
        //         scrollBrake.value = withTiming(1000)
        //     }
        // }
    });


    const additionalSize = useAnimatedStyle(() => {
        // console.log("animScrollAdjust", scrollBrake.value);
        return { marginTop: animScrollAdjust.value, paddingTop: animPaddingTop.value };
    });

    return (
        <Animated.ScrollView
            {...rest}
            style={style}
            maintainVisibleContentPosition={maintainVisibleContentPosition ? { minIndexForVisible: 0 } : undefined}
            contentContainerStyle={[
                contentContainerStyle,
                horizontal
                    ? {
                          height: "100%",
                      }
                    : {},
            ]}
            onScroll={handleScroll}
            onLayout={onLayout}
            horizontal={horizontal}
            contentOffset={
                initialContentOffset
                    ? horizontal
                        ? { x: initialContentOffset, y: 0 }
                        : { x: 0, y: initialContentOffset }
                    : undefined
            }
            ref={refScrollView}
        >
            <Animated.View style={additionalSize} />
            {ListHeaderComponent && (
                <Animated.View
                    style={ListHeaderComponentStyle}
                    onLayout={(event) => {
                        const size = event.nativeEvent.layout[horizontal ? "width" : "height"];
                        const prevSize = peek$<number>(ctx, "headerSize") || 0;
                        if (size !== prevSize) {
                            set$(ctx, "headerSize", size);
                        }
                    }}
                >
                    {getComponent(ListHeaderComponent)}
                </Animated.View>
            )}
            {ListEmptyComponent && (
                <Animated.View style={ListEmptyComponentStyle}>{getComponent(ListEmptyComponent)}</Animated.View>
            )}

            <Containers
                horizontal={horizontal!}
                recycleItems={recycleItems!}
                waitForInitialLayout={waitForInitialLayout}
                getRenderedItem={getRenderedItem}
                ItemSeparatorComponent={ItemSeparatorComponent && getComponent(ItemSeparatorComponent)}
                updateItemSize={updateItemSize}
            />
            {ListFooterComponent && <View style={ListFooterComponentStyle}>{getComponent(ListFooterComponent)}</View>}
        </Animated.ScrollView>
    );
});
