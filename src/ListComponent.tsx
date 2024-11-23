import * as React from 'react';
import { ReactNode } from 'react';
import {
    LayoutChangeEvent,
    NativeScrollEvent,
    NativeSyntheticEvent,
    ScrollView,
    StyleProp,
    View,
    ViewStyle,
} from 'react-native';
import { $View } from './$View';
import { Containers } from './Containers';
import { peek$, useStateContext } from './state';
import type { LegendListProps } from './types';

interface ListComponentProps
    extends Omit<
        LegendListProps<any>,
        'data' | 'estimatedItemLength' | 'drawDistance' | 'maintainScrollAtEnd' | 'maintainScrollAtEndThreshold'
    > {
    style: StyleProp<ViewStyle>;
    contentContainerStyle: StyleProp<ViewStyle>;
    horizontal: boolean;
    initialContentOffset: number | undefined;
    refScroller: React.MutableRefObject<ScrollView>;
    getRenderedItem: (index: number) => ReactNode;
    updateItemLength: (index: number, length: number) => void;
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
    getRenderedItem,
    updateItemLength,
    refScroller,
    ...rest
}: ListComponentProps) {
    const ctx = useStateContext();

    return (
        <ScrollView
            {...rest}
            style={style}
            contentContainerStyle={[
                contentContainerStyle,
                horizontal
                    ? {
                          height: '100%',
                      }
                    : {},
            ]}
            onScroll={handleScroll}
            onLayout={onLayout}
            scrollEventThrottle={32}
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
            {alignItemsAtEnd && <$View $key="paddingTop" $style={() => ({ height: peek$(ctx, 'paddingTop') })} />}
            {ListHeaderComponent && <View style={ListHeaderComponentStyle}>{getComponent(ListHeaderComponent)}</View>}
            {/* {supportsEstimationAdjustment && (
                <Reactive.View
                    $style={() => ({
                        height: visibleRange$.topPad.get(),
                        width: '100%',
                    })}
                />
            )} */}

            <Containers
                horizontal={horizontal!}
                recycleItems={recycleItems!}
                getRenderedItem={getRenderedItem}
                ItemSeparatorComponent={ItemSeparatorComponent && getComponent(ItemSeparatorComponent)}
                updateItemLength={updateItemLength}
            />
            {ListFooterComponent && <View style={ListFooterComponentStyle}>{getComponent(ListFooterComponent)}</View>}
        </ScrollView>
    );
});
