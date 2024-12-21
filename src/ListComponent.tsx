import type { ReactNode } from "react";
import * as React from "react";
import {
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    type ScrollView,
    View,
} from "react-native";
import { $ScrollView} from "./$ScrollView";
import { $View } from "./$View";
import { Containers } from "./Containers";
import { peek$, useStateContext } from "./state";
import type { LegendListProps } from "./types";

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
    refScroller: React.MutableRefObject<ScrollView>;
    getRenderedItem: (key: string, containerId: number) => ReactNode;
    updateItemSize: (key: string, size: number) => void;
    handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onLayout: (event: LayoutChangeEvent) => void;

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
    refScroller,
    ...rest
}: ListComponentProps) {
    const ctx = useStateContext();

    return (
        <$ScrollView
            {...rest}
            style={style}
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
            ref={refScroller}
        >
         
            {alignItemsAtEnd && <$View $key="paddingTop" $style={() => ({ height: peek$(ctx, "paddingTop") })} />}
            {/* {ListHeaderComponent && (
                <$View
                    $key="scrollAdjust"
                    $style={() =>
                        StyleSheet.compose(ListHeaderComponentStyle, { top: peek$<number>(ctx, "scrollAdjust") })
                    }
                    onLayout={(event) => {
                        const size = event.nativeEvent.layout[horizontal ? "width" : "height"];
                        const prevSize = peek$<number>(ctx, "headerSize") || 0;
                        if (size !== prevSize) {
                            set$(ctx, "headerSize", size);
                        }
                    }}
                >
                    {getComponent(ListHeaderComponent)}
                </$View>
            )}
            {ListEmptyComponent && (
                <$View
                    $key="scrollAdjust"
                    $style={() =>
                        StyleSheet.compose(ListEmptyComponentStyle, { top: peek$<number>(ctx, "scrollAdjust") })
                    }
                >
                    {getComponent(ListEmptyComponent)}
                </$View>
            )} */}

            <Containers
                horizontal={horizontal!}
                recycleItems={recycleItems!}
                getRenderedItem={getRenderedItem}
                ItemSeparatorComponent={ItemSeparatorComponent && getComponent(ItemSeparatorComponent)}
                updateItemSize={updateItemSize}
            />
            {ListFooterComponent && <View style={ListFooterComponentStyle}>{getComponent(ListFooterComponent)}</View>}
          
        </$ScrollView>
    );
});
