import { ComponentProps, ReactNode } from 'react';
import { ScrollView, StyleProp, ViewStyle } from 'react-native';

export type LegendListProps<T> = Omit<ComponentProps<typeof ScrollView>, 'contentOffset'> & {
    data: ArrayLike<any> & T[];
    initialScrollOffset?: number;
    initialScrollIndex?: number;
    drawDistance?: number;
    initialContainers?: number;
    recycleItems?: boolean;
    onEndReachedThreshold?: number | null | undefined;
    maintainScrollAtEnd?: boolean;
    maintainScrollAtEndThreshold?: number;
    alignItemsAtEnd?: boolean;
    estimatedAverateItemLength: number;
    estimatedItemLength?: (index: number, item: T) => number;
    onEndReached?: ((info: { distanceFromEnd: number }) => void) | null | undefined;
    keyExtractor?: (item: T, index: number) => string;
    renderItem?: (props: LegendListRenderItemInfo<T>) => ReactNode;
    onViewableRangeChanged?: (range: ViewableRange<T>) => void;
    ListHeaderComponent?: ReactNode;
    ListHeaderComponentStyle?: StyleProp<ViewStyle> | undefined;
    ListFooterComponent?: ReactNode;
    ListFooterComponentStyle?: StyleProp<ViewStyle> | undefined;
    ItemSeparatorComponent?: ReactNode;
    //   TODO:
    //   onViewableItemsChanged?:
    //     | ((info: {
    //         viewableItems: Array<ViewToken<T>>;
    //         changed: Array<ViewToken<T>>;
    //       }) => void)
    //     | null
    //     | undefined;
};

export interface ViewableRange<T> {
    startBuffered: number;
    start: number;
    endBuffered: number;
    end: number;
    items: T[];
}

export interface LegendListRenderItemInfo<ItemT> {
    item: ItemT;
    index: number;
}
