import * as React from 'react';
import { LayoutChangeEvent, View, ViewStyle } from 'react-native';
import { $View } from './$View';
import { peek$, use$, useStateContext } from './state';

export const Container = ({
    id,
    recycleItems,
    horizontal,
    getRenderedItem,
    onLayout,
    ItemSeparatorComponent,
}: {
    id: number;
    recycleItems?: boolean;
    horizontal: boolean;
    getRenderedItem: (index: number) => React.ReactNode;
    onLayout: (index: number, length: number) => void;
    ItemSeparatorComponent?: React.ReactNode;
}) => {
    const ctx = useStateContext();
    const numItems = ItemSeparatorComponent ? use$<number>('numItems') : 0;
    // Subscribe to the itemIndex so this re-renders when the itemIndex changes.
    const itemIndex = use$<number>(`containerIndex${id}`);

    if (itemIndex < 0) {
        return null;
    }

    const createStyle = (): ViewStyle => {
        const position = peek$(`containerPosition${id}`, ctx);
        return horizontal
            ? {
                  flexDirection: 'row',
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: position,
                  opacity: position < 0 ? 0 : 1,
              }
            : {
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  top: position,
                  opacity: position < 0 ? 0 : 1,
              };
    };

    const renderedItem = getRenderedItem(itemIndex);

    // Use a reactive View to ensure the container element itself
    // is not rendered when style changes, only the style prop.
    // This is a big perf boost to do less work rendering.
    return (
        <$View
            $key={`containerPosition${id}`}
            $style={createStyle}
            onLayout={(event: LayoutChangeEvent) => {
                const index = peek$(`containerIndex${id}`, ctx);
                const length = Math.round(event.nativeEvent.layout[horizontal ? 'width' : 'height']);

                onLayout(index, length);
            }}
        >
            {recycleItems ? renderedItem : <React.Fragment key={itemIndex}>{renderedItem}</React.Fragment>}
            {ItemSeparatorComponent && itemIndex < numItems - 1 && ItemSeparatorComponent}
        </$View>
    );
};
